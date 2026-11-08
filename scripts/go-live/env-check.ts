/// <reference types="node" />
/**
 * Which environment variables StudyFlow needs, and whether an env file has them.
 *
 * The list is not kept by hand: it is collected on every run from .env.example, the secrets
 * table in analysis/security_review.md (§5), the Edge Function code (Deno.env.get / env()),
 * the app code (process.env.*), supabase/config.toml (env(...)) and the GitHub workflows
 * (vars.* / secrets.*). RULES only adds what each key is for and how to check a value; a key
 * found in the code without a rule is treated as required, so a new key cannot slip through.
 */

import fs from 'node:fs';
import path from 'node:path';

import { LEGAL_VERSION } from '../../src/features/legal/texts';

export const ROOT = path.resolve(__dirname, '../..');

/** app: EAS environment variables · supabase: function secrets and CLI settings · github: repo settings. */
export type Target = 'app' | 'supabase' | 'github';
/** platform: set by Supabase itself · local: development only, not needed for a release. */
export type Level = 'required' | 'recommended' | 'optional' | 'platform' | 'local';

type Rule = {
  target: Target;
  level: Level;
  note: string;
  /** Returns a problem (never the value itself) or null. */
  validate?: (value: string) => string | null;
  /** A value that must never be used in a release. */
  forbid?: (value: string) => string | null;
  /** Needed by the go-live scripts themselves, so listed even when no code mentions it. */
  always?: boolean;
};

const isHttps = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname);
  } catch {
    return false;
  }
};
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

const httpsUrl = (value: string) => (isHttps(value) ? null : 'must be an https URL that is not this machine');
const email = (value: string) => (EMAIL_RE.test(value) ? null : 'must be an e-mail address');
const minLength = (n: number) => (value: string) => (value.length >= n ? null : `must be at least ${n} characters`);
const prefix = (start: string) => (value: string) => (value.startsWith(start) ? null : `should start with "${start}"`);

function jwtRole(value: string): string | null {
  const part = value.split('.')[1];
  if (!part) return null;
  try {
    const payload = JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as {
      role?: unknown;
    };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export const RULES: Record<string, Rule> = {
  // App (public values, inlined into the JS bundle)
  EXPO_PUBLIC_SUPABASE_URL: {
    target: 'app',
    level: 'required',
    note: 'Supabase project URL (EU). Without it the app runs in local mode, which release builds refuse.',
    validate: (v) => httpsUrl(v) ?? (/\.supabase\.(co|in)\/?$/.test(v) ? null : 'should be https://<ref>.supabase.co'),
  },
  EXPO_PUBLIC_SUPABASE_ANON_KEY: {
    target: 'app',
    level: 'required',
    note: 'Public anon (or publishable) key. Never the service role key.',
    validate: (v) =>
      jwtRole(v) === 'service_role' || v.startsWith('sb_secret_') ? 'is a service role / secret key: use the anon key' : null,
  },
  EXPO_PUBLIC_REVENUECAT_IOS_KEY: {
    target: 'app',
    level: 'required',
    note: 'RevenueCat public iOS SDK key (Project settings › API keys).',
    validate: prefix('appl_'),
  },
  EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: {
    target: 'app',
    level: 'optional',
    note: 'RevenueCat Android key; needed from the Android release (R2a).',
    validate: prefix('goog_'),
  },
  EXPO_PUBLIC_CONSENT_WEB_URL: {
    target: 'app',
    level: 'required',
    note: 'Parent consent page; same value as the CONSENT_WEB_URL function secret.',
    validate: httpsUrl,
  },
  EXPO_PUBLIC_SUPPORT_EMAIL: { target: 'app', level: 'required', note: 'Support address shown in the app.', validate: email },
  EXPO_PUBLIC_AI_DEV_URL: { target: 'app', level: 'local', note: 'Local-mode AI server only (npm run ai:dev).' },
  EAS_PROJECT_ID: {
    target: 'github',
    level: 'required',
    note: 'EAS project id from `eas init`: repo variable for preview.yml, and exported in the shell before eas build/update.',
    validate: (v) => (/^[0-9a-f-]{36}$/i.test(v) ? null : 'should be the UUID that `eas init` prints'),
  },

  // Edge Function secrets (`supabase secrets set`)
  ANTHROPIC_API_KEY: {
    target: 'supabase',
    level: 'required',
    note: 'AI processing (process-document).',
    validate: prefix('sk-ant-'),
  },
  AI_MODEL: { target: 'supabase', level: 'optional', note: 'Defaults to claude-opus-5-5 (ADR-002).' },
  AI_MONTHLY_BUDGET_USD: {
    target: 'supabase',
    level: 'recommended',
    note: 'Monthly AI budget; the team is warned at 80% (AIQ-07, ops-alerts).',
    validate: (v) => (Number(v) > 0 ? null : 'must be a positive number of US dollars'),
  },
  RESEND_API_KEY: { target: 'supabase', level: 'required', note: 'Transactional e-mail (ADR-004).', validate: prefix('re_') },
  EMAIL_FROM: {
    target: 'supabase',
    level: 'required',
    note: 'Sender on the verified Resend domain, e.g. StudyFlow <no-reply@studyflow.app>.',
    validate: (v) => (/<[^\s@<>]+@[^\s@<>]+>$/.test(v) || EMAIL_RE.test(v) ? null : 'must be "Name <address>" or an address'),
  },
  EMAIL_REPLY_TO: { target: 'supabase', level: 'recommended', note: 'Reply-To for e-mails (support address).', validate: email },
  EMAIL_PROVIDER: {
    target: 'supabase',
    level: 'optional',
    note: 'Defaults to resend.',
    forbid: (v) => (v.toLowerCase() === 'console' ? '"console" only logs e-mails: use resend (or leave it unset)' : null),
  },
  EMAIL_CONSOLE_BODY: {
    target: 'supabase',
    level: 'local',
    note: 'Local testing only: prints one-time links to the logs.',
    forbid: (v) => (v === '1' ? 'prints one-time consent links to the logs: remove it' : null),
  },
  SUPPORT_TEAM_EMAIL: { target: 'supabase', level: 'required', note: 'Team inbox for support tickets.', validate: email },
  OPS_ALERT_EMAIL: {
    target: 'supabase',
    level: 'recommended',
    note: 'Inbox for ops alerts (ops-alerts); without it alerts only reach the function log.',
    validate: email,
  },
  CONSENT_WEB_URL: {
    target: 'supabase',
    level: 'required',
    note: 'Parent consent page used in consent e-mails, e.g. https://studyflow.app/veli-onayi/.',
    validate: (v) => httpsUrl(v) ?? (v.endsWith('/') ? null : 'should end with "/" (avoids a redirect on static hosts)'),
  },
  CONSENT_TEXT_VERSION: {
    target: 'supabase',
    level: 'optional',
    note: `Consent text version; defaults to 1.0 and must equal LEGAL_VERSION (${LEGAL_VERSION}).`,
    validate: (v) => (v === LEGAL_VERSION ? null : `must equal LEGAL_VERSION in src/features/legal/texts.ts (${LEGAL_VERSION})`),
  },
  CORS_ALLOWED_ORIGIN: {
    target: 'supabase',
    level: 'required',
    note: 'Origin of the web pages, e.g. https://studyflow.app (no path).',
    validate: (v) => httpsUrl(v) ?? (new URL(v).origin === v ? null : 'must be an origin only: https://host, no path or slash'),
  },
  CRON_SECRET: {
    target: 'supabase',
    level: 'required',
    note: 'Shared with Vault cron_secret (pg_cron → consent-maintenance).',
    validate: minLength(32),
  },
  REVENUECAT_WEBHOOK_SECRET: {
    target: 'supabase',
    level: 'required',
    note: 'Same value as the Authorization header in the RevenueCat webhook.',
    validate: minLength(24),
  },
  TELEMETRY_HASH_SALT: {
    target: 'supabase',
    level: 'required',
    note: 'Random secret for the telemetry rate-limit key (ADR-006); 32+ random characters suggested.',
    validate: minLength(16),
  },
  EXPO_ACCESS_TOKEN: {
    target: 'supabase',
    level: 'optional',
    note: 'Needed only if Expo push security is turned on.',
  },
  APPLE_TEAM_ID: {
    target: 'supabase',
    level: 'required',
    note: 'Apple team id (Sign in with Apple revoke on deletion, 5.1.1(v)).',
    validate: (v) => (/^[A-Z0-9]{10}$/.test(v) ? null : 'should be 10 letters/digits'),
  },
  APPLE_KEY_ID: {
    target: 'supabase',
    level: 'required',
    note: 'Id of the Sign in with Apple key (.p8).',
    validate: (v) => (/^[A-Z0-9]{10}$/.test(v) ? null : 'should be 10 letters/digits'),
  },
  APPLE_PRIVATE_KEY: {
    target: 'supabase',
    level: 'required',
    note: 'Contents of the .p8 file.',
    validate: (v) => (v.includes('BEGIN PRIVATE KEY') ? null : 'should be the whole .p8 file (BEGIN PRIVATE KEY …)'),
  },
  APPLE_CLIENT_ID: {
    target: 'supabase',
    level: 'required',
    note: 'The iOS bundle id.',
    validate: (v) => (v === 'com.cobanov.studyflow' ? null : 'should be the bundle id com.cobanov.studyflow'),
  },
  SUPABASE_URL: { target: 'supabase', level: 'platform', note: 'Set by Supabase for every function.' },
  SUPABASE_ANON_KEY: { target: 'supabase', level: 'platform', note: 'Set by Supabase for every function.' },
  SUPABASE_SERVICE_ROLE_KEY: { target: 'supabase', level: 'platform', note: 'Set by Supabase for every function.' },
  SUPABASE_DB_URL: { target: 'supabase', level: 'platform', note: 'Set by Supabase for every function.' },

  // Supabase CLI settings used by scripts/go-live/supabase-setup.sh (not function secrets)
  SUPABASE_PROJECT_REF: {
    target: 'supabase',
    level: 'required',
    note: 'Project ref (20 letters) of the EU project, for supabase link.',
    always: true,
    validate: (v) => (/^[a-z]{20}$/.test(v) ? null : 'should be the 20-letter project ref'),
  },
  SUPABASE_ACCESS_TOKEN: {
    target: 'supabase',
    level: 'recommended',
    note: 'Personal access token for the CLI (or run `supabase login`). Also a GitHub environment secret.',
  },
  SUPABASE_DB_PASSWORD: {
    target: 'supabase',
    level: 'recommended',
    note: 'Database password (the CLI asks for it otherwise). Also a GitHub environment secret.',
  },
  SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID: {
    target: 'supabase',
    level: 'required',
    note: 'Read by config.toml on `supabase config push`: the bundle id com.cobanov.studyflow.',
    validate: (v) => (v.split(',').includes('com.cobanov.studyflow') ? null : 'must include com.cobanov.studyflow'),
  },
  SUPABASE_AUTH_EXTERNAL_APPLE_SECRET: {
    target: 'supabase',
    level: 'optional',
    note: 'Only for the web OAuth flow; the app signs in natively.',
  },

  // GitHub repository settings (listed, not read)
  SUPABASE_PROJECT_ID: { target: 'github', level: 'required', note: 'Environment variable in staging/production (supabase.yml).' },
  SUPABASE_DEPLOY: { target: 'github', level: 'optional', note: 'Repo variable: "true" turns on supabase.yml.' },
  EAS_PREVIEW: { target: 'github', level: 'optional', note: 'Repo variable: "true" turns on preview.yml.' },
  WEB_DEPLOY: { target: 'github', level: 'optional', note: 'Repo variable: "true" turns on web.yml (GitHub Pages).' },
  EXPO_TOKEN: { target: 'github', level: 'required', note: 'Repo secret for preview.yml (expo.dev › Access tokens).' },
  GITLEAKS_LICENSE: { target: 'github', level: 'optional', note: 'Only for organization repos.' },
  GITHUB_TOKEN: { target: 'github', level: 'platform', note: 'Provided by GitHub Actions.' },
  WEB_FUNCTIONS_URL: { target: 'github', level: 'required', note: 'Repo variable for web.yml: production functions URL.' },
  WEB_STAGING_FUNCTIONS_URL: { target: 'github', level: 'optional', note: 'Repo variable for web.yml: staging functions URL.' },
  WEB_BASE_URL: { target: 'github', level: 'optional', note: 'Repo variable for web.yml: site address once the domain is set.' },
  WEB_APP_STORE_URL: { target: 'github', level: 'optional', note: 'Repo variable for web.yml: App Store link.' },
};

/** Set by the tools themselves, never by us. */
const BUILT_IN = new Set(['NODE_ENV', 'EXPO_OS', 'CI', 'JEST_WORKER_ID', 'HOME', 'PATH']);
const BUILT_IN_PREFIXES = ['EAS_BUILD', 'EXPO_ROUTER_', 'GITHUB_', 'RUNNER_'];

export type Found = { name: string; sources: Set<string> };

function walk(dir: string, match: (file: string) => boolean, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, match, out);
    else if (match(full)) out.push(full);
  }
  return out;
}

const read = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');

/** Every variable name the repository mentions, with where it was found. */
export function discoverKeys(root: string = ROOT): Map<string, Found> {
  const found = new Map<string, Found>();
  const add = (name: string, source: string) => {
    if (BUILT_IN.has(name) || BUILT_IN_PREFIXES.some((p) => name.startsWith(p)) || name.endsWith('_')) return;
    const item = found.get(name) ?? { name, sources: new Set<string>() };
    item.sources.add(source);
    found.set(name, item);
  };
  const rel = (file: string) => path.relative(root, file);

  // .env.example, including commented-out keys.
  for (const match of read(path.join(root, '.env.example')).matchAll(/^\s*#?\s*([A-Z][A-Z0-9_]*)=/gm)) {
    add(match[1], '.env.example');
  }

  // Security review §5 (secrets table and the non-secret configuration line).
  const review = read(path.join(root, 'analysis', 'security_review.md'));
  const section = /^## 5\.[^\n]*\n([\s\S]*?)(?=^## \d+\.)/m.exec(review)?.[1] ?? '';
  for (const match of section.matchAll(/`([A-Z][A-Z0-9_]{2,})`/g)) add(match[1], 'analysis/security_review.md §5');

  // Edge Functions.
  for (const file of walk(path.join(root, 'supabase', 'functions'), (f) => f.endsWith('.ts'))) {
    const code = read(file);
    for (const match of code.matchAll(/Deno\.env\.get\(\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\)/g)) add(match[1], rel(file));
    for (const match of code.matchAll(/\benv\(\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\)/g)) add(match[1], rel(file));
  }

  // App code and app config.
  const appFiles = [
    ...walk(path.join(root, 'src'), (f) => /\.(ts|tsx)$/.test(f)),
    ...['app.config.ts', 'app.config.js'].map((f) => path.join(root, f)).filter((f) => fs.existsSync(f)),
  ];
  for (const file of appFiles) {
    const code = read(file);
    for (const match of code.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) add(match[1], rel(file));
    for (const match of code.matchAll(/process\.env\[\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\]/g)) add(match[1], rel(file));
  }

  // supabase/config.toml env(...) references (read by `supabase config push`), comments skipped.
  const toml = read(path.join(root, 'supabase', 'config.toml'))
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
  for (const match of toml.matchAll(/env\(([A-Z][A-Z0-9_]*)\)/g)) add(match[1], 'supabase/config.toml');

  // GitHub workflows.
  for (const file of walk(path.join(root, '.github', 'workflows'), (f) => /\.ya?ml$/.test(f))) {
    for (const match of read(file).matchAll(/\b(?:vars|secrets)\.([A-Z][A-Z0-9_]*)/g)) add(match[1], rel(file));
  }

  return found;
}

export type KeyInfo = {
  name: string;
  target: Target;
  level: Level;
  note: string;
  sources: string[];
  /** No rule yet: found in the code and treated as required. */
  unclassified: boolean;
};

function inferTarget(found: Found): Target {
  const sources = [...found.sources];
  if (found.name.startsWith('EXPO_PUBLIC_')) return 'app';
  if (sources.some((s) => s.startsWith('.github'))) return 'github';
  if (sources.some((s) => s.startsWith('src') || s.startsWith('app.config'))) return 'app';
  return 'supabase';
}

export function describeKeys(found: Map<string, Found>): KeyInfo[] {
  const names = new Set([...found.keys(), ...Object.keys(RULES).filter((name) => RULES[name].always)]);
  const infos: KeyInfo[] = [];
  for (const name of [...names].sort()) {
    const item = found.get(name) ?? { name, sources: new Set<string>() };
    const rule = RULES[name];
    infos.push({
      name,
      target: rule?.target ?? inferTarget(item),
      level: rule?.level ?? 'required',
      note: rule?.note ?? 'Found in the code but not described in scripts/go-live/env-check.ts RULES yet.',
      sources: item.sources.size ? [...item.sources].sort() : rule?.always ? ['scripts/go-live'] : [],
      unclassified: !rule,
    });
  }
  return infos;
}

/** dotenv-style parser: KEY=value, quotes (multi-line in double quotes), comments, `export `. */
export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re =
    /^[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]*(?:"((?:\\[\s\S]|[^"\\])*)"|'([^']*)'|([^\n]*?))(?:[ \t]+#[^\n]*)?[ \t]*$/gm;
  for (const match of text.replace(/\r\n/g, '\n').matchAll(re)) {
    const [, key, doubleQuoted, singleQuoted, bare] = match;
    if (doubleQuoted !== undefined) {
      out[key] = doubleQuoted.replace(/\\n/g, '\n').replace(/\\(["\\])/g, '$1');
    } else if (singleQuoted !== undefined) {
      out[key] = singleQuoted;
    } else {
      out[key] = (bare ?? '').trim();
    }
  }
  return out;
}

export type Finding = {
  name: string;
  status: 'ok' | 'missing' | 'invalid' | 'warning' | 'ignored';
  message: string;
  info: KeyInfo;
};

export type CheckResult = { findings: Finding[]; errors: number; warnings: number };

/** Checks `env` against every key for `targets`. Messages never contain values. */
export function checkEnv(env: Record<string, string | undefined>, keys: KeyInfo[], targets: readonly Target[]): CheckResult {
  const findings: Finding[] = [];
  for (const info of keys) {
    if (!targets.includes(info.target)) continue;
    const rule = RULES[info.name];
    const value = env[info.name]?.trim() ?? '';
    const push = (status: Finding['status'], message: string) => findings.push({ name: info.name, status, message, info });

    if (info.level === 'platform') {
      if (value && info.target === 'supabase') push('ignored', 'set by Supabase; drop it from the secrets file');
      continue;
    }
    if (!value) {
      if (info.level === 'required') push('missing', info.note);
      else if (info.level === 'recommended') push('warning', `not set: ${info.note}`);
      continue;
    }
    const forbidden = rule?.forbid?.(value);
    if (forbidden) {
      push('invalid', forbidden);
      continue;
    }
    if (info.level === 'local') {
      push('ignored', 'development only; not used by release builds');
      continue;
    }
    let problem: string | null = null;
    try {
      problem = rule?.validate?.(value) ?? null;
    } catch {
      problem = 'could not be read';
    }
    if (problem) push(info.level === 'required' ? 'invalid' : 'warning', problem);
    else push('ok', info.note);
  }

  // Server secrets must never sit in the app's env (EXPO_PUBLIC_* goes into the bundle).
  if (targets.includes('app') && !targets.includes('supabase')) {
    for (const info of keys) {
      if (info.target !== 'supabase' || info.level === 'platform') continue;
      if (env[info.name]?.trim()) {
        findings.push({ name: info.name, status: 'warning', message: 'server secret in the app env: keep it out of EAS', info });
      }
    }
  }
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith('EXPO_PUBLIC_') || !value) continue;
    if (jwtRole(value) === 'service_role' || value.startsWith('sb_secret_') || value.startsWith('sk-ant-')) {
      const info: KeyInfo = { name, target: 'app', level: 'required', note: '', sources: [], unclassified: false };
      findings.push({ name, status: 'invalid', message: 'a secret in an EXPO_PUBLIC_ variable ends up in the app bundle', info });
    }
  }

  const errors = findings.filter((f) => f.status === 'missing' || f.status === 'invalid').length;
  const warnings = findings.filter((f) => f.status === 'warning').length;
  return { findings, errors, warnings };
}

#!/usr/bin/env node
/**
 * App bundle secret scan (US-68, SEC-02). Runs in CI next to gitleaks.
 *
 * 1. Looks for secrets in everything that can end up inside the app: src/, app.json and any
 *    exported bundle (dist/, web-build/, build/) if it exists.
 * 2. Fails when app code reads an environment variable that is not EXPO_PUBLIC_*: only those are
 *    inlined into the bundle on purpose, everything else is server-only.
 *
 * Usage: node scripts/check-secrets.mjs [extra paths...]   Exit code 1 on any finding.
 */

import { Buffer } from 'node:buffer';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const targets = ['src', 'app.json', 'dist', 'web-build', 'build', ...process.argv.slice(2)];
const textExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.html', '.map', '.hbc', '.txt', '.plist', '.xml']);
const skipDirs = new Set(['node_modules', '.git', '__tests__', 'coverage']);

/** Secrets that must never be in the app. */
const secretPatterns = [
  { name: 'Anthropic API key', re: /sk-ant-[A-Za-z0-9_-]{8,}/g },
  { name: 'Supabase secret key', re: /sb_secret_[A-Za-z0-9_-]{8,}/g },
  { name: 'Service role reference', re: /SUPABASE_SERVICE_ROLE[A-Z_]*/g },
  { name: 'Private key', re: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/g },
  { name: 'Resend API key', re: /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{12,}/g },
  { name: 'Secret API key (sk_)', re: /\bsk_(?:live|test)?_?[A-Za-z0-9]{24,}/g },
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{30,}/g },
  { name: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'Expo access token variable', re: /\bEXPO_TOKEN\b/g },
];

/** JWTs are fine when they are anon keys; a service_role JWT is a full-access key. */
const jwtPattern = /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;

/** Env vars the bundler inlines that are not secrets. */
const allowedEnv = new Set(['NODE_ENV', 'EXPO_OS', 'EXPO_ROUTER_APP_ROOT', 'EXPO_ROUTER_IMPORT_MODE', 'EXPO_BASE_URL']);
const envPattern = /process\.env(?:\.([A-Za-z_][A-Za-z0-9_]*)|\[\s*['"`]([A-Za-z_][A-Za-z0-9_]*)['"`]\s*\])/g;

function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(part, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function mask(value) {
  return value.length <= 12 ? `${value.slice(0, 4)}…` : `${value.slice(0, 8)}…${value.slice(-3)}`;
}

function* walk(path) {
  if (!existsSync(path)) return;
  const stat = statSync(path);
  if (stat.isFile()) {
    yield path;
    return;
  }
  for (const entry of readdirSync(path)) {
    if (skipDirs.has(entry)) continue;
    const child = join(path, entry);
    const childStat = statSync(child);
    if (childStat.isDirectory()) yield* walk(child);
    else if (textExtensions.has(extname(entry)) && !/\.test\.[jt]sx?$/.test(entry)) yield child;
  }
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

const findings = [];
let scanned = 0;

for (const target of targets) {
  for (const file of walk(join(root, target))) {
    const stat = statSync(file);
    if (stat.size > 50 * 1024 * 1024) continue;
    const text = readFileSync(file, 'utf8');
    scanned += 1;
    const rel = relative(root, file);

    for (const { name, re } of secretPatterns) {
      for (const match of text.matchAll(re)) {
        findings.push(`${rel}:${lineOf(text, match.index)}  ${name}: ${mask(match[0])}`);
      }
    }

    for (const match of text.matchAll(jwtPattern)) {
      const payload = decodeJwtPayload(match[0]);
      if (payload && payload.role && payload.role !== 'anon') {
        findings.push(`${rel}:${lineOf(text, match.index)}  JWT with role "${payload.role}": ${mask(match[0])}`);
      }
    }

    // Source files only: bundles have already inlined their env values.
    if (rel.startsWith('src')) {
      for (const match of text.matchAll(envPattern)) {
        const name = match[1] ?? match[2];
        if (!name.startsWith('EXPO_PUBLIC_') && !allowedEnv.has(name)) {
          findings.push(`${rel}:${lineOf(text, match.index)}  process.env.${name} is not EXPO_PUBLIC_*: server-only values must not be read by the app`);
        }
      }
    }
  }
}

if (findings.length > 0) {
  console.error(`Secret scan failed (${findings.length} finding${findings.length === 1 ? '' : 's'} in ${scanned} files):`);
  for (const finding of findings) console.error(`  ${finding}`);
  console.error('\nMove the value to a server environment (Edge Function secrets, EAS secrets) and rotate it if it was ever committed.');
  process.exit(1);
}

console.log(`Secret scan passed: ${scanned} files checked, no secrets or server-only env vars in the app.`);

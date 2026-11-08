/// <reference types="node" />
/**
 * Small helpers for supabase-setup.sh, so the shell never has to parse an env file itself
 * (values such as "StudyFlow <no-reply@…>" or a multi-line .p8 key break `source`).
 *
 *   env-tool.ts exports  <env-file> KEY1,KEY2   → `export KEY='…'` lines for eval (set keys only)
 *   env-tool.ts secrets  <env-file> <out-file>  → function secrets only, for `supabase secrets set`
 *   env-tool.ts vault    <env-file> <out-file>  → idempotent Vault SQL (project_url, cron_secret);
 *                                                prints it with the secret masked
 *   env-tool.ts crons                           → cron job names the migrations schedule
 *
 * Names are printed to stderr; secret values never are.
 */

import fs from 'node:fs';
import path from 'node:path';

import { describeKeys, discoverKeys, parseEnv, ROOT } from './env-check';

/** CLI settings that live in the same file but are not function secrets. */
export const CLI_ONLY = new Set([
  'SUPABASE_PROJECT_REF',
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_DB_PASSWORD',
  'SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID',
  'SUPABASE_AUTH_EXTERNAL_APPLE_SECRET',
]);

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** godotenv (used by the Supabase CLI) reads \n inside double quotes as a newline. */
function dotenvQuote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Function secrets: everything in the file except CLI settings, platform keys and dev-only keys. */
export function functionSecrets(env: Record<string, string>): Record<string, string> {
  const info = new Map(describeKeys(discoverKeys()).map((key) => [key.name, key]));
  const out: Record<string, string> = {};
  for (const [name, raw] of Object.entries(env)) {
    const value = raw.trim();
    const key = info.get(name);
    if (!value || CLI_ONLY.has(name) || name.startsWith('SUPABASE_') || name.startsWith('EXPO_PUBLIC_')) continue;
    if (key && (key.level === 'local' || key.level === 'platform' || key.target !== 'supabase')) continue;
    out[name] = value;
  }
  return out;
}

export function vaultSql(projectUrl: string, cronSecret: string): string {
  const upsert = (name: string, value: string) =>
    [
      `  if exists (select 1 from vault.secrets where name = ${sqlLiteral(name)}) then`,
      `    perform vault.update_secret((select id from vault.secrets where name = ${sqlLiteral(name)}), ${sqlLiteral(value)});`,
      '  else',
      `    perform vault.create_secret(${sqlLiteral(value)}, ${sqlLiteral(name)});`,
      '  end if;',
    ].join('\n');
  return [
    '-- Vault secrets read by the pg_cron jobs (safe to run again).',
    'do $$',
    'begin',
    upsert('project_url', projectUrl),
    upsert('cron_secret', cronSecret),
    'end',
    '$$;',
    "select name, updated_at from vault.secrets where name in ('project_url', 'cron_secret') order by name;",
    '',
  ].join('\n');
}

export function scheduledCronJobs(root: string = ROOT): string[] {
  const dir = path.join(root, 'supabase', 'migrations');
  const names = new Set<string>();
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const match of sql.matchAll(/cron\.schedule\(\s*'([^']+)'/g)) names.add(match[1]);
    for (const match of sql.matchAll(/cron\.unschedule\(\s*'([^']+)'/g)) names.delete(match[1]);
  }
  return [...names].sort();
}

function readEnvFile(file: string | undefined): Record<string, string> {
  if (!file || !fs.existsSync(file)) throw new Error(`Env file not found: ${file ?? '(none)'}`);
  return parseEnv(fs.readFileSync(file, 'utf8'));
}

function writePrivate(file: string, content: string) {
  fs.writeFileSync(file, content, { mode: 0o600 });
}

function main(): number {
  const [command, file, extra] = process.argv.slice(2);
  switch (command) {
    case 'exports': {
      const env = readEnvFile(file);
      for (const name of (extra ?? '').split(',').filter(Boolean)) {
        const value = env[name]?.trim();
        if (value) console.log(`export ${name}=${shellQuote(value)}`);
      }
      return 0;
    }
    case 'secrets': {
      if (!extra) throw new Error('Pass the output file');
      const secrets = functionSecrets(readEnvFile(file));
      writePrivate(extra, `${Object.entries(secrets).map(([k, v]) => `${k}=${dotenvQuote(v)}`).join('\n')}\n`);
      console.error(`Function secrets (${Object.keys(secrets).length}): ${Object.keys(secrets).sort().join(', ')}`);
      return 0;
    }
    case 'vault': {
      if (!extra) throw new Error('Pass the output file');
      const env = readEnvFile(file);
      const ref = env.SUPABASE_PROJECT_REF?.trim();
      const secret = env.CRON_SECRET?.trim();
      if (!ref || !secret) throw new Error('SUPABASE_PROJECT_REF and CRON_SECRET are needed for the Vault SQL');
      writePrivate(extra, vaultSql(`https://${ref}.supabase.co`, secret));
      // What the operator sees: the same SQL with the secret masked.
      console.log(vaultSql(`https://${ref}.supabase.co`, '********'));
      return 0;
    }
    case 'crons': {
      console.log(scheduledCronJobs().join('\n'));
      return 0;
    }
    default:
      console.error('Usage: env-tool.ts exports|secrets|vault|crons …');
      return 2;
  }
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

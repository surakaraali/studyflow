/// <reference types="node" />
/**
 * Checks an env file (or the current environment) against every variable StudyFlow needs.
 *
 *   npm run go-live:check-env -- --target supabase --env-file ../studyflow-secrets/supabase.prod.env
 *   npm run go-live:check-env -- --target app --env-file ../studyflow-secrets/app.production.env
 *   npm run go-live:check-env -- --target app             # checks the current environment
 *   npm run go-live:check-env -- --list                   # every key, where it was found
 *
 * --target  app | supabase | all (default all). github keys are listed with --list only.
 * --strict  warnings fail too.
 * --allow-missing A,B,PREFIX_*   these required keys may stay empty (they become warnings). For a
 *           staging project set up before every account exists; a wrong value still fails.
 * Exit code: 0 ready, 1 something is missing or wrong, 2 wrong usage. Values are never printed.
 */

import fs from 'node:fs';
import path from 'node:path';

import { allowMissing, checkEnv, describeKeys, discoverKeys, parseEnv, type Finding, type Target } from './env-check';

const USAGE =
  'Usage: check-env [--target app|supabase|all] [--env-file <path>] [--allow-missing A,B,PREFIX_*] [--strict] [--list]';

function arg(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const MARK: Record<Finding['status'], string> = {
  ok: 'ok     ',
  missing: 'MISSING',
  invalid: 'INVALID',
  warning: 'warning',
  ignored: 'ignored',
};

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    return 0;
  }
  const keys = describeKeys(discoverKeys());

  if (args.includes('--list')) {
    for (const target of ['app', 'supabase', 'github'] as const) {
      console.log(`\n${target}`);
      for (const key of keys.filter((k) => k.target === target)) {
        const flag = key.unclassified ? ' (new: no rule yet, treated as required)' : '';
        console.log(`  ${key.name.padEnd(40)} ${key.level.padEnd(11)} ${key.sources.join(', ')}${flag}`);
      }
    }
    return 0;
  }

  const targetArg = arg(args, '--target') ?? 'all';
  const targets: Target[] =
    targetArg === 'all' ? ['app', 'supabase'] : targetArg === 'app' || targetArg === 'supabase' ? [targetArg] : [];
  if (targets.length === 0) {
    console.error(`Unknown target "${targetArg}". ${USAGE}`);
    return 2;
  }

  const file = arg(args, '--env-file');
  let env: Record<string, string | undefined> = process.env;
  if (file) {
    const full = path.resolve(file);
    if (!fs.existsSync(full)) {
      console.error(`Env file not found: ${full}`);
      return 2;
    }
    env = parseEnv(fs.readFileSync(full, 'utf8'));
  }

  const allowed = (arg(args, '--allow-missing') ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const result = allowMissing(checkEnv(env, keys, targets), allowed);
  console.log(`check-env · target ${targets.join(' + ')} · ${file ? `file ${file}` : 'current environment'}`);
  if (allowed.length) console.log(`  allowed to stay empty: ${allowed.join(', ')}`);
  const order: Finding['status'][] = ['missing', 'invalid', 'warning', 'ignored', 'ok'];
  for (const status of order) {
    for (const finding of result.findings.filter((f) => f.status === status)) {
      const where = finding.info.sources.length ? `  [${finding.info.sources.join(', ')}]` : '';
      const isNew = finding.info.unclassified ? ' (new key)' : '';
      const detail = status === 'ok' ? '' : ` ${finding.message}${where}`;
      console.log(`  ${MARK[status]}  ${finding.name}${isNew}${detail}`);
    }
  }
  const strict = args.includes('--strict');
  const failed = result.errors > 0 || (strict && result.warnings > 0);
  console.log(
    `\n${failed ? 'Not ready' : 'Ready'}: ${result.errors} missing or invalid, ${result.warnings} warning(s)${strict ? ' (strict)' : ''}.`,
  );
  return failed ? 1 : 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
}

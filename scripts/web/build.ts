/// <reference types="node" />
/**
 * Builds the public web pages into web/dist (gitignored).
 *
 *   npm run web:build                     # build with the current env
 *   npm run web:build -- --strict         # also fail on placeholder or local URLs (deploys)
 *   npm run web:check                     # fail if web/dist is missing, out of date or incomplete
 *   npm run web:build -- --out <dir>
 *
 * Env (all optional for a local build):
 *   WEB_FUNCTIONS_URL          https://<prod-ref>.supabase.co/functions/v1
 *                              (or EXPO_PUBLIC_SUPABASE_URL, + /functions/v1)
 *   WEB_STAGING_FUNCTIONS_URL  also builds /staging/veli-onayi/ and /staging/hesap-silme/
 *   WEB_BASE_URL               https://studyflow.app/ (canonical links and the 404 page)
 *   EXPO_PUBLIC_SUPPORT_EMAIL  support address shown on the pages
 *   WEB_APP_STORE_URL          App Store link on the landing page once the app is live
 *   WEB_ANON_KEY               optional public anon key for the two forms
 */

import path from 'node:path';

import {
  buildSite,
  DEFAULT_OUT_DIR,
  diffWithDir,
  FUNCTIONS_PLACEHOLDER,
  optionsFromEnv,
  ROOT,
  strictProblems,
  verifySite,
  writeSite,
} from './site';

function shown(dir: string): string {
  const rel = path.relative(ROOT, dir);
  return rel && !rel.startsWith('..') ? rel : dir;
}

function main(): number {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const strict = args.includes('--strict');
  const outIndex = args.indexOf('--out');
  const outDir = outIndex >= 0 && args[outIndex + 1] ? path.resolve(args[outIndex + 1]) : DEFAULT_OUT_DIR;

  const options = optionsFromEnv(process.env);
  const files = buildSite(options);
  const problems = verifySite(files);
  if (strict) problems.push(...strictProblems(options));

  if (check) problems.push(...diffWithDir(files, outDir));

  if (problems.length > 0) {
    console.error(`Web pages: ${problems.length} problem(s)`);
    for (const problem of problems) console.error(`  - ${problem}`);
    if (check) console.error('Run `npm run web:build` (with the same env) and try again.');
    return 1;
  }

  if (check) {
    console.log(`Web pages are up to date (${files.size} files in ${shown(outDir)}).`);
    return 0;
  }

  writeSite(files, outDir);
  console.log(`Built ${files.size} files into ${shown(outDir)}`);
  console.log(`  functions: ${options.functionsUrl ?? `${FUNCTIONS_PLACEHOLDER} (placeholder)`}`);
  if (options.stagingFunctionsUrl) console.log(`  staging functions: ${options.stagingFunctionsUrl}`);
  if (!options.functionsUrl) console.warn('  warning: consent and deletion forms will not work until WEB_FUNCTIONS_URL is set');
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

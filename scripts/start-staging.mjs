// npm run start:staging — Expo Go against the staging Supabase project instead of local mode.
// Reads the public EXPO_PUBLIC_* values from an env file outside the project (default
// ../studyflow-secrets/app.staging.env, or STAGING_ENV_FILE) and starts `expo start --go` with them.
// The file stays outside on purpose: Metro tries to bundle extra .env files in the project root.
// `npm start` stays in local mode.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = fileURLToPath(new URL('..', import.meta.url));
const file = path.resolve(root, process.env.STAGING_ENV_FILE ?? '../studyflow-secrets/app.staging.env');

if (!fs.existsSync(file)) {
  console.error(`Missing ${file}: add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (analysis/go_live.md, step 4).`);
  process.exit(1);
}
const staging = parseEnv(fs.readFileSync(file, 'utf8'));
if (!staging.EXPO_PUBLIC_SUPABASE_URL || !staging.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  console.error(`${file} needs EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.`);
  process.exit(1);
}

const cli = fileURLToPath(new URL('../node_modules/expo/bin/cli', import.meta.url));
const child = spawn(process.execPath, [cli, 'start', '--go', ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  // Values already in the environment win over .env files, so these replace local mode.
  env: { ...process.env, ...staging },
});

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)));

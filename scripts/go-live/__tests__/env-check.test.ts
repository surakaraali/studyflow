/// <reference types="node" />
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { allowMissing, checkEnv, describeKeys, discoverKeys, parseEnv, type KeyInfo } from '../env-check';
import { functionSecrets, scheduledCronJobs, vaultSql } from '../env-tool';

/** A tiny repository with one key in each place the checker reads. */
function fixtureRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studyflow-env-'));
  const write = (file: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  };
  write('.env.example', 'EXPO_PUBLIC_SUPABASE_URL=\n# APPLE_TEAM_ID=\n');
  write(
    'analysis/security_review.md',
    '## 5. Gizli bilgi\n| `RESEND_API_KEY` | x |\n`EXPO_PUBLIC_*` values\n## 6. Envanter\n`NOT_IN_SECTION_FIVE`\n',
  );
  write('supabase/functions/new-thing/index.ts', "const a = Deno.env.get('BRAND_NEW_SECRET');\nenv('ANOTHER_KEY');\n");
  write('src/services/config.ts', 'const x = process.env.EXPO_PUBLIC_NEW_FLAG; const n = process.env.NODE_ENV;');
  write('supabase/config.toml', 'client_id = "env(SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID)"\n# pass = "env(COMMENTED_OUT)"\n');
  write('.github/workflows/web.yml', 'if: vars.WEB_DEPLOY == \'true\'\n');
  return root;
}

describe('env discovery', () => {
  const root = fixtureRepo();
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));
  const found = discoverKeys(root);

  it('collects keys from every source', () => {
    expect([...found.keys()].sort()).toEqual(
      [
        'ANOTHER_KEY',
        'APPLE_TEAM_ID',
        'BRAND_NEW_SECRET',
        'EXPO_PUBLIC_NEW_FLAG',
        'EXPO_PUBLIC_SUPABASE_URL',
        'RESEND_API_KEY',
        'SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID',
        'WEB_DEPLOY',
      ].sort(),
    );
    expect([...found.get('BRAND_NEW_SECRET')!.sources]).toEqual(['supabase/functions/new-thing/index.ts']);
  });

  it('treats a key without a rule as required, so it cannot be missed', () => {
    const keys = describeKeys(found);
    const newSecret = keys.find((k) => k.name === 'BRAND_NEW_SECRET')!;
    expect(newSecret).toMatchObject({ target: 'supabase', level: 'required', unclassified: true });
    expect(keys.find((k) => k.name === 'EXPO_PUBLIC_NEW_FLAG')).toMatchObject({ target: 'app', unclassified: true });
    const result = checkEnv({}, keys, ['supabase']);
    expect(result.findings.filter((f) => f.status === 'missing').map((f) => f.name)).toEqual(
      expect.arrayContaining(['BRAND_NEW_SECRET', 'ANOTHER_KEY', 'RESEND_API_KEY', 'SUPABASE_PROJECT_REF']),
    );
    expect(result.errors).toBeGreaterThan(0);
  });

  it('finds the real keys of this repository', () => {
    const names = new Set(describeKeys(discoverKeys()).map((k) => k.name));
    for (const name of ['ANTHROPIC_API_KEY', 'CONSENT_WEB_URL', 'CRON_SECRET', 'EXPO_PUBLIC_SUPABASE_URL', 'APPLE_PRIVATE_KEY']) {
      expect(names.has(name)).toBe(true);
    }
  });
});

describe('env file parsing', () => {
  it('reads quotes, comments, export and multi-line values', () => {
    const env = parseEnv(
      [
        '# comment',
        'export PLAIN=value # trailing comment',
        'HASH=a#b',
        'EMPTY=',
        'FROM="StudyFlow <no-reply@studyflow.app>"',
        "SINGLE='it''s'",
        // Shaped like a .p8 file, but with a label secret scanners don't flag.
        'KEY="-----BEGIN TEST BLOCK-----',
        'abc',
        '-----END TEST BLOCK-----"',
        'ESCAPED="line1\\nline2"',
      ].join('\n'),
    );
    expect(env.PLAIN).toBe('value');
    expect(env.HASH).toBe('a#b');
    expect(env.EMPTY).toBe('');
    expect(env.FROM).toBe('StudyFlow <no-reply@studyflow.app>');
    expect(env.KEY).toBe('-----BEGIN TEST BLOCK-----\nabc\n-----END TEST BLOCK-----');
    expect(env.ESCAPED).toBe('line1\nline2');
  });
});

describe('env checks', () => {
  const keys: KeyInfo[] = describeKeys(discoverKeys());

  it('flags wrong values without printing them', () => {
    const env = {
      CONSENT_WEB_URL: 'http://localhost:8099/consent/',
      CORS_ALLOWED_ORIGIN: 'https://studyflow.app/',
      EMAIL_PROVIDER: 'console',
      CRON_SECRET: 'short-secret-value',
      CONSENT_TEXT_VERSION: '0.9',
    };
    const result = checkEnv(env, keys, ['supabase']);
    const invalid = Object.fromEntries(result.findings.filter((f) => f.status === 'invalid').map((f) => [f.name, f.message]));
    expect(Object.keys(invalid)).toEqual(
      expect.arrayContaining(['CONSENT_WEB_URL', 'CORS_ALLOWED_ORIGIN', 'EMAIL_PROVIDER', 'CRON_SECRET']),
    );
    expect(result.findings.find((f) => f.name === 'CONSENT_TEXT_VERSION')?.status).toBe('warning');
    for (const message of Object.values(invalid)) expect(message).not.toContain('short-secret-value');
  });

  it('lets chosen keys stay empty but still fails a wrong value', () => {
    const env = { APPLE_TEAM_ID: 'too-short', CRON_SECRET: 'c'.repeat(40) };
    const before = checkEnv(env, keys, ['supabase']);
    const after = allowMissing(before, ['RESEND_API_KEY', 'APPLE_*']);
    const status = (name: string) => after.findings.find((f) => f.name === name)?.status;

    expect(before.findings.find((f) => f.name === 'RESEND_API_KEY')?.status).toBe('missing');
    expect(status('RESEND_API_KEY')).toBe('warning');
    expect(status('APPLE_KEY_ID')).toBe('warning');
    // Set but wrong: the pattern does not hide it.
    expect(status('APPLE_TEAM_ID')).toBe('invalid');
    // Not in the list: still missing.
    expect(status('ANTHROPIC_API_KEY')).toBe('missing');
    expect(after.errors).toBeLessThan(before.errors);
    expect(after.errors).toBe(after.findings.filter((f) => f.status === 'missing' || f.status === 'invalid').length);
  });

  it('refuses a service role key in the app env', () => {
    const payload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url');
    const result = checkEnv({ EXPO_PUBLIC_SUPABASE_ANON_KEY: `x.${payload}.y` }, keys, ['app']);
    expect(result.findings.find((f) => f.name === 'EXPO_PUBLIC_SUPABASE_ANON_KEY')?.status).toBe('invalid');
  });

  it('passes a complete function secrets file', () => {
    const env: Record<string, string> = {
      SUPABASE_PROJECT_REF: 'abcdefghijklmnopqrst',
      SUPABASE_ACCESS_TOKEN: 'sbp_x',
      SUPABASE_DB_PASSWORD: 'x',
      SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID: 'com.cobanov.studyflow',
      ANTHROPIC_API_KEY: 'sk-ant-x',
      AI_MONTHLY_BUDGET_USD: '250',
      RESEND_API_KEY: 're_x',
      EMAIL_FROM: 'StudyFlow <no-reply@studyflow.app>',
      EMAIL_REPLY_TO: 'destek@studyflow.app',
      SUPPORT_TEAM_EMAIL: 'destek@studyflow.app',
      OPS_ALERT_EMAIL: 'ops@studyflow.app',
      CONSENT_WEB_URL: 'https://studyflow.app/veli-onayi/',
      CORS_ALLOWED_ORIGIN: 'https://studyflow.app',
      CRON_SECRET: 'c'.repeat(40),
      REVENUECAT_WEBHOOK_SECRET: 'w'.repeat(32),
      TELEMETRY_HASH_SALT: 't'.repeat(40),
      APPLE_TEAM_ID: 'ABCDE12345',
      APPLE_KEY_ID: 'KEY1234567',
      APPLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----',
      APPLE_CLIENT_ID: 'com.cobanov.studyflow',
    };
    const result = checkEnv(env, keys, ['supabase']);
    const unknown = keys.filter((k) => k.target === 'supabase' && k.unclassified).map((k) => k.name);
    // Keys added by other work since these rules were written show up here, by design.
    const errors = result.findings.filter((f) => (f.status === 'missing' || f.status === 'invalid') && !unknown.includes(f.name));
    expect(errors).toEqual([]);

    const secrets = functionSecrets(env);
    expect(Object.keys(secrets)).not.toEqual(expect.arrayContaining(['SUPABASE_PROJECT_REF']));
    expect(Object.keys(secrets).some((name) => name.startsWith('SUPABASE_'))).toBe(false);
    expect(secrets.CRON_SECRET).toBe(env.CRON_SECRET);
  });
});

describe('go-live SQL helpers', () => {
  it('writes Vault SQL that creates or updates and escapes quotes', () => {
    const sql = vaultSql('https://abcdefghijklmnopqrst.supabase.co', "it's-secret");
    expect(sql).toContain("vault.update_secret((select id from vault.secrets where name = 'cron_secret'), 'it''s-secret')");
    expect(sql).toContain("vault.create_secret('https://abcdefghijklmnopqrst.supabase.co', 'project_url')");
  });

  it('lists the cron jobs the migrations schedule', () => {
    expect(scheduledCronJobs()).toEqual(expect.arrayContaining(['consent-maintenance-daily']));
  });
});

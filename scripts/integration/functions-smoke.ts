/**
 * Smoke test for the Edge Functions on a local stack:
 *   supabase start && supabase functions serve --env-file <file with EMAIL_PROVIDER=console>
 *   npx tsx scripts/integration/functions-smoke.ts <path-of-the-functions-serve-log> [<env file>]
 *
 * Walks the parent consent flow (US-16), telemetry (ADR-006) and account deletion (US-13) with
 * real requests. The consent link is read from the console e-mail in the serve log.
 * The env file needs TELEMETRY_HASH_SALT and OPS_ALERT_EMAIL; with CRON_SECRET in it (or in the
 * environment) the ops-alerts checks run too, otherwise they are skipped.
 */

import { createClient } from '@supabase/supabase-js';
import { execFileSync, execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ` → ${JSON.stringify(detail)}`}`);
}

/** One value from the private schema, which the API does not expose. */
function sql(query: string): string {
  return execFileSync('docker', ['exec', 'supabase_db_studyflow', 'psql', '-U', 'postgres', '-tAc', query], {
    encoding: 'utf8',
  }).trim();
}

function envValue(file: string | undefined, name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  if (!file) return undefined;
  const line = readFileSync(file, 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim() || undefined;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const logPath = process.argv[2];
  const envFile = process.argv[3];
  const status = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8' }));
  const url: string = status.API_URL;
  const fn = (name: string) => `${url}/functions/v1/${name}`;
  const admin = createClient(url, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const email = `student-${Date.now()}@test.local`;
  const password = 'smoke-test-password';
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const userId = created.data.user.id;
  const client = createClient(url, status.ANON_KEY, { auth: { persistSession: false } });
  const session = (await client.auth.signInWithPassword({ email, password })).data.session!;
  const auth = { Authorization: `Bearer ${session.access_token}`, apikey: status.ANON_KEY };

  // A 15-year-old finishes onboarding: the server derives "pending".
  const year = new Date().getFullYear() - 15;
  const onboard = await client
    .from('profiles')
    .update({ birth_year: year, grade: 10, segment: 'lise', onboarding_done: 1, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('consent_status')
    .single();
  check('profile becomes pending after onboarding', onboard.data?.consent_status === 'pending', onboard.error?.message);

  const tamper = await client.from('profiles').update({ consent_status: 'granted', plan: 'pro' }).eq('id', userId).select('consent_status, plan').single();
  check('client cannot grant itself consent or Pro', tamper.data?.consent_status === 'pending' && tamper.data?.plan === 'free', tamper.data ?? tamper.error);

  const same = await fetch(fn('consent-request'), { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ parentEmail: email }) });
  check('own e-mail is refused as parent e-mail', same.status === 422, same.status);

  const parentEmail = `parent-${Date.now()}@test.local`;
  const request = await fetch(fn('consent-request'), { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ parentEmail }) });
  check('consent request accepted', request.ok, await request.text());

  const log = readFileSync(logPath, 'utf8');
  const token = [...log.matchAll(/[?&]token=([A-Za-z0-9_-]+)/g)].at(-1)?.[1];
  check('consent e-mail contains a link', Boolean(token));
  if (!token) throw new Error('No consent link in the serve log');

  const page = await fetch(`${fn('consent')}?token=${token}`);
  const info = await page.json();
  check('parent page loads the request', page.ok && !info.expired, info);

  const grant = await fetch(fn('consent'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, action: 'grant', purposes: ['ai'] }) });
  check('parent grants consent (AI only)', grant.ok, await grant.text());

  const after = await client.from('profiles').select('consent_status, notif_plan').eq('id', userId).single();
  check('profile is granted', after.data?.consent_status === 'granted', after.data);
  const records = await client.from('consent_records').select('action, purposes').order('created_at');
  // The app logs "requested" itself (it syncs from the device); the server writes the parent's answer.
  check('consent record "granted" with the ticked purposes', JSON.stringify(records.data) === '[{"action":"granted","purposes":["ai"]}]', records.data);

  const editRecord = await client.from('consent_records').update({ action: 'granted' }).eq('user_id', userId).select();
  check('consent records cannot be edited', (editRecord.data ?? []).length === 0, editRecord.data);

  const revoke = await fetch(fn('consent'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, action: 'revoke' }) });
  check('parent revokes consent', revoke.ok, await revoke.text());
  const revoked = await client.from('profiles').select('consent_status').eq('id', userId).single();
  check('profile is revoked', revoked.data?.consent_status === 'revoked', revoked.data);

  const bad = await fetch(`${fn('consent')}?token=not-a-real-token`);
  check('unknown token is rejected', bad.status >= 400 && bad.status < 500, bad.status);

  // Telemetry (ADR-006): signed-in callers only, dictionary check, no ids, hourly limit.
  const marker = `0.0.${Date.now() % 100_000} (smoke)`;
  const ctx = { app_version: marker, platform: 'ios', os_major: 18 };
  const telemetry = (body: unknown, headers: Record<string, string> = auth) =>
    fetch(fn('telemetry'), { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const anonymous = await telemetry({ items: [] }, { apikey: status.ANON_KEY, Authorization: `Bearer ${status.ANON_KEY}` });
  check('telemetry refuses calls without a signed-in user', anonymous.status === 401, anonymous.status);

  const sent = await telemetry({
    items: [
      { type: 'event', name: 'quiz_completed', props: { correct: 7, user_id: userId }, ...ctx },
      { type: 'event', name: 'not_in_the_dictionary', props: {}, ...ctx },
      { type: 'crash', name: 'TypeError', message: `boom for ${email}`, stack: 'at f (/Users/ali/app/index.js:1:2)', fatal: false, ...ctx },
    ],
  });
  const sentBody = await sent.json();
  check('telemetry stores listed items and skips unknown events', sent.ok && sentBody.accepted === 2 && sentBody.skipped === 1, sentBody);
  const storedProps = sql(`select props::text from private.telemetry_events where app_version = '${marker}'`);
  check('event stored without the unknown prop', storedProps === '{"correct": 7}', storedProps);
  const storedCrash = sql(`select message || ' | ' || stack from private.crash_reports where app_version = '${marker}'`);
  check('crash text scrubbed again on the server', storedCrash === 'boom for <email> | at f (index.js:1:2)', storedCrash);
  const idColumns = sql(
    `select count(*) from information_schema.columns where table_schema = 'private' and table_name in ('telemetry_events', 'crash_reports') and column_name ~ '(user|device|install|session|ip)'`,
  );
  check('telemetry tables have no id or IP columns', idColumns === '0', idColumns);

  const tooMany = await telemetry({ items: Array.from({ length: 51 }, () => ({ type: 'event', name: 'progress_viewed', props: {}, ...ctx })) });
  check('telemetry refuses more than 50 items', tooMany.status === 413, tooMany.status);

  const cronSecret = envValue(envFile, 'CRON_SECRET');
  if (!cronSecret) {
    console.log('skip ops-alerts checks (no CRON_SECRET; pass the functions env file as the 2nd argument)');
  } else {
    const opsAlerts = (body: unknown, secret = cronSecret) =>
      fetch(fn('ops-alerts'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    const wrong = await opsAlerts({}, 'not-the-secret');
    check('ops-alerts refuses calls without the cron secret', wrong.status === 401, wrong.status);

    // A crash spike: 12 reports in the last 15 minutes.
    sql(`delete from private.ops_alerts where key = 'crash_spike'`);
    sql(`delete from private.crash_reports where name = 'SmokeSpike'`);
    sql(`insert into private.crash_reports (name, platform, app_version) select 'SmokeSpike', 'ios', '${marker}' from generate_series(1, 12)`);

    const logStart = readFileSync(logPath, 'utf8').length;
    const dry = await (await opsAlerts({ dryRun: true })).json();
    check('ops-alerts dry run sees the crash spike and sends nothing', dry.firing?.includes('crash_spike') && dry.emailed === false, dry);
    const first = await (await opsAlerts({})).json();
    const fired = (first.actions ?? []).find((a: { key: string }) => a.key === 'crash_spike');
    check('ops-alerts e-mails a new alert', fired?.action === 'fire' && first.emailed === true, first.actions ?? first);
    const again = await (await opsAlerts({})).json();
    check('ops-alerts does not e-mail the same alert again', !(again.actions ?? []).some((a: { key: string }) => a.key === 'crash_spike'), again.actions ?? again);

    sql(`delete from private.crash_reports where name = 'SmokeSpike'`);
    const resolved = await (await opsAlerts({})).json();
    const cleared = (resolved.actions ?? []).find((a: { key: string }) => a.key === 'crash_spike');
    check('ops-alerts e-mails once when the spike is over', cleared?.action === 'resolve', resolved.actions ?? resolved);

    await sleep(500);
    const opsLog = readFileSync(logPath, 'utf8').slice(logStart);
    check('alert e-mail sent to OPS_ALERT_EMAIL', /\[email:console\] ops_alert → /.test(opsLog));
    const counted = sql(
      `select coalesce(sum(requests), 0) from private.function_requests where function_name in ('telemetry', 'ops-alerts') and minute > now() - interval '10 minutes'`,
    );
    check('function responses are counted for the error-rate alert', Number(counted) > 0, counted);
  }

  // Hourly limit (300 items per user): batches of 50 until the server says 429.
  let limited = false;
  let accepted = 2;
  for (let i = 0; i < 8 && !limited; i++) {
    const response = await telemetry({ items: Array.from({ length: 50 }, () => ({ type: 'event', name: 'progress_viewed', props: {}, ...ctx })) });
    if (response.status === 429) limited = true;
    else accepted += (await response.json()).accepted ?? 0;
  }
  check('telemetry rate-limits a user per hour', limited && accepted <= 300, { limited, accepted });

  // Account deletion keeps the consent trail for the legal period (BR-18).
  const del = await fetch(fn('delete-account'), { method: 'POST', headers: auth });
  check('account deletion succeeds', del.ok, await del.text());
  const gone = await admin.auth.admin.getUserById(userId);
  check('auth user is gone', Boolean(gone.error) || !gone.data.user, gone.data?.user?.id);
  // The private schema is not exposed over the API, so read it straight from the database.
  const retained = execSync(
    `docker exec supabase_db_studyflow psql -U postgres -tAc "select count(*) from private.retained_consent_records where former_user_id = '${userId}'"`,
    { encoding: 'utf8' },
  ).trim();
  check('consent trail retained after deletion', Number(retained) >= 2, retained);

  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

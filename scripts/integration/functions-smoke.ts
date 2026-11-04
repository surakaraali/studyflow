/**
 * Smoke test for the Edge Functions on a local stack:
 *   supabase start && supabase functions serve --env-file <file with EMAIL_PROVIDER=console>
 *   npx tsx scripts/integration/functions-smoke.ts <path-of-the-functions-serve-log>
 *
 * Walks the parent consent flow (US-16) and account deletion (US-13) with real requests.
 * The consent link is read from the console e-mail in the serve log.
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ` → ${JSON.stringify(detail)}`}`);
}

async function main() {
  const logPath = process.argv[2];
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

/// <reference types="node" />
/**
 * Creates (or refreshes) the adult App Review demo account on a Supabase project and fills it
 * with the dev-seed demo data, through the same sync path the app uses.
 *
 *   npm run go-live:seed-review -- --local --email review@example.com     # local stack
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=… SUPABASE_ANON_KEY=… \
 *   REVIEW_EMAIL=… REVIEW_PASSWORD=… npm run go-live:seed-review
 *
 * Data source: a device database made by the dev-seed route (`…/--/dev-seed?mode=full` in local
 * mode). By default the newest "demo-full" account in the iOS simulator is used; pass
 * --from-db <file> for another one. The account becomes an 18+ adult (no parent consent), dates
 * are moved so the history ends yesterday and the exams lie ahead, and the sample document is
 * marked processed without using the account's monthly quota.
 *
 * Options:
 *   --email <address>   or REVIEW_EMAIL
 *   --password <pw>     or REVIEW_PASSWORD (prefer the env var: arguments stay in shell history)
 *   --url <url>         or SUPABASE_URL; keys come from SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY
 *   --local             use the local stack from `supabase status`
 *   --from-db <file>    device database to copy
 *   --reset             delete the account first, then create it again (new user id)
 *   --dry-run           read and prepare everything, write nothing
 *
 * Safe to re-run: the same row ids are upserted with a newer updated_at, so the data is
 * refreshed, not duplicated. Neither the password nor any key is printed.
 */

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { SYNCED_TABLES, type SyncedTable } from '@/db/schema';
import { pullChanges, pushChanges } from '@/services/sync/engine';
import { supabaseRemote } from '@/services/sync/supabase-remote';
import { FakeDevice } from '@/services/sync/testing/fakes';
import type { Row } from '@/services/sync/types';

import { prepareReviewRows, type ReviewRows } from './review-data';

const DEMO_EMAIL = 'demo-full@studyflow.local';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 12;

type Options = {
  email: string;
  password: string;
  url: string;
  serviceKey: string;
  anonKey: string;
  fromDb: string;
  reset: boolean;
  dryRun: boolean;
};

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function fail(message: string): never {
  throw new Error(message);
}

/** The newest dev-seed "full" device database in any iOS simulator on this Mac. */
export function findSimulatorDemoDb(home: string = os.homedir()): string | null {
  const devices = path.join(home, 'Library', 'Developer', 'CoreSimulator', 'Devices');
  if (!fs.existsSync(devices)) return null;
  let listing = '';
  try {
    listing = execFileSync('find', [devices, '-name', 'local-accounts.db', '-path', '*SQLite*'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (error) {
    // find exits 1 when some folders are unreadable; keep what it printed.
    listing = (error as { stdout?: string }).stdout ?? '';
  }
  let best: { file: string; mtime: number } | null = null;
  for (const accounts of listing.split('\n').filter(Boolean)) {
    try {
      const db = new DatabaseSync(accounts, { readOnly: true });
      const row = db.prepare('SELECT id FROM accounts WHERE email = ?').get(DEMO_EMAIL) as { id?: string } | undefined;
      db.close();
      if (!row?.id) continue;
      const file = path.join(path.dirname(accounts), `user-${row.id}.db`);
      if (!fs.existsSync(file)) continue;
      const mtime = fs.statSync(file).mtimeMs;
      if (!best || mtime > best.mtime) best = { file, mtime };
    } catch {
      // Not a StudyFlow database or locked; skip it.
    }
  }
  return best?.file ?? null;
}

function localStack(): { url: string; serviceKey: string; anonKey: string } {
  const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })) as Record<
    string,
    string
  >;
  return { url: status.API_URL, serviceKey: status.SERVICE_ROLE_KEY, anonKey: status.ANON_KEY };
}

function readOptions(args: string[], env: Record<string, string | undefined>): Options {
  const local = args.includes('--local');
  const stack = local ? localStack() : null;
  const email = (argValue(args, '--email') ?? env.REVIEW_EMAIL ?? '').trim().toLowerCase();
  const password = argValue(args, '--password') ?? env.REVIEW_PASSWORD ?? '';
  const url = (stack?.url ?? argValue(args, '--url') ?? env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const serviceKey = stack?.serviceKey ?? env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const anonKey = stack?.anonKey ?? env.SUPABASE_ANON_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const fromDb = argValue(args, '--from-db') ?? findSimulatorDemoDb() ?? '';

  if (!EMAIL_RE.test(email)) fail('Pass the review account e-mail with --email or REVIEW_EMAIL.');
  if (password.length < MIN_PASSWORD) fail(`Pass a password of at least ${MIN_PASSWORD} characters in REVIEW_PASSWORD.`);
  if (!url) fail('Pass the Supabase URL with --url or SUPABASE_URL (or use --local).');
  if (!serviceKey) fail('Set SUPABASE_SERVICE_ROLE_KEY (Project settings › API keys), or use --local.');
  if (!anonKey) fail('Set SUPABASE_ANON_KEY (the public anon key), or use --local.');
  if (!fromDb || !fs.existsSync(fromDb)) {
    fail(
      'No demo database found. Open the app in local mode in the simulator, run ' +
        '`xcrun simctl openurl booted "exp://127.0.0.1:8081/--/dev-seed?mode=full"`, or pass --from-db <file>.',
    );
  }
  if (argValue(args, '--password')) console.warn('note: --password stays in your shell history; REVIEW_PASSWORD is safer.');
  return { email, password, url, serviceKey, anonKey, fromDb, reset: args.includes('--reset'), dryRun: args.includes('--dry-run') };
}

function readDevice(file: string): Map<SyncedTable, Row[]> {
  // Copy first so a running simulator never sees a lock from us.
  const copy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'studyflow-seed-')), 'device.db');
  fs.copyFileSync(file, copy);
  for (const suffix of ['-wal', '-shm']) {
    if (fs.existsSync(file + suffix)) fs.copyFileSync(file + suffix, copy + suffix);
  }
  const db = new DatabaseSync(copy, { readOnly: true });
  const tables = new Map<SyncedTable, Row[]>();
  for (const table of SYNCED_TABLES) {
    tables.set(table, db.prepare(`SELECT * FROM ${table}`).all() as Row[]);
  }
  db.close();
  fs.rmSync(path.dirname(copy), { recursive: true, force: true });
  return tables;
}

async function findUser(admin: SupabaseClient, email: string): Promise<User | null> {
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function ensureUser(admin: SupabaseClient, options: Options): Promise<{ user: User; created: boolean }> {
  let existing = await findUser(admin, options.email);
  if (existing && options.reset) {
    const { error } = await admin.auth.admin.deleteUser(existing.id);
    if (error) throw error;
    console.log('Deleted the old review account (--reset).');
    existing = null;
  }
  // Marked so the team can leave it out of KPIs and clean it up later.
  const appMetadata = { ...(existing?.app_metadata ?? {}), review_account: true };
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: options.password,
      email_confirm: true,
      app_metadata: appMetadata,
    });
    if (error) throw error;
    return { user: data.user, created: false };
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: options.email,
    password: options.password,
    email_confirm: true,
    app_metadata: appMetadata,
  });
  if (error) throw error;
  return { user: data.user, created: true };
}

function printPlan(rows: ReviewRows) {
  console.log(`Dates moved by ${rows.shiftDays} day(s); history now ends ${rows.lastStudyDay ?? '(no history)'}.`);
  for (const table of SYNCED_TABLES) {
    const count = rows.tables.get(table)?.length ?? 0;
    if (count) console.log(`  ${table.padEnd(16)} ${count}`);
  }
}

async function main() {
  const options = readOptions(process.argv.slice(2), process.env);
  const host = new URL(options.url).host;
  console.log(`Review account ${options.email} on ${host}`);
  console.log(`Demo data from ${options.fromDb.replace(os.homedir(), '~')}`);

  const source = readDevice(options.fromDb);
  // The profile id is replaced below; a placeholder keeps the dry run honest.
  const planned = prepareReviewRows(source, { userId: '00000000-0000-4000-8000-000000000000', now: new Date() });
  printPlan(planned);
  if (options.dryRun) {
    console.log('Dry run: nothing was written.');
    return;
  }

  const admin = createClient(options.url, options.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { user, created } = await ensureUser(admin, options);
  console.log(created ? 'Created a verified account.' : 'Account exists: password reset, e-mail verified.');

  const client = createClient(options.url, options.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const signIn = await client.auth.signInWithPassword({ email: options.email, password: options.password });
  if (signIn.error) throw signIn.error;
  const remote = supabaseRemote(client);

  const rows = prepareReviewRows(source, { userId: user.id, now: new Date() });
  const device = new FakeDevice();
  for (const table of SYNCED_TABLES) {
    for (const row of rows.tables.get(table) ?? []) device.localUpsert(table, row);
  }
  const queued = device.outbox.length;
  let pushed = 0;
  for (let round = 0; round < 20 && device.outbox.length > 0; round++) {
    const report = await pushChanges({ userId: user.id, outbox: device, local: device, remote }, { includeStuck: true });
    pushed += report.pushed;
    if (report.rejected || report.error) console.log(`push round ${round}:`, report.error ?? `${report.rejected} rejected`);
    if (report.retryLater) break;
  }
  console.log(`Pushed ${pushed} of ${queued} rows through the sync service.`);
  if (device.outbox.length > 0) throw new Error(`${device.outbox.length} rows were not accepted; see the messages above.`);

  // The server owns document state: mark the sample document processed, outside the quota.
  const documentIds = (rows.tables.get('documents') ?? []).map((row) => row.id);
  if (documentIds.length) {
    const { error } = await admin
      .from('documents')
      .update({ status: 'ready', error_code: null, attempts: 1, next_attempt_at: null, counted: 0 })
      .eq('user_id', user.id)
      .in('id', documentIds);
    if (error) throw error;
  }

  // Check: a fresh device pulls the same rows back, and the account is an adult on the free plan.
  const fresh = new FakeDevice();
  const pull = await pullChanges({ userId: user.id, outbox: fresh, local: fresh, remote });
  if (pull.error) throw new Error(`pull failed: ${pull.error}`);
  let failures = 0;
  for (const table of SYNCED_TABLES) {
    const want = rows.tables.get(table)?.length ?? 0;
    if (!want) continue;
    const got = [...fresh.table(table).values()].filter((row) => rows.ids.get(table)?.has(row.id)).length;
    if (got !== want) failures++;
    console.log(`  ${got === want ? 'ok  ' : 'FAIL'} ${table.padEnd(16)} ${got}/${want}`);
  }
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('consent_status, plan, birth_year, onboarding_done')
    .eq('id', user.id)
    .single();
  if (profileError) throw profileError;
  const adult = profile.consent_status === 'not_required' && profile.onboarding_done === 1;
  console.log(`  ${adult ? 'ok  ' : 'FAIL'} profile          consent ${profile.consent_status}, plan ${profile.plan}`);
  const { data: docs } = await admin.from('documents').select('status, counted').eq('user_id', user.id).in('id', documentIds);
  const ready = (docs ?? []).every((doc) => doc.status === 'ready' && doc.counted === 0);
  console.log(`  ${ready ? 'ok  ' : 'FAIL'} documents        ${(docs ?? []).length} processed, outside the quota`);

  await client.auth.signOut();
  if (failures > 0 || !adult || !ready) throw new Error('The review account is not complete.');
  console.log(`\nReady. Sign in with ${options.email} and the REVIEW_PASSWORD you set.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

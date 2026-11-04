/**
 * Integration check for the sync service against a local Supabase stack (`supabase start`).
 *
 *   npx tsx scripts/integration/sync-roundtrip.ts <path-to-a-device-sqlite-file>
 *
 * Pushes every synced row of a real device database through the sync engine, pulls it back
 * into an empty device and compares row counts per table. A second push must change nothing.
 * Uses the local stack's well-known demo keys from `supabase status`.
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

import { SYNCED_TABLES, type SyncedTable } from '@/db/schema';
import { pullChanges, pushChanges } from '@/services/sync/engine';
import { supabaseRemote } from '@/services/sync/supabase-remote';
import { FakeDevice } from '@/services/sync/testing/fakes';
import type { Row } from '@/services/sync/types';

async function main() {
  const source = process.argv[2];
  if (!source) throw new Error('Pass the path of a device SQLite file');

  const status = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8' }));
  const url: string = status.API_URL;
  const admin = createClient(url, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const email = `sync-${Date.now()}@test.local`;
  const password = 'sync-test-password';
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const userId = created.data.user.id;

  const client = createClient(url, status.ANON_KEY, { auth: { persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  const remote = supabaseRemote(client);

  // Device A: every row of the real database, queued in the outbox like local writes.
  const db = new DatabaseSync(source, { readOnly: true });
  const deviceA = new FakeDevice();
  const expected = new Map<SyncedTable, number>();
  for (const table of SYNCED_TABLES) {
    let rows = db.prepare(`SELECT * FROM ${table}`).all() as Row[];
    // Only the server records a parent's grant or revoke; a device may only log a request.
    if (table === 'consent_records') rows = rows.filter((row) => row.action === 'requested');
    for (const row of rows) {
      deviceA.localUpsert(table, table === 'profile' ? { ...row, id: userId, email } : row);
    }
    expected.set(table, rows.length);
  }
  const queued = deviceA.outbox.length;

  let pushed = 0;
  for (let round = 0; round < 20 && deviceA.outbox.length > 0; round++) {
    const report = await pushChanges({ userId, outbox: deviceA, local: deviceA, remote }, { includeStuck: true });
    pushed += report.pushed;
    if (report.rejected || report.error) console.log('push round', round, report);
    if (report.retryLater) break;
  }

  // Device B: empty, pulls everything back.
  const deviceB = new FakeDevice();
  const pull = await pullChanges({ userId, outbox: deviceB, local: deviceB, remote });

  // A second push of the same rows must not create anything new.
  for (const table of SYNCED_TABLES) {
    for (const row of deviceA.table(table).values()) deviceA.localUpsert(table, row);
  }
  const again = await pushChanges({ userId, outbox: deviceA, local: deviceA, remote }, { includeStuck: true });
  const pullAgain = await pullChanges({ userId, outbox: deviceB, local: deviceB, remote });

  let failures = 0;
  console.log(`queued ${queued}, pushed ${pushed}, left in outbox ${deviceA.outbox.length}`);
  console.log(`pulled ${pull.received} (${pull.error ?? 'ok'}), second push ${again.pushed}, second pull new rows ${pullAgain.written}`);
  for (const table of SYNCED_TABLES) {
    const want = expected.get(table) ?? 0;
    const got = deviceB.table(table).size;
    const ok = got === want;
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${table.padEnd(16)} device ${want}  round-trip ${got}`);
  }

  await admin.auth.admin.deleteUser(userId);
  if (failures > 0 || deviceA.outbox.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Offline sync core (US-05, OFF-03, REL-05). Pure logic over the interfaces in types.ts.
 *
 * Push: outbox entries are merged per row (latest full row + later soft-delete), grouped per
 * table and sent in batches. Client-generated ids make every write idempotent: editable tables
 * use upsert by id, append-only tables insert-or-ignore, so a retried batch never duplicates.
 * A batch the server rejects is retried row by row so one bad row cannot block the rest; the
 * bad row stays in the outbox with attempts + 1. A network/server failure stops the push and
 * keeps everything for the next run; so does a refused session (401), without counting it
 * against any row.
 *
 * Pull: per table, rows with synced_at > cursor (server write time, so device clocks don't
 * matter), oldest first, in pages. Last write wins by updated_at; rows with local changes still
 * waiting in the outbox are skipped (they are pushed first and come back on the next pull).
 * Server-owned columns always take the server's value.
 */

import { SYNCED_TABLES, type SyncedTable } from '@/db/schema';

import { isAppendOnly, remoteTable, SERVER_OWNED_COLUMNS, toLocal, toRemote } from './mapping';
import type {
  LocalWrite,
  OutboxEntry,
  PullReport,
  PushReport,
  RemoteResult,
  SyncDeps,
  SyncReport,
} from './types';

/** After this many rejections a change is left out of automatic runs (still kept, see `includeStuck`). */
export const MAX_REJECTIONS = 5;
export const PUSH_BATCH = 200;
export const PULL_PAGE = 500;
const OUTBOX_READ = 1000;
const MAX_PULL_PAGES = 40;
/**
 * Re-read this much before the cursor: a transaction that stamped synced_at earlier may commit
 * after a later one was already pulled. Re-reading a row is harmless (last write wins).
 */
export const PULL_OVERLAP_MS = 30_000;

type RowChange = {
  table: SyncedTable;
  id: string;
  seqs: number[];
  attempts: number;
  /** 'upsert' when any entry carries the full row; otherwise a soft delete only. */
  op: 'upsert' | 'delete';
  payload: Record<string, unknown>;
};

/** Merges outbox entries per (table, row) in seq order. */
export function mergeEntries(entries: readonly OutboxEntry[]): RowChange[] {
  const byKey = new Map<string, RowChange>();
  for (const entry of entries) {
    const key = `${entry.table_name}:${entry.row_id}`;
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(entry.payload) as Record<string, unknown>;
    } catch {
      payload = { id: entry.row_id };
    }
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, {
        table: entry.table_name,
        id: entry.row_id,
        seqs: [entry.seq],
        attempts: entry.attempts,
        op: entry.op,
        payload: { ...payload, id: entry.row_id },
      });
      continue;
    }
    current.seqs.push(entry.seq);
    current.attempts = Math.max(current.attempts, entry.attempts);
    current.payload = { ...current.payload, ...payload, id: entry.row_id };
    if (entry.op === 'upsert') current.op = 'upsert';
  }
  return [...byKey.values()];
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function pushChanges(deps: SyncDeps, options: { includeStuck?: boolean } = {}): Promise<PushReport> {
  const { outbox, remote, userId } = deps;
  const report: PushReport = { pushed: 0, rejected: 0, retryLater: false };

  const entries = await outbox.list(OUTBOX_READ);
  if (entries.length === 0) return report;

  const changes = mergeEntries(entries).filter((c) => options.includeStuck || c.attempts < MAX_REJECTIONS);
  const order = new Map(SYNCED_TABLES.map((t, i) => [t, i]));
  changes.sort((a, b) => (order.get(a.table) ?? 99) - (order.get(b.table) ?? 99));

  const send = async (table: SyncedTable, batch: RowChange[]): Promise<RemoteResult> => {
    const name = remoteTable(table);
    if (batch[0].op === 'delete') {
      const { payload } = batch[0];
      return remote.softDelete(name, batch[0].id, { deleted_at: payload.deleted_at, updated_at: payload.updated_at });
    }
    const rows = batch.map((c) => toRemote(table, c.payload, userId));
    return isAppendOnly(table) ? remote.insertMissing(name, rows) : remote.upsert(name, rows);
  };

  // Returns false when the push must stop (network/server down).
  const deliver = async (table: SyncedTable, batch: RowChange[]): Promise<boolean> => {
    const result = await send(table, batch);
    if (result.ok) {
      await outbox.remove(batch.flatMap((c) => c.seqs));
      report.pushed += batch.length;
      return true;
    }
    if (result.auth) {
      // The session is the problem, not the rows: keep everything as it is.
      report.authFailed = true;
      report.error = result.message;
      return false;
    }
    if (result.retryable) {
      report.retryLater = true;
      report.error = result.message;
      return false;
    }
    if (batch.length > 1) {
      // Find the row the server refuses; send the others.
      for (const change of batch) {
        if (!(await deliver(table, [change]))) return false;
      }
      return true;
    }
    await outbox.markRejected(batch[0].seqs);
    report.rejected += 1;
    report.error = result.message;
    return true;
  };

  for (const table of SYNCED_TABLES) {
    const forTable = changes.filter((c) => c.table === table);
    if (forTable.length === 0) continue;
    const upserts = forTable.filter((c) => c.op === 'upsert');
    const deletes = forTable.filter((c) => c.op === 'delete');
    for (const batch of chunks(upserts, PUSH_BATCH)) {
      if (!(await deliver(table, batch))) return report;
    }
    for (const change of deletes) {
      if (!(await deliver(table, [change]))) return report;
    }
  }
  return report;
}

function minusOverlap(cursor: string | null): string | null {
  if (!cursor) return null;
  const time = new Date(cursor).getTime();
  return Number.isNaN(time) ? null : new Date(time - PULL_OVERLAP_MS).toISOString();
}

function newer(remote: unknown, local: unknown): boolean {
  if (typeof remote !== 'string') return false;
  if (typeof local !== 'string') return true;
  return new Date(remote).getTime() > new Date(local).getTime();
}

export async function pullChanges(deps: SyncDeps, tables: readonly SyncedTable[] = SYNCED_TABLES): Promise<PullReport> {
  const { local, outbox, remote } = deps;
  const report: PullReport = { received: 0, written: 0, retryLater: false };
  const changed = new Set<SyncedTable>();

  try {
    for (const table of tables) {
      const columns = await local.columns(table);
      const serverOwned = (SERVER_OWNED_COLUMNS[table] ?? []).filter((c) => columns.has(c));
      const appendOnly = isAppendOnly(table);
      const savedCursor = await local.getCursor(table);
      let since = minusOverlap(savedCursor);

      for (let page = 0; page < MAX_PULL_PAGES; page++) {
        const result = await remote.pull(remoteTable(table), since, PULL_PAGE);
        if (!result.ok) {
          report.retryLater = result.retryable;
          if (result.auth) report.authFailed = true;
          report.error = result.message;
          return report;
        }
        const rows = result.rows;
        if (rows.length === 0) break;
        report.received += rows.length;

        const pending = await outbox.pendingRowIds(table);
        const ids = rows.map((r) => r.id);
        const versions = await local.versions(table, ids, serverOwned);
        const write: LocalWrite = { upserts: [], patches: [] };

        for (const row of rows) {
          if (pending.has(row.id)) continue;
          const incoming = toLocal(table, row, columns);
          const mine = versions.get(row.id);
          if (!mine) {
            write.upserts.push(incoming);
            continue;
          }
          if (appendOnly) continue;
          if (newer(incoming.updated_at, mine.updated_at)) {
            write.upserts.push(incoming);
            continue;
          }
          const changes: Record<string, unknown> = {};
          for (const column of serverOwned) {
            if (incoming[column] !== undefined && incoming[column] !== mine[column]) changes[column] = incoming[column];
          }
          if (Object.keys(changes).length > 0) write.patches.push({ id: row.id, changes });
        }

        if (write.upserts.length > 0 || write.patches.length > 0) {
          await local.write(table, write);
          report.written += write.upserts.length + write.patches.length;
          changed.add(table);
        }

        const last = rows[rows.length - 1].synced_at;
        if (!savedCursor || newer(last, savedCursor)) await local.setCursor(table, last);
        if (rows.length < PULL_PAGE) break;
        since = last;
      }
    }
    return report;
  } finally {
    if (changed.size > 0) local.notify([...changed]);
  }
}

/** One full run: push first (so the pull never overwrites unsent edits), then pull. */
export async function syncOnce(deps: SyncDeps, options: { includeStuck?: boolean } = {}): Promise<SyncReport> {
  const push = await pushChanges(deps, options);
  if (push.retryLater || push.authFailed) return { push, pull: null };
  const pull = await pullChanges(deps);
  return { push, pull };
}

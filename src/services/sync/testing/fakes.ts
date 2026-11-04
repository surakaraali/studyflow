/**
 * In-memory stand-ins for the device database and the server, used by the sync tests.
 * The fake server copies the Postgres behaviour the engine relies on: upsert by id with
 * last-write-wins on updated_at, insert-or-ignore for append-only tables, a server clock in
 * synced_at, and Postgres output formats ("+00:00" timestamps, "HH:MM:SS" times).
 */

import { MIGRATIONS, type SyncedTable } from '@/db/schema';

import type {
  LocalStore,
  LocalVersion,
  LocalWrite,
  OutboxEntry,
  OutboxStore,
  Remote,
  RemoteResult,
  RemoteRow,
  Row,
} from '../types';

/** Column lists straight from src/db/schema.ts. */
export function deviceColumns(): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();
  const re = /CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\s*\);/g;
  for (const sql of MIGRATIONS) {
    for (const match of sql.matchAll(re)) {
      const columns = match[2]
        .split('\n')
        .map((line) => line.trim().split(/\s+/)[0])
        .filter((name) => /^[a-z_]+$/.test(name));
      tables.set(match[1], new Set(columns));
    }
  }
  return tables;
}

export class FakeDevice implements OutboxStore, LocalStore {
  tables = new Map<string, Map<string, Row>>();
  outbox: OutboxEntry[] = [];
  cursors = new Map<string, string>();
  notified: string[][] = [];
  private seq = 0;
  private schema = deviceColumns();

  table(name: string): Map<string, Row> {
    let table = this.tables.get(name);
    if (!table) {
      table = new Map();
      this.tables.set(name, table);
    }
    return table;
  }

  /** Same effect as upsert() in src/db/write.ts with the backend on. */
  localUpsert(table: SyncedTable, row: Row) {
    const existing = this.table(table).get(row.id);
    const full = { ...existing, ...row };
    this.table(table).set(row.id, full);
    this.enqueue(table, row.id, 'upsert', full);
  }

  /** Same effect as softDelete() in src/db/write.ts. */
  localSoftDelete(table: SyncedTable, id: string, now: string) {
    const existing = this.table(table).get(id);
    if (existing) this.table(table).set(id, { ...existing, deleted_at: now, updated_at: now });
    this.enqueue(table, id, 'delete', { id, deleted_at: now, updated_at: now });
  }

  private enqueue(table: SyncedTable, rowId: string, op: 'upsert' | 'delete', payload: object) {
    this.outbox.push({
      seq: ++this.seq,
      table_name: table,
      row_id: rowId,
      op,
      payload: JSON.stringify(payload),
      attempts: 0,
      created_at: new Date().toISOString(),
    });
  }

  // OutboxStore
  async list(limit: number) {
    return this.outbox.slice(0, limit).map((e) => ({ ...e }));
  }
  async remove(seqs: readonly number[]) {
    this.outbox = this.outbox.filter((e) => !seqs.includes(e.seq));
  }
  async markRejected(seqs: readonly number[]) {
    for (const entry of this.outbox) if (seqs.includes(entry.seq)) entry.attempts += 1;
  }
  async pendingRowIds(table: SyncedTable) {
    return new Set(this.outbox.filter((e) => e.table_name === table).map((e) => e.row_id));
  }
  async count() {
    return { pending: this.outbox.length, stuck: this.outbox.filter((e) => e.attempts >= 5).length };
  }

  // LocalStore
  async getCursor(table: SyncedTable) {
    return this.cursors.get(table) ?? null;
  }
  async setCursor(table: SyncedTable, cursor: string) {
    this.cursors.set(table, cursor);
  }
  async columns(table: SyncedTable) {
    return this.schema.get(table) ?? new Set<string>();
  }
  async versions(table: SyncedTable, ids: readonly string[], extra: readonly string[]) {
    const out = new Map<string, LocalVersion>();
    for (const id of ids) {
      const row = this.table(table).get(id);
      if (!row) continue;
      const version: LocalVersion = { updated_at: (row.updated_at as string | undefined) ?? null };
      for (const column of extra) version[column] = row[column];
      out.set(id, version);
    }
    return out;
  }
  async write(table: SyncedTable, changes: LocalWrite) {
    for (const row of changes.upserts) this.table(table).set(row.id, { ...this.table(table).get(row.id), ...row });
    for (const patch of changes.patches) {
      const row = this.table(table).get(patch.id);
      if (row) this.table(table).set(patch.id, { ...row, ...patch.changes });
    }
  }
  notify(tables: readonly SyncedTable[]) {
    this.notified.push([...tables]);
  }
}

const TIME_COLUMNS = new Set(['bedtime', 'wake_time', 'start_time', 'end_time', 'time']);

/** Postgres-like output: "…Z" → "….000000+00:00", "HH:MM" → "HH:MM:00". */
function postgresOut(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
      out[key] = value.replace(/\.(\d{3})Z$/, '.$1000+00:00');
    } else if (typeof value === 'string' && TIME_COLUMNS.has(key) && /^\d{2}:\d{2}$/.test(value)) {
      out[key] = `${value}:00`;
    } else {
      out[key] = value;
    }
  }
  return out;
}

export class FakeServer implements Remote {
  tables = new Map<string, Map<string, Record<string, unknown>>>();
  /** Every call fails like a dropped connection. */
  offline = false;
  /** The next N calls fail with 503. */
  failNext = 0;
  /** Apply the next write, then lose the response (the device sees a network error). */
  loseNextResponse = false;
  /** Rows with these ids are refused (400), failing the whole batch like Postgres. */
  rejectIds = new Set<string>();
  writes = 0;
  private clock = Date.parse('2026-11-04T08:00:00.000Z');

  table(name: string) {
    let table = this.tables.get(name);
    if (!table) {
      table = new Map();
      this.tables.set(name, table);
    }
    return table;
  }

  rows(name: string) {
    return [...this.table(name).values()];
  }

  /** A row written on the server (another device, an Edge Function). */
  serverWrite(name: string, row: Record<string, unknown> & { id: string }) {
    this.table(name).set(row.id, { ...this.table(name).get(row.id), ...row, synced_at: this.tick() });
  }

  private tick(): string {
    this.clock += 1;
    return new Date(this.clock).toISOString().replace(/\.(\d{3})Z$/, '.$1000+00:00');
  }

  private gate(): RemoteResult | null {
    if (this.offline) return { ok: false, retryable: true, message: '0 TypeError: Network request failed' };
    if (this.failNext > 0) {
      this.failNext -= 1;
      return { ok: false, retryable: true, message: '503 Service Unavailable' };
    }
    return null;
  }

  private finish(): RemoteResult {
    if (this.loseNextResponse) {
      this.loseNextResponse = false;
      return { ok: false, retryable: true, message: '0 TypeError: Network request failed' };
    }
    return { ok: true };
  }

  private rejected(rows: Row[]): RemoteResult | null {
    const bad = rows.find((r) => this.rejectIds.has(r.id));
    return bad ? { ok: false, retryable: false, message: `400 23514 row ${bad.id} refused` } : null;
  }

  async upsert(name: string, rows: Row[]) {
    const blocked = this.gate() ?? this.rejected(rows);
    if (blocked) return blocked;
    for (const row of rows) {
      const existing = this.table(name).get(row.id);
      // Last write wins: an older edit never overwrites a newer one (private.sync_row).
      if (existing && String(row.updated_at) < String(existing.updated_at ?? '')) continue;
      this.table(name).set(row.id, { ...existing, ...row, synced_at: this.tick() });
      this.writes += 1;
    }
    return this.finish();
  }

  async insertMissing(name: string, rows: Row[]) {
    const blocked = this.gate() ?? this.rejected(rows);
    if (blocked) return blocked;
    for (const row of rows) {
      if (this.table(name).has(row.id)) continue;
      this.table(name).set(row.id, { ...row, synced_at: this.tick() });
      this.writes += 1;
    }
    return this.finish();
  }

  async softDelete(name: string, id: string, changes: { deleted_at: unknown; updated_at: unknown }) {
    const blocked = this.gate();
    if (blocked) return blocked;
    const existing = this.table(name).get(id);
    if (existing) {
      this.table(name).set(id, { ...existing, ...changes, synced_at: this.tick() });
      this.writes += 1;
    }
    return this.finish();
  }

  async pull(name: string, since: string | null, limit: number) {
    const blocked = this.gate();
    if (blocked) return blocked as Extract<RemoteResult, { ok: false }>;
    const sinceTime = since ? Date.parse(since) : Number.NEGATIVE_INFINITY;
    const rows = this.rows(name)
      .filter((r) => Date.parse(String(r.synced_at)) > sinceTime)
      .sort((a, b) => String(a.synced_at).localeCompare(String(b.synced_at)) || String(a.id).localeCompare(String(b.id)))
      .slice(0, limit)
      .map((r) => postgresOut(r) as RemoteRow);
    return { ok: true as const, rows };
  }
}

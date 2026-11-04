import { getDb } from './client';
import { notifyTables } from './events';
import { nowIso } from './ids';
import { APPEND_ONLY_TABLES, type SyncedTable, type TableName } from './schema';
import { backendMode } from '@/services/config';

type Row = Record<string, unknown> & { id: string };

function sqlValue(value: unknown): string | number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'string') return value;
  return JSON.stringify(value);
}

async function enqueue(table: SyncedTable, rowId: string, op: 'upsert' | 'delete', payload: object) {
  // The outbox only matters when there is a server to sync to.
  if (backendMode !== 'supabase') return;
  await getDb().runAsync(
    'INSERT INTO outbox (table_name, row_id, op, payload, created_at) VALUES (?, ?, ?, ?, ?)',
    table,
    rowId,
    op,
    JSON.stringify(payload),
    nowIso(),
  );
}

/**
 * Inserts or updates a row, stamps `updated_at`, queues it for sync and refreshes live queries.
 * A new row needs every NOT NULL column. For an existing row you may pass only the columns
 * you want to change; the others keep their values.
 */
export async function upsert<T extends Row>(
  table: SyncedTable,
  row: T,
  options: { touch?: TableName[] } = {},
): Promise<void> {
  const db = getDb();
  const now = nowIso();
  const isAppendOnly = APPEND_ONLY_TABLES.includes(table);

  if (!isAppendOnly) {
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM ${table} WHERE id = ?`,
      row.id,
    );
    if (existing) {
      const { id, ...changes } = row;
      await patch(table, id, changes, options);
      return;
    }
  }
  const values: Row = isAppendOnly
    ? { created_at: now, ...row }
    : { created_at: now, ...row, updated_at: now };

  const columns = Object.keys(values);
  const placeholders = columns.map(() => '?').join(', ');
  const updates = columns
    .filter((c) => c !== 'id' && c !== 'created_at')
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');

  const sql = isAppendOnly
    ? `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
    : `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})
       ON CONFLICT(id) DO UPDATE SET ${updates}`;

  await db.runAsync(sql, columns.map((c) => sqlValue(values[c])));

  // Sync the full row so the server never sees a partial insert.
  const full = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM ${table} WHERE id = ?`,
    row.id,
  );
  await enqueue(table, row.id, 'upsert', full ?? values);
  notifyTables([table, ...(options.touch ?? [])]);
}

/** Updates some columns of an existing row. */
export async function patch(
  table: SyncedTable,
  id: string,
  changes: Record<string, unknown>,
  options: { touch?: TableName[] } = {},
): Promise<void> {
  if (APPEND_ONLY_TABLES.includes(table)) throw new Error(`${table} is append-only`);
  const db = getDb();
  // A plain UPDATE: an upsert with only some columns would trip NOT NULL checks on insert.
  const values: Record<string, unknown> = { ...changes, updated_at: nowIso() };
  delete values.id;
  delete values.created_at;
  const columns = Object.keys(values);
  const result = await db.runAsync(
    `UPDATE ${table} SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
    [...columns.map((c) => sqlValue(values[c])), id],
  );
  if (result.changes === 0) throw new Error(`${table} row ${id} does not exist`);

  const full = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM ${table} WHERE id = ?`,
    id,
  );
  if (full) await enqueue(table, id, 'upsert', full);
  notifyTables([table, ...(options.touch ?? [])]);
}

/** Soft-deletes a row so the deletion syncs; queries must filter `deleted_at IS NULL`. */
export async function softDelete(
  table: SyncedTable,
  id: string,
  options: { touch?: TableName[] } = {},
): Promise<void> {
  if (APPEND_ONLY_TABLES.includes(table)) throw new Error(`${table} is append-only`);
  const now = nowIso();
  await getDb().runAsync(
    `UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    now,
    now,
    id,
  );
  await enqueue(table, id, 'delete', { id, deleted_at: now, updated_at: now });
  notifyTables([table, ...(options.touch ?? [])]);
}

/** Small key-value store for device state (timer, sync cursor, flags). Not synced. */
export async function kvGet<T>(key: string): Promise<T | null> {
  const row = await getDb().getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  return row ? (JSON.parse(row.value) as T) : null;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await getDb().runAsync(
    'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    JSON.stringify(value),
  );
  notifyTables(['kv']);
}

export async function kvDelete(key: string): Promise<void> {
  await getDb().runAsync('DELETE FROM kv WHERE key = ?', key);
  notifyTables(['kv']);
}

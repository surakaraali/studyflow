/**
 * OutboxStore and LocalStore over the signed-in user's SQLite file (src/db/client.ts).
 * Pulled rows are written with raw SQL on purpose: going through upsert() would queue them in
 * the outbox and send them straight back to the server.
 */

import type { SQLiteBindValue } from 'expo-sqlite';

import { getDb } from '@/db/client';
import { notifyTables } from '@/db/events';
import type { SyncedTable } from '@/db/schema';

import { MAX_REJECTIONS } from './engine';
import type { LocalStore, LocalVersion, LocalWrite, OutboxEntry, OutboxStore, Row } from './types';

const CURSOR_PREFIX = 'sync.cursor.';
const IN_CHUNK = 400;

function bindValue(value: unknown): SQLiteBindValue {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'string') return value;
  return JSON.stringify(value);
}

function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

export const sqliteOutbox: OutboxStore = {
  async list(limit) {
    return getDb().getAllAsync<OutboxEntry>(
      'SELECT seq, table_name, row_id, op, payload, attempts, created_at FROM outbox ORDER BY seq LIMIT ?',
      limit,
    );
  },
  async remove(seqs) {
    for (let i = 0; i < seqs.length; i += IN_CHUNK) {
      const part = seqs.slice(i, i + IN_CHUNK);
      await getDb().runAsync(`DELETE FROM outbox WHERE seq IN (${part.map(() => '?').join(', ')})`, [...part]);
    }
  },
  async markRejected(seqs) {
    for (let i = 0; i < seqs.length; i += IN_CHUNK) {
      const part = seqs.slice(i, i + IN_CHUNK);
      await getDb().runAsync(
        `UPDATE outbox SET attempts = attempts + 1 WHERE seq IN (${part.map(() => '?').join(', ')})`,
        [...part],
      );
    }
  },
  async pendingRowIds(table) {
    const rows = await getDb().getAllAsync<{ row_id: string }>(
      'SELECT DISTINCT row_id FROM outbox WHERE table_name = ?',
      table,
    );
    return new Set(rows.map((r) => r.row_id));
  },
  async count() {
    const row = await getDb().getFirstAsync<{ pending: number; stuck: number }>(
      `SELECT COUNT(*) AS pending, COALESCE(SUM(CASE WHEN attempts >= ? THEN 1 ELSE 0 END), 0) AS stuck FROM outbox`,
      MAX_REJECTIONS,
    );
    return { pending: row?.pending ?? 0, stuck: row?.stuck ?? 0 };
  },
};

const columnCache = new Map<string, Set<string>>();

export const sqliteLocal: LocalStore = {
  async getCursor(table) {
    const row = await getDb().getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', CURSOR_PREFIX + table);
    if (!row) return null;
    try {
      const value: unknown = JSON.parse(row.value);
      return typeof value === 'string' ? value : null;
    } catch {
      return null;
    }
  },

  async setCursor(table, cursor) {
    // Not kvSet(): that would wake every live query that reads kv.
    await getDb().runAsync(
      'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      CURSOR_PREFIX + table,
      JSON.stringify(cursor),
    );
  },

  async columns(table) {
    const cached = columnCache.get(table);
    if (cached) return cached;
    const info = await getDb().getAllAsync<{ name: string }>(`PRAGMA table_info(${quoteIdent(table)})`);
    const set = new Set(info.map((c) => c.name));
    columnCache.set(table, set);
    return set;
  },

  async versions(table, ids, extraColumns) {
    const result = new Map<string, LocalVersion>();
    const known = await sqliteLocal.columns(table);
    const select = ['id', known.has('updated_at') ? 'updated_at' : 'NULL AS updated_at', ...extraColumns.map(quoteIdent)];
    for (let i = 0; i < ids.length; i += IN_CHUNK) {
      const part = ids.slice(i, i + IN_CHUNK);
      const rows = await getDb().getAllAsync<Row & LocalVersion>(
        `SELECT ${select.join(', ')} FROM ${quoteIdent(table)} WHERE id IN (${part.map(() => '?').join(', ')})`,
        [...part],
      );
      for (const row of rows) result.set(row.id, row);
    }
    return result;
  },

  async write(table, changes: LocalWrite) {
    const db = getDb();
    await db.withTransactionAsync(async () => {
      for (const row of changes.upserts) {
        const columns = Object.keys(row);
        const updates = columns.filter((c) => c !== 'id').map((c) => `${quoteIdent(c)} = excluded.${quoteIdent(c)}`);
        const sql =
          `INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(', ')}) ` +
          `VALUES (${columns.map(() => '?').join(', ')}) ` +
          (updates.length ? `ON CONFLICT(id) DO UPDATE SET ${updates.join(', ')}` : 'ON CONFLICT(id) DO NOTHING');
        await db.runAsync(sql, columns.map((c) => bindValue(row[c])));
      }
      for (const patch of changes.patches) {
        const columns = Object.keys(patch.changes);
        if (columns.length === 0) continue;
        await db.runAsync(
          `UPDATE ${quoteIdent(table)} SET ${columns.map((c) => `${quoteIdent(c)} = ?`).join(', ')} WHERE id = ?`,
          [...columns.map((c) => bindValue(patch.changes[c])), patch.id],
        );
      }
    });
  },

  notify(tables: readonly SyncedTable[]) {
    notifyTables(tables);
  },
};

/** Forget cached column lists (a migration may have added columns). */
export function resetColumnCache() {
  columnCache.clear();
}

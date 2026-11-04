/**
 * Small interfaces the sync engine runs against, so the push/pull logic can be tested without
 * SQLite or the network (see engine.ts and __tests__/engine.test.ts).
 */

import type { SyncedTable } from '@/db/schema';

export type Row = Record<string, unknown> & { id: string };

export type OutboxEntry = {
  seq: number;
  table_name: SyncedTable;
  row_id: string;
  op: 'upsert' | 'delete';
  /** JSON: the full row for 'upsert', { id, deleted_at, updated_at } for 'delete'. */
  payload: string;
  /** Times the server rejected this change (network failures do not count). */
  attempts: number;
  created_at: string;
};

/** The device's queue of local changes (the `outbox` table). */
export interface OutboxStore {
  /** Oldest first. */
  list(limit: number): Promise<OutboxEntry[]>;
  remove(seqs: readonly number[]): Promise<void>;
  /** The server refused these changes; keep them and count the attempt. */
  markRejected(seqs: readonly number[]): Promise<void>;
  /** Ids of rows in `table` that still have changes waiting. */
  pendingRowIds(table: SyncedTable): Promise<Set<string>>;
  count(): Promise<{ pending: number; stuck: number }>;
}

export type LocalVersion = { updated_at: string | null } & Record<string, unknown>;

export type LocalWrite = {
  /** New rows, or rows the server has a newer version of: written in full. */
  upserts: Row[];
  /** Server-owned columns only (e.g. profile.plan) on rows the device edited later. */
  patches: { id: string; changes: Record<string, unknown> }[];
};

/** The device database, written without creating outbox entries. */
export interface LocalStore {
  getCursor(table: SyncedTable): Promise<string | null>;
  setCursor(table: SyncedTable, cursor: string): Promise<void>;
  /** Columns the device has for this table (unknown server columns are dropped). */
  columns(table: SyncedTable): Promise<Set<string>>;
  /** updated_at plus the requested columns for the rows that exist locally. */
  versions(table: SyncedTable, ids: readonly string[], extraColumns: readonly string[]): Promise<Map<string, LocalVersion>>;
  write(table: SyncedTable, changes: LocalWrite): Promise<void>;
  /** Refreshes live queries once a pull has written rows. */
  notify(tables: readonly SyncedTable[]): void;
}

export type RemoteRow = Record<string, unknown> & { id: string; synced_at: string };

export type RemoteResult = { ok: true } | { ok: false; retryable: boolean; message: string };

/** The server (Supabase/PostgREST in the app). */
export interface Remote {
  /** Insert or update rows by id. */
  upsert(table: string, rows: Row[]): Promise<RemoteResult>;
  /** Insert rows by id; rows that already exist are left alone (append-only tables). */
  insertMissing(table: string, rows: Row[]): Promise<RemoteResult>;
  /** Marks a row deleted (no-op when the server never had it). */
  softDelete(table: string, id: string, changes: { deleted_at: unknown; updated_at: unknown }): Promise<RemoteResult>;
  /** Rows changed after `since` (exclusive), oldest first. */
  pull(table: string, since: string | null, limit: number): Promise<{ ok: true; rows: RemoteRow[] } | Extract<RemoteResult, { ok: false }>>;
}

export type SyncDeps = {
  userId: string;
  outbox: OutboxStore;
  local: LocalStore;
  remote: Remote;
  now?: () => Date;
};

export type PushReport = {
  pushed: number;
  rejected: number;
  /** True when the network/server failed and the whole push should be retried later. */
  retryLater: boolean;
  error?: string;
};

export type PullReport = {
  received: number;
  written: number;
  retryLater: boolean;
  error?: string;
};

export type SyncReport = { push: PushReport; pull: PullReport | null };

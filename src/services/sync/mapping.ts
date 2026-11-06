/**
 * Row mapping between SQLite (src/db/schema.ts) and Postgres (supabase/migrations).
 * Column names are the same on both sides; the differences are listed here (ADR-001):
 *   - SQLite `profile` is `profiles`; every other remote table has `user_id`;
 *   - booleans are 0/1 on both sides (smallint), so they copy as they are;
 *   - JSON text columns are jsonb remotely: parsed on push, stringified on pull;
 *   - timestamptz comes back as "…+00:00" and time as "HH:MM:SS"; both are normalised to the
 *     app's formats ("…Z" ISO strings and "HH:MM") so string comparisons keep working;
 *   - server-only columns (user_id, synced_at, review fields…) are dropped on pull, and
 *     device-only columns (documents.file_uri) are never pushed or overwritten;
 *   - server-owned columns (profile.plan, profile.consent_status, …) are never pushed and
 *     always taken from the server on pull.
 */

import { APPEND_ONLY_TABLES, type SyncedTable } from '@/db/schema';

import type { RemoteRow, Row } from './types';

export function remoteTable(table: SyncedTable): string {
  return table === 'profile' ? 'profiles' : table;
}

export function isAppendOnly(table: SyncedTable): boolean {
  return APPEND_ONLY_TABLES.includes(table);
}

const JSON_COLUMNS: Partial<Record<SyncedTable, readonly string[]>> = {
  consent_records: ['purposes'],
  exams: ['topic_ids'],
  summaries: ['content'],
  questions: ['options'],
  quiz_attempts: ['question_ids', 'answers'],
  feedback: ['payload'],
};

const TIME_COLUMNS: Partial<Record<SyncedTable, readonly string[]>> = {
  profile: ['bedtime', 'wake_time'],
  timetable_slots: ['start_time', 'end_time'],
  availability: ['start_time', 'end_time'],
  exams: ['time'],
  plan_items: ['start_time', 'end_time'],
};

const COMMON_TIMESTAMPS = ['created_at', 'updated_at', 'deleted_at'] as const;

const TIMESTAMP_COLUMNS: Partial<Record<SyncedTable, readonly string[]>> = {
  profile: ['ai_notice_accepted_at', 'birth_year_corrected_at'],
  courses: ['archived_at'],
  homework: ['done_at'],
  documents: ['next_attempt_at'],
  quiz_attempts: ['started_at', 'finished_at'],
  cards: ['due', 'last_review'],
  card_reviews: ['due', 'reviewed_at'],
  study_sessions: ['started_at', 'ended_at'],
};

/** Columns that only make sense on this device. */
const DEVICE_ONLY_COLUMNS: Partial<Record<SyncedTable, readonly string[]>> = {
  documents: ['file_uri'],
};

/**
 * Columns the server decides. They are not pushed, and on pull they always take the server's
 * value, even when the device edited the row later (the database also ignores device changes
 * to them, see private.protect_profile / guard_document / protect_report in the migration).
 */
export const SERVER_OWNED_COLUMNS: Partial<Record<SyncedTable, readonly string[]>> = {
  profile: ['plan', 'consent_status', 'email', 'birth_year_corrected_at'],
  documents: ['status', 'error_code', 'attempts', 'next_attempt_at', 'counted'],
  content_reports: ['status'],
};

export function deviceOnlyColumns(table: SyncedTable): readonly string[] {
  return DEVICE_ONLY_COLUMNS[table] ?? [];
}

/** SQLite row → Postgres row. */
export function toRemote(table: SyncedTable, row: Record<string, unknown>, userId: string): Row {
  const out: Record<string, unknown> = {};
  const json = JSON_COLUMNS[table] ?? [];
  const skip = [...(DEVICE_ONLY_COLUMNS[table] ?? []), ...(SERVER_OWNED_COLUMNS[table] ?? [])];
  for (const [key, value] of Object.entries(row)) {
    if (skip.includes(key)) continue;
    out[key] = json.includes(key) ? parseJson(value) : value;
  }
  if (table !== 'profile') out.user_id = userId;
  return out as Row;
}

/** Postgres row → SQLite row, keeping only the columns the device has. */
export function toLocal(table: SyncedTable, row: RemoteRow, localColumns: ReadonlySet<string>): Row {
  const out: Record<string, unknown> = {};
  const json = JSON_COLUMNS[table] ?? [];
  const times = TIME_COLUMNS[table] ?? [];
  const timestamps = [...COMMON_TIMESTAMPS, ...(TIMESTAMP_COLUMNS[table] ?? [])];
  const deviceOnly = DEVICE_ONLY_COLUMNS[table] ?? [];
  for (const [key, value] of Object.entries(row)) {
    if (!localColumns.has(key) || deviceOnly.includes(key)) continue;
    if (value === null || value === undefined) out[key] = null;
    else if (json.includes(key)) out[key] = typeof value === 'string' ? value : JSON.stringify(value);
    else if (times.includes(key)) out[key] = normalizeTime(value);
    else if (timestamps.includes(key)) out[key] = normalizeTimestamp(value);
    else if (typeof value === 'boolean') out[key] = value ? 1 : 0;
    else out[key] = value;
  }
  return out as Row;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    // Not JSON: store it as a JSON string rather than lose it.
    return value;
  }
}

/** "08:30:00" → "08:30". */
export function normalizeTime(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const match = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value);
  return match ? `${match[1]}:${match[2]}` : value;
}

/** "2026-11-04T10:00:00.123456+00:00" → "2026-11-04T10:00:00.123Z" (what nowIso() writes). */
export function normalizeTimestamp(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)?$/.exec(value);
  if (!match) return value;
  const millis = (match[3] ?? '').padEnd(3, '0').slice(0, 3);
  let zone = match[4] ?? 'Z';
  if (zone !== 'Z' && !zone.includes(':')) zone = zone.length === 3 ? `${zone}:00` : `${zone.slice(0, 3)}:${zone.slice(3)}`;
  const date = new Date(`${match[1]}T${match[2]}.${millis}${zone}`);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

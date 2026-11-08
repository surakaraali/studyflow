/**
 * Turns a dev-seed device database into the App Review account's rows (seed-review-account.ts).
 * Pure, so it is unit tested: an adult profile, no consent or report rows, and dates moved so
 * the study history ends yesterday while exams and homework still lie ahead.
 */

import { SYNCED_TABLES, type SyncedTable } from '@/db/schema';
import type { Row } from '@/services/sync/types';

/** Rows the review account must not carry: parent decisions, content reports, beta feedback. */
const DROP_TABLES: readonly SyncedTable[] = ['consent_records', 'content_reports', 'feedback'];

/** Things that already happened: after the shift they are never later than now. */
const PAST_COLUMNS = new Set([
  'created_at',
  'started_at',
  'ended_at',
  'finished_at',
  'reviewed_at',
  'last_review',
  'done_at',
  'archived_at',
]);
const SHIFT_COLUMNS = new Set([...PAST_COLUMNS, 'date', 'due_date', 'due', 'next_attempt_at']);

/** Age by birth year only, like the app; 19 stays 18+ across a new year. */
export const REVIEW_AGE = 19;

export type ReviewRows = {
  tables: Map<SyncedTable, Row[]>;
  ids: Map<SyncedTable, Set<string>>;
  shiftDays: number;
  lastStudyDay: string | null;
};

const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" in Türkiye (UTC+3 all year). */
export function istanbulDay(now: Date): string {
  return new Date(now.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
}

function dayNumber(day: string): number {
  return Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
}

/** Moves the leading date of "YYYY-MM-DD…" by `days`, keeping the rest of the string. */
export function shiftDate(value: unknown, days: number): unknown {
  if (typeof value !== 'string' || days === 0) return value;
  const match = /^(\d{4}-\d{2}-\d{2})(.*)$/s.exec(value);
  if (!match) return value;
  const shifted = new Date((dayNumber(match[1]) + days) * DAY_MS).toISOString().slice(0, 10);
  return `${shifted}${match[2]}`;
}

function notAfter(value: unknown, now: Date): unknown {
  if (typeof value !== 'string') return value;
  const time = Date.parse(value);
  return Number.isFinite(time) && time > now.getTime() ? now.toISOString() : value;
}

export function prepareReviewRows(
  source: Map<SyncedTable, Row[]>,
  { userId, now }: { userId: string; now: Date },
): ReviewRows {
  const live = (table: SyncedTable) => (source.get(table) ?? []).filter((row) => !row.deleted_at);

  // The seed's history ends the day before it ran; move that day to yesterday.
  const sessionDays = live('study_sessions')
    .map((row) => row.date)
    .filter((day): day is string => typeof day === 'string')
    .sort();
  const anchor = sessionDays.at(-1) ?? null;
  const yesterday = dayNumber(istanbulDay(now)) - 1;
  const shiftDays = anchor ? yesterday - dayNumber(anchor) : 0;

  const nowIso = now.toISOString();
  const today = istanbulDay(now);
  const tables = new Map<SyncedTable, Row[]>();
  const ids = new Map<SyncedTable, Set<string>>();

  for (const table of SYNCED_TABLES) {
    if (DROP_TABLES.includes(table)) continue;
    const rows: Row[] = [];
    for (const original of live(table)) {
      const row: Record<string, unknown> = { ...original };
      // Official LGS/YKS dates are fixed; everything else moves with the history.
      const fixedDate = table === 'exams' && Boolean(row.official_key);
      for (const column of Object.keys(row)) {
        if (!SHIFT_COLUMNS.has(column) || (fixedDate && column === 'date')) continue;
        row[column] = shiftDate(row[column], shiftDays);
        if (PAST_COLUMNS.has(column)) row[column] = notAfter(row[column], now);
      }
      // Newer than any earlier run, so a re-run refreshes the rows (last write wins).
      row.updated_at = nowIso;

      if (table === 'profile') {
        Object.assign(row, {
          id: userId,
          birth_year: Number(today.slice(0, 4)) - REVIEW_AGE,
          grade: 12,
          segment: 'lise',
          parent_email: null,
          waitlist_parent_email: null,
          // The reviewer sees the AI notice and the notification prompt like a new student.
          ai_notice_accepted_at: null,
          notif_permission_asked: 0,
          onboarding_done: 1,
          birth_year_corrected_at: null,
        });
      }
      if (table === 'documents') {
        Object.assign(row, { storage_path: null, file_uri: null, quota_month: today.slice(0, 7) });
      }
      rows.push(row as Row);
    }
    if (rows.length) {
      tables.set(table, rows);
      ids.set(table, new Set(rows.map((row) => row.id)));
    }
  }

  const lastStudyDay = anchor ? (shiftDate(anchor, shiftDays) as string) : null;
  return { tables, ids, shiftDays, lastStudyDay };
}

import { getDb } from '@/db/client';
import type { TableName } from '@/db/schema';
import { parseDate, weekStart } from '@/lib/dates';

import {
  weekStarts,
  type AttemptInput,
  type PlanItemInput,
  type ProgressInput,
  type QuestionInput,
  type SessionInput,
} from './stats';

/** Tables the progress screen reads; the live query re-runs when one of them changes. */
export const PROGRESS_TABLES: readonly TableName[] = [
  'study_sessions',
  'plan_items',
  'quiz_attempts',
  'quizzes',
  'questions',
  'courses',
  'streak_freezes',
];

/** Loads the rows the progress stats need: the last 4 weeks plus per-day totals for the streak. */
export async function loadProgressInput(today: string): Promise<ProgressInput> {
  const db = getDb();
  const from = weekStarts(today)[0];
  // finished_at is a UTC timestamp; start a day early so local-time edges are kept, stats filter exactly.
  const fromIso = new Date(parseDate(from).getTime() - 86_400_000).toISOString();
  const monday = weekStart(today);

  const [sessions, planItems, attempts, questions, minutesPerDay, blocksPerDay, freezes, history] =
    await Promise.all([
      db.getAllAsync<SessionInput>(
        `SELECT course_id, date, minutes FROM study_sessions
         WHERE deleted_at IS NULL AND date >= ?`,
        from,
      ),
      db.getAllAsync<PlanItemInput>(
        `SELECT date, status FROM plan_items
         WHERE deleted_at IS NULL AND date >= ? AND date <= date(?, '+6 days')`,
        monday,
        monday,
      ),
      db.getAllAsync<AttemptInput>(
        `SELECT q.course_id, a.finished_at, a.question_ids, a.answers, a.retry_of
         FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
         WHERE a.deleted_at IS NULL AND q.deleted_at IS NULL
           AND a.status = 'done' AND a.finished_at IS NOT NULL AND a.finished_at >= ?`,
        fromIso,
      ),
      db.getAllAsync<QuestionInput>(
        `SELECT id, correct_index, topic FROM questions
         WHERE deleted_at IS NULL AND hidden = 0 AND quiz_id IN (
           SELECT quiz_id FROM quiz_attempts
           WHERE deleted_at IS NULL AND status = 'done' AND finished_at >= ?
         )`,
        fromIso,
      ),
      db.getAllAsync<{ date: string; minutes: number }>(
        `SELECT date, SUM(minutes) AS minutes FROM study_sessions
         WHERE deleted_at IS NULL GROUP BY date`,
      ),
      db.getAllAsync<{ date: string; blocks: number }>(
        `SELECT date, COUNT(*) AS blocks FROM plan_items
         WHERE deleted_at IS NULL AND status = 'done' GROUP BY date`,
      ),
      db.getAllAsync<{ date: string; week: string }>(
        'SELECT date, week FROM streak_freezes WHERE deleted_at IS NULL',
      ),
      db.getFirstAsync<{ any: number }>(
        `SELECT (
           EXISTS (SELECT 1 FROM study_sessions WHERE deleted_at IS NULL)
           OR EXISTS (SELECT 1 FROM plan_items WHERE deleted_at IS NULL AND status = 'done')
           OR EXISTS (SELECT 1 FROM quiz_attempts WHERE deleted_at IS NULL AND status = 'done')
         ) AS any`,
      ),
    ]);

  return {
    sessions,
    planItems,
    attempts,
    questions,
    minutesPerDay,
    blocksPerDay,
    freezes,
    hasHistory: history?.any === 1,
  };
}

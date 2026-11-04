/** Streak storage (US-56): reads activity per day and stores the freezes the rule uses. */

import { getDb } from '@/db/client';
import { newId } from '@/db/ids';
import { upsert } from '@/db/write';
import { computeStreak, type DayActivity, type StreakResult } from '@/domain/streak';
import { addDays } from '@/lib/dates';

/** A streak longer than this is not looked at (it only bounds the query). */
const LOOKBACK_DAYS = 400;

export const STREAK_TABLES = ['plan_items', 'study_sessions', 'streak_freezes'] as const;

let chain: Promise<unknown> = Promise.resolve();

/**
 * Current streak; stores any freeze the rule just used. Calls run one at a time so two
 * screens never store the same week's freeze twice.
 */
export function loadStreak(today: string): Promise<StreakResult> {
  const run = chain.then(() => load(today));
  chain = run.catch(() => undefined);
  return run;
}

async function load(today: string): Promise<StreakResult> {
  const db = getDb();
  const since = addDays(today, -LOOKBACK_DAYS);
  const [blocks, minutes, freezes] = await Promise.all([
    db.getAllAsync<{ date: string; n: number }>(
      `SELECT date, COUNT(*) AS n FROM plan_items
       WHERE deleted_at IS NULL AND status = 'done' AND date >= ? GROUP BY date`,
      since,
    ),
    db.getAllAsync<{ date: string; m: number }>(
      `SELECT date, SUM(minutes) AS m FROM study_sessions
       WHERE deleted_at IS NULL AND date >= ? GROUP BY date`,
      since,
    ),
    db.getAllAsync<{ date: string; week: string }>(
      'SELECT date, week FROM streak_freezes WHERE deleted_at IS NULL',
    ),
  ]);

  const activity: Record<string, DayActivity> = {};
  const get = (date: string) => (activity[date] ??= { blocksDone: 0, minutes: 0 });
  for (const row of blocks) get(row.date).blocksDone += row.n;
  for (const row of minutes) get(row.date).minutes += row.m;

  const result = computeStreak({ today, activity, freezes, maxDays: LOOKBACK_DAYS });

  // One freeze per week: never store a second one for a week that already has one.
  const usedWeeks = new Set(freezes.map((f) => f.week));
  for (const freeze of result.newFreezes) {
    if (usedWeeks.has(freeze.week)) continue;
    usedWeeks.add(freeze.week);
    await upsert('streak_freezes', { id: newId(), week: freeze.week, date: freeze.date });
  }
  return result;
}

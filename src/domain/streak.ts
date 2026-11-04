/**
 * Study streak (US-56, BR-17). Pure: the caller passes the activity per day and today's date.
 *
 * - A day counts with at least one finished block or 10+ minutes logged.
 * - The streak is the run of counted days that ends today or yesterday (today is not over yet).
 * - Each ISO week has one freeze. It is used automatically on a single missed day whose
 *   previous day counted, so one missed day does not break the streak. A frozen day keeps the
 *   streak alive but does not add to it. Two missed days in a row always end the streak.
 */

import { addDays, isoWeek } from '../lib/dates';
import { dayCountsForStreak } from './rules';

export type DayActivity = { blocksDone: number; minutes: number };

export type StreakFreezeRecord = { date: string; week: string };

export type StreakInput = {
  today: string;
  /** "YYYY-MM-DD" → what happened that day. Missing days had no activity. */
  activity: Record<string, DayActivity>;
  /** Freezes already used (stored in streak_freezes). */
  freezes: StreakFreezeRecord[];
  /** How far back to look, in days. */
  maxDays?: number;
};

export type StreakResult = {
  /** Counted days in the current run. */
  current: number;
  todayCounts: boolean;
  /** Freezes this calculation used; the caller stores them. */
  newFreezes: StreakFreezeRecord[];
  /** True when this week's freeze is already used. */
  freezeUsedThisWeek: boolean;
};

export function dayCounts(activity: DayActivity | undefined): boolean {
  return activity != null && dayCountsForStreak(activity.blocksDone, activity.minutes);
}

export function computeStreak(input: StreakInput): StreakResult {
  const { today, activity } = input;
  const counts = (date: string) => dayCounts(activity[date]);
  const frozen = new Set(input.freezes.map((f) => f.date));
  const usedWeeks = new Set(input.freezes.map((f) => f.week));
  const newFreezes: StreakFreezeRecord[] = [];

  const todayCounts = counts(today);
  let date = todayCounts ? today : addDays(today, -1);
  let current = 0;

  for (let i = 0; i < (input.maxDays ?? 730); i++) {
    if (counts(date)) {
      current++;
    } else if (!frozen.has(date)) {
      const week = isoWeek(date);
      if (usedWeeks.has(week) || !counts(addDays(date, -1))) break;
      newFreezes.push({ date, week });
      usedWeeks.add(week);
      frozen.add(date);
    }
    date = addDays(date, -1);
  }

  return {
    current,
    todayCounts,
    newFreezes,
    freezeUsedThisWeek: usedWeeks.has(isoWeek(today)),
  };
}

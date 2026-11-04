/**
 * Numbers for the progress screen (US-57, FR-AN-01..03, KPI G-02 and G-03).
 * Pure functions over plain rows, so they can be tested without a database.
 * Dates are local "YYYY-MM-DD" strings; weeks start on Monday.
 */

import { computeStreak, type StreakFreezeRecord } from '@/domain/streak';
import { addDays, daysBetween, formatDate, weekStart } from '@/lib/dates';

/** How many weeks the trends look back, this week included (G-03 measures a 4-week change). */
export const TREND_WEEKS = 4;

export type SessionInput = {
  course_id: string | null;
  date: string;
  minutes: number;
};

export type PlanItemInput = {
  date: string;
  status: 'planned' | 'done' | 'skipped';
};

export type AttemptInput = {
  course_id: string;
  /** ISO timestamp */
  finished_at: string;
  /** JSON array of question ids */
  question_ids: string;
  /** JSON object: question id → chosen option index, or null for blank */
  answers: string;
  retry_of: string | null;
};

export type QuestionInput = {
  id: string;
  correct_index: number;
  topic: string | null;
};

export type StreakDayInput = {
  date: string;
  blocksDone: number;
  minutes: number;
};

/** Mondays of the last `count` weeks, oldest first; the last one is this week's Monday. */
export function weekStarts(today: string, count: number = TREND_WEEKS): string[] {
  const thisWeek = weekStart(today);
  return Array.from({ length: count }, (_, i) => addDays(thisWeek, -7 * (count - 1 - i)));
}

/** Index of the week `date` falls in, counted from `firstMonday`; -1 when outside the range. */
function weekIndex(date: string, firstMonday: string, count: number): number {
  const days = daysBetween(firstMonday, date);
  if (days < 0) return -1;
  const index = Math.floor(days / 7);
  return index < count ? index : -1;
}

/** Total study minutes per week for the last TREND_WEEKS weeks, oldest first. */
export function weeklyMinutes(sessions: SessionInput[], today: string): number[] {
  const starts = weekStarts(today);
  const totals = starts.map(() => 0);
  for (const s of sessions) {
    if (s.date > today) continue;
    const i = weekIndex(s.date, starts[0], starts.length);
    if (i >= 0) totals[i] += Math.max(0, s.minutes);
  }
  return totals;
}

export type CourseMinutes = {
  /** null = sessions logged without a course */
  courseId: string | null;
  minutes: number;
  lastWeek: number;
};

/** This week's minutes per course (FR-AN-01), most studied first, with last week's minutes beside. */
export function minutesByCourse(sessions: SessionInput[], today: string): CourseMinutes[] {
  const thisMonday = weekStart(today);
  const lastMonday = addDays(thisMonday, -7);
  const rows = new Map<string | null, CourseMinutes>();

  for (const s of sessions) {
    if (s.date > today || s.date < lastMonday) continue;
    const row = rows.get(s.course_id) ?? { courseId: s.course_id, minutes: 0, lastWeek: 0 };
    if (s.date >= thisMonday) row.minutes += Math.max(0, s.minutes);
    else row.lastWeek += Math.max(0, s.minutes);
    rows.set(s.course_id, row);
  }

  return [...rows.values()]
    .filter((row) => row.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
}

export type Adherence = {
  done: number;
  /** Blocks due so far this week (up to today), plus blocks finished ahead of time. */
  planned: number;
  /** Blocks still ahead this week. */
  remaining: number;
  /** done / planned, or null when nothing was due yet. */
  ratio: number | null;
};

/**
 * Plan adherence (FR-AN-03, KPI G-02): finished blocks out of the blocks planned this week.
 * Blocks later in the week are not counted yet, so the ratio is fair on a Monday too.
 */
export function planAdherence(items: PlanItemInput[], today: string): Adherence {
  const monday = weekStart(today);
  const sunday = addDays(monday, 6);
  let done = 0;
  let planned = 0;
  let remaining = 0;

  for (const item of items) {
    if (item.date < monday || item.date > sunday) continue;
    if (item.status === 'done') {
      done += 1;
      planned += 1;
    } else if (item.date <= today) {
      planned += 1;
    } else if (item.status === 'planned') {
      remaining += 1;
    }
  }

  return { done, planned, remaining, ratio: planned > 0 ? done / planned : null };
}

/** Finished blocks per day this week, Monday first (the optik grid: one bubble per block). */
export function doneBlocksPerDay(items: PlanItemInput[], today: string): number[] {
  const monday = weekStart(today);
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const item of items) {
    if (item.status !== 'done') continue;
    const i = daysBetween(monday, item.date);
    if (i >= 0 && i < 7) counts[i] += 1;
  }
  return counts;
}

/**
 * Current streak in days (BR-17, US-56). Uses the streak module of the plan feature, so this
 * screen and the Today screen always show the same number (including the weekly freeze).
 * Display only: freezes it would use are stored by the plan feature, not here.
 */
export function currentStreak(
  days: StreakDayInput[],
  freezes: StreakFreezeRecord[],
  today: string,
): number {
  const activity: Record<string, { blocksDone: number; minutes: number }> = {};
  for (const day of days) activity[day.date] = { blocksDone: day.blocksDone, minutes: day.minutes };
  return computeStreak({ today, activity, freezes }).current;
}

/** Joins minutes and finished blocks per date, for currentStreak. */
export function streakDays(
  minutesPerDay: { date: string; minutes: number }[],
  blocksPerDay: { date: string; blocks: number }[],
): StreakDayInput[] {
  const byDate = new Map<string, StreakDayInput>();
  const get = (date: string) => {
    const day = byDate.get(date) ?? { date, blocksDone: 0, minutes: 0 };
    byDate.set(date, day);
    return day;
  };
  for (const row of minutesPerDay) get(row.date).minutes += row.minutes;
  for (const row of blocksPerDay) get(row.date).blocksDone += row.blocks;
  return [...byDate.values()];
}

export type AccuracyStat = {
  correct: number;
  /** Questions asked (blanks count as not correct). */
  total: number;
  /** correct / total over the whole window, or null without answers. */
  ratio: number | null;
  /** Ratio per week, oldest first; null for weeks without answers. */
  weekly: (number | null)[];
  /**
   * Change in percentage points from the first to the last week that has answers
   * (FR-AN-02, KPI G-03). Null with fewer than two weeks of answers.
   */
  change: number | null;
};

export type TopicAccuracy = AccuracyStat & { topic: string };
export type CourseAccuracy = AccuracyStat & { courseId: string; topics: TopicAccuracy[] };

type Tally = { correct: number[]; total: number[] };

function emptyTally(weeks: number): Tally {
  return { correct: Array(weeks).fill(0), total: Array(weeks).fill(0) };
}

function toStat(tally: Tally): AccuracyStat {
  const correct = tally.correct.reduce((a, b) => a + b, 0);
  const total = tally.total.reduce((a, b) => a + b, 0);
  const weekly = tally.total.map((t, i) => (t > 0 ? tally.correct[i] / t : null));
  const withData = weekly.filter((w): w is number => w != null);
  const change =
    withData.length >= 2
      ? Math.round((withData[withData.length - 1] - withData[0]) * 100)
      : null;
  return { correct, total, ratio: total > 0 ? correct / total : null, weekly, change };
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    const value = JSON.parse(text) as unknown;
    return value != null && typeof value === 'object' ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Local calendar date of an ISO timestamp. */
export function localDate(iso: string): string {
  return formatDate(new Date(iso));
}

/**
 * Accuracy per course and per topic over the last TREND_WEEKS weeks (FR-AN-02).
 *
 * Each answer in an attempt is checked against the question's correct option. Retry attempts
 * (only the wrong and blank questions, right after seeing the answers) are left out because
 * they would inflate the trend. Removed or hidden questions are skipped: a reported question
 * may have a wrong answer key.
 */
export function accuracyByCourse(
  attempts: AttemptInput[],
  questions: Map<string, QuestionInput>,
  today: string,
): CourseAccuracy[] {
  const starts = weekStarts(today);
  const weeks = starts.length;
  const courses = new Map<string, { tally: Tally; topics: Map<string, { name: string; tally: Tally }> }>();

  for (const attempt of attempts) {
    if (attempt.retry_of) continue;
    const date = localDate(attempt.finished_at);
    if (date > today) continue;
    const w = weekIndex(date, starts[0], weeks);
    if (w < 0) continue;

    const ids = parseJson<unknown[]>(attempt.question_ids, []);
    const answers = parseJson<Record<string, unknown>>(attempt.answers, {});
    if (!Array.isArray(ids)) continue;

    let course = courses.get(attempt.course_id);
    if (!course) {
      course = { tally: emptyTally(weeks), topics: new Map() };
      courses.set(attempt.course_id, course);
    }

    for (const id of ids) {
      if (typeof id !== 'string') continue;
      const question = questions.get(id);
      if (!question) continue;
      const isCorrect = answers[id] === question.correct_index ? 1 : 0;

      course.tally.total[w] += 1;
      course.tally.correct[w] += isCorrect;

      const name = question.topic?.trim();
      if (!name) continue;
      // AI topic names vary in case ("Hücre" / "hücre"); group them together.
      const key = name.toLocaleLowerCase('tr-TR');
      let topic = course.topics.get(key);
      if (!topic) {
        topic = { name, tally: emptyTally(weeks) };
        course.topics.set(key, topic);
      }
      topic.tally.total[w] += 1;
      topic.tally.correct[w] += isCorrect;
    }
  }

  return [...courses.entries()]
    .map(([courseId, course]) => ({
      courseId,
      ...toStat(course.tally),
      topics: [...course.topics.values()]
        .map((topic) => ({ topic: topic.name, ...toStat(topic.tally) }))
        .filter((topic) => topic.total > 0)
        .sort((a, b) => (a.ratio ?? 0) - (b.ratio ?? 0) || b.total - a.total),
    }))
    .filter((course) => course.total > 0)
    .sort((a, b) => b.total - a.total);
}

export type ProgressInput = {
  sessions: SessionInput[];
  planItems: PlanItemInput[];
  attempts: AttemptInput[];
  questions: QuestionInput[];
  minutesPerDay: { date: string; minutes: number }[];
  blocksPerDay: { date: string; blocks: number }[];
  freezes: StreakFreezeRecord[];
  /** Anything ever recorded: sessions, finished blocks or finished quizzes. */
  hasHistory: boolean;
};

export type ProgressStats = {
  today: string;
  weekStart: string;
  hasHistory: boolean;
  streak: number;
  weekMinutes: number;
  weeklyMinutes: number[];
  weekStarts: string[];
  byCourse: CourseMinutes[];
  adherence: Adherence;
  blocksPerDay: number[];
  accuracy: CourseAccuracy[];
};

/** Everything the progress screen shows, from the rows the repo loads. */
export function buildProgress(input: ProgressInput, today: string): ProgressStats {
  const weekly = weeklyMinutes(input.sessions, today);
  return {
    today,
    weekStart: weekStart(today),
    hasHistory: input.hasHistory,
    streak: currentStreak(streakDays(input.minutesPerDay, input.blocksPerDay), input.freezes, today),
    weekMinutes: weekly[weekly.length - 1],
    weeklyMinutes: weekly,
    weekStarts: weekStarts(today),
    byCourse: minutesByCourse(input.sessions, today),
    adherence: planAdherence(input.planItems, today),
    blocksPerDay: doneBlocksPerDay(input.planItems, today),
    accuracy: accuracyByCourse(
      input.attempts,
      new Map(input.questions.map((q) => [q.id, q])),
      today,
    ),
  };
}

/**
 * Plan engine v1 (US-48, BR-07–BR-11) with missed-block carry-over (US-49, BR-10).
 *
 * A pure, deterministic function: the same input always gives the same plan.
 * No I/O and no clock reads; the caller passes `now`.
 *
 * How a plan is built, day by day over the next 14 days:
 * 1. Free time = availability (weekday/weekend) ∩ [wake, bedtime] − school − blocks we keep.
 *    It is cut into a grid of `block + break` slots that starts at the beginning of each free
 *    window, so the plan does not shift every time the app opens.
 * 2. Homework due on D gets one homework block on the latest allowed day before D.
 * 3. Missed blocks (planned, in the past) move into the 3 days after the day they were first
 *    planned for, onto the day with the most room under the cap. Blocks that do not fit stay
 *    where they are and the result carries a "plan is tight" warning; nothing is deleted.
 * 4. The rest of the day is filled up to the daily goal, or up to the daily cap when an exam is
 *    within 7 days. Courses are picked by weight (days to exam, topic difficulty, low accuracy)
 *    with a smooth weighted round robin, never more than 2 of the same course in a row.
 *
 * Exam rules (BR-11): no block of a course on its exam day; the day before an exam holds only
 * review blocks of that exam.
 * Official exams (LGS/YKS, no course): no blocks at all on the exam day; the day before holds
 * only light review (any course, up to the daily goal); within 7 days the day may reach the cap.
 */

import { addDays, daysBetween, formatDate, isoWeekday } from '../lib/dates';
import {
  blockRules,
  breakMinutesFor,
  clampBlockMinutes,
  dailyCapMinutes,
  defaultDailyGoal,
  defaultSleep,
  fromMinutes,
  type Segment,
} from './rules';

export const PLAN_HORIZON_DAYS = 14;
/** BR-10: a missed block can move into the 3 days after the day it was planned for. */
export const CARRY_DAYS = 3;
/** BR-11: an exam this close gets the highest priority and the day may go up to the cap. */
export const NEAR_EXAM_DAYS = 7;
/** School slots closer than this are one school day (lunch breaks are not study time). */
const SCHOOL_MERGE_GAP = 90;
/** "Spread courses": at most this many blocks of the same course in a row. */
const MAX_SAME_IN_A_ROW = 2;
const DAY_END = 24 * 60;

export type PlanKind = 'study' | 'review' | 'homework';
export type PlanStatus = 'planned' | 'done' | 'skipped';
export type TimeRange = { start: string; end: string };

export type EngineProfile = {
  segment: Segment;
  blockMin?: number | null;
  breakMin?: number | null;
  dailyGoalMin?: number | null;
  dailyCapOverride?: number | null;
  bedtime?: string | null;
  wakeTime?: string | null;
};

/** A school timetable row. 1 = Monday … 7 = Sunday. */
export type EngineTimetableSlot = { weekday: number; start: string; end: string };
export type EngineTopic = { id: string; courseId: string; difficulty: number };
/** `courseId` is null for official exams (LGS, YKS). */
export type EngineExam = { id: string; courseId: string | null; date: string; topicIds: string[] };
export type EngineHomework = { id: string; courseId: string; dueDate: string; done: boolean };

/** An existing plan item (not deleted). */
export type EngineItem = {
  id: string;
  date: string;
  start: string;
  end: string;
  minutes: number;
  breakMin: number;
  kind: PlanKind;
  courseId: string | null;
  topicId: string | null;
  examId: string | null;
  homeworkId: string | null;
  status: PlanStatus;
  source: 'auto' | 'manual';
  /** The day the block was first planned for, when it has been moved. */
  carriedFrom: string | null;
};

export type PlanInput = {
  now: Date;
  horizonDays?: number;
  profile: EngineProfile;
  timetable: EngineTimetableSlot[];
  availability: { weekday: TimeRange[]; weekend: TimeRange[] };
  /** Active courses, in display order. */
  courses: { id: string }[];
  topics: EngineTopic[];
  exams: EngineExam[];
  homework: EngineHomework[];
  /** Recent correct-answer rate, 0…1. Missing means "no data". */
  accuracy?: { course?: Record<string, number>; topic?: Record<string, number> };
  existing: EngineItem[];
};

/** A new auto block (status 'planned', source 'auto'). */
export type NewBlock = {
  date: string;
  start: string;
  end: string;
  minutes: number;
  breakMin: number;
  kind: PlanKind;
  courseId: string | null;
  topicId: string | null;
  examId: string | null;
  homeworkId: string | null;
};

/** A missed block moved to a new slot (BR-10). */
export type CarryMove = {
  id: string;
  date: string;
  start: string;
  end: string;
  minutes: number;
  breakMin: number;
  kind: PlanKind;
  examId: string | null;
  carriedFrom: string;
};

export type PlanWarning =
  /** Missed blocks did not fit into the next 3 days. They are kept. */
  | { code: 'plan_tight'; count: number }
  /** There are courses but no free study time in the whole horizon. */
  | { code: 'no_time' };

export type PlanResult = {
  blocks: NewBlock[];
  moves: CarryMove[];
  /** Missed blocks that did not fit; they stay untouched. */
  stuck: string[];
  warnings: PlanWarning[];
};

type Interval = [number, number];

type Settings = {
  segment: Segment;
  block: number;
  brk: number;
  wake: number;
  bed: number;
  goal: number;
  override: number | null;
};

type Ctx = {
  today: string;
  nowMin: number;
  settings: Settings;
  courses: string[];
  courseSet: Set<string>;
  topicsByCourse: Map<string, EngineTopic[]>;
  topicById: Map<string, EngineTopic>;
  /** Upcoming exams (today or later) of active courses and official exams, by date. */
  exams: EngineExam[];
  /** Every exam, also past ones, to tell when a missed block's exam is over. */
  allExams: Map<string, EngineExam>;
  homework: Map<string, EngineHomework>;
  courseAccuracy: Record<string, number>;
  topicAccuracy: Record<string, number>;
  timetable: EngineTimetableSlot[];
  availability: PlanInput['availability'];
};

type Queued = {
  carryId: string | null;
  carriedFrom: string | null;
  kind: PlanKind;
  courseId: string | null;
  topicId: string | null;
  examId: string | null;
  homeworkId: string | null;
};

type Day = {
  date: string;
  cap: number;
  /** Free slot starts (minutes), ascending. Queued blocks take them in order. */
  slots: number[];
  /** Minutes counted toward the daily cap. */
  used: number;
  /** Minutes of blocks moved away from this day; they count toward the goal only. */
  credit: number;
  examCourses: Set<string>;
  officialExam: boolean;
  eveExams: EngineExam[];
  eveOfficial: EngineExam | null;
  nearExam: boolean;
  queue: Queued[];
};

// ---------------------------------------------------------------------------------------------
// Small helpers

export function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes <= DAY_END ? minutes : null;
}

/** Compares string tuples left to right (stable, locale-free ordering). */
function compareKeys(a: string[], b: string[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function nowMinutes(now: Date) {
  return now.getHours() * 60 + now.getMinutes();
}

/** Sorts and joins intervals that overlap or are at most `gap` minutes apart. */
function mergeIntervals(list: Interval[], gap = 0): Interval[] {
  const sorted = [...list].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: Interval[] = [];
  for (const [s, e] of sorted) {
    const last = out[out.length - 1];
    if (last && s - last[1] <= gap) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

function subtract(windows: Interval[], busy: Interval[]): Interval[] {
  let result = windows;
  for (const [bs, be] of busy) {
    const next: Interval[] = [];
    for (const [ws, we] of result) {
      if (be <= ws || bs >= we) {
        next.push([ws, we]);
        continue;
      }
      if (bs > ws) next.push([ws, bs]);
      if (be < we) next.push([be, we]);
    }
    result = next;
  }
  return result;
}

function toIntervals(ranges: TimeRange[]): Interval[] {
  const out: Interval[] = [];
  for (const range of ranges) {
    const s = parseTime(range.start);
    const e = parseTime(range.end);
    if (s == null || e == null) continue;
    // "18:00–00:00" means until midnight.
    const end = e === 0 && s > 0 ? DAY_END : e;
    if (end > s) out.push([s, end]);
  }
  return out;
}

/** BR-07: the student's block and break length, BR-09 sleep window, goal and cap inputs. */
function resolveSettings(profile: EngineProfile): Settings {
  const { segment } = profile;
  const rules = blockRules(segment);
  const block = clampBlockMinutes(segment, profile.blockMin ?? rules.study);
  const brk =
    profile.breakMin != null && profile.breakMin >= 0
      ? Math.round(profile.breakMin)
      : profile.blockMin != null
        ? breakMinutesFor(segment, block)
        : rules.break;
  const sleep = defaultSleep(segment);
  const wake = parseTime(profile.wakeTime) ?? parseTime(sleep.wake) ?? 7 * 60;
  let bed = parseTime(profile.bedtime) ?? parseTime(sleep.bedtime) ?? 22 * 60;
  // A bedtime after midnight: plan until midnight at the latest.
  if (bed <= wake) bed = DAY_END;
  const goal =
    profile.dailyGoalMin != null && profile.dailyGoalMin > 0
      ? profile.dailyGoalMin
      : defaultDailyGoal(segment);
  return { segment, block, brk, wake, bed, goal, override: profile.dailyCapOverride ?? null };
}

function makeContext(input: PlanInput): Ctx {
  const today = formatDate(input.now);
  const courses = input.courses.map((c) => c.id);
  const courseSet = new Set(courses);

  const topicsByCourse = new Map<string, EngineTopic[]>();
  const topicById = new Map<string, EngineTopic>();
  for (const topic of input.topics) {
    if (!courseSet.has(topic.courseId)) continue;
    topicById.set(topic.id, topic);
    const list = topicsByCourse.get(topic.courseId) ?? [];
    list.push(topic);
    topicsByCourse.set(topic.courseId, list);
  }

  const allExams = new Map(input.exams.map((e) => [e.id, e]));
  const exams = input.exams
    .filter((e) => e.date >= today && (e.courseId == null || courseSet.has(e.courseId)))
    .sort((a, b) => compareKeys([a.date, a.id], [b.date, b.id]));

  return {
    today,
    nowMin: nowMinutes(input.now),
    settings: resolveSettings(input.profile),
    courses,
    courseSet,
    topicsByCourse,
    topicById,
    exams,
    allExams,
    homework: new Map(input.homework.map((h) => [h.id, h])),
    courseAccuracy: input.accuracy?.course ?? {},
    topicAccuracy: input.accuracy?.topic ?? {},
    timetable: input.timetable,
    availability: input.availability,
  };
}

/** True when regeneration may replace this item: a future, untouched auto block. */
export function isReplaceable(item: EngineItem, today: string, nowMin: number): boolean {
  if (item.status !== 'planned' || item.source !== 'auto' || item.carriedFrom != null) return false;
  if (item.date > today) return true;
  return item.date === today && (parseTime(item.start) ?? 0) >= nowMin;
}

/** School hours of one weekday as busy spans (BR-09). */
function schoolSpans(timetable: EngineTimetableSlot[], weekday: number): Interval[] {
  const spans: Interval[] = [];
  for (const slot of timetable) {
    if (slot.weekday !== weekday) continue;
    const s = parseTime(slot.start);
    const e = parseTime(slot.end);
    if (s != null && e != null && e > s) spans.push([s, e]);
  }
  return mergeIntervals(spans, SCHOOL_MERGE_GAP);
}

function buildDay(
  ctx: Ctx,
  date: string,
  occupied: EngineItem[],
  credits: EngineItem[],
  len: number,
  brk: number,
): Day {
  const weekday = isoWeekday(date);
  const weekend = weekday >= 6;
  const { settings } = ctx;

  const ranges = weekend ? ctx.availability.weekend : ctx.availability.weekday;
  let windows = mergeIntervals(toIntervals(ranges))
    .map(([s, e]): Interval => [Math.max(s, settings.wake), Math.min(e, settings.bed)])
    .filter(([s, e]) => e > s);
  windows = subtract(windows, schoolSpans(ctx.timetable, weekday));

  let used = 0;
  const busy: Interval[] = [];
  for (const item of occupied) {
    if (item.date !== date) continue;
    used += item.minutes;
    const s = parseTime(item.start);
    const e = parseTime(item.end);
    if (s == null || e == null) continue;
    busy.push([s - brk, e + Math.max(0, item.breakMin)]);
  }
  windows = subtract(windows, busy);

  const slots: number[] = [];
  for (const [ws, we] of windows) {
    for (let t = ws; t + len <= we; t += len + brk) {
      if (date === ctx.today && t < ctx.nowMin) continue;
      slots.push(t);
    }
  }
  slots.sort((a, b) => a - b);

  let credit = 0;
  for (const item of credits) {
    if (item.carriedFrom === date && item.date !== date) credit += item.minutes;
  }

  const tomorrow = addDays(date, 1);
  const examCourses = new Set<string>();
  let officialExam = false;
  const eveCourse: EngineExam[] = [];
  let eveOfficial: EngineExam | null = null;
  let nearExam = false;
  for (const exam of ctx.exams) {
    if (exam.date === date) {
      if (exam.courseId) examCourses.add(exam.courseId);
      else officialExam = true;
    } else if (exam.date === tomorrow) {
      if (exam.courseId) eveCourse.push(exam);
      else eveOfficial ??= exam;
    }
    const n = daysBetween(date, exam.date);
    if (n >= 1 && n <= NEAR_EXAM_DAYS) nearExam = true;
  }
  const eveExams = eveCourse.filter((e) => !examCourses.has(e.courseId as string));

  return {
    date,
    cap: dailyCapMinutes(settings.segment, weekend, settings.override),
    slots,
    used,
    credit,
    examCourses,
    officialExam,
    eveExams,
    eveOfficial: eveExams.length > 0 ? null : eveOfficial,
    nearExam,
    queue: [],
  };
}

/**
 * Which kind a block takes on `day`, or null when the exam rules keep it off that day.
 * The day before an exam turns that exam's blocks into review blocks.
 */
function kindOn(
  ctx: Ctx,
  day: Day,
  block: { kind: PlanKind; courseId: string | null; examId: string | null; homeworkId: string | null },
): { kind: PlanKind; examId: string | null } | null {
  if (day.officialExam) return null;
  if (block.courseId && day.examCourses.has(block.courseId)) return null;
  if (block.examId) {
    const exam = ctx.allExams.get(block.examId);
    if (exam && exam.date <= day.date) return null;
  }
  if (block.homeworkId) {
    const hw = ctx.homework.get(block.homeworkId);
    if (!hw || hw.done || hw.dueDate <= day.date) return null;
  }
  if (day.eveExams.length > 0) {
    if (block.kind === 'homework') return null;
    const exam = day.eveExams.find((e) => e.courseId === block.courseId);
    return exam ? { kind: 'review', examId: exam.id } : null;
  }
  if (day.eveOfficial) {
    if (block.kind === 'homework') return null;
    return { kind: 'review', examId: block.examId ?? day.eveOfficial.id };
  }
  return { kind: block.kind, examId: block.examId };
}

function hasRoom(day: Day, minutes: number) {
  return day.queue.length < day.slots.length && day.used + minutes <= day.cap;
}

// ---------------------------------------------------------------------------------------------
// Priorities (BR-11)

/** Days to exam → weight. ≤ 7 days is the highest band. */
export function examUrgency(daysToExam: number | null): number {
  if (daysToExam == null) return 1;
  if (daysToExam <= NEAR_EXAM_DAYS) return 6 + (NEAR_EXAM_DAYS - daysToExam);
  if (daysToExam <= 14) return 3;
  return 1.5;
}

/** Topic difficulty 1 (easy) … 3 (hard) → weight. */
export function difficultyFactor(difficulty: number): number {
  return 0.75 + 0.25 * clamp(difficulty, 1, 3);
}

/** Lower accuracy → higher weight. No data → neutral. */
export function accuracyFactor(accuracy: number | undefined): number {
  return accuracy == null ? 1 : 1.6 - clamp(accuracy, 0, 1);
}

function nextExamOf(ctx: Ctx, courseId: string, date: string): EngineExam | null {
  return ctx.exams.find((e) => e.courseId === courseId && e.date > date) ?? null;
}

function topicPool(ctx: Ctx, courseId: string, exam: EngineExam | null): EngineTopic[] {
  if (exam && exam.topicIds.length > 0) {
    const fromExam = exam.topicIds
      .map((id) => ctx.topicById.get(id))
      .filter((t): t is EngineTopic => t != null && t.courseId === courseId);
    if (fromExam.length > 0) return fromExam;
  }
  return ctx.topicsByCourse.get(courseId) ?? [];
}

function courseWeight(ctx: Ctx, courseId: string, date: string): number {
  const exam = nextExamOf(ctx, courseId, date);
  const urgency = examUrgency(exam ? daysBetween(date, exam.date) : null);
  const pool = topicPool(ctx, courseId, exam);
  const difficulty =
    pool.length > 0 ? pool.reduce((sum, t) => sum + t.difficulty, 0) / pool.length : 2;
  return urgency * difficultyFactor(difficulty) * accuracyFactor(ctx.courseAccuracy[courseId]);
}

/**
 * Smooth weighted round robin: proportional and interleaved. `state` lives across days so
 * that courses also rotate from one day to the next.
 */
function pickWeighted(
  candidates: string[],
  weight: (id: string) => number,
  state: Map<string, number>,
  avoid: string | null,
): string {
  let total = 0;
  for (const id of candidates) {
    const w = weight(id);
    state.set(id, (state.get(id) ?? 0) + w);
    total += w;
  }
  const allowed = avoid && candidates.length > 1 ? candidates.filter((c) => c !== avoid) : candidates;
  let best = allowed[0];
  for (const id of allowed) {
    if ((state.get(id) ?? 0) > (state.get(best) ?? 0) + 1e-9) best = id;
  }
  state.set(best, (state.get(best) ?? 0) - total);
  return best;
}

/** The course to avoid next: the one that already filled the last MAX_SAME_IN_A_ROW slots. */
function streakCourse(queue: Queued[]): string | null {
  if (queue.length < MAX_SAME_IN_A_ROW) return null;
  const tail = queue.slice(-MAX_SAME_IN_A_ROW).map((q) => q.courseId);
  return tail[0] != null && tail.every((c) => c === tail[0]) ? tail[0] : null;
}

// ---------------------------------------------------------------------------------------------
// The engine

export function generatePlan(input: PlanInput): PlanResult {
  const ctx = makeContext(input);
  const { settings, today } = ctx;
  const horizon = input.horizonDays ?? PLAN_HORIZON_DAYS;
  const len = settings.block;
  const brk = settings.brk;

  // Blocks we keep occupy their time and count toward the cap of their day.
  const kept = input.existing.filter(
    (item) => item.date >= today && !isReplaceable(item, today, ctx.nowMin),
  );

  const days: Day[] = [];
  const dayIndex = new Map<string, Day>();
  for (let i = 0; i < horizon; i++) {
    const date = addDays(today, i);
    const day = buildDay(ctx, date, kept, input.existing, len, brk);
    days.push(day);
    dayIndex.set(date, day);
  }
  const lastDay = days[days.length - 1]?.date ?? today;

  const warnings: PlanWarning[] = [];
  if (ctx.courses.length > 0 && days.every((d) => d.slots.length === 0)) {
    warnings.push({ code: 'no_time' });
  }

  // 1. Homework: one block on the latest allowed day before the due date (FR-PL-03).
  const homeworkWithBlock = new Set(
    input.existing
      .filter((item) => item.homeworkId && !isReplaceable(item, today, ctx.nowMin))
      .map((item) => item.homeworkId as string),
  );
  const homework = [...input.homework]
    .filter((h) => !h.done && ctx.courseSet.has(h.courseId) && !homeworkWithBlock.has(h.id))
    .filter((h) => h.dueDate > today && addDays(h.dueDate, -1) <= lastDay)
    .sort((a, b) => compareKeys([a.dueDate, a.id], [b.dueDate, b.id]));

  for (const hw of homework) {
    for (let date = addDays(hw.dueDate, -1); date >= today; date = addDays(date, -1)) {
      const day = dayIndex.get(date);
      if (!day) continue;
      const block = { kind: 'homework' as const, courseId: hw.courseId, examId: null, homeworkId: hw.id };
      if (!kindOn(ctx, day, block) || !hasRoom(day, len)) continue;
      day.queue.push({ ...block, carryId: null, carriedFrom: null, topicId: null });
      day.used += len;
      break;
    }
  }

  // 2. Missed blocks move into the 3 days after their first day (BR-10).
  const missed = input.existing
    .filter((item) => item.status === 'planned' && item.date < today)
    .map((item) => ({ item, origin: item.carriedFrom ?? item.date }))
    .filter(({ item }) => item.courseId == null || ctx.courseSet.has(item.courseId))
    .sort((a, b) =>
      compareKeys(
        [a.origin, a.item.date, a.item.start, a.item.id],
        [b.origin, b.item.date, b.item.start, b.item.id],
      ),
    );

  const stuck: string[] = [];
  for (const { item, origin } of missed) {
    const from = addDays(origin, 1) > today ? addDays(origin, 1) : today;
    const to = addDays(origin, CARRY_DAYS);
    const allowed: { day: Day; kind: PlanKind; examId: string | null }[] = [];
    for (let date = from; date <= to; date = addDays(date, 1)) {
      const day = dayIndex.get(date);
      if (!day) continue;
      const verdict = kindOn(ctx, day, item);
      if (verdict) allowed.push({ day, ...verdict });
    }
    // No day where the rules allow it (window over, exam passed, homework done): leave it be.
    if (allowed.length === 0) continue;

    let best: (typeof allowed)[number] | null = null;
    for (const option of allowed) {
      if (!hasRoom(option.day, len)) continue;
      if (!best || option.day.cap - option.day.used > best.day.cap - best.day.used) best = option;
    }
    if (!best) {
      stuck.push(item.id);
      continue;
    }
    best.day.queue.push({
      carryId: item.id,
      carriedFrom: origin,
      kind: best.kind,
      courseId: item.courseId,
      topicId: item.topicId,
      examId: best.examId,
      homeworkId: item.homeworkId,
    });
    best.day.used += len;
  }
  if (stuck.length > 0) warnings.push({ code: 'plan_tight', count: stuck.length });

  // 3. Fill each day up to its target.
  const courseState = new Map<string, number>();
  const topicState = new Map<string, number>();

  const pickTopic = (courseId: string, exam: EngineExam | null): string | null => {
    const pool = topicPool(ctx, courseId, exam);
    if (pool.length === 0) return null;
    const weightOf = new Map(
      pool.map((t) => [
        t.id,
        difficultyFactor(t.difficulty) * accuracyFactor(ctx.topicAccuracy[t.id]),
      ]),
    );
    return pickWeighted(
      pool.map((t) => t.id),
      (id) => weightOf.get(id) ?? 1,
      topicState,
      null,
    );
  };

  for (const day of days) {
    if (day.officialExam || ctx.courses.length === 0) continue;

    let target: number;
    if (day.eveExams.length === 0 && day.eveOfficial) target = Math.min(settings.goal, day.cap);
    else if (day.nearExam) target = day.cap;
    else target = Math.min(settings.goal, day.cap);

    const want = Math.ceil(Math.max(0, target - day.used - day.credit) / len);
    const capRoom = Math.floor((day.cap - day.used) / len);
    const slotRoom = day.slots.length - day.queue.length;
    const count = Math.max(0, Math.min(want, capRoom, slotRoom));
    if (count === 0) continue;

    let candidates: string[];
    let kind: PlanKind;
    let examFor: (courseId: string) => EngineExam | null;
    let weight: (courseId: string) => number;

    if (day.eveExams.length > 0) {
      const eveCourses = new Set(day.eveExams.map((e) => e.courseId as string));
      candidates = ctx.courses.filter((c) => eveCourses.has(c));
      kind = 'review';
      examFor = (c) => day.eveExams.find((e) => e.courseId === c) ?? null;
      weight = () => 1;
    } else {
      candidates = ctx.courses.filter((c) => !day.examCourses.has(c));
      kind = day.eveOfficial ? 'review' : 'study';
      const official = day.eveOfficial;
      examFor = official ? () => official : (c) => nextExamOf(ctx, c, day.date);
      const weights = new Map(candidates.map((c) => [c, courseWeight(ctx, c, day.date)]));
      weight = (c) => weights.get(c) ?? 1;
    }
    if (candidates.length === 0) continue;

    // Rotation state carries over from earlier days, but only about one round of it: forced
    // picks (the "2 in a row" rule) or an exam that has passed must not tilt later days.
    const roundTotal = candidates.reduce((sum, c) => sum + weight(c), 0);
    for (const c of candidates) {
      courseState.set(c, clamp(courseState.get(c) ?? 0, -roundTotal, roundTotal));
    }

    for (let i = 0; i < count; i++) {
      const courseId = pickWeighted(candidates, weight, courseState, streakCourse(day.queue));
      const exam = examFor(courseId);
      // Topics come from the course's own exam (an official exam has no topic list).
      const topicExam = exam && exam.courseId === courseId ? exam : null;
      day.queue.push({
        carryId: null,
        carriedFrom: null,
        kind,
        courseId,
        topicId: pickTopic(courseId, topicExam),
        examId: exam?.id ?? null,
        homeworkId: null,
      });
      day.used += len;
    }
  }

  // 4. Lay the queued blocks onto the free slots, in time order.
  const blocks: NewBlock[] = [];
  const moves: CarryMove[] = [];
  for (const day of days) {
    day.queue.forEach((q, i) => {
      const startMin = day.slots[i];
      const start = fromMinutes(startMin);
      const end = fromMinutes(startMin + len);
      if (q.carryId) {
        moves.push({
          id: q.carryId,
          date: day.date,
          start,
          end,
          minutes: len,
          breakMin: brk,
          kind: q.kind,
          examId: q.examId,
          carriedFrom: q.carriedFrom as string,
        });
      } else {
        blocks.push({
          date: day.date,
          start,
          end,
          minutes: len,
          breakMin: brk,
          kind: q.kind,
          courseId: q.courseId,
          topicId: q.topicId,
          examId: q.examId,
          homeworkId: q.homeworkId,
        });
      }
    });
  }

  return { blocks, moves, stuck, warnings };
}

export type FreeSlot = {
  date: string;
  start: string;
  end: string;
  kind: PlanKind;
  examId: string | null;
};

/**
 * "Ertele" (US-49): the next free slot for one block, later than its current start and within
 * `maxDays` days. Every other existing block stays where it is and keeps its time.
 */
export function findNextFreeSlot(
  input: PlanInput,
  itemId: string,
  maxDays: number = CARRY_DAYS,
): FreeSlot | null {
  const item = input.existing.find((i) => i.id === itemId);
  if (!item) return null;
  const ctx = makeContext(input);
  const others = input.existing.filter((i) => i.id !== itemId);
  const from = item.date > ctx.today ? item.date : ctx.today;
  const itemStart = parseTime(item.start) ?? 0;

  for (let i = 0; i <= maxDays; i++) {
    const date = addDays(from, i);
    const day = buildDay(ctx, date, others, [], item.minutes, item.breakMin);
    const verdict = kindOn(ctx, day, item);
    if (!verdict || day.used + item.minutes > day.cap) continue;
    const slot = day.slots.find((t) => date !== item.date || t > itemStart);
    if (slot == null) continue;
    return {
      date,
      start: fromMinutes(slot),
      end: fromMinutes(slot + item.minutes),
      kind: verdict.kind,
      examId: verdict.examId,
    };
  }
  return null;
}

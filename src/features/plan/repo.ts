/**
 * Plan storage: loads the engine's inputs from SQLite, applies its result, and the block
 * actions of US-49 (done, skip, postpone).
 */

import { getDb } from '@/db/client';
import { newId } from '@/db/ids';
import type { Course, Exam, Homework, PlanItem, PlanItemStatus, Profile, Topic } from '@/db/types';
import { kvGet, kvSet, patch, softDelete, upsert } from '@/db/write';
import {
  findNextFreeSlot,
  isReplaceable,
  parseTime,
  type EngineItem,
  type FreeSlot,
  type NewBlock,
  type PlanInput,
  type PlanResult,
  type PlanWarning,
} from '@/domain/plan-engine';
import { segmentForGrade, type Segment } from '@/domain/rules';
import { getAvailability } from '@/features/availability/repo';
import { listCourses } from '@/features/courses/repo';
import { examTopicIds } from '@/features/exams/repo';
import { loadAccuracy } from '@/features/plan/accuracy';
import { addDays, formatDate } from '@/lib/dates';
import { track } from '@/services/analytics';
import { backendMode } from '@/services/config';

export const PLAN_WARNINGS_KEY = 'plan.warnings';
/** Past days the engine looks at: missed blocks (3-day window) and finished exams. */
const LOOKBACK_DAYS = 7;

export function profileSegment(profile: Pick<Profile, 'segment' | 'grade'> | null): Segment | null {
  if (!profile) return null;
  if (profile.segment) return profile.segment;
  return profile.grade ? segmentForGrade(profile.grade) : null;
}

export function toEngineItem(row: PlanItem): EngineItem {
  return {
    id: row.id,
    date: row.date,
    start: row.start_time,
    end: row.end_time,
    minutes: row.minutes,
    breakMin: row.break_min,
    kind: row.kind,
    courseId: row.course_id,
    topicId: row.topic_id,
    examId: row.exam_id,
    homeworkId: row.homework_id,
    status: row.status,
    source: row.source,
    carriedFrom: row.carried_from,
  };
}

/** Everything the plan engine needs, or null before onboarding is done. */
export async function loadPlanInput(now: Date): Promise<PlanInput | null> {
  const db = getDb();
  const profile = await db.getFirstAsync<Profile>('SELECT * FROM profile LIMIT 1');
  const segment = profileSegment(profile);
  if (!profile || !segment || profile.onboarding_done !== 1) return null;

  const today = formatDate(now);
  const since = addDays(today, -LOOKBACK_DAYS);

  const [courses, timetable, availability, topics, exams, homework, items, accuracy] =
    await Promise.all([
      listCourses(),
      db.getAllAsync<{ weekday: number; start_time: string; end_time: string }>(
        'SELECT weekday, start_time, end_time FROM timetable_slots WHERE deleted_at IS NULL',
      ),
      getAvailability(segment),
      db.getAllAsync<Pick<Topic, 'id' | 'course_id' | 'difficulty'>>(
        'SELECT id, course_id, difficulty FROM topics WHERE deleted_at IS NULL',
      ),
      db.getAllAsync<Pick<Exam, 'id' | 'course_id' | 'date' | 'topic_ids'>>(
        'SELECT id, course_id, date, topic_ids FROM exams WHERE deleted_at IS NULL AND date >= ?',
        since,
      ),
      db.getAllAsync<Pick<Homework, 'id' | 'course_id' | 'due_date' | 'done_at'>>(
        'SELECT id, course_id, due_date, done_at FROM homework WHERE deleted_at IS NULL AND due_date >= ?',
        since,
      ),
      db.getAllAsync<PlanItem>(
        'SELECT * FROM plan_items WHERE deleted_at IS NULL AND date >= ? ORDER BY date, start_time',
        since,
      ),
      loadAccuracy(now).catch(() => ({ course: {}, topic: {} })),
    ]);

  return {
    now,
    profile: {
      segment,
      blockMin: profile.block_min,
      breakMin: profile.break_min,
      dailyGoalMin: profile.daily_goal_min,
      dailyCapOverride: profile.daily_cap_override,
      bedtime: profile.bedtime,
      wakeTime: profile.wake_time,
    },
    timetable: timetable.map((s) => ({ weekday: s.weekday, start: s.start_time, end: s.end_time })),
    availability: { weekday: availability.weekday, weekend: availability.weekend },
    courses: courses.map((c) => ({ id: c.id })),
    topics: topics.map((t) => ({ id: t.id, courseId: t.course_id, difficulty: t.difficulty })),
    exams: exams.map((e) => ({
      id: e.id,
      courseId: e.course_id,
      date: e.date,
      topicIds: examTopicIds(e),
    })),
    homework: homework.map((h) => ({
      id: h.id,
      courseId: h.course_id,
      dueDate: h.due_date,
      done: h.done_at != null,
    })),
    accuracy,
    existing: items.map(toEngineItem),
  };
}

function blockKey(b: NewBlock | EngineItem): string {
  return [
    b.date,
    b.start,
    b.end,
    b.minutes,
    b.breakMin,
    b.kind,
    b.courseId ?? '',
    b.topicId ?? '',
    b.examId ?? '',
    b.homeworkId ?? '',
  ].join('|');
}

/**
 * Writes an engine result in one transaction: future untouched auto blocks are replaced
 * (identical ones are kept, so sync does not churn), done/skipped/manual/carried blocks stay,
 * missed blocks move. Past blocks are never deleted.
 */
export async function applyPlan(input: PlanInput, result: PlanResult): Promise<boolean> {
  const today = formatDate(input.now);
  const nowMin = input.now.getHours() * 60 + input.now.getMinutes();

  const wanted = new Map<string, NewBlock[]>();
  for (const block of result.blocks) {
    const key = blockKey(block);
    wanted.set(key, [...(wanted.get(key) ?? []), block]);
  }
  const toRemove: string[] = [];
  for (const item of input.existing) {
    if (!isReplaceable(item, today, nowMin)) continue;
    const same = wanted.get(blockKey(item));
    if (same && same.length > 0) same.pop();
    else toRemove.push(item.id);
  }
  const toCreate = [...wanted.values()].flat();
  if (toRemove.length === 0 && toCreate.length === 0 && result.moves.length === 0) return false;

  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (const id of toRemove) await softDelete('plan_items', id);
    for (const block of toCreate) {
      await upsert('plan_items', {
        id: newId(),
        date: block.date,
        start_time: block.start,
        end_time: block.end,
        minutes: block.minutes,
        break_min: block.breakMin,
        kind: block.kind,
        course_id: block.courseId,
        topic_id: block.topicId,
        exam_id: block.examId,
        homework_id: block.homeworkId,
        status: 'planned',
        source: 'auto',
        carried_from: null,
      });
    }
    for (const move of result.moves) {
      await patch('plan_items', move.id, {
        date: move.date,
        start_time: move.start,
        end_time: move.end,
        minutes: move.minutes,
        break_min: move.breakMin,
        kind: move.kind,
        exam_id: move.examId,
        carried_from: move.carriedFrom,
      });
    }
  });

  // Without a server nothing needs the deleted rows; keep the local file small.
  if (backendMode === 'local') {
    await db.runAsync('DELETE FROM plan_items WHERE deleted_at IS NOT NULL');
  }
  return true;
}

export async function getPlanWarnings(): Promise<PlanWarning[]> {
  return (await kvGet<PlanWarning[]>(PLAN_WARNINGS_KEY)) ?? [];
}

export async function savePlanWarnings(warnings: PlanWarning[]): Promise<void> {
  const current = await kvGet<PlanWarning[]>(PLAN_WARNINGS_KEY);
  if (JSON.stringify(current ?? []) !== JSON.stringify(warnings)) {
    await kvSet(PLAN_WARNINGS_KEY, warnings);
  }
}

// ---------------------------------------------------------------------------------------------
// Reads for the screens

/** Plan items between two dates (inclusive), in time order. */
export async function listPlanItems(from: string, to: string): Promise<PlanItem[]> {
  return getDb().getAllAsync<PlanItem>(
    `SELECT * FROM plan_items WHERE deleted_at IS NULL AND date >= ? AND date <= ?
     ORDER BY date, start_time`,
    from,
    to,
  );
}

export async function hasUpcomingPlan(today: string): Promise<boolean> {
  const row = await getDb().getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM plan_items WHERE deleted_at IS NULL AND date >= ?',
    today,
  );
  return (row?.n ?? 0) > 0;
}

/** Topic names by id (for block rows). */
export async function topicNames(): Promise<Map<string, string>> {
  const rows = await getDb().getAllAsync<{ id: string; name: string }>(
    'SELECT id, name FROM topics WHERE deleted_at IS NULL',
  );
  return new Map(rows.map((r) => [r.id, r.name]));
}

export type BlockDetails = {
  item: PlanItem;
  course: Course | null;
  topic: Topic | null;
  exam: Exam | null;
  homework: Homework | null;
};

export async function getBlockDetails(id: string): Promise<BlockDetails | null> {
  const db = getDb();
  const item = await db.getFirstAsync<PlanItem>(
    'SELECT * FROM plan_items WHERE id = ? AND deleted_at IS NULL',
    id,
  );
  if (!item) return null;
  const [course, topic, exam, homework] = await Promise.all([
    item.course_id
      ? db.getFirstAsync<Course>('SELECT * FROM courses WHERE id = ?', item.course_id)
      : null,
    item.topic_id ? db.getFirstAsync<Topic>('SELECT * FROM topics WHERE id = ?', item.topic_id) : null,
    item.exam_id
      ? db.getFirstAsync<Exam>('SELECT * FROM exams WHERE id = ? AND deleted_at IS NULL', item.exam_id)
      : null,
    item.homework_id
      ? db.getFirstAsync<Homework>(
          'SELECT * FROM homework WHERE id = ? AND deleted_at IS NULL',
          item.homework_id,
        )
      : null,
  ]);
  return { item, course, topic, exam, homework };
}

// ---------------------------------------------------------------------------------------------
// Block actions (US-49)

export async function setBlockStatus(id: string, status: PlanItemStatus): Promise<void> {
  const item = await getDb().getFirstAsync<PlanItem>('SELECT * FROM plan_items WHERE id = ?', id);
  if (!item) return;
  await patch('plan_items', id, { status });
  if (status === 'done') track('plan_block_completed', { kind: item.kind, minutes: item.minutes });
  if (status === 'skipped') track('plan_block_skipped', { kind: item.kind });
}

/**
 * "Ertele": moves the block to the next free slot within 3 days. The block keeps the day it
 * was first planned for in `carried_from`, so the next regeneration leaves it there.
 * Returns the new slot, or null when nothing fits.
 */
export async function postponeBlock(id: string, now: Date = new Date()): Promise<FreeSlot | null> {
  const input = await loadPlanInput(now);
  if (!input) return null;
  let item = input.existing.find((i) => i.id === id);
  if (!item) {
    const row = await getDb().getFirstAsync<PlanItem>(
      'SELECT * FROM plan_items WHERE id = ? AND deleted_at IS NULL',
      id,
    );
    if (!row) return null;
    item = toEngineItem(row);
    input.existing.push(item);
  }
  const slot = findNextFreeSlot(input, id);
  if (!slot) return null;
  await patch('plan_items', id, {
    date: slot.date,
    start_time: slot.start,
    end_time: slot.end,
    kind: slot.kind,
    exam_id: slot.examId,
    carried_from: item.carriedFrom ?? item.date,
  });
  return slot;
}

/** The first block of the day that is still to do and not over yet. */
export function nextBlock(items: PlanItem[], now: Date): PlanItem | null {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return (
    items.find((i) => i.status === 'planned' && (parseTime(i.end_time) ?? 0) > nowMin) ?? null
  );
}

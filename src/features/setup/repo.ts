/**
 * Reads and device flags for the first-run guide (US-74), the new school year prompt
 * (US-78) and the Pro-ended notice (US-79). Flags live in kv: they are about this device's
 * screens, not the student's data, so they don't sync.
 */

import { getDb } from '@/db/client';
import type { Course } from '@/db/types';
import { kvGet, kvSet } from '@/db/write';
import type { Plan } from '@/domain/rules';
import { getAvailability } from '@/features/availability/repo';

import { EMPTY_NEW_YEAR_MEMORY, type NewYearMemory } from './new-year';
import { rememberPlan, samePlanMemory, type PlanMemory } from './plan-change';

export const SETUP_KV = {
  /** Set once the first-run course picker was opened (US-74). */
  coursesOffered: 'setup.coursesOffered',
  checklistDismissed: 'setup.checklistDismissed',
  newYear: 'setup.newYear',
  plan: 'setup.planMemory',
} as const;

// ---------------------------------------------------------------- first-run course picker

/** True when Today should open the first-run course picker: never shown and no courses yet. */
export async function shouldOfferCourses(): Promise<boolean> {
  if (await kvGet<boolean>(SETUP_KV.coursesOffered)) return false;
  const row = await getDb().getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM courses WHERE deleted_at IS NULL AND archived_at IS NULL',
  );
  return (row?.n ?? 0) === 0;
}

export async function markCoursesOffered(): Promise<void> {
  await kvSet(SETUP_KV.coursesOffered, true);
}

// ---------------------------------------------------------------- checklist

export const CHECKLIST_TABLES = ['courses', 'timetable_slots', 'availability', 'exams', 'kv'] as const;

export type ChecklistData = {
  hasCourses: boolean;
  hasTimetable: boolean;
  availabilitySaved: boolean;
  hasSchoolExam: boolean;
  dismissed: boolean;
};

export async function loadChecklistData(): Promise<ChecklistData> {
  const [counts, availability, dismissed] = await Promise.all([
    getDb().getFirstAsync<{ courses: number; slots: number; exams: number }>(
      `SELECT
         (SELECT COUNT(*) FROM courses WHERE deleted_at IS NULL AND archived_at IS NULL) AS courses,
         (SELECT COUNT(*) FROM timetable_slots WHERE deleted_at IS NULL) AS slots,
         (SELECT COUNT(*) FROM exams e JOIN courses c ON c.id = e.course_id
           WHERE e.deleted_at IS NULL AND e.kind != 'official' AND c.deleted_at IS NULL) AS exams`,
    ),
    getAvailability(),
    kvGet<boolean>(SETUP_KV.checklistDismissed),
  ]);
  return {
    hasCourses: (counts?.courses ?? 0) > 0,
    hasTimetable: (counts?.slots ?? 0) > 0,
    availabilitySaved: !availability.isDefault,
    hasSchoolExam: (counts?.exams ?? 0) > 0,
    dismissed: dismissed === true,
  };
}

export async function dismissChecklist(): Promise<void> {
  await kvSet(SETUP_KV.checklistDismissed, true);
}

// ---------------------------------------------------------------- new school year

export const NEW_YEAR_TABLES = ['kv', 'exams'] as const;

export type NewYearData = {
  memory: NewYearMemory;
  /** Last date of the student's official exams (their target exam), if any. */
  targetExamDate: string | null;
};

export async function loadNewYearData(): Promise<NewYearData> {
  const [memory, exam] = await Promise.all([
    kvGet<NewYearMemory>(SETUP_KV.newYear),
    getDb().getFirstAsync<{ date: string | null }>(
      "SELECT MAX(date) AS date FROM exams WHERE kind = 'official' AND deleted_at IS NULL",
    ),
  ]);
  return { memory: memory ?? EMPTY_NEW_YEAR_MEMORY, targetExamDate: exam?.date ?? null };
}

export async function saveNewYearMemory(memory: NewYearMemory): Promise<void> {
  await kvSet(SETUP_KV.newYear, memory);
}

/** Active courses, for the "archive the old ones" step. */
export async function listActiveCourses(): Promise<Course[]> {
  return getDb().getAllAsync<Course>(
    'SELECT * FROM courses WHERE deleted_at IS NULL AND archived_at IS NULL ORDER BY name',
  );
}

// ---------------------------------------------------------------- plan change

export async function loadPlanMemory(): Promise<PlanMemory | null> {
  return kvGet<PlanMemory>(SETUP_KV.plan);
}

/** Records the plan the app sees now; raises the notice on a step from Pro to free. */
export async function recordPlan(current: Plan): Promise<void> {
  const memory = await loadPlanMemory();
  const next = rememberPlan(memory, current);
  if (!samePlanMemory(memory, next)) await kvSet(SETUP_KV.plan, next);
}

export async function dismissPlanNotice(): Promise<void> {
  const memory = await loadPlanMemory();
  if (memory?.expiredNotice) await kvSet(SETUP_KV.plan, { ...memory, expiredNotice: false });
}

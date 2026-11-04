/**
 * Courses (US-21, US-22). Reads skip soft-deleted rows; writes go through db/write so they
 * sync, and every change asks the plan to rebuild.
 */

import { getDb } from '@/db/client';
import { newId, nowIso } from '@/db/ids';
import type { Course } from '@/db/types';
import { patch, softDelete, upsert } from '@/db/write';
import { assignCourseColors } from '@/features/courses/colors';
import { catalogCourse } from '@/features/courses/catalog';
import { sameCourseName } from '@/features/courses/validation';
import { schedulePlanRegeneration } from '@/features/plan/regenerate';
import { todayString } from '@/lib/dates';

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'tr');

/** Active (not archived, not deleted) courses, alphabetical. */
export async function listCourses(options: { includeArchived?: boolean } = {}): Promise<Course[]> {
  const archived = options.includeArchived ? '' : 'AND archived_at IS NULL';
  const rows = await getDb().getAllAsync<Course>(
    `SELECT * FROM courses WHERE deleted_at IS NULL ${archived}`,
  );
  return rows.sort(byName);
}

/** Any course by id, including archived and deleted ones (check `deleted_at`). */
export async function getCourse(id: string): Promise<Course | null> {
  return getDb().getFirstAsync<Course>('SELECT * FROM courses WHERE id = ?', id);
}

/** id → course, including archived ones (history keeps their names and colors). */
export async function courseMap(): Promise<Map<string, Course>> {
  const rows = await listCourses({ includeArchived: true });
  return new Map(rows.map((c) => [c.id, c]));
}

export async function listArchivedCourses(): Promise<Course[]> {
  const rows = await getDb().getAllAsync<Course>(
    'SELECT * FROM courses WHERE deleted_at IS NULL AND archived_at IS NOT NULL',
  );
  return rows.sort(byName);
}

export type CourseSummary = Course & {
  /** Exams on or after today */
  exam_count: number;
  /** Homework not done yet */
  homework_count: number;
};

/** Active courses with their upcoming exam and open homework counts (Courses tab). */
export async function listCourseSummaries(today: string = todayString()): Promise<CourseSummary[]> {
  const rows = await getDb().getAllAsync<CourseSummary>(
    `SELECT c.*,
       (SELECT COUNT(*) FROM exams e
         WHERE e.course_id = c.id AND e.deleted_at IS NULL AND e.date >= ?) AS exam_count,
       (SELECT COUNT(*) FROM homework h
         WHERE h.course_id = c.id AND h.deleted_at IS NULL AND h.done_at IS NULL) AS homework_count
     FROM courses c
     WHERE c.deleted_at IS NULL AND c.archived_at IS NULL`,
    today,
  );
  return rows.sort(byName);
}

async function usedColors(): Promise<string[]> {
  const rows = await getDb().getAllAsync<{ color: string }>(
    'SELECT color FROM courses WHERE deleted_at IS NULL AND archived_at IS NULL',
  );
  return rows.map((r) => r.color);
}

/** Adds one course. Without a color it gets the least-used palette color. */
export async function createCourse(input: {
  name: string;
  color?: string;
  catalogKey?: string | null;
}): Promise<string> {
  const id = newId();
  const color = input.color ?? assignCourseColors(1, await usedColors())[0];
  await upsert('courses', {
    id,
    name: input.name.trim(),
    color,
    catalog_key: input.catalogKey ?? null,
    archived_at: null,
  });
  schedulePlanRegeneration('courses');
  return id;
}

/**
 * Adds the chosen catalog courses (US-21). Skips ones the student already has and
 * brings archived ones back. Returns how many courses were added or restored.
 */
export async function addCatalogCourses(keys: readonly string[]): Promise<number> {
  const existing = await listCourses({ includeArchived: true });
  const toCreate: { key: string; name: string }[] = [];
  let restored = 0;

  for (const key of keys) {
    const item = catalogCourse(key);
    if (!item) continue;
    const match = existing.find(
      (c) => c.catalog_key === key || sameCourseName(c.name, item.name),
    );
    if (!match) {
      toCreate.push({ key, name: item.name });
    } else if (match.archived_at) {
      await patch('courses', match.id, { archived_at: null });
      restored++;
    }
  }

  const colors = assignCourseColors(toCreate.length, await usedColors());
  for (const [i, item] of toCreate.entries()) {
    await upsert('courses', {
      id: newId(),
      name: item.name,
      color: colors[i],
      catalog_key: item.key,
      archived_at: null,
    });
  }

  const changed = toCreate.length + restored;
  if (changed > 0) schedulePlanRegeneration('courses');
  return changed;
}

export async function updateCourse(id: string, changes: { name?: string; color?: string }) {
  const values: Record<string, unknown> = {};
  if (changes.name != null) values.name = changes.name.trim();
  if (changes.color != null) values.color = changes.color;
  await patch('courses', id, values);
  schedulePlanRegeneration('courses');
}

/** US-22: archived courses leave the plan; their history stays. */
export async function archiveCourse(id: string) {
  await patch('courses', id, { archived_at: nowIso() });
  schedulePlanRegeneration('courses');
}

export async function unarchiveCourse(id: string) {
  await patch('courses', id, { archived_at: null });
  schedulePlanRegeneration('courses');
}

export type CourseLinks = { exams: number; homework: number; documents: number };

/** What deleting a course would also delete (shown in the confirmation). */
export async function courseLinkCounts(id: string): Promise<CourseLinks> {
  const row = await getDb().getFirstAsync<CourseLinks>(
    `SELECT
       (SELECT COUNT(*) FROM exams WHERE course_id = ? AND deleted_at IS NULL) AS exams,
       (SELECT COUNT(*) FROM homework WHERE course_id = ? AND deleted_at IS NULL) AS homework,
       (SELECT COUNT(*) FROM documents WHERE course_id = ? AND deleted_at IS NULL) AS documents`,
    id,
    id,
    id,
  );
  return row ?? { exams: 0, homework: 0, documents: 0 };
}

/** Tables whose rows belong to one course and go with it. */
const COURSE_CHILDREN = ['exams', 'homework', 'documents', 'topics', 'quizzes', 'decks'] as const;

/**
 * US-22: soft-deletes the course and everything attached to it, so the deletion syncs.
 * Timetable slots keep their hours (school is still school) but lose the course.
 */
export async function deleteCourse(id: string) {
  const db = getDb();
  for (const table of COURSE_CHILDREN) {
    const rows = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM ${table} WHERE course_id = ? AND deleted_at IS NULL`,
      id,
    );
    for (const row of rows) await softDelete(table, row.id);
  }
  const slots = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM timetable_slots WHERE course_id = ? AND deleted_at IS NULL',
    id,
  );
  for (const slot of slots) await patch('timetable_slots', slot.id, { course_id: null });

  await softDelete('courses', id);
  schedulePlanRegeneration('courses');
}

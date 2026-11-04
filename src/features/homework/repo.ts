/**
 * Homework (US-29). Each open homework becomes an "ödev bloğu" in the plan (FR-PL-03),
 * so every change asks the plan to rebuild.
 *
 * By default reads leave out homework of archived or deleted courses.
 */

import { getDb } from '@/db/client';
import { newId, nowIso } from '@/db/ids';
import type { Homework } from '@/db/types';
import { patch, softDelete, upsert } from '@/db/write';
import type { HomeworkDraft } from '@/features/homework/validation';
import { schedulePlanRegeneration } from '@/features/plan/regenerate';
import { addDays, todayString } from '@/lib/dates';

export type HomeworkWithCourse = Homework & {
  course_name: string;
  course_color: string;
};

export type HomeworkQuery = {
  courseId?: string;
  /** Inclusive "YYYY-MM-DD" bounds on the due date */
  from?: string;
  to?: string;
  /** Default 'all' */
  status?: 'open' | 'done' | 'all';
  /** Default false */
  includeArchivedCourses?: boolean;
};

/** Homework by due date (earliest first). */
export async function listHomework(query: HomeworkQuery = {}): Promise<HomeworkWithCourse[]> {
  const where = ['h.deleted_at IS NULL', 'c.deleted_at IS NULL'];
  const args: string[] = [];
  if (!query.includeArchivedCourses) where.push('c.archived_at IS NULL');
  if (query.courseId) {
    where.push('h.course_id = ?');
    args.push(query.courseId);
  }
  if (query.from) {
    where.push('h.due_date >= ?');
    args.push(query.from);
  }
  if (query.to) {
    where.push('h.due_date <= ?');
    args.push(query.to);
  }
  if (query.status === 'open') where.push('h.done_at IS NULL');
  if (query.status === 'done') where.push('h.done_at IS NOT NULL');

  return getDb().getAllAsync<HomeworkWithCourse>(
    `SELECT h.*, c.name AS course_name, c.color AS course_color
     FROM homework h JOIN courses c ON c.id = h.course_id
     WHERE ${where.join(' AND ')}
     ORDER BY h.due_date, h.created_at`,
    args,
  );
}

/** US-28: homework due today and tomorrow, done or not. */
export async function listHomeworkDue(today: string = todayString()): Promise<HomeworkWithCourse[]> {
  return listHomework({ from: today, to: addDays(today, 1) });
}

export async function getHomework(id: string): Promise<HomeworkWithCourse | null> {
  return getDb().getFirstAsync<HomeworkWithCourse>(
    `SELECT h.*, c.name AS course_name, c.color AS course_color
     FROM homework h JOIN courses c ON c.id = h.course_id
     WHERE h.id = ? AND h.deleted_at IS NULL`,
    id,
  );
}

/** Creates (no id) or updates homework. Validate the draft first. Returns the id. */
export async function saveHomework(draft: HomeworkDraft, id?: string): Promise<string> {
  const homeworkId = id ?? newId();
  const row = {
    id: homeworkId,
    course_id: draft.courseId,
    description: draft.description.trim(),
    due_date: draft.dueDate,
  };
  if (id) await patch('homework', id, row);
  else await upsert('homework', { ...row, done_at: null });
  schedulePlanRegeneration('homework');
  return homeworkId;
}

export async function setHomeworkDone(id: string, done: boolean) {
  await patch('homework', id, { done_at: done ? nowIso() : null });
  schedulePlanRegeneration('homework');
}

export async function deleteHomework(id: string) {
  await softDelete('homework', id);
  schedulePlanRegeneration('homework');
}

/**
 * School exams (US-26) and official exams (US-27). Every change asks the plan to rebuild.
 *
 * By default reads leave out exams of archived or deleted courses (they are not in the
 * plan any more); official exams have no course and are always included.
 */

import { getDb } from '@/db/client';
import { newId } from '@/db/ids';
import type { Exam } from '@/db/types';
import { patch, softDelete, upsert } from '@/db/write';
import type { ExamDraft } from '@/features/exams/validation';
import { schedulePlanRegeneration } from '@/features/plan/regenerate';
import { todayString } from '@/lib/dates';

export type ExamWithCourse = Exam & {
  course_name: string | null;
  course_color: string | null;
};

export type ExamQuery = {
  courseId?: string;
  /** Inclusive "YYYY-MM-DD" bounds */
  from?: string;
  to?: string;
  /** Default true */
  includeOfficial?: boolean;
  /** Default false: exams of archived courses are hidden */
  includeArchivedCourses?: boolean;
  limit?: number;
};

/** Exams in date and time order (exams without a time come first on their day). */
export async function listExams(query: ExamQuery = {}): Promise<ExamWithCourse[]> {
  const where = ['e.deleted_at IS NULL'];
  const args: (string | number)[] = [];

  where.push(
    query.includeArchivedCourses
      ? '(e.course_id IS NULL OR c.deleted_at IS NULL)'
      : '(e.course_id IS NULL OR (c.deleted_at IS NULL AND c.archived_at IS NULL))',
  );
  if (query.courseId) {
    where.push('e.course_id = ?');
    args.push(query.courseId);
  }
  if (query.from) {
    where.push('e.date >= ?');
    args.push(query.from);
  }
  if (query.to) {
    where.push('e.date <= ?');
    args.push(query.to);
  }
  if (query.includeOfficial === false) where.push("e.kind != 'official'");

  let sql = `SELECT e.*, c.name AS course_name, c.color AS course_color
    FROM exams e LEFT JOIN courses c ON c.id = e.course_id
    WHERE ${where.join(' AND ')}
    ORDER BY e.date, COALESCE(e.time, ''), e.created_at`;
  if (query.limit != null) {
    sql += ' LIMIT ?';
    args.push(query.limit);
  }
  return getDb().getAllAsync<ExamWithCourse>(sql, args);
}

/** Exams from today on, nearest first (Today widget, plan engine). */
export async function listUpcomingExams(
  options: { today?: string; limit?: number; courseId?: string } = {},
): Promise<ExamWithCourse[]> {
  return listExams({
    from: options.today ?? todayString(),
    limit: options.limit,
    courseId: options.courseId,
  });
}

export async function getExam(id: string): Promise<ExamWithCourse | null> {
  return getDb().getFirstAsync<ExamWithCourse>(
    `SELECT e.*, c.name AS course_name, c.color AS course_color
     FROM exams e LEFT JOIN courses c ON c.id = e.course_id
     WHERE e.id = ? AND e.deleted_at IS NULL`,
    id,
  );
}

/** Topic ids stored on an exam (a JSON array). */
export function examTopicIds(exam: Pick<Exam, 'topic_ids'>): string[] {
  try {
    const value: unknown = JSON.parse(exam.topic_ids);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** Creates (no id) or updates a school exam. Validate the draft first. Returns the id. */
export async function saveExam(draft: ExamDraft & { title: string }, id?: string): Promise<string> {
  const examId = id ?? newId();
  const row = {
    id: examId,
    course_id: draft.courseId,
    kind: draft.kind,
    title: draft.title.trim(),
    date: draft.date,
    time: draft.time,
    topic_ids: JSON.stringify(draft.topicIds),
  };
  if (id) await patch('exams', id, row);
  else await upsert('exams', { ...row, official_key: null, score: null });
  schedulePlanRegeneration('exams');
  return examId;
}

export async function deleteExam(id: string) {
  await softDelete('exams', id);
  schedulePlanRegeneration('exams');
}

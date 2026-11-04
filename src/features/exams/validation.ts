import type { ExamKind } from '@/db/types';

export type SchoolExamKind = Exclude<ExamKind, 'official'>;
export const SCHOOL_EXAM_KINDS: readonly SchoolExamKind[] = ['yazili', 'quiz', 'sozlu', 'proje'];
export const EXAM_TITLE_MAX = 60;

export type ExamDraft = {
  courseId: string | null;
  kind: SchoolExamKind;
  title: string;
  date: string;
  time: string | null;
  topicIds: string[];
};

export type ExamErrors = {
  course?: 'required';
  title?: 'tooLong';
  date?: 'past';
};

/**
 * US-26: a course is required and the date cannot be in the past.
 * When editing, an exam that already passed may keep its original date.
 */
export function validateExam(draft: ExamDraft, today: string, originalDate?: string): ExamErrors {
  const errors: ExamErrors = {};
  if (!draft.courseId) errors.course = 'required';
  if (draft.title.trim().length > EXAM_TITLE_MAX) errors.title = 'tooLong';
  if (draft.date < today && draft.date !== originalDate) errors.date = 'past';
  return errors;
}

export function hasErrors(errors: object): boolean {
  return Object.values(errors).some(Boolean);
}

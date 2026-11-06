/**
 * US-78: when to ask "X. sınıfa geçtin mi?" and which courses no longer fit. Pure logic on
 * "YYYY-MM-DD" strings, unit tested.
 *
 * A Turkish school year starts in September. We ask once per school year:
 * - from 1 September, when the student set their grade in an earlier school year, or
 * - after their target exam (LGS / YKS) has passed, for the coming school year.
 * Answers are remembered by school year (`NewYearMemory`), so a student is never asked
 * twice for the same year. Saying "Hayır" right after the exam still lets September ask.
 */

import type { Course } from '@/db/types';
import { isGradeSupported, type Track } from '@/domain/rules';
import { suggestedCourses } from '@/features/courses/catalog';

/** Months are 1-based here: 9 = September. */
export const SCHOOL_YEAR_START_MONTH = 9;

/** The year the school year containing `day` started in: 2026-11-05 → 2026, 2027-06-20 → 2026. */
export function schoolYearOf(day: string): number {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  return month >= SCHOOL_YEAR_START_MONTH ? year : year - 1;
}

/** The grade after this one, or null when there is none we support (12th grade, primary). */
export function nextGradeOf(grade: number | null | undefined): number | null {
  if (grade == null || !isGradeSupported(grade) || grade >= 12) return null;
  return isGradeSupported(grade + 1) ? grade + 1 : null;
}

/** What the student already answered (kept in kv on the device). */
export type NewYearMemory = {
  /** Every school year up to and including this one is answered. */
  through: number | null;
  /** The student said "Hayır" to the after-exam question for this school year. */
  examDeclined: number | null;
};

export const EMPTY_NEW_YEAR_MEMORY: NewYearMemory = { through: null, examDeclined: null };

export type NewYearReason = 'september' | 'examPassed';

export type NewYearInput = {
  today: string;
  /** Local day the profile was created, i.e. when the grade was first set. */
  createdOn: string;
  grade: number | null;
  /** Last date of the student's official exam(s) (LGS, YKS sessions), if any. */
  targetExamDate: string | null;
  memory: NewYearMemory;
};

export type NewYearPrompt = {
  /** The school year the question is about. */
  schoolYear: number;
  grade: number;
  nextGrade: number;
  reason: NewYearReason;
};

export function newYearPrompt(input: NewYearInput): NewYearPrompt | null {
  const nextGrade = nextGradeOf(input.grade);
  if (input.grade == null || nextGrade == null) return null;
  const current = schoolYearOf(input.today);
  const through = input.memory.through ?? Number.NEGATIVE_INFINITY;

  // The exam is behind them and summer is ahead: ask about the coming school year.
  const exam = input.targetExamDate;
  const examPassed =
    exam != null &&
    exam < input.today &&
    input.createdOn < exam &&
    schoolYearOf(exam) === current;
  if (examPassed && current + 1 > through && input.memory.examDeclined !== current + 1) {
    return { schoolYear: current + 1, grade: input.grade, nextGrade, reason: 'examPassed' };
  }

  // A new school year started since the student told us their grade.
  if (schoolYearOf(input.createdOn) < current && current > through) {
    return { schoolYear: current, grade: input.grade, nextGrade, reason: 'september' };
  }
  return null;
}

/** The memory after the student answers `prompt`. */
export function answerNewYear(
  memory: NewYearMemory,
  prompt: Pick<NewYearPrompt, 'schoolYear' | 'reason'>,
  moved: boolean,
): NewYearMemory {
  if (!moved && prompt.reason === 'examPassed') {
    return { ...memory, examDeclined: prompt.schoolYear };
  }
  return { ...memory, through: Math.max(memory.through ?? prompt.schoolYear, prompt.schoolYear) };
}

/**
 * Active catalog courses that the new grade's list (for the student's track) does not have.
 * Courses the student made up themselves are never offered for the archive.
 */
export function coursesOutsideGrade<T extends Pick<Course, 'catalog_key' | 'archived_at'>>(
  courses: readonly T[],
  grade: number,
  track: Track | null,
): T[] {
  const keep = new Set(suggestedCourses(grade, track).map((c) => c.key));
  return courses.filter((c) => c.archived_at == null && c.catalog_key != null && !keep.has(c.catalog_key));
}

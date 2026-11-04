import { getDb } from '@/db/client';
import type { Course, PlanItem } from '@/db/types';
import { courseMap } from '@/features/courses/repo';
import { listExams, type ExamWithCourse } from '@/features/exams/repo';
import { hasUpcomingPlan, listPlanItems, topicNames } from '@/features/plan/repo';
import { minutesStudied } from '@/features/sessions/repo';
import { addDays } from '@/lib/dates';

export type TodayData = {
  hasCourses: boolean;
  items: PlanItem[];
  courses: Map<string, Course>;
  topics: Map<string, string>;
  minutesToday: number;
  /** Any block from today on: the first plan exists (US-60 asks for permission then). */
  hasPlan: boolean;
};

export const TODAY_TABLES = ['plan_items', 'courses', 'topics', 'study_sessions'] as const;

export async function loadToday(today: string): Promise<TodayData> {
  const [active, items, courses, topics, minutesToday, hasPlan] = await Promise.all([
    getDb().getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM courses WHERE deleted_at IS NULL AND archived_at IS NULL',
    ),
    listPlanItems(today, today),
    courseMap(),
    topicNames(),
    minutesStudied(today),
    hasUpcomingPlan(today),
  ]);
  return { hasCourses: (active?.n ?? 0) > 0, items, courses, topics, minutesToday, hasPlan };
}

export type WeekData = {
  hasCourses: boolean;
  items: PlanItem[];
  exams: ExamWithCourse[];
  courses: Map<string, Course>;
  topics: Map<string, string>;
};

export const WEEK_TABLES = ['plan_items', 'exams', 'courses', 'topics'] as const;

/** Blocks and exams of the week that starts on `monday`. */
export async function loadWeek(monday: string): Promise<WeekData> {
  const sunday = addDays(monday, 6);
  const [active, items, exams, courses, topics] = await Promise.all([
    getDb().getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM courses WHERE deleted_at IS NULL AND archived_at IS NULL',
    ),
    listPlanItems(monday, sunday),
    listExams({ from: monday, to: sunday }),
    courseMap(),
    topicNames(),
  ]);
  return { hasCourses: (active?.n ?? 0) > 0, items, exams, courses, topics };
}

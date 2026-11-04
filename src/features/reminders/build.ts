/**
 * Which reminders to schedule (US-61), as plain data. Pure, so the timing rules are testable:
 * - block start, for blocks of today and tomorrow;
 * - exams: 7, 3 and 1 days before at 18:00, and a morning note on the day (BR-16: not before
 *   07:30, and never inside the student's quiet hours);
 * - homework: the day before it is due, at 17:00.
 * Quiet hours (BR-16) drop a reminder instead of moving it.
 */

import { EXAM_DAY_EARLIEST, isQuietTime, quietHours, toMinutes } from '@/domain/rules';
import { addDays, formatDate, parseDate } from '@/lib/dates';

export const EXAM_REMINDER_DAYS = [7, 3, 1] as const;
export const EXAM_REMINDER_TIME = '18:00';
export const HOMEWORK_REMINDER_TIME = '17:00';
/** Block reminders cover today and tomorrow. */
export const BLOCK_REMINDER_DAYS = 2;
/** iOS keeps at most 64 pending local notifications per app. */
export const IOS_PENDING_LIMIT = 64;

export type ReminderBlock = {
  id: string;
  date: string;
  start: string;
  minutes: number;
  kind: 'study' | 'review' | 'homework';
  courseName: string;
};
export type ReminderExam = { id: string; title: string; date: string };
export type ReminderHomework = { id: string; dueDate: string; courseName: string; description: string };

export type Reminder =
  | { kind: 'plan'; date: Date; block: ReminderBlock }
  | { kind: 'exam'; date: Date; exam: ReminderExam; daysLeft: number }
  | { kind: 'homework'; date: Date; homework: ReminderHomework };

export function atTime(date: string, time: string): Date {
  const day = parseDate(date);
  const minutes = toMinutes(time);
  day.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return day;
}

/** The exam-day note: 07:30, or later when the quiet hours end later (under 13: 08:00). */
export function examMorningTime(age: number | null): string {
  if (age == null) return EXAM_DAY_EARLIEST;
  const end = quietHours(age).end;
  return toMinutes(end) > toMinutes(EXAM_DAY_EARLIEST) ? end : EXAM_DAY_EARLIEST;
}

export function buildReminders(input: {
  now: Date;
  age: number | null;
  blocks: ReminderBlock[];
  exams: ReminderExam[];
  homework: ReminderHomework[];
}): Reminder[] {
  const { now, age } = input;
  const today = formatDate(now);
  const lastBlockDay = addDays(today, BLOCK_REMINDER_DAYS - 1);
  const out: Reminder[] = [];

  for (const block of input.blocks) {
    if (block.date < today || block.date > lastBlockDay) continue;
    out.push({ kind: 'plan', date: atTime(block.date, block.start), block });
  }

  const morning = examMorningTime(age);
  for (const exam of input.exams) {
    for (const daysLeft of EXAM_REMINDER_DAYS) {
      out.push({ kind: 'exam', date: atTime(addDays(exam.date, -daysLeft), EXAM_REMINDER_TIME), exam, daysLeft });
    }
    out.push({ kind: 'exam', date: atTime(exam.date, morning), exam, daysLeft: 0 });
  }

  for (const homework of input.homework) {
    out.push({ kind: 'homework', date: atTime(addDays(homework.dueDate, -1), HOMEWORK_REMINDER_TIME), homework });
  }

  return out
    .filter((r) => r.date.getTime() > now.getTime())
    .filter((r) => age == null || !isQuietTime(r.date, age))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

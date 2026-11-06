/**
 * Schedules the plan, exam and homework reminders (US-61). Runs after every plan
 * regeneration and after a notification setting changes: it cancels the old ones first,
 * then schedules the nearest ones while staying under iOS's 64 pending notifications.
 * `scheduleAt` applies the per-type switches and the quiet hours again (BR-16).
 * Without the parent's notification consent nothing is built (US-76).
 */

import * as Notifications from 'expo-notifications';
import type { Href } from 'expo-router';

import { getDb, hasDb } from '@/db/client';
import type { PlanItem } from '@/db/types';
import { notificationsAllowedNow } from '@/features/permissions/notifications-allowed';
import i18n from '@/i18n';
import { addDays, formatDate } from '@/lib/dates';
import {
  cancelKinds,
  hasNotificationPermission,
  scheduleAt,
  type NotificationKind,
} from '@/services/notifications';
import { profileAge, useSession } from '@/stores/session';
import {
  BLOCK_REMINDER_DAYS,
  buildReminders,
  IOS_PENDING_LIMIT,
  type Reminder,
} from './build';

const OUR_KINDS: NotificationKind[] = ['plan', 'exam', 'homework'];
/** Room left for timer, AI and consent notifications. */
const RESERVED = 6;
/** Exam reminders start 7 days ahead; look a little further so none is missed. */
const EXAM_LOOKAHEAD_DAYS = 30;

let chain: Promise<unknown> = Promise.resolve();

/** Cancels and reschedules every reminder. Calls run one at a time. */
export function rescheduleReminders(): Promise<void> {
  const run = chain.then(reschedule);
  chain = run.catch(() => undefined);
  return run;
}

function content(reminder: Reminder): { title: string; body: string; url: Href } {
  switch (reminder.kind) {
    case 'plan': {
      const { block } = reminder;
      return {
        title: i18n.t('reminders.blockTitle', { course: block.courseName }),
        body: i18n.t('reminders.blockBody', {
          time: block.start,
          minutes: block.minutes,
          kind: i18n.t(`plan.kind.${block.kind}`).toLocaleLowerCase('tr-TR'),
        }),
        url: `/block/${block.id}` as Href,
      };
    }
    case 'exam': {
      const { exam, daysLeft } = reminder;
      return daysLeft === 0
        ? {
            title: i18n.t('reminders.examDayTitle', { title: exam.title }),
            body: i18n.t('reminders.examDayBody'),
            url: `/exam/${exam.id}` as Href,
          }
        : {
            title: i18n.t('reminders.examTitle', { title: exam.title, count: daysLeft }),
            body: i18n.t('reminders.examBody'),
            url: `/exam/${exam.id}` as Href,
          };
    }
    case 'homework': {
      const { homework } = reminder;
      return {
        title: i18n.t('reminders.homeworkTitle', { course: homework.courseName }),
        body: i18n.t('reminders.homeworkBody', { description: homework.description }),
        url: `/homework/${homework.id}` as Href,
      };
    }
  }
}

async function reschedule(): Promise<void> {
  if (!hasDb()) return;
  const profile = useSession.getState().profile;
  if (!profile) return;

  await cancelKinds(OUR_KINDS);
  if (!(await notificationsAllowedNow())) return;
  if (!(await hasNotificationPermission())) return;

  const now = new Date();
  const today = formatDate(now);
  const db = getDb();
  const [blocks, exams, homework] = await Promise.all([
    db.getAllAsync<PlanItem & { course_name: string | null }>(
      `SELECT p.*, c.name AS course_name FROM plan_items p LEFT JOIN courses c ON c.id = p.course_id
       WHERE p.deleted_at IS NULL AND p.status = 'planned' AND p.date >= ? AND p.date <= ?
       ORDER BY p.date, p.start_time`,
      today,
      addDays(today, BLOCK_REMINDER_DAYS - 1),
    ),
    db.getAllAsync<{ id: string; title: string; date: string }>(
      `SELECT e.id, e.title, e.date FROM exams e LEFT JOIN courses c ON c.id = e.course_id
       WHERE e.deleted_at IS NULL AND e.date >= ? AND e.date <= ?
         AND (e.course_id IS NULL OR (c.deleted_at IS NULL AND c.archived_at IS NULL))`,
      today,
      addDays(today, EXAM_LOOKAHEAD_DAYS),
    ),
    db.getAllAsync<{ id: string; due_date: string; description: string; course_name: string | null }>(
      `SELECT h.id, h.due_date, h.description, c.name AS course_name
       FROM homework h LEFT JOIN courses c ON c.id = h.course_id
       WHERE h.deleted_at IS NULL AND h.done_at IS NULL AND h.due_date > ?
         AND c.deleted_at IS NULL AND c.archived_at IS NULL`,
      today,
    ),
  ]);

  const reminders = buildReminders({
    now,
    age: profileAge(profile, now),
    blocks: blocks.map((b) => ({
      id: b.id,
      date: b.date,
      start: b.start_time,
      minutes: b.minutes,
      kind: b.kind,
      courseName: b.course_name ?? i18n.t('plan.generalReview'),
    })),
    exams,
    homework: homework.map((h) => ({
      id: h.id,
      dueDate: h.due_date,
      description: h.description,
      courseName: h.course_name ?? '',
    })),
  });

  const pending = await Notifications.getAllScheduledNotificationsAsync();
  let budget = IOS_PENDING_LIMIT - RESERVED - pending.length;
  for (const reminder of reminders) {
    if (budget <= 0) break;
    const id = await scheduleAt({ kind: reminder.kind, date: reminder.date, ...content(reminder) });
    if (id) budget -= 1;
  }
}

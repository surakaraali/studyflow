/**
 * Focus timer storage and actions (US-54). The state lives in the device kv store; every
 * action reads it fresh, so the timer screen, a restart and the app-start check agree.
 */

import { getDb } from '@/db/client';
import type { PlanItem, PlanItemKind, Profile } from '@/db/types';
import { kvDelete, kvGet, kvSet, patch } from '@/db/write';
import { blockRules, breakMinutesFor, clampBlockMinutes } from '@/domain/rules';
import { profileSegment } from '@/features/plan/repo';
import { addStudySession } from '@/features/sessions/repo';
import i18n from '@/i18n';
import { formatDate } from '@/lib/dates';
import { track } from '@/services/analytics';
import { cancelNotification, scheduleAt } from '@/services/notifications';
import {
  breakState,
  elapsedSeconds,
  newFocusState,
  pausedState,
  remainingSeconds,
  resumedState,
  type TimerState,
} from './clock';

export const TIMER_KEY = 'timer.state';

let chain: Promise<unknown> = Promise.resolve();

/** Runs timer actions one at a time (a finish must never save the session twice). */
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task);
  chain = run.catch(() => undefined);
  return run;
}

export function loadTimer(): Promise<TimerState | null> {
  return kvGet<TimerState>(TIMER_KEY);
}

async function scheduleEnd(state: TimerState): Promise<TimerState> {
  if (state.endsAt == null) return state;
  const focus = state.phase === 'focus';
  const id = await scheduleAt({
    kind: 'timer',
    title: i18n.t(focus ? 'timer.notifyFocusTitle' : 'timer.notifyBreakTitle'),
    body: i18n.t(focus ? 'timer.notifyFocusBody' : 'timer.notifyBreakBody'),
    url: '/timer',
    date: new Date(state.endsAt),
  }).catch(() => null);
  return { ...state, notificationId: id };
}

async function cancelEnd(state: TimerState) {
  if (state.notificationId) await cancelNotification(state.notificationId).catch(() => undefined);
}

/** Starts a focus phase for a block (its length) or a course (the profile's block length). */
export function startFocus(options: {
  blockId: string | null;
  courseId: string | null;
  topicId: string | null;
  minutes: number;
  breakMin: number;
}): Promise<TimerState> {
  return serial(async () => {
    const existing = await loadTimer();
    if (existing) return existing;
    const state = await scheduleEnd(newFocusState(options, Date.now()));
    await kvSet(TIMER_KEY, state);
    return state;
  });
}

export function pauseTimer(): Promise<void> {
  return serial(async () => {
    const state = await loadTimer();
    if (!state || state.endsAt == null) return;
    await cancelEnd(state);
    await kvSet(TIMER_KEY, pausedState(state, Date.now()));
  });
}

export function resumeTimer(): Promise<void> {
  return serial(async () => {
    const state = await loadTimer();
    if (!state || state.endsAt != null) return;
    if (state.phase !== 'focus' && state.phase !== 'break') return;
    await kvSet(TIMER_KEY, await scheduleEnd(resumedState(state, Date.now())));
  });
}

/** Saves the session, marks the block done and offers the break. */
async function finishFocus(state: TimerState): Promise<TimerState> {
  const minutes = Math.max(1, Math.round(state.durationSec / 60));
  const endedAt = new Date(state.endsAt ?? Date.now());
  await addStudySession({
    courseId: state.courseId,
    topicId: state.topicId,
    planItemId: state.blockId,
    date: formatDate(new Date(state.startedAt)),
    minutes,
    source: 'timer',
    startedAt: state.startedAt,
    endedAt: endedAt.toISOString(),
  });
  if (state.blockId) {
    // The block may have been removed meanwhile; the session is saved either way.
    const block = await getDb().getFirstAsync<{ kind: PlanItemKind }>(
      'SELECT kind FROM plan_items WHERE id = ? AND deleted_at IS NULL',
      state.blockId,
    );
    if (block) {
      await patch('plan_items', state.blockId, { status: 'done' });
      track('plan_block_completed', { kind: block.kind, minutes });
    }
  }
  const next: TimerState = { ...state, phase: 'focusDone', endsAt: null, notificationId: null, savedMinutes: minutes };
  await kvSet(TIMER_KEY, next);
  return next;
}

/**
 * Moves a running phase that has reached its end to the next step. Safe to call any time:
 * the timer screen calls it every tick, app start calls it after a restart.
 */
export function settleTimer(nowMs: number = Date.now()): Promise<TimerState | null> {
  return serial(async () => {
    const state = await loadTimer();
    if (!state || state.endsAt == null || remainingSeconds(state, nowMs) > 0) return state;
    if (state.phase === 'focus') return finishFocus(state);
    if (state.phase === 'break') {
      const next: TimerState = { ...state, phase: 'breakDone', endsAt: null, notificationId: null };
      await kvSet(TIMER_KEY, next);
      return next;
    }
    return state;
  });
}

export function startBreak(): Promise<void> {
  return serial(async () => {
    const state = await loadTimer();
    if (!state || state.phase !== 'focusDone') return;
    await kvSet(TIMER_KEY, await scheduleEnd(breakState(state, Date.now())));
  });
}

/**
 * Ends the timer. During focus, `save` keeps the minutes studied so far as a session
 * (the block stays to do, since it was not finished).
 */
export function stopTimer(options: { save: boolean } = { save: false }): Promise<void> {
  return serial(async () => {
    const state = await loadTimer();
    if (!state) return;
    await cancelEnd(state);
    if (options.save && state.phase === 'focus') {
      const minutes = Math.floor(elapsedSeconds(state, Date.now()) / 60);
      if (minutes >= 1) {
        await addStudySession({
          courseId: state.courseId,
          topicId: state.topicId,
          planItemId: null,
          date: formatDate(new Date(state.startedAt)),
          minutes,
          source: 'timer',
          startedAt: state.startedAt,
          endedAt: new Date().toISOString(),
        });
      }
    }
    await kvDelete(TIMER_KEY);
  });
}

/**
 * Starts the timer for a block (its own length) or for a course / free study (the
 * profile's block length, BR-07). Does nothing when a timer is already open.
 */
export async function startTimerFor(
  params: { blockId?: string | null; courseId?: string | null },
  profile: Profile | null,
): Promise<void> {
  if (params.blockId) {
    const block = await getDb().getFirstAsync<PlanItem>(
      'SELECT * FROM plan_items WHERE id = ? AND deleted_at IS NULL',
      params.blockId,
    );
    if (block) {
      await startFocus({
        blockId: block.id,
        courseId: block.course_id,
        topicId: block.topic_id,
        minutes: block.minutes,
        breakMin: block.break_min,
      });
      return;
    }
  }
  const segment = profileSegment(profile) ?? 'ortaokul';
  const minutes = clampBlockMinutes(segment, profile?.block_min ?? blockRules(segment).study);
  await startFocus({
    blockId: null,
    courseId: params.courseId ?? null,
    topicId: null,
    minutes,
    breakMin: profile?.break_min ?? breakMinutesFor(segment, minutes),
  });
}

/** "Fizik · Elektrik" for the timer screen. */
export async function timerLabel(state: TimerState | null): Promise<string | null> {
  if (!state?.courseId) return null;
  const db = getDb();
  const course = await db.getFirstAsync<{ name: string }>('SELECT name FROM courses WHERE id = ?', state.courseId);
  const topic = state.topicId
    ? await db.getFirstAsync<{ name: string }>('SELECT name FROM topics WHERE id = ?', state.topicId)
    : null;
  return [course?.name, topic?.name].filter(Boolean).join(' · ') || null;
}

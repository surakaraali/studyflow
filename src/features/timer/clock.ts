/**
 * Focus timer state (US-54). Timestamp based: a running phase stores when it ends, so the
 * remaining time is right after backgrounding, a lock screen or an app restart.
 */

export type TimerPhase = 'focus' | 'focusDone' | 'break' | 'breakDone';

export type TimerState = {
  phase: TimerPhase;
  blockId: string | null;
  courseId: string | null;
  topicId: string | null;
  /** Length of the current phase in seconds. */
  durationSec: number;
  /** Break after the focus phase, in minutes. */
  breakMin: number;
  /** When the focus phase first started (ISO), stored on the study session. */
  startedAt: string;
  /** Epoch ms when the running phase ends; null while paused or finished. */
  endsAt: number | null;
  /** Seconds left while paused. */
  pausedRemainingSec: number;
  /** The scheduled end-of-phase notification. */
  notificationId: string | null;
  /** Minutes saved when the focus phase finished. */
  savedMinutes: number | null;
};

export function isRunning(state: TimerState): boolean {
  return (state.phase === 'focus' || state.phase === 'break') && state.endsAt != null;
}

export function remainingSeconds(state: TimerState, nowMs: number): number {
  if (state.phase === 'focusDone' || state.phase === 'breakDone') return 0;
  if (state.endsAt == null) return Math.max(0, state.pausedRemainingSec);
  return Math.max(0, Math.ceil((state.endsAt - nowMs) / 1000));
}

/** Focused seconds so far (pauses do not count). */
export function elapsedSeconds(state: TimerState, nowMs: number): number {
  return Math.max(0, state.durationSec - remainingSeconds(state, nowMs));
}

/** "24:59" (or "1:05:00" past an hour). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

export function newFocusState(
  options: {
    blockId: string | null;
    courseId: string | null;
    topicId: string | null;
    minutes: number;
    breakMin: number;
  },
  nowMs: number,
): TimerState {
  const durationSec = Math.max(1, Math.round(options.minutes * 60));
  return {
    phase: 'focus',
    blockId: options.blockId,
    courseId: options.courseId,
    topicId: options.topicId,
    durationSec,
    breakMin: options.breakMin,
    startedAt: new Date(nowMs).toISOString(),
    endsAt: nowMs + durationSec * 1000,
    pausedRemainingSec: durationSec,
    notificationId: null,
    savedMinutes: null,
  };
}

export function pausedState(state: TimerState, nowMs: number): TimerState {
  return { ...state, pausedRemainingSec: remainingSeconds(state, nowMs), endsAt: null, notificationId: null };
}

export function resumedState(state: TimerState, nowMs: number): TimerState {
  return { ...state, endsAt: nowMs + state.pausedRemainingSec * 1000 };
}

export function breakState(state: TimerState, nowMs: number): TimerState {
  const durationSec = Math.max(60, state.breakMin * 60);
  return {
    ...state,
    phase: 'break',
    durationSec,
    endsAt: nowMs + durationSec * 1000,
    pausedRemainingSec: durationSec,
    notificationId: null,
  };
}

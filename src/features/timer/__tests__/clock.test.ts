import {
  breakState,
  elapsedSeconds,
  formatClock,
  isRunning,
  newFocusState,
  pausedState,
  remainingSeconds,
  resumedState,
} from '../clock';

const T0 = Date.UTC(2026, 10, 9, 14, 0, 0);
const focus = () =>
  newFocusState({ blockId: 'b', courseId: 'c', topicId: null, minutes: 25, breakMin: 5 }, T0);

describe('US-54 focus timer clock', () => {
  it('counts down from the block length using the end timestamp', () => {
    const state = focus();
    expect(isRunning(state)).toBe(true);
    expect(remainingSeconds(state, T0)).toBe(1500);
    // Ten minutes in the background: still right when the app comes back.
    expect(remainingSeconds(state, T0 + 600_000)).toBe(900);
    expect(remainingSeconds(state, T0 + 2_000_000)).toBe(0);
  });

  it('pause keeps the remaining time; resume moves the end', () => {
    const paused = pausedState(focus(), T0 + 60_000);
    expect(isRunning(paused)).toBe(false);
    expect(remainingSeconds(paused, T0 + 999_999)).toBe(1440);
    const resumed = resumedState(paused, T0 + 300_000);
    expect(remainingSeconds(resumed, T0 + 300_000)).toBe(1440);
    expect(elapsedSeconds(resumed, T0 + 360_000)).toBe(120);
  });

  it('break phase uses the break length', () => {
    const state = breakState({ ...focus(), phase: 'focusDone', endsAt: null }, T0);
    expect(state.phase).toBe('break');
    expect(remainingSeconds(state, T0)).toBe(300);
    expect(remainingSeconds({ ...state, phase: 'breakDone' }, T0)).toBe(0);
  });

  it('formats the clock', () => {
    expect(formatClock(1500)).toBe('25:00');
    expect(formatClock(59)).toBe('00:59');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(-3)).toBe('00:00');
  });
});

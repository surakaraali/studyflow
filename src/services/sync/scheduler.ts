/**
 * Decides when sync runs (US-05, OFF-03). Platform-free so it can be tested with fake timers;
 * index.ts wires it to AppState, expo-network and table events.
 *
 * - sign-in, app foreground: now
 * - network back: within ONLINE_DELAY_MS (the story asks for < 30 s)
 * - while active: every INTERVAL_MS
 * - local writes: LOCAL_DEBOUNCE_MS after the last one
 * - failures: exponential backoff (5 s … 5 min); network back resets it
 * Only one run at a time; a trigger during a run schedules one more run afterwards.
 */

export type RunOutcome = 'done' | 'more' | 'retry' | 'skipped';

export const INTERVAL_MS = 60_000;
export const LOCAL_DEBOUNCE_MS = 2_000;
export const ONLINE_DELAY_MS = 1_000;
const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 5 * 60_000;

export type Scheduler = {
  /** Starts the periodic timer (app active and signed in). */
  start(): void;
  /** Stops all timers (background or signed out). */
  stop(): void;
  /** Run soon; `delayMs` 0 means now. */
  trigger(delayMs?: number): void;
  /** Local data changed: debounce. */
  localChange(): void;
  /** Connectivity changed. */
  network(online: boolean): void;
  readonly running: boolean;
};

export function createScheduler(run: () => Promise<RunOutcome>): Scheduler {
  let active = false;
  let online = true;
  let running = false;
  let again = false;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let timerAt = Number.POSITIVE_INFINITY;
  let interval: ReturnType<typeof setInterval> | null = null;

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    timerAt = Number.POSITIVE_INFINITY;
  };

  const schedule = (delayMs: number) => {
    if (!active) return;
    const at = Date.now() + delayMs;
    // Keep the earlier of two pending runs.
    if (timer && timerAt <= at) return;
    clearTimer();
    timerAt = at;
    timer = setTimeout(() => {
      timer = null;
      timerAt = Number.POSITIVE_INFINITY;
      void execute();
    }, delayMs);
  };

  const execute = async () => {
    if (!active) return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    let outcome: RunOutcome = 'skipped';
    try {
      outcome = await run();
    } catch {
      outcome = 'retry';
    } finally {
      running = false;
    }
    if (outcome === 'retry') {
      failures += 1;
      // Offline: wait for the network event instead of polling fast.
      schedule(online ? Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (failures - 1)) : BACKOFF_MAX_MS);
      again = false;
      return;
    }
    failures = 0;
    if (outcome === 'more' || again) {
      again = false;
      schedule(0);
    }
  };

  return {
    start() {
      if (active) return;
      active = true;
      interval = setInterval(() => schedule(0), INTERVAL_MS);
    },
    stop() {
      active = false;
      again = false;
      clearTimer();
      if (interval) clearInterval(interval);
      interval = null;
    },
    trigger(delayMs = 0) {
      schedule(delayMs);
    },
    localChange() {
      // Offline: the network event will start the run.
      if (!active || !online) return;
      // Debounce: the last change decides when the run starts.
      if (timer && timerAt - Date.now() <= LOCAL_DEBOUNCE_MS) {
        clearTimer();
      }
      schedule(LOCAL_DEBOUNCE_MS);
    },
    network(next) {
      const cameBack = next && !online;
      online = next;
      if (cameBack) {
        failures = 0;
        clearTimer();
        schedule(ONLINE_DELAY_MS);
      }
    },
    get running() {
      return running;
    },
  };
}

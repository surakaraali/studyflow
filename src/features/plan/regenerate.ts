/**
 * CONTRACT (owned by the plan feature): asks the plan engine to rebuild the 14-day plan.
 * Call it after courses, exams, homework, timetable, availability or the profile change.
 * Debounced; safe to call often.
 *
 * It also runs on its own: after sign-in, when the app comes back to the foreground and
 * once a new day starts. After every rebuild the reminders are rescheduled.
 */

import { AppState } from 'react-native';

import { hasDb } from '@/db/client';
import { registerAppService } from '@/services/app-services';
import { onSignedIn, onSignedOut, useSession } from '@/stores/session';

const DEBOUNCE_MS = 500;
const RETRY_MS = 2_000;

let debounce: ReturnType<typeof setTimeout> | null = null;
let midnight: ReturnType<typeof setTimeout> | null = null;
let running = false;
let again = false;
let retries = 0;
let runner: (() => Promise<void>) | null = null;

/**
 * The plan runner (./runner.ts) registers itself here. Keeping the heavy imports out of this
 * module lets every repo call schedulePlanRegeneration without an import cycle.
 */
export function setPlanRunner(fn: () => Promise<void>) {
  runner = fn;
}

export function schedulePlanRegeneration(reason?: string): void {
  void reason; // Kept for callers' readability ("exam-saved", "foreground", ...).
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => {
    debounce = null;
    void run();
  }, DEBOUNCE_MS);
}

async function run(): Promise<void> {
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    do {
      again = false;
      await regenerateOnce();
    } while (again);
    retries = 0;
  } catch (error) {
    console.warn('Plan regeneration failed', error);
    // Usually another write held the database (e.g. a sync transaction). Try again shortly.
    if (retries < 3) {
      retries += 1;
      setTimeout(() => schedulePlanRegeneration('retry'), RETRY_MS);
    }
  } finally {
    running = false;
  }
}

async function regenerateOnce(): Promise<void> {
  if (!runner || !hasDb() || useSession.getState().status !== 'signedIn') return;
  await runner();
  scheduleMidnight();
}

/** Rebuilds once the date changes while the app stays open. */
function scheduleMidnight() {
  if (midnight) clearTimeout(midnight);
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 1);
  midnight = setTimeout(() => schedulePlanRegeneration('new-day'), next.getTime() - now.getTime());
}

function stop() {
  if (debounce) clearTimeout(debounce);
  if (midnight) clearTimeout(midnight);
  debounce = null;
  midnight = null;
}

registerAppService(() => {
  onSignedIn(() => schedulePlanRegeneration('sign-in'));
  onSignedOut(stop);
  AppState.addEventListener('change', (state) => {
    if (state === 'active') schedulePlanRegeneration('foreground');
  });
  if (useSession.getState().status === 'signedIn') schedulePlanRegeneration('app-start');
});

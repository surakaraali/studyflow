/**
 * Product analytics and crash reporting (US-06, NFR OBS-01, OBS-04, PRIV-04, PRIV-05).
 *
 * Privacy rules (children's app, ADR-006):
 * - Every event is in the dictionary below and tied to a KPI (BRD §3, G-01..G-05).
 *   `track()` drops props that are not listed for the event or do not match their type.
 * - No ids of any kind: no user id, no device or install id, no advertising id, no ATT prompt.
 * - String props only accept listed values, so free text (names, emails, document text)
 *   can never slip through.
 * - Crash reports keep the error type, a scrubbed message and stack frames with file names
 *   only (no paths, emails, ids or long numbers).
 *
 * Where events go (ADR-006: no third-party analytics or crash SDK):
 * - Supabase mode: src/services/telemetry sets its sink at start-up; events and crash reports
 *   are queued on the device and sent to our own telemetry Edge Function (EU).
 * - Local mode: the console in development, nothing in release builds.
 * Documentation: analysis/analytics_events.md.
 */

import { AppState, Platform } from 'react-native';

import { hasDb } from '@/db/client';
import { kvGet, kvSet } from '@/db/write';
import { todayString } from '@/lib/dates';
import { registerAppService } from '@/services/app-services';
import { onSignedIn, useSession } from '@/stores/session';
import { appVersionLabel } from '@/lib/app-version';

export type Kpi = 'G-01' | 'G-02' | 'G-03' | 'G-04' | 'G-05';

type PropSpec = 'number' | 'boolean' | readonly string[];

const PLAN = ['free', 'pro'] as const;
const SEGMENT = ['ilkokul', 'ortaokul', 'lise'] as const;
const BLOCK_KIND = ['study', 'review', 'homework'] as const;
const PERIOD = ['monthly', 'annual', 'other'] as const;

/**
 * The event dictionary: event → KPI and allowed props. Keep analysis/analytics_events.md and the
 * server copy (supabase/functions/_shared/telemetry.ts, checked by a test) in sync.
 */
export const EVENTS = {
  // G-01 regular use (D7 retention)
  app_opened: { kpi: 'G-01', props: { days_since_signup: 'number' } },
  onboarding_completed: {
    kpi: 'G-01',
    props: { segment: SEGMENT, has_target_exam: 'boolean', needs_consent: 'boolean' },
  },
  progress_viewed: { kpi: 'G-01', props: {} },

  // G-02 the plan is followed
  plan_generated: { kpi: 'G-02', props: { blocks: 'number', days: 'number' } },
  plan_block_completed: { kpi: 'G-02', props: { kind: BLOCK_KIND, minutes: 'number' } },
  plan_block_skipped: { kpi: 'G-02', props: { kind: BLOCK_KIND } },
  study_session_saved: { kpi: 'G-02', props: { source: ['timer', 'manual'], minutes: 'number' } },

  // G-03 learning improves
  quiz_completed: {
    kpi: 'G-03',
    props: {
      questions: 'number',
      correct: 'number',
      wrong: 'number',
      blank: 'number',
      is_retry: 'boolean',
    },
  },
  cards_reviewed: { kpi: 'G-03', props: { cards: 'number', new_cards: 'number' } },

  // G-04 AI creates value
  document_uploaded: { kpi: 'G-04', props: { pages: 'number', plan: PLAN } },
  document_ready: { kpi: 'G-04', props: { pages: 'number', duration_sec: 'number' } },
  document_failed: {
    kpi: 'G-04',
    props: {
      reason: [
        'encrypted',
        'not_pdf',
        'too_large',
        'too_many_pages',
        'no_text',
        'timeout',
        'ai_error',
        'network',
        'unknown',
      ],
    },
  },
  content_reported: {
    kpi: 'G-04',
    props: { item: ['question', 'card', 'summary'], reason: ['wrong_answer', 'unclear', 'inappropriate'] },
  },

  // G-05 free → Pro conversion
  quota_reached: { kpi: 'G-05', props: { plan: PLAN } },
  paywall_viewed: { kpi: 'G-05', props: { source: ['settings', 'quota', 'other'], test: 'boolean' } },
  purchase_started: { kpi: 'G-05', props: { period: PERIOD, under_18: 'boolean' } },
  purchase_completed: { kpi: 'G-05', props: { period: PERIOD, test: 'boolean' } },
  purchase_failed: {
    kpi: 'G-05',
    props: { reason: ['cancelled', 'pending', 'not_allowed', 'network', 'unavailable', 'unknown'] },
  },
  purchase_restored: { kpi: 'G-05', props: { active: 'boolean' } },
} as const satisfies Record<string, { kpi: Kpi; props: Record<string, PropSpec> }>;

export type EventName = keyof typeof EVENTS;

type PropValue<S> = S extends 'number'
  ? number
  : S extends 'boolean'
    ? boolean
    : S extends readonly (infer U)[]
      ? U
      : never;

type Specs<E extends EventName> = (typeof EVENTS)[E]['props'];

export type EventProps<E extends EventName> = {
  [K in keyof Specs<E>]?: PropValue<Specs<E>[K]>;
};

export type CleanProps = Record<string, string | number | boolean>;

export type CrashReport = {
  name: string;
  message: string;
  stack: string;
  fatal: boolean;
  platform: string;
  os_version: string;
  app_version: string;
};

export type AnalyticsSink = {
  capture(event: EventName, props: CleanProps, kpi: Kpi): void;
  captureCrash(report: CrashReport): void;
};

const consoleSink: AnalyticsSink = {
  capture: (event, props, kpi) => console.log(`[analytics] ${event} (${kpi})`, props),
  captureCrash: (report) => console.log('[crash]', report),
};

const silentSink: AnalyticsSink = {
  capture: () => {},
  captureCrash: () => {},
};

let sink: AnalyticsSink = __DEV__ ? consoleSink : silentSink;

/** Swaps where events go (src/services/telemetry does this in Supabase mode). */
export function setAnalyticsSink(next: AnalyticsSink) {
  sink = next;
}

function matches(spec: PropSpec, value: unknown): value is string | number | boolean {
  if (spec === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (spec === 'boolean') return typeof value === 'boolean';
  return typeof value === 'string' && spec.includes(value);
}

/**
 * Keeps only the props the dictionary allows for this event, with the right type.
 * Returns null for an unknown event.
 */
export function scrubProps(event: string, props: Record<string, unknown> | undefined): CleanProps | null {
  if (!Object.prototype.hasOwnProperty.call(EVENTS, event)) return null;
  const specs = EVENTS[event as EventName].props as Record<string, PropSpec>;
  const clean: CleanProps = {};
  for (const [key, value] of Object.entries(props ?? {})) {
    if (!Object.prototype.hasOwnProperty.call(specs, key)) continue;
    const spec = specs[key];
    if (!matches(spec, value)) continue;
    clean[key] = typeof value === 'number' ? Math.round(value * 100) / 100 : value;
  }
  return clean;
}

/** Records a product event. Never throws; unknown props are dropped. */
export function track<E extends EventName>(event: E, props?: EventProps<E>): void {
  try {
    const clean = scrubProps(event, props as Record<string, unknown> | undefined);
    if (clean) sink.capture(event, clean, EVENTS[event].kpi);
  } catch {
    // Analytics must never break the app.
  }
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const URL_OR_PATH = /(?:[a-z][a-z0-9+.-]*:\/\/[^\s()'"]+|(?:~|\.{1,2})?\/(?:[^\s/()'"]+\/)*[^\s/()'"]+)/gi;
const LONG_NUMBER = /\d{6,}/g;
const CODE_FILE = /\.(?:js|jsx|ts|tsx|mjs|cjs|bundle|jsbundle|hbc)$/i;

/** A path or URL becomes its file name for code files, and "<path>" for anything else. */
function scrubLocation(location: string): string {
  const position = location.match(/(?::\d+)+$/)?.[0] ?? '';
  const withoutPosition = position ? location.slice(0, -position.length) : location;
  // Metro URLs carry options after "?" or, in newer versions, after "//&".
  const withoutQuery = withoutPosition.replace(/(?:[?#]|\/\/&).*$/, '');
  const name = withoutQuery.split('/').filter(Boolean).pop() ?? '';
  return CODE_FILE.test(name) ? `${name}${position}` : '<path>';
}

/** Removes personal data from an error message or stack line. */
export function scrubText(text: string, maxLength = 300): string {
  const scrubbed = text
    .replace(EMAIL, '<email>')
    .replace(URL_OR_PATH, scrubLocation)
    .replace(UUID, '<id>')
    .replace(LONG_NUMBER, '<n>');
  return scrubbed.length > maxLength ? `${scrubbed.slice(0, maxLength)}…` : scrubbed;
}

/** Keeps function names and code file positions; drops paths and personal data. */
export function scrubStack(stack: string | undefined, maxFrames = 25): string {
  if (!stack) return '';
  return stack
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maxFrames)
    .map((line) => scrubText(line, 200))
    .join('\n');
}

function appVersion(): string {
  return appVersionLabel();
}

export function buildCrashReport(error: unknown, fatal: boolean): CrashReport {
  const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Non-error thrown');
  return {
    name: scrubText(err.name || 'Error', 60),
    message: scrubText(err.message ?? ''),
    stack: scrubStack(err.stack),
    fatal,
    platform: Platform.OS,
    os_version: String(Platform.Version),
    app_version: appVersion(),
  };
}

/** Reports an error the app caught and handled (not shown to the student). */
export function captureError(error: unknown): void {
  try {
    sink.captureCrash(buildCrashReport(error, false));
  } catch {
    // Never let reporting fail the caller.
  }
}

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsLike = {
  getGlobalHandler: () => GlobalHandler;
  setGlobalHandler: (handler: GlobalHandler) => void;
};

let crashHandlerInstalled = false;

/** Wraps React Native's global JS error handler; the previous handler still runs (red box, crash). */
export function installCrashHandler(): void {
  const errorUtils = (globalThis as unknown as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (crashHandlerInstalled || !errorUtils) return;
  crashHandlerInstalled = true;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    try {
      sink.captureCrash(buildCrashReport(error, isFatal ?? false));
    } catch {
      // Reporting must not hide the original error.
    }
    previous?.(error, isFatal);
  });
}

/** Days since the account was created, capped so the value stays coarse (G-01 cohorts). */
export function daysSinceSignup(createdAt: string | null | undefined, now: Date = new Date()): number | null {
  if (!createdAt) return null;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(created)) / 86_400_000);
  return Math.max(0, Math.min(days, 60));
}

const LAST_OPEN_KEY = 'analytics.lastOpenDay';

/** At most one app_opened per account and day, so counts equal active students per day. */
async function trackDailyOpen() {
  const { status, profile } = useSession.getState();
  if (status !== 'signedIn' || !hasDb()) return;
  const today = todayString();
  if ((await kvGet<string>(LAST_OPEN_KEY)) === today) return;
  await kvSet(LAST_OPEN_KEY, today);
  const days = daysSinceSignup(profile?.created_at);
  track('app_opened', days == null ? {} : { days_since_signup: days });
}

// Installed on import (boot.ts imports this module first) so errors in later modules are caught.
installCrashHandler();

registerAppService(() => {
  const open = () => {
    trackDailyOpen().catch(() => {});
  };
  onSignedIn(open);
  AppState.addEventListener('change', (state) => {
    if (state === 'active') open();
  });
});

/**
 * Telemetry batch checks for the telemetry Edge Function (ADR-006, OBS-04, PRIV-04, SEC-06).
 *
 * TELEMETRY_EVENTS is the server copy of the event dictionary (EVENTS in src/services/analytics.ts).
 * src/services/telemetry/__tests__/contract.test.ts fails when the two differ, so change both together.
 *
 * Kept free of imports and Deno APIs so Jest can test it too.
 */

export type PropSpec = 'number' | 'boolean' | readonly string[];

const PLAN = ['free', 'pro'] as const;
const SEGMENT = ['ilkokul', 'ortaokul', 'lise'] as const;
const BLOCK_KIND = ['study', 'review', 'homework'] as const;
const PERIOD = ['monthly', 'annual', 'other'] as const;

export const TELEMETRY_EVENTS: Record<string, Record<string, PropSpec>> = {
  app_opened: { days_since_signup: 'number' },
  onboarding_completed: { segment: SEGMENT, has_target_exam: 'boolean', needs_consent: 'boolean' },
  progress_viewed: {},
  plan_generated: { blocks: 'number', days: 'number' },
  plan_block_completed: { kind: BLOCK_KIND, minutes: 'number' },
  plan_block_skipped: { kind: BLOCK_KIND },
  study_session_saved: { source: ['timer', 'manual'], minutes: 'number' },
  quiz_completed: { questions: 'number', correct: 'number', wrong: 'number', blank: 'number', is_retry: 'boolean' },
  cards_reviewed: { cards: 'number', new_cards: 'number' },
  document_uploaded: { pages: 'number', plan: PLAN },
  document_ready: { pages: 'number', duration_sec: 'number' },
  document_failed: {
    reason: ['encrypted', 'not_pdf', 'too_large', 'too_many_pages', 'no_text', 'timeout', 'ai_error', 'network', 'unknown'],
  },
  content_reported: {
    item: ['question', 'card', 'summary'],
    reason: ['wrong_answer', 'unclear', 'inappropriate'],
  },
  quota_reached: { plan: PLAN },
  paywall_viewed: { source: ['settings', 'quota', 'other'], test: 'boolean' },
  purchase_started: { period: PERIOD, under_18: 'boolean' },
  purchase_completed: { period: PERIOD, test: 'boolean' },
  purchase_failed: { reason: ['cancelled', 'pending', 'not_allowed', 'network', 'unavailable', 'unknown'] },
  purchase_restored: { active: 'boolean' },
};

/** Request limits. The app sends at most BATCH_ITEMS per request (src/services/telemetry). */
export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_ITEMS = 50;
/** Items (events + crash reports) per user per hour. */
export const HOURLY_LIMIT = 300;

const MAX_PROPS_BYTES = 1024;
const MAX_NAME = 80;
const MAX_MESSAGE = 300;
const MAX_STACK_LINES = 25;
const MAX_STACK_LINE = 200;

export type Platform = 'ios' | 'android' | 'web';
type Context = { app_version: string | null; platform: Platform; os_major: number | null };
export type CleanEvent = Context & { name: string; props: Record<string, string | number | boolean> };
export type CleanCrash = Context & { name: string; message: string; stack: string; fatal: boolean };

export type ParsedBatch =
  | { ok: true; events: CleanEvent[]; crashes: CleanCrash[]; skipped: number }
  | { ok: false; status: 413 | 422; code: string };

const has = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function matches(spec: PropSpec, value: unknown): value is string | number | boolean {
  if (spec === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (spec === 'boolean') return typeof value === 'boolean';
  return typeof value === 'string' && spec.includes(value);
}

/** Same rule as scrubProps in src/services/analytics.ts: listed props with the right type only. */
export function cleanProps(name: string, props: unknown): Record<string, string | number | boolean> | null {
  if (!has(TELEMETRY_EVENTS, name)) return null;
  const specs = TELEMETRY_EVENTS[name];
  const clean: Record<string, string | number | boolean> = {};
  if (!isRecord(props)) return clean;
  for (const [key, value] of Object.entries(props)) {
    if (!has(specs, key) || !matches(specs[key], value)) continue;
    clean[key] = typeof value === 'number' ? Math.round(value * 100) / 100 : value;
  }
  return clean;
}

// Second pass over crash text (the app scrubs it first, see scrubText in src/services/analytics.ts).
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const IPV4 = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;
const URL_OR_PATH = /(?:[a-z][a-z0-9+.-]*:\/\/[^\s()'"]+|(?:~|\.{1,2})?\/(?:[^\s/()'"]+\/)*[^\s/()'"]+)/gi;
const LONG_NUMBER = /\d{6,}/g;
const CODE_FILE = /\.(?:js|jsx|ts|tsx|mjs|cjs|bundle|jsbundle|hbc)$/i;

function scrubLocation(location: string): string {
  const position = location.match(/(?::\d+)+$/)?.[0] ?? '';
  const withoutPosition = position ? location.slice(0, -position.length) : location;
  const withoutQuery = withoutPosition.replace(/(?:[?#]|\/\/&).*$/, '');
  const name = withoutQuery.split('/').filter(Boolean).pop() ?? '';
  return CODE_FILE.test(name) ? `${name}${position}` : '<path>';
}

export function scrubText(text: string, maxLength: number): string {
  const scrubbed = text
    .replace(EMAIL, '<email>')
    .replace(URL_OR_PATH, scrubLocation)
    .replace(UUID, '<id>')
    .replace(IPV4, '<ip>')
    .replace(LONG_NUMBER, '<n>');
  return scrubbed.length > maxLength ? `${scrubbed.slice(0, maxLength)}…` : scrubbed;
}

function scrubStack(stack: string): string {
  return stack
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_STACK_LINES)
    .map((line) => scrubText(line, MAX_STACK_LINE))
    .join('\n');
}

function context(item: Record<string, unknown>): Context | null {
  const platform = item.platform;
  if (platform !== 'ios' && platform !== 'android' && platform !== 'web') return null;
  const version = item.app_version;
  const osMajor = item.os_major;
  return {
    platform,
    // "1.2.0 (45)"; anything else is dropped rather than stored.
    app_version: typeof version === 'string' && /^[\w.() ?+-]{1,40}$/.test(version) ? version : null,
    os_major: typeof osMajor === 'number' && Number.isInteger(osMajor) && osMajor >= 0 && osMajor <= 1000 ? osMajor : null,
  };
}

/**
 * Checks a request body. A wrong shape or size refuses the whole batch (the app drops it);
 * unknown events and broken items are skipped one by one, so an app that is newer than the
 * server still gets its other items stored.
 */
export function parseBatch(body: unknown): ParsedBatch {
  if (!isRecord(body) || !Array.isArray(body.items)) return { ok: false, status: 422, code: 'invalid_batch' };
  if (body.items.length > MAX_ITEMS) return { ok: false, status: 413, code: 'too_many_items' };

  const events: CleanEvent[] = [];
  const crashes: CleanCrash[] = [];
  let skipped = 0;

  for (const item of body.items as unknown[]) {
    const ctx = isRecord(item) ? context(item) : null;
    if (!isRecord(item) || !ctx || typeof item.name !== 'string') {
      skipped++;
      continue;
    }
    if (item.type === 'event') {
      const props = cleanProps(item.name, item.props);
      if (!props || JSON.stringify(props).length > MAX_PROPS_BYTES) {
        skipped++;
        continue;
      }
      events.push({ ...ctx, name: item.name, props });
    } else if (item.type === 'crash') {
      const name = scrubText(item.name.trim(), MAX_NAME - 1);
      if (!name) {
        skipped++;
        continue;
      }
      crashes.push({
        ...ctx,
        name,
        message: typeof item.message === 'string' ? scrubText(item.message, MAX_MESSAGE) : '',
        stack: typeof item.stack === 'string' ? scrubStack(item.stack) : '',
        fatal: item.fatal === true,
      });
    } else {
      skipped++;
    }
  }
  return { ok: true, events, crashes, skipped };
}

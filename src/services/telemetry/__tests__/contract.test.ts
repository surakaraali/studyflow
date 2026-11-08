/// <reference types="jest" />
/**
 * The app and the telemetry Edge Function must agree on the event dictionary and the batch
 * format. The server code lives in supabase/functions (Deno), which Jest skips, so it is tested
 * from here; supabase/functions/_shared/telemetry.ts has no imports for that reason.
 */
import { EVENTS, scrubProps } from '@/services/analytics';

import {
  HOURLY_LIMIT,
  MAX_ITEMS,
  parseBatch,
  TELEMETRY_EVENTS,
} from '../../../../supabase/functions/_shared/telemetry';
import { BATCH_SIZE } from '../flush';
import { MAX_QUEUED } from '../queue';

jest.mock('@/stores/session', () => ({
  onSignedIn: jest.fn(),
  useSession: { getState: () => ({ status: 'signedOut', profile: null }) },
}));
jest.mock('@/db/client', () => ({ hasDb: () => false }));
jest.mock('@/db/write', () => ({ kvGet: jest.fn(), kvSet: jest.fn() }));

const context = { app_version: '1.0.0 (42)', platform: 'ios', os_major: 18 };

describe('event dictionary: app and server', () => {
  it('lists the same events with the same props (update both files together)', () => {
    const app = Object.fromEntries(Object.entries(EVENTS).map(([name, event]) => [name, event.props]));
    expect(TELEMETRY_EVENTS).toEqual(app);
  });

  it('agrees on batch and queue sizes', () => {
    expect(BATCH_SIZE).toBe(MAX_ITEMS);
    // A full queue can be sent within one hour's limit.
    expect(MAX_QUEUED).toBeLessThanOrEqual(HOURLY_LIMIT * 2);
  });

  it('cleans props the same way as the app', () => {
    const props = { correct: 7.456, wrong: '2', is_retry: false, user_id: 'x', email: 'a@b.co' };
    const result = parseBatch({ items: [{ type: 'event', name: 'quiz_completed', props, ...context }] });
    expect(result.ok && result.events[0].props).toEqual(scrubProps('quiz_completed', props));
  });
});

describe('server batch checks', () => {
  it('keeps listed events and props and skips unknown events', () => {
    const result = parseBatch({
      items: [
        { type: 'event', name: 'document_failed', props: { reason: 'timeout', file_name: 'notlar.pdf' }, ...context },
        { type: 'event', name: 'screen_viewed', props: {}, ...context },
        { type: 'event', name: 'document_failed', props: { reason: 'my own words' }, ...context },
      ],
    });
    expect(result).toEqual({
      ok: true,
      events: [
        { name: 'document_failed', props: { reason: 'timeout' }, ...context },
        { name: 'document_failed', props: {}, ...context },
      ],
      crashes: [],
      skipped: 1,
    });
  });

  it('refuses more than 50 items and wrong shapes', () => {
    const item = { type: 'event', name: 'progress_viewed', props: {}, ...context };
    expect(parseBatch({ items: Array.from({ length: 51 }, () => item) })).toEqual({
      ok: false,
      status: 413,
      code: 'too_many_items',
    });
    expect(parseBatch({ items: 'nope' })).toMatchObject({ ok: false, status: 422 });
    expect(parseBatch({})).toMatchObject({ ok: false, status: 422 });
  });

  it('skips items without a known platform and drops odd versions', () => {
    const result = parseBatch({
      items: [
        { type: 'event', name: 'progress_viewed', props: {}, platform: 'windows' },
        { type: 'event', name: 'progress_viewed', props: {}, platform: 'android', app_version: 'x'.repeat(41), os_major: 3.5 },
        { type: 'other', name: 'progress_viewed', props: {}, ...context },
      ],
    });
    expect(result).toMatchObject({
      ok: true,
      events: [{ name: 'progress_viewed', platform: 'android', app_version: null, os_major: null }],
      skipped: 2,
    });
  });

  it('scrubs crash text again and caps its size', () => {
    const result = parseBatch({
      items: [
        {
          type: 'crash',
          name: 'TypeError',
          message: `failed for ali@example.com 3fa85f64-5717-4562-b3fc-2c963f66afa6 at 192.168.1.20 ${'x'.repeat(400)}`,
          stack: Array.from({ length: 40 }, (_, i) => `at f${i} (/Users/ali/app/index.ts:${i}:1)`).join('\n'),
          fatal: true,
          ...context,
        },
      ],
    });
    if (!result.ok) throw new Error('expected ok');
    const [crash] = result.crashes;
    expect(crash.message).toContain('<email>');
    expect(crash.message).toContain('<id>');
    expect(crash.message).toContain('<ip>');
    expect(crash.message).not.toContain('ali@');
    expect(crash.message.length).toBeLessThanOrEqual(301);
    expect(crash.stack.split('\n')).toHaveLength(25);
    expect(crash.stack).not.toContain('/Users');
    expect(crash.stack.split('\n')[0]).toBe('at f0 (index.ts:0:1)');
    expect(crash.fatal).toBe(true);
  });

  it('skips a crash without a name', () => {
    const result = parseBatch({ items: [{ type: 'crash', name: '  ', message: 'x', ...context }] });
    expect(result).toMatchObject({ ok: true, crashes: [], skipped: 1 });
  });
});

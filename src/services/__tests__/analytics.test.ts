/// <reference types="jest" />
import {
  EVENTS,
  buildCrashReport,
  daysSinceSignup,
  scrubProps,
  scrubStack,
  scrubText,
  setAnalyticsSink,
  track,
  type AnalyticsSink,
} from '../analytics';

// The service registers sign-in hooks and reads the session; keep those modules (and the
// database behind them) out of this unit test. jest.mock calls are hoisted above the import.
jest.mock('@/stores/session', () => ({
  onSignedIn: jest.fn(),
  useSession: { getState: () => ({ status: 'signedOut', profile: null }) },
}));
jest.mock('@/db/client', () => ({ hasDb: () => false }));
jest.mock('@/db/write', () => ({ kvGet: jest.fn(), kvSet: jest.fn() }));

describe('event dictionary (OBS-04)', () => {
  it('ties every event to a KPI between G-01 and G-05', () => {
    for (const [name, event] of Object.entries(EVENTS)) {
      expect([name, event.kpi]).toEqual([name, expect.stringMatching(/^G-0[1-5]$/)]);
    }
  });

  it('never allows an id, email, name or free-text prop', () => {
    const banned = /(^|_)(id|ids|email|mail|name|nickname|birth|year|text|title|token|device|ad)($|_)/;
    for (const event of Object.values(EVENTS)) {
      for (const [key, spec] of Object.entries(event.props)) {
        expect(key).not.toMatch(banned);
        // Strings must come from a fixed list; there is no free "string" type.
        expect(spec === 'number' || spec === 'boolean' || Array.isArray(spec)).toBe(true);
      }
    }
  });
});

describe('scrubProps (PRIV-04)', () => {
  it('keeps allowed props with the right type', () => {
    expect(scrubProps('plan_block_completed', { kind: 'study', minutes: 25 })).toEqual({
      kind: 'study',
      minutes: 25,
    });
  });

  it('drops props that are not in the dictionary', () => {
    expect(
      scrubProps('quiz_completed', {
        correct: 7,
        user_id: 'b3b8c6f2-0a4e-4c43-9a4f-0c9d1e1f2a3b',
        email: 'ali@example.com',
        nickname: 'Ali',
        birth_year: 2011,
        document_text: 'Hücre zarı seçici geçirgendir',
      }),
    ).toEqual({ correct: 7 });
  });

  it('drops values of the wrong type or outside the allowed list', () => {
    expect(
      scrubProps('document_failed', { reason: 'Biyoloji notlarım.pdf açılamadı' }),
    ).toEqual({});
    expect(scrubProps('plan_block_completed', { kind: 'study', minutes: '25' })).toEqual({
      kind: 'study',
    });
    expect(scrubProps('plan_block_completed', { minutes: Number.NaN })).toEqual({});
    expect(scrubProps('purchase_restored', { active: 'yes' })).toEqual({});
  });

  it('rounds numbers to two decimals', () => {
    expect(scrubProps('document_ready', { duration_sec: 12.3456 })).toEqual({ duration_sec: 12.35 });
  });

  it('rejects unknown events', () => {
    expect(scrubProps('secret_event', { a: 1 })).toBeNull();
    expect(scrubProps('toString', {})).toBeNull();
  });

  it('sends only the clean props to the sink', () => {
    const capture = jest.fn();
    const sink: AnalyticsSink = { capture, captureCrash: jest.fn() };
    setAnalyticsSink(sink);
    track('paywall_viewed', { source: 'settings', email: 'x@y.com' } as never);
    expect(capture).toHaveBeenCalledWith('paywall_viewed', { source: 'settings' }, 'G-05');
  });
});

describe('crash scrubbing (OBS-01)', () => {
  it('removes emails, ids, long numbers and user file paths from messages', () => {
    const text = scrubText(
      'Could not open file:///var/mobile/Containers/Data/Application/ABC/Documents/Biyoloji%20notlar.pdf ' +
        'for ali.veli@okul.k12.tr (user 0f8fad5b-d9cb-469f-a165-70867728950e, phone 5551234567)',
    );
    expect(text).toBe('Could not open <path> for <email> (user <id>, phone <n>)');
  });

  it('keeps code file names and positions in stack frames, without paths or bundle options', () => {
    const stack = scrubStack(
      [
        'Error: boom',
        '    at loadSummary (http://192.168.1.20:8081/index.bundle//&platform=ios&dev=true:1234:56)',
        '    at anonymous (/private/var/containers/Bundle/Application/1A2B/StudyFlow.app/main.jsbundle:1:9876)',
        '    at render (/Users/ayse/Projects/studyflow/src/app/(app)/document/[id].tsx:42:7)',
        '    at open (http://localhost:8081/index.bundle?platform=ios&dev=true:10:2)',
      ].join('\n'),
    );
    expect(stack.split('\n')).toEqual([
      'Error: boom',
      'at loadSummary (index.bundle:1234:56)',
      'at anonymous (main.jsbundle:1:9876)',
      expect.not.stringContaining('ayse'),
      'at open (index.bundle:10:2)',
    ]);
  });

  it('limits the number of frames', () => {
    const stack = scrubStack(Array.from({ length: 40 }, (_, i) => `at f${i} (a.js:${i}:1)`).join('\n'));
    expect(stack.split('\n')).toHaveLength(25);
  });

  it('builds a report without personal data', () => {
    const error = new Error('Profile ali@example.com not found');
    const report = buildCrashReport(error, true);
    expect(report.message).toBe('Profile <email> not found');
    expect(report.fatal).toBe(true);
    expect(report.name).toBe('Error');
    expect(JSON.stringify(report)).not.toContain('ali@example.com');
  });

  it('handles values that are not errors', () => {
    expect(buildCrashReport('plain text', false).message).toBe('plain text');
    expect(buildCrashReport(undefined, false).message).toBe('Non-error thrown');
  });
});

describe('daysSinceSignup (G-01 cohorts)', () => {
  it('counts calendar days and caps the value', () => {
    const now = new Date(2026, 10, 10, 9);
    expect(daysSinceSignup(new Date(2026, 10, 3, 23).toISOString(), now)).toBe(7);
    expect(daysSinceSignup(new Date(2025, 0, 1).toISOString(), now)).toBe(60);
    expect(daysSinceSignup(null, now)).toBeNull();
    expect(daysSinceSignup('not a date', now)).toBeNull();
  });
});

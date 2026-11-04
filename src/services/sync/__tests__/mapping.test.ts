import { normalizeTime, normalizeTimestamp, remoteTable, toLocal, toRemote } from '../mapping';

describe('normalizeTimestamp', () => {
  it.each([
    ['2026-11-04T10:00:00.123456+00:00', '2026-11-04T10:00:00.123Z'],
    ['2026-11-04T10:00:00+00:00', '2026-11-04T10:00:00.000Z'],
    ['2026-11-04 13:00:00.5+03', '2026-11-04T10:00:00.500Z'],
    ['2026-11-04T10:00:00.123Z', '2026-11-04T10:00:00.123Z'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeTimestamp(input)).toBe(expected);
  });

  it('leaves other values alone', () => {
    expect(normalizeTimestamp('2026-11-04')).toBe('2026-11-04');
    expect(normalizeTimestamp(null)).toBeNull();
  });
});

describe('normalizeTime', () => {
  it('drops seconds', () => {
    expect(normalizeTime('08:30:00')).toBe('08:30');
    expect(normalizeTime('24:00:00')).toBe('24:00');
    expect(normalizeTime('07:05')).toBe('07:05');
  });
});

describe('table names', () => {
  it('maps profile to profiles', () => {
    expect(remoteTable('profile')).toBe('profiles');
    expect(remoteTable('cards')).toBe('cards');
  });
});

describe('toRemote / toLocal', () => {
  const user = 'u-1';

  it('round-trips a quiz attempt', () => {
    const local = {
      id: 'q1',
      quiz_id: 'z',
      question_ids: '["a","b"]',
      answers: '{"a":1,"b":null}',
      status: 'done',
      started_at: '2026-11-04T10:00:00.000Z',
      created_at: '2026-11-04T10:00:00.000Z',
      updated_at: '2026-11-04T10:05:00.000Z',
      deleted_at: null,
    };
    const remote = toRemote('quiz_attempts', local, user);
    expect(remote).toMatchObject({ user_id: user, question_ids: ['a', 'b'], answers: { a: 1, b: null } });

    const columns = new Set(Object.keys(local));
    const back = toLocal('quiz_attempts', { ...remote, synced_at: 'x' }, columns);
    expect(back).toEqual(local);
  });

  it('keeps JSON that was stored as text on the server', () => {
    const row = toLocal('summaries', { id: 's', content: '{"sections":[]}', synced_at: 'x' }, new Set(['id', 'content']));
    expect(row.content).toBe('{"sections":[]}');
  });

  it('turns booleans into 0/1 and drops server-only columns', () => {
    const row = toLocal(
      'content_reports',
      { id: 'r', status: 'open', user_id: user, reviewed_by: 'team', synced_at: 'x', extra: true },
      new Set(['id', 'status', 'extra']),
    );
    expect(row).toEqual({ id: 'r', status: 'open', extra: 1 });
  });
});

import { PARENT_GATE_ATTEMPTS, PARENT_GATE_LOCK_MS } from '@/domain/rules';

import {
  attemptsLeft,
  capitalizeTr,
  initialGateLock,
  isCorrectAnswer,
  lockRemainingMs,
  makeGateQuestion,
  numberToTurkishWords,
  registerWrongAnswer,
} from '../question';

describe('numberToTurkishWords', () => {
  it.each([
    [0, 'sıfır'],
    [1, 'bir'],
    [7, 'yedi'],
    [10, 'on'],
    [12, 'on iki'],
    [19, 'on dokuz'],
    [40, 'kırk'],
    [66, 'altmış altı'],
    [99, 'doksan dokuz'],
    [100, 'yüz'],
    [101, 'yüz bir'],
    [123, 'yüz yirmi üç'],
    [200, 'iki yüz'],
    [261, 'iki yüz altmış bir'],
    [999, 'dokuz yüz doksan dokuz'],
    [1000, 'bin'],
    [1001, 'bin bir'],
    [1984, 'bin dokuz yüz seksen dört'],
    [2000, 'iki bin'],
    [12_345, 'on iki bin üç yüz kırk beş'],
    [100_000, 'yüz bin'],
    [1_000_000, 'bir milyon'],
    [2_500_000, 'iki milyon beş yüz bin'],
  ])('%i → %s', (value, words) => {
    expect(numberToTurkishWords(value)).toBe(words);
  });

  it('rejects negative and fractional numbers', () => {
    expect(() => numberToTurkishWords(-1)).toThrow(RangeError);
    expect(() => numberToTurkishWords(1.5)).toThrow(RangeError);
  });
});

describe('capitalizeTr', () => {
  it('uses Turkish casing for i', () => {
    expect(capitalizeTr('iki yüz')).toBe('İki yüz');
    expect(capitalizeTr('on iki')).toBe('On iki');
    expect(capitalizeTr('')).toBe('');
  });
});

describe('makeGateQuestion', () => {
  it('builds a two-digit times one-digit multiplication', () => {
    for (let i = 0; i < 500; i++) {
      const q = makeGateQuestion();
      expect(q.a).toBeGreaterThanOrEqual(11);
      expect(q.a).toBeLessThanOrEqual(29);
      expect(q.a % 10).not.toBe(0);
      expect(q.b).toBeGreaterThanOrEqual(3);
      expect(q.b).toBeLessThanOrEqual(9);
      expect(q.answer).toBe(q.a * q.b);
    }
  });

  it('is driven by the random source', () => {
    expect(makeGateQuestion(() => 0)).toEqual({ a: 11, b: 3, answer: 33 });
    // 0.5 → a = 11 + floor(0.5 × 19) = 20 → bumped to 21
    expect(makeGateQuestion(() => 0.5).a).toBe(21);
    expect(makeGateQuestion(() => 0.999)).toEqual({ a: 29, b: 9, answer: 261 });
  });
});

describe('isCorrectAnswer', () => {
  const q = { a: 12, b: 7, answer: 84 };
  it('accepts the right number only', () => {
    expect(isCorrectAnswer(q, '84')).toBe(true);
    expect(isCorrectAnswer(q, '084')).toBe(true);
    expect(isCorrectAnswer(q, '85')).toBe(false);
    expect(isCorrectAnswer(q, '')).toBe(false);
    expect(isCorrectAnswer(q, '8a')).toBe(false);
  });
});

describe('gate lock', () => {
  it('locks for a minute after three wrong answers', () => {
    const now = 1_000_000;
    let state = initialGateLock;
    expect(attemptsLeft(state)).toBe(PARENT_GATE_ATTEMPTS);
    for (let i = 1; i < PARENT_GATE_ATTEMPTS; i++) {
      state = registerWrongAnswer(state, now);
      expect(state.lockedUntil).toBeNull();
      expect(attemptsLeft(state)).toBe(PARENT_GATE_ATTEMPTS - i);
    }
    state = registerWrongAnswer(state, now);
    expect(state.lockedUntil).toBe(now + PARENT_GATE_LOCK_MS);
    expect(lockRemainingMs(state, now)).toBe(PARENT_GATE_LOCK_MS);
    expect(lockRemainingMs(state, now + 30_000)).toBe(30_000);
    expect(lockRemainingMs(state, now + PARENT_GATE_LOCK_MS + 1)).toBe(0);
    // After the lock the student gets all attempts back.
    expect(attemptsLeft(state)).toBe(PARENT_GATE_ATTEMPTS);
  });
});

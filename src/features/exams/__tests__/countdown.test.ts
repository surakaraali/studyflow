import type { TFunction } from 'i18next';

import { countdown, countdownText, EXAM_SOON_DAYS } from '../countdown';

// Echoes the key (and count) so the test checks which string is chosen.
const t = ((key: string, options?: { count?: number }) =>
  options?.count != null ? `${key}:${options.count}` : key) as unknown as TFunction;

describe('US-28 countdown', () => {
  const today = '2026-11-04';

  it('says today, tomorrow or days left', () => {
    expect(countdownText(countdown('2026-11-04', today), t)).toBe('common.today');
    expect(countdownText(countdown('2026-11-05', today), t)).toBe('common.tomorrow');
    expect(countdownText(countdown('2026-11-07', today), t)).toBe('common.daysLeft:3');
    expect(countdownText(countdown('2026-11-03', today), t)).toBe('exams.past');
  });

  it('counts across months and the DST change', () => {
    expect(countdown('2026-12-01', today).days).toBe(27);
    expect(countdown('2027-03-30', '2027-03-26').days).toBe(4);
  });

  it(`marks exams within ${EXAM_SOON_DAYS} days as soon`, () => {
    expect(countdown('2026-11-04', today).soon).toBe(true);
    expect(countdown('2026-11-11', today).soon).toBe(true);
    expect(countdown('2026-11-12', today).soon).toBe(false);
    expect(countdown('2026-11-03', today).soon).toBe(false);
  });

  it('reads well in Turkish', () => {
    // Uses the real strings to catch a missing key.
    const tr = jest.requireActual('@/i18n').default.t as TFunction;
    expect(countdownText(countdown('2026-11-07', today), tr)).toBe('3 gün kaldı');
    expect(countdownText(countdown('2026-11-05', today), tr)).toBe('Yarın');
    expect(countdownText(countdown('2026-11-04', today), tr)).toBe('Bugün');
    expect(countdownText(countdown('2026-11-01', today), tr)).toBe('Geçti');
  });
});

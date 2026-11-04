import { addDays, isoWeek } from '../../lib/dates';
import { computeStreak, dayCounts, type DayActivity } from '../streak';

// 2026-11-12 is a Thursday (ISO week 46).
const TODAY = '2026-11-12';
const day = (offset: number) => addDays(TODAY, offset);
const block: DayActivity = { blocksDone: 1, minutes: 0 };

function activity(days: Record<number, DayActivity>): Record<string, DayActivity> {
  return Object.fromEntries(Object.entries(days).map(([offset, a]) => [day(Number(offset)), a]));
}

describe('BR-17 streak', () => {
  it('a day counts with one finished block or 10+ minutes', () => {
    expect(dayCounts({ blocksDone: 1, minutes: 0 })).toBe(true);
    expect(dayCounts({ blocksDone: 0, minutes: 10 })).toBe(true);
    expect(dayCounts({ blocksDone: 0, minutes: 9 })).toBe(false);
    expect(dayCounts(undefined)).toBe(false);
  });

  it('counts consecutive days ending today', () => {
    const result = computeStreak({
      today: TODAY,
      activity: activity({ 0: block, [-1]: block, [-2]: { blocksDone: 0, minutes: 25 } }),
      freezes: [],
    });
    expect(result).toMatchObject({ current: 3, todayCounts: true, newFreezes: [] });
  });

  it('a streak ending yesterday is still alive today', () => {
    const result = computeStreak({
      today: TODAY,
      activity: activity({ [-1]: block, [-2]: block }),
      freezes: [],
    });
    expect(result).toMatchObject({ current: 2, todayCounts: false });
  });

  it('nine minutes do not count', () => {
    const result = computeStreak({
      today: TODAY,
      activity: activity({ 0: { blocksDone: 0, minutes: 9 } }),
      freezes: [],
    });
    expect(result.current).toBe(0);
  });

  it('one freeze per week covers a single missed day', () => {
    // Wednesday (−1) missed, Tuesday and Monday counted.
    const result = computeStreak({
      today: TODAY,
      activity: activity({ 0: block, [-2]: block, [-3]: block }),
      freezes: [],
    });
    expect(result.current).toBe(3);
    expect(result.newFreezes).toEqual([{ date: day(-1), week: isoWeek(day(-1)) }]);
    expect(result.freezeUsedThisWeek).toBe(true);
  });

  it('a missed yesterday is frozen so the streak survives until today ends', () => {
    const result = computeStreak({
      today: TODAY,
      activity: activity({ [-2]: block, [-3]: block }),
      freezes: [],
    });
    expect(result.current).toBe(2);
    expect(result.newFreezes).toHaveLength(1);
  });

  it('two missed days in a row end the streak', () => {
    const result = computeStreak({
      today: TODAY,
      activity: activity({ 0: block, [-3]: block }),
      freezes: [],
    });
    expect(result.current).toBe(1);
    expect(result.newFreezes).toEqual([]);
  });

  it('a second missed day in the same week ends the streak', () => {
    // Week 46: Mon (−3) and Wed (−1) missed.
    const result = computeStreak({
      today: TODAY,
      activity: activity({ 0: block, [-2]: block, [-4]: block, [-5]: block }),
      freezes: [],
    });
    expect(result.current).toBe(2);
    expect(result.newFreezes).toHaveLength(1);
  });

  it('each week has its own freeze', () => {
    // Wed of this week (−1) and Wed of last week (−8) missed.
    const counted: Record<number, DayActivity> = {};
    for (let i = 0; i >= -10; i--) if (i !== -1 && i !== -8) counted[i] = block;
    const result = computeStreak({ today: TODAY, activity: activity(counted), freezes: [] });
    expect(result.current).toBe(9);
    expect(result.newFreezes.map((f) => f.week)).toEqual([isoWeek(day(-1)), isoWeek(day(-8))]);
  });

  it('uses the stored freezes and does not freeze twice in a week', () => {
    const stored = [{ date: day(-3), week: isoWeek(day(-3)) }];
    const kept = computeStreak({
      today: TODAY,
      activity: activity({ 0: block, [-1]: block, [-2]: block, [-4]: block }),
      freezes: stored,
    });
    expect(kept).toMatchObject({ current: 4, newFreezes: [], freezeUsedThisWeek: true });

    const broken = computeStreak({
      today: TODAY,
      activity: activity({ 0: block, [-2]: block }),
      freezes: stored,
    });
    expect(broken.current).toBe(1);
  });

  it('nothing to count, nothing to freeze', () => {
    const result = computeStreak({ today: TODAY, activity: {}, freezes: [] });
    expect(result).toEqual({ current: 0, todayCounts: false, newFreezes: [], freezeUsedThisWeek: false });
  });
});

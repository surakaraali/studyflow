import { describe, expect, it } from '@jest/globals';

import { intervalParts } from '../interval';

const from = new Date(2026, 10, 4, 9, 0);
const later = (ms: number) => new Date(from.getTime() + ms);
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

describe('rating button intervals', () => {
  it.each([
    [0, 'minutes', 1],
    [MIN, 'minutes', 1],
    [10 * MIN, 'minutes', 10],
    [5 * 60 * MIN, 'hours', 5],
    [DAY, 'days', 1],
    [8 * DAY, 'days', 8],
    [62 * DAY, 'months', 2],
    [400 * DAY, 'years', 1.1],
  ])('%d ms → %s %d', (ms, unit, count) => {
    expect(intervalParts(from, later(ms))).toEqual({ unit, count });
  });
});

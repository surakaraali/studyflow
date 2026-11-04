import { clampPageRange, initialPageRange, quotaStatus, rangeLength } from '../quota';

describe('quotaStatus (BR-14, US-38)', () => {
  it('free plan: 3 documents a month, 20 pages each', () => {
    expect(quotaStatus('free', 2)).toMatchObject({ used: 2, limit: 3, remaining: 1, full: false, pages: 20 });
    expect(quotaStatus('free', 3)).toMatchObject({ remaining: 0, full: true, ratio: 1 });
  });

  it('pro plan: 40 documents a month, 100 pages each', () => {
    expect(quotaStatus('pro', 3)).toMatchObject({ limit: 40, full: false, pages: 100 });
  });

  it('never goes below zero or above a full bar', () => {
    expect(quotaStatus('free', 7)).toMatchObject({ remaining: 0, ratio: 1, full: true });
    expect(quotaStatus('free', -1)).toMatchObject({ used: 0, ratio: 0 });
  });
});

describe('page ranges (US-31)', () => {
  it('starts with the first pages that fit the plan', () => {
    // Gherkin: a 48-page PDF on the free plan → at most 20 pages.
    expect(initialPageRange(48, 20)).toEqual({ from: 1, to: 20 });
    expect(initialPageRange(12, 20)).toEqual({ from: 1, to: 12 });
  });

  it('moves the end along when the start moves past the limit', () => {
    expect(clampPageRange({ from: 30, to: 20 }, 48, 20, 'from')).toEqual({ from: 30, to: 30 });
    expect(clampPageRange({ from: 5, to: 40 }, 48, 20, 'from')).toEqual({ from: 5, to: 24 });
  });

  it('moves the start along when the end moves past the limit', () => {
    expect(clampPageRange({ from: 1, to: 30 }, 48, 20, 'to')).toEqual({ from: 11, to: 30 });
    expect(clampPageRange({ from: 10, to: 4 }, 48, 20, 'to')).toEqual({ from: 4, to: 4 });
  });

  it('stays inside the document', () => {
    expect(clampPageRange({ from: 0, to: 99 }, 48, 100, 'to')).toEqual({ from: 1, to: 48 });
  });

  it('counts pages inclusively', () => {
    expect(rangeLength({ from: 3, to: 12 })).toBe(10);
  });
});

import { describe, expect, it } from '@jest/globals';

import { decisionEffect, groupOpenReports, shouldReviewDocument } from '../logic';

describe('BR-23 report threshold', () => {
  it('puts a document under review only after more than three reports', () => {
    expect(shouldReviewDocument(0)).toBe(false);
    expect(shouldReviewDocument(3)).toBe(false);
    expect(shouldReviewDocument(4)).toBe(true);
  });
});

describe('US-37 team decisions', () => {
  it('removes, or shows the item again after a fix or a rejected report', () => {
    expect(decisionEffect('removed')).toEqual({ deleteItem: true, hidden: 1 });
    expect(decisionEffect('fixed')).toEqual({ deleteItem: false, hidden: 0 });
    expect(decisionEffect('valid')).toEqual({ deleteItem: false, hidden: 0 });
  });

  it('groups open reports by item, oldest first', () => {
    const groups = groupOpenReports([
      { item_id: 'q2', status: 'open', created_at: '2026-11-03T10:00:00Z' },
      { item_id: 'q1', status: 'open', created_at: '2026-11-02T10:00:00Z' },
      { item_id: 'q2', status: 'open', created_at: '2026-11-01T10:00:00Z' },
      { item_id: 'q3', status: 'valid', created_at: '2026-10-01T10:00:00Z' },
    ]);
    expect(groups.map((g) => [g.itemId, g.reports.length])).toEqual([
      ['q2', 2],
      ['q1', 1],
    ]);
  });
});

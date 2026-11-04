import {
  budgetStatus,
  costUsd,
  monthlyUsage,
  priceFor,
  type UsageRow,
} from '../../supabase/functions/_shared/ai/pricing.ts';

describe('costUsd', () => {
  it('prices Opus 5.5 at $4 / $20 per million tokens', () => {
    expect(costUsd('claude-opus-5-5', { input_tokens: 1_000_000, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0 })).toBe(4);
    expect(costUsd('claude-opus-5-5', { input_tokens: 0, output_tokens: 1_000_000, cache_read_tokens: 0, cache_write_tokens: 0 })).toBe(20);
  });

  it('charges cache reads and writes at their own rates', () => {
    const usage = { input_tokens: 0, output_tokens: 0, cache_read_tokens: 1_000_000, cache_write_tokens: 1_000_000 };
    expect(costUsd('claude-opus-5-5', usage)).toBeCloseTo(0.2 + 5, 6);
    expect(costUsd('claude-sonnet-5-5', usage)).toBeCloseTo(0.2 + 2.5, 6);
  });

  it('prices a typical 20-page job on Haiku 5.5 around a cent', () => {
    const cost = costUsd('claude-haiku-5-5', { input_tokens: 30_000, output_tokens: 5_000, cache_read_tokens: 60_000, cache_write_tokens: 30_000 });
    expect(cost).toBeGreaterThan(0.005);
    expect(cost).toBeLessThan(0.02);
  });

  it('uses the default model price for unknown models', () => {
    expect(priceFor('claude-something-new')).toEqual(priceFor('claude-opus-5-5'));
  });
});

const row = (over: Partial<UsageRow>): UsageRow => ({
  document_id: 'd1',
  input_tokens: 100,
  output_tokens: 50,
  cache_read_tokens: 0,
  cache_write_tokens: 0,
  cost_usd: 0.01,
  duration_ms: 1000,
  created_at: '2026-11-04T10:00:00.000Z',
  ...over,
});

describe('monthlyUsage', () => {
  it('sums one month and ignores other months', () => {
    const usage = monthlyUsage(
      [
        row({ document_id: 'd1', cost_usd: 0.02 }),
        row({ document_id: 'd1', cost_usd: 0.01, cache_read_tokens: 300 }),
        row({ document_id: 'd2', cost_usd: 0.03 }),
        row({ document_id: 'd3', created_at: '2026-10-31T23:00:00.000Z', cost_usd: 5 }),
      ],
      '2026-11',
    );
    expect(usage.requests).toBe(3);
    expect(usage.documents).toBe(2);
    expect(usage.costUsd).toBeCloseTo(0.06, 6);
    expect(usage.costPerDocument).toBeCloseTo(0.03, 6);
    expect(usage.inputTokens).toBe(300);
    expect(usage.cacheHitRatio).toBeCloseTo(300 / 600, 6);
  });

  it('is all zeros for an empty month', () => {
    const usage = monthlyUsage([], '2026-12');
    expect(usage).toMatchObject({ requests: 0, documents: 0, costUsd: 0, costPerDocument: 0, cacheHitRatio: 0 });
  });
});

describe('budgetStatus (AIQ-07)', () => {
  it('warns at 80% and flags overspend at 100%', () => {
    expect(budgetStatus(79, 100)).toMatchObject({ warn: false, over: false });
    expect(budgetStatus(80, 100)).toMatchObject({ warn: true, over: false });
    expect(budgetStatus(100, 100)).toMatchObject({ warn: true, over: true });
  });
});

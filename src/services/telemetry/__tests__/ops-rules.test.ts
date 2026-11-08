/// <reference types="jest" />
/**
 * Alert rules of the ops-alerts Edge Function (OBS-03). The code lives in supabase/functions
 * (Deno), which Jest skips, so it is tested from here.
 */
import {
  decide,
  evaluate,
  nextState,
  REMIND_AFTER_MS,
  type AlertState,
  type OpsMetrics,
} from '../../../../supabase/functions/_shared/ops-rules';

const quiet: OpsMetrics = {
  backend: { total: 0, errors: 0, functions: [] },
  ai: { ready: 0, failed: 0, codes: [] },
  crashes: { recent: 0, recent_fatal: 0, baseline_24h: 0, top: [] },
  ai_cost: { month: '2026-11', spent: 0 },
};
const budget = { monthlyUsd: 250, warnRatio: 0.8 };

function firing(metrics: Partial<OpsMetrics>): string[] {
  return evaluate({ ...quiet, ...metrics }, budget)
    .filter((c) => c.firing)
    .map((c) => c.key);
}

describe('ops alert thresholds (OBS-03)', () => {
  it('is quiet when nothing happens', () => {
    expect(firing({})).toEqual([]);
  });

  it('backend: more than 2% 5xx over 5 minutes, with enough requests', () => {
    expect(firing({ backend: { total: 100, errors: 3, functions: [] } })).toEqual(['backend_errors']);
    expect(firing({ backend: { total: 100, errors: 2, functions: [] } })).toEqual([]);
    expect(firing({ backend: { total: 10, errors: 5, functions: [] } })).toEqual([]);
  });

  it('AI: more than 5% failed jobs over 15 minutes, with enough jobs', () => {
    expect(firing({ ai: { ready: 18, failed: 2, codes: [] } })).toEqual(['ai_failures']);
    expect(firing({ ai: { ready: 19, failed: 1, codes: [] } })).toEqual([]);
    expect(firing({ ai: { ready: 1, failed: 3, codes: [] } })).toEqual([]);
  });

  it('crashes: a spike is at least 10 reports and 3× the usual 15 minutes', () => {
    const crashes = (recent: number, baseline: number) => ({ recent, recent_fatal: 0, baseline_24h: baseline, top: [] });
    expect(firing({ crashes: crashes(10, 0) })).toEqual(['crash_spike']);
    expect(firing({ crashes: crashes(9, 0) })).toEqual([]);
    // 960 reports in 24 h = 10 per 15 minutes; 25 is not 3× that.
    expect(firing({ crashes: crashes(25, 960) })).toEqual([]);
    expect(firing({ crashes: crashes(30, 960) })).toEqual(['crash_spike']);
  });

  it('AI budget: 80% and 100% of the monthly budget, keyed by month', () => {
    expect(firing({ ai_cost: { month: '2026-11', spent: 199 } })).toEqual([]);
    expect(firing({ ai_cost: { month: '2026-11', spent: 200 } })).toEqual(['ai_budget_80:2026-11']);
    expect(firing({ ai_cost: { month: '2026-11', spent: 260 } })).toEqual(['ai_budget_80:2026-11', 'ai_budget_100:2026-11']);
  });

  it('skips the budget check when no budget is set', () => {
    const keys = evaluate({ ...quiet, ai_cost: { month: '2026-11', spent: 999 } }, { monthlyUsd: 0, warnRatio: 0.8 }).map(
      (c) => c.key,
    );
    expect(keys).toEqual(['backend_errors', 'ai_failures', 'crash_spike']);
  });

  it('writes numbers only in the e-mail lines', () => {
    const [backend] = evaluate(
      { ...quiet, backend: { total: 40, errors: 4, functions: [{ function: 'support', errors: 4, total: 10 }] } },
      budget,
    );
    expect(backend.lines).toEqual(['Son 5 dakikada 40 istekten 4 tanesi 5xx ile bitti (%10). Eşik %2.', 'support: 4 / 10']);
  });
});

describe('ops alert de-duplication', () => {
  const now = new Date('2026-11-07T12:00:00Z');
  const condition = (isFiring: boolean, remindAfterMs: number | null = REMIND_AFTER_MS) => ({
    key: 'backend_errors',
    firing: isFiring,
    title: 't',
    lines: [],
    remindAfterMs,
  });
  const state = (isFiring: boolean, notifiedMinutesAgo: number): AlertState => ({
    key: 'backend_errors',
    firing: isFiring,
    first_fired_at: '2026-11-07T08:00:00Z',
    last_notified_at: new Date(now.getTime() - notifiedMinutesAgo * 60_000).toISOString(),
  });

  it('e-mails when a condition starts', () => {
    expect(decide(undefined, condition(true), now)).toBe('fire');
    expect(decide(state(false, 600), condition(true), now)).toBe('fire');
  });

  it('stays quiet while it keeps firing, then reminds every 6 hours', () => {
    expect(decide(state(true, 5), condition(true), now)).toBe('none');
    expect(decide(state(true, 359), condition(true), now)).toBe('none');
    expect(decide(state(true, 360), condition(true), now)).toBe('remind');
  });

  it('never reminds for once-a-month conditions', () => {
    expect(decide(state(true, 60 * 24 * 10), condition(true, null), now)).toBe('none');
  });

  it('e-mails once when it is resolved, then stays quiet', () => {
    expect(decide(state(true, 30), condition(false), now)).toBe('resolve');
    expect(decide(state(false, 30), condition(false), now)).toBe('none');
    expect(decide(undefined, condition(false), now)).toBe('none');
  });

  it('stores the new state after an e-mail', () => {
    expect(nextState(undefined, condition(true), 'fire', now)).toMatchObject({
      firing: true,
      first_fired_at: now.toISOString(),
      last_notified_at: now.toISOString(),
      resolved_at: null,
    });
    expect(nextState(state(true, 400), condition(true), 'remind', now)).toMatchObject({
      firing: true,
      first_fired_at: '2026-11-07T08:00:00Z',
      last_notified_at: now.toISOString(),
    });
    expect(nextState(state(true, 30), condition(false), 'resolve', now)).toMatchObject({
      firing: false,
      resolved_at: now.toISOString(),
    });
    expect(nextState(state(true, 30), condition(true), 'none', now)).toBeNull();
  });
});

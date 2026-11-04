/**
 * AI cost per request and monthly totals for the team (US-38, AIQ-07, OBS-02).
 * Prices are USD per million tokens. Check them against the provider's price list when a
 * model is added or changed.
 */

export type ModelPrice = {
  input: number;
  output: number;
  /** Reading a cached prefix. */
  cacheRead: number;
  /** Writing a 5-minute cache entry (1.25 × input). */
  cacheWrite: number;
};

export const MODEL_PRICES: Record<string, ModelPrice> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  // Possible server-side fallback targets when the main model declines a request.
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-opus-4-8': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
};

export const DEFAULT_MODEL = 'claude-opus-5-5';

/** Unknown models are priced like the default model, so costs are never under-reported. */
export function priceFor(model: string): ModelPrice {
  return MODEL_PRICES[model] ?? MODEL_PRICES[DEFAULT_MODEL];
}

export type TokenUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
};

/** Cost in USD, rounded to 6 decimals. `input_tokens` is the uncached part of the prompt. */
export function costUsd(model: string, usage: TokenUsage): number {
  const p = priceFor(model);
  const total =
    usage.input_tokens * p.input +
    usage.output_tokens * p.output +
    usage.cache_read_tokens * p.cacheRead +
    usage.cache_write_tokens * p.cacheWrite;
  return Math.round((total / 1_000_000) * 1e6) / 1e6;
}

/**
 * Monthly AI budget for the whole product (project plan §14.2: ≈ $150–250 at 1,000 MAU).
 * The Edge Function reads AI_MONTHLY_BUDGET_USD to override it.
 */
export const MONTHLY_AI_BUDGET_USD = 250;

/** AIQ-07: warn the team at 80% of the monthly budget. */
export const BUDGET_WARNING_RATIO = 0.8;

export type UsageRow = TokenUsage & {
  document_id: string | null;
  cost_usd: number;
  duration_ms: number;
  created_at: string;
};

export type MonthlyUsage = {
  /** "2026-11" */
  month: string;
  requests: number;
  documents: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  /** Average cost of one processed document (AIQ-07 target ≤ $0.05 for 20 pages). */
  costPerDocument: number;
  /** Share of prompt tokens served from cache; shows whether caching works. */
  cacheHitRatio: number;
};

/** Totals for one calendar month ("YYYY-MM", by the row's ISO created_at). Pure. */
export function monthlyUsage(rows: readonly UsageRow[], month: string): MonthlyUsage {
  const inMonth = rows.filter((r) => r.created_at.slice(0, 7) === month);
  const documents = new Set(inMonth.map((r) => r.document_id).filter(Boolean)).size;
  const sum = (pick: (r: UsageRow) => number) => inMonth.reduce((acc, r) => acc + pick(r), 0);

  const inputTokens = sum((r) => r.input_tokens);
  const cacheReadTokens = sum((r) => r.cache_read_tokens);
  const cacheWriteTokens = sum((r) => r.cache_write_tokens);
  const cost = Math.round(sum((r) => r.cost_usd) * 1e6) / 1e6;
  const promptTokens = inputTokens + cacheReadTokens + cacheWriteTokens;

  return {
    month,
    requests: inMonth.length,
    documents,
    inputTokens,
    outputTokens: sum((r) => r.output_tokens),
    cacheReadTokens,
    cacheWriteTokens,
    costUsd: cost,
    costPerDocument: documents > 0 ? Math.round((cost / documents) * 1e6) / 1e6 : 0,
    cacheHitRatio: promptTokens > 0 ? cacheReadTokens / promptTokens : 0,
  };
}

export type BudgetStatus = {
  spentUsd: number;
  budgetUsd: number;
  ratio: number;
  /** At or above 80%: alert the team. */
  warn: boolean;
  /** At or above 100%. */
  over: boolean;
};

export function budgetStatus(spentUsd: number, budgetUsd: number = MONTHLY_AI_BUDGET_USD): BudgetStatus {
  const ratio = budgetUsd > 0 ? spentUsd / budgetUsd : 1;
  return {
    spentUsd,
    budgetUsd,
    ratio,
    warn: ratio >= BUDGET_WARNING_RATIO,
    over: ratio >= 1,
  };
}

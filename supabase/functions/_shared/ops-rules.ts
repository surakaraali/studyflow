/**
 * Alert rules for ops-alerts (OBS-03, ADR-006). Pure: turns the numbers from public.ops_metrics()
 * into conditions, and decides per condition whether to e-mail (new, reminder, resolved) or stay
 * quiet, so one problem does not send an e-mail every 5 minutes.
 *
 * Kept free of imports and Deno APIs so Jest can test it too.
 */

export type OpsMetrics = {
  backend: { total: number; errors: number; functions: { function: string; errors: number; total: number }[] };
  ai: { ready: number; failed: number; codes: { code: string; jobs: number }[] };
  crashes: {
    recent: number;
    recent_fatal: number;
    baseline_24h: number;
    top: { name: string; app_version: string; reports: number }[];
  };
  ai_cost: { month: string; spent: number };
};

export const THRESHOLDS = {
  /** OBS-03: Edge Function 5xx rate over 5 minutes. */
  backendErrorRate: 0.02,
  /** Fewer requests than this in 5 minutes are too few to judge. */
  backendMinRequests: 20,
  /** OBS-03: failed AI jobs over 15 minutes. */
  aiFailureRate: 0.05,
  aiMinJobs: 5,
  /** Crash reports in 15 minutes: at least this many and this many times the usual 15 minutes. */
  crashSpikeMin: 10,
  crashSpikeFactor: 3,
} as const;

/** A condition that keeps firing is repeated this often. */
export const REMIND_AFTER_MS = 6 * 60 * 60 * 1000;

export type Condition = {
  key: string;
  firing: boolean;
  title: string;
  lines: string[];
  /** null: e-mail once, no reminders (budget, per month). */
  remindAfterMs: number | null;
};

export type AlertState = {
  key: string;
  firing: boolean;
  first_fired_at: string | null;
  last_notified_at: string | null;
};

export type Action = 'fire' | 'remind' | 'resolve' | 'none';

const percent = (ratio: number) => `%${(Math.round(ratio * 1000) / 10).toLocaleString('tr-TR')}`;
const usd = (value: number) => `$${value.toFixed(2)}`;
const decimal = (value: number) => value.toLocaleString('tr-TR', { maximumFractionDigits: 1 });

export function evaluate(
  m: OpsMetrics,
  budget: { monthlyUsd: number; warnRatio: number },
  t: typeof THRESHOLDS = THRESHOLDS,
): Condition[] {
  const conditions: Condition[] = [];

  const backendRate = m.backend.total > 0 ? m.backend.errors / m.backend.total : 0;
  conditions.push({
    key: 'backend_errors',
    firing: m.backend.total >= t.backendMinRequests && backendRate > t.backendErrorRate,
    title: 'Sunucu fonksiyonlarında hata oranı yüksek',
    lines: [
      `Son 5 dakikada ${m.backend.total} istekten ${m.backend.errors} tanesi 5xx ile bitti (${percent(backendRate)}). Eşik ${percent(t.backendErrorRate)}.`,
      ...m.backend.functions.slice(0, 5).map((f) => `${f.function}: ${f.errors} / ${f.total}`),
    ],
    remindAfterMs: REMIND_AFTER_MS,
  });

  const jobs = m.ai.ready + m.ai.failed;
  const aiRate = jobs > 0 ? m.ai.failed / jobs : 0;
  conditions.push({
    key: 'ai_failures',
    firing: jobs >= t.aiMinJobs && aiRate > t.aiFailureRate,
    title: 'Yapay zekâ işlerinde başarısızlık yüksek',
    lines: [
      `Son 15 dakikada biten ${jobs} işten ${m.ai.failed} tanesi başarısız (${percent(aiRate)}). Eşik ${percent(t.aiFailureRate)}.`,
      ...m.ai.codes.slice(0, 5).map((c) => `${c.code}: ${c.jobs}`),
    ],
    remindAfterMs: REMIND_AFTER_MS,
  });

  const usual = m.crashes.baseline_24h / 96;
  conditions.push({
    key: 'crash_spike',
    firing: m.crashes.recent >= t.crashSpikeMin && m.crashes.recent >= t.crashSpikeFactor * usual,
    title: 'Çökme raporlarında ani artış',
    lines: [
      `Son 15 dakikada ${m.crashes.recent} rapor (${m.crashes.recent_fatal} tanesi uygulamayı kapattı). Önceki 24 saatte 15 dakikada ortalama ${decimal(usual)}.`,
      ...m.crashes.top.map((c) => `${c.name} · ${c.app_version}: ${c.reports}`),
      'Ayrıntı: SQL editöründe select * from ops.recent_crashes;',
    ],
    remindAfterMs: REMIND_AFTER_MS,
  });

  if (budget.monthlyUsd > 0) {
    const ratio = m.ai_cost.spent / budget.monthlyUsd;
    const line = `${m.ai_cost.month}: ${usd(m.ai_cost.spent)} / ${usd(budget.monthlyUsd)} (${percent(ratio)}).`;
    conditions.push({
      key: `ai_budget_${Math.round(budget.warnRatio * 100)}:${m.ai_cost.month}`,
      firing: ratio >= budget.warnRatio,
      title: `Yapay zekâ bütçesinin ${percent(budget.warnRatio)}'i kullanıldı`,
      lines: [line],
      remindAfterMs: null,
    });
    conditions.push({
      key: `ai_budget_100:${m.ai_cost.month}`,
      firing: ratio >= 1,
      title: 'Yapay zekâ bütçesi aşıldı',
      lines: [line],
      remindAfterMs: null,
    });
  }

  return conditions;
}

export function decide(previous: AlertState | undefined, condition: Condition, now: Date): Action {
  if (condition.firing) {
    if (!previous?.firing) return 'fire';
    if (condition.remindAfterMs == null || !previous.last_notified_at) return 'none';
    const since = now.getTime() - Date.parse(previous.last_notified_at);
    return since >= condition.remindAfterMs ? 'remind' : 'none';
  }
  return previous?.firing ? 'resolve' : 'none';
}

export type SavedState = {
  key: string;
  firing: boolean;
  first_fired_at: string | null;
  last_notified_at: string | null;
  resolved_at: string | null;
  details: { title: string; lines: string[] };
};

/** The row to store after the e-mail went out; null when nothing changes. */
export function nextState(
  previous: AlertState | undefined,
  condition: Condition,
  action: Action,
  now: Date,
): SavedState | null {
  const at = now.toISOString();
  const details = { title: condition.title, lines: condition.lines };
  switch (action) {
    case 'fire':
      return { key: condition.key, firing: true, first_fired_at: at, last_notified_at: at, resolved_at: null, details };
    case 'remind':
      return {
        key: condition.key,
        firing: true,
        first_fired_at: previous?.first_fired_at ?? at,
        last_notified_at: at,
        resolved_at: null,
        details,
      };
    case 'resolve':
      return {
        key: condition.key,
        firing: false,
        first_fired_at: previous?.first_fired_at ?? null,
        last_notified_at: previous?.last_notified_at ?? null,
        resolved_at: at,
        details,
      };
    case 'none':
      return null;
  }
}

/**
 * POST /functions/v1/ops-alerts   (pg_cron every 5 minutes; OBS-03, ADR-006)
 * Authorization: Bearer <CRON_SECRET>   (the same value is in Vault as 'cron_secret')
 *
 * Reads public.ops_metrics() and e-mails OPS_ALERT_EMAIL when:
 *   backend_errors         Edge Function 5xx rate > 2% over 5 minutes (at least 20 requests)
 *   ai_failures            failed AI jobs > 5% over 15 minutes (at least 5 finished jobs)
 *   crash_spike            ≥ 10 crash reports in 15 minutes and ≥ 3× the usual 15 minutes
 *   ai_budget_80:<month>   AI spend ≥ 80% of AI_MONTHLY_BUDGET_USD (and ai_budget_100 at 100%)
 * One e-mail per run lists what is new, still going (every 6 hours) or resolved; a condition
 * that stays the same sends nothing (state in private.ops_alerts). Without OPS_ALERT_EMAIL the
 * alerts only go to the function log.
 *
 * Body (optional): { dryRun: true } evaluates and answers without e-mailing or saving.
 */

import 'jsr:@supabase/functions-js@2.118.0/edge-runtime.d.ts';

import { adminClient } from '../_shared/admin.ts';
import { BUDGET_WARNING_RATIO, MONTHLY_AI_BUDGET_USD } from '../_shared/ai/pricing.ts';
import { requireSecret } from '../_shared/auth.ts';
import { sendEmail } from '../_shared/email.ts';
import { opsAlertEmail, type OpsAlertItem } from '../_shared/email-templates.ts';
import { errorResponse, json, readJson, requireMethod } from '../_shared/http.ts';
import { withMetrics } from '../_shared/metrics.ts';
import { type AlertState, decide, evaluate, nextState, type OpsMetrics } from '../_shared/ops-rules.ts';

function projectLabel(): string {
  try {
    return new URL(Deno.env.get('SUPABASE_URL') ?? '').host || 'unknown';
  } catch {
    return 'unknown';
  }
}

Deno.serve(
  withMetrics('ops-alerts', async (req) => {
    try {
      requireMethod(req, 'POST');
      requireSecret(req, Deno.env.get('CRON_SECRET'));
      const body = await readJson<{ dryRun: unknown }>(req);
      const dryRun = body.dryRun === true;

      const admin = adminClient();
      const { data: metrics, error } = await admin.rpc('ops_metrics');
      if (error) throw error;
      const { data: states, error: statesError } = await admin.rpc('ops_alert_states');
      if (statesError) throw statesError;

      const budgetUsd = Number(Deno.env.get('AI_MONTHLY_BUDGET_USD')) || MONTHLY_AI_BUDGET_USD;
      const conditions = evaluate(metrics as OpsMetrics, { monthlyUsd: budgetUsd, warnRatio: BUDGET_WARNING_RATIO });
      const previous = new Map(((states ?? []) as AlertState[]).map((state) => [state.key, state]));
      const now = new Date();

      const steps = conditions
        .map((condition) => ({ condition, action: decide(previous.get(condition.key), condition, now) }))
        .filter((step) => step.action !== 'none');
      const items: OpsAlertItem[] = steps.map(({ condition, action }) => ({
        action: action as OpsAlertItem['action'],
        title: condition.title,
        lines: condition.lines,
      }));

      let emailed = false;
      if (!dryRun && steps.length > 0) {
        const to = Deno.env.get('OPS_ALERT_EMAIL');
        if (to) {
          // A failed send throws before the state is saved, so the next run tries again.
          await sendEmail(opsAlertEmail({ to, project: projectLabel(), items }));
          emailed = true;
        } else {
          console.warn('[ops-alerts] OPS_ALERT_EMAIL is not set', items.map((item) => `${item.action}: ${item.title}`));
        }
        const rows = steps.map(({ condition, action }) => nextState(previous.get(condition.key), condition, action, now));
        const { error: saveError } = await admin.rpc('ops_alert_save', { p_alerts: rows.filter(Boolean) });
        if (saveError) throw saveError;
      }

      return json({
        ok: true,
        dryRun,
        firing: conditions.filter((condition) => condition.firing).map((condition) => condition.key),
        actions: steps.map(({ condition, action }) => ({ key: condition.key, action })),
        emailed,
        metrics,
      });
    } catch (error) {
      return errorResponse(error);
    }
  }),
);

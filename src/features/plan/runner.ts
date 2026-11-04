/**
 * Rebuilds the plan: loads the inputs, runs the engine, writes the result and reschedules
 * reminders. Triggered through schedulePlanRegeneration (./regenerate.ts).
 */

import { generatePlan, PLAN_HORIZON_DAYS } from '@/domain/plan-engine';
import { setPlanRunner } from '@/features/plan/regenerate';
import { applyPlan, loadPlanInput, savePlanWarnings } from '@/features/plan/repo';
import { rescheduleReminders } from '@/features/reminders/schedule';
import { settleTimer } from '@/features/timer/timer-store';
import { track } from '@/services/analytics';

async function rebuildPlan(): Promise<void> {
  const now = new Date();
  // A timer that ended while the app was closed finishes its block before carry-over runs.
  await settleTimer(now.getTime()).catch(() => null);

  const input = await loadPlanInput(now);
  if (!input) return;
  const result = generatePlan(input);
  const changed = await applyPlan(input, result);
  if (changed) {
    track('plan_generated', {
      blocks: result.blocks.length + result.moves.length,
      days: PLAN_HORIZON_DAYS,
    });
  }
  await savePlanWarnings(result.warnings);
  await rescheduleReminders().catch((error) => console.warn('Reminders failed', error));
}

setPlanRunner(rebuildPlan);

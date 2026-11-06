/**
 * US-79: notice when Pro ends. The device remembers the last plan it saw; a step from 'pro'
 * to 'free' raises a one-time notice that stays until the student closes it.
 */

import type { Plan } from '@/domain/rules';

export type PlanMemory = {
  lastPlan: Plan;
  /** True from the moment Pro ended until the student closes the notice. */
  expiredNotice: boolean;
};

/** The memory after seeing `current`. A first look only records the plan. */
export function rememberPlan(memory: PlanMemory | null, current: Plan): PlanMemory {
  if (!memory) return { lastPlan: current, expiredNotice: false };
  if (memory.lastPlan === 'pro' && current === 'free') return { lastPlan: 'free', expiredNotice: true };
  // Pro again (renewed or restored): the old notice no longer applies.
  if (current === 'pro') return { lastPlan: 'pro', expiredNotice: false };
  return { lastPlan: current, expiredNotice: memory.expiredNotice };
}

export function samePlanMemory(a: PlanMemory | null, b: PlanMemory): boolean {
  return a != null && a.lastPlan === b.lastPlan && a.expiredNotice === b.expiredNotice;
}

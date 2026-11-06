import { rememberPlan, samePlanMemory } from '../plan-change';

describe('US-79 Pro ended notice', () => {
  it('only records the plan the first time', () => {
    expect(rememberPlan(null, 'free')).toEqual({ lastPlan: 'free', expiredNotice: false });
    expect(rememberPlan(null, 'pro')).toEqual({ lastPlan: 'pro', expiredNotice: false });
  });

  it('raises the notice when Pro turns into free', () => {
    expect(rememberPlan({ lastPlan: 'pro', expiredNotice: false }, 'free')).toEqual({
      lastPlan: 'free',
      expiredNotice: true,
    });
  });

  it('keeps the notice until it is closed, without raising it again', () => {
    const raised = rememberPlan({ lastPlan: 'pro', expiredNotice: false }, 'free');
    expect(rememberPlan(raised, 'free')).toEqual(raised);
    const closed = { ...raised, expiredNotice: false };
    expect(rememberPlan(closed, 'free')).toEqual(closed);
  });

  it('does not raise it for a free student', () => {
    expect(rememberPlan({ lastPlan: 'free', expiredNotice: false }, 'free').expiredNotice).toBe(false);
  });

  it('clears it when Pro comes back', () => {
    expect(rememberPlan({ lastPlan: 'free', expiredNotice: true }, 'pro')).toEqual({
      lastPlan: 'pro',
      expiredNotice: false,
    });
  });

  it('tells when nothing needs writing', () => {
    expect(samePlanMemory(null, { lastPlan: 'free', expiredNotice: false })).toBe(false);
    expect(samePlanMemory({ lastPlan: 'free', expiredNotice: false }, { lastPlan: 'free', expiredNotice: false })).toBe(true);
    expect(samePlanMemory({ lastPlan: 'pro', expiredNotice: false }, { lastPlan: 'free', expiredNotice: true })).toBe(false);
  });
});

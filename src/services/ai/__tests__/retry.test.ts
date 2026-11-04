import { decideRetry, isExpired, MAX_AUTO_RETRIES, QUEUE_LIMIT_MS, RETRY_DELAYS_MS } from '../retry';

const created = '2026-11-04T10:00:00.000Z';
const now = new Date('2026-11-04T10:05:00.000Z');

describe('decideRetry (REL-03)', () => {
  it('retries three times with growing delays, then fails', () => {
    const delays = [1, 2, 3].map((attempts) => {
      const decision = decideRetry({ attempts, retryable: true, createdAt: created, now });
      expect(decision.action).toBe('retry');
      return decision.action === 'retry' ? decision.at.getTime() - now.getTime() : 0;
    });
    expect(delays).toEqual([...RETRY_DELAYS_MS]);
    expect(delays[0]).toBeLessThan(delays[1]);
    expect(delays[1]).toBeLessThan(delays[2]);

    expect(decideRetry({ attempts: MAX_AUTO_RETRIES + 1, retryable: true, createdAt: created, now })).toEqual({ action: 'fail' });
  });

  it('fails at once when the error cannot be fixed by retrying', () => {
    expect(decideRetry({ attempts: 1, retryable: false, createdAt: created, now })).toEqual({ action: 'fail' });
  });

  it('never schedules a retry past the 24-hour queue limit (REL-06)', () => {
    const late = new Date(Date.parse(created) + QUEUE_LIMIT_MS - 10_000);
    expect(decideRetry({ attempts: 1, retryable: true, createdAt: created, now: late })).toEqual({ action: 'fail' });
  });
});

describe('isExpired', () => {
  it('is true after 24 hours in the queue', () => {
    expect(isExpired(created, now)).toBe(false);
    expect(isExpired(created, new Date(Date.parse(created) + QUEUE_LIMIT_MS + 1))).toBe(true);
  });
});

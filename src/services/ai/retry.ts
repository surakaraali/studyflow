/**
 * Retry policy for AI jobs (US-32, REL-03, REL-06). Pure functions so the rules are testable.
 */

/** Three automatic retries after the first try. */
export const MAX_AUTO_RETRIES = 3;

/** Exponential backoff: 30 s, 2 min, 8 min. */
export const RETRY_DELAYS_MS = [30_000, 120_000, 480_000] as const;

/** REL-06: a job waits at most 24 hours in the queue. */
export const QUEUE_LIMIT_MS = 24 * 60 * 60 * 1000;

export type RetryDecision = { action: 'retry'; at: Date } | { action: 'fail' };

export function isExpired(createdAt: string, now: Date = new Date()): boolean {
  return now.getTime() - Date.parse(createdAt) > QUEUE_LIMIT_MS;
}

/**
 * What to do after a failed try.
 * @param attempts tries made so far, including the one that just failed
 */
export function decideRetry(input: {
  attempts: number;
  retryable: boolean;
  createdAt: string;
  now?: Date;
}): RetryDecision {
  const now = input.now ?? new Date();
  if (!input.retryable) return { action: 'fail' };
  if (input.attempts > MAX_AUTO_RETRIES) return { action: 'fail' };

  const delay = RETRY_DELAYS_MS[Math.max(0, input.attempts - 1)] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  const at = new Date(now.getTime() + delay);
  if (at.getTime() - Date.parse(input.createdAt) > QUEUE_LIMIT_MS) return { action: 'fail' };
  return { action: 'retry', at };
}

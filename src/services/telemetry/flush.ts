/**
 * Sends the queue in batches (ADR-006). One flush at a time; a failed batch waits with
 * exponential backoff (5 s doubling to 30 min, with jitter) before the next try.
 */

import type { TelemetryQueue } from './queue';
import type { SendResult, TelemetryItem } from './types';

/** Same limit as MAX_ITEMS in supabase/functions/_shared/telemetry.ts. */
export const BATCH_SIZE = 50;
/** Batches per flush; the rest goes on the next one. */
export const MAX_BATCHES = 5;

const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 30 * 60_000;

/**
 * 2xx: stored. 401 (session being refreshed), 408 and 429 (hourly limit): try again later.
 * Any other 4xx: the server will never take this batch, so it is dropped. 5xx and network
 * errors (status 0): try again later.
 */
export function classifyStatus(status: number): SendResult {
  if (status >= 200 && status < 300) return 'sent';
  if (status === 401 || status === 408 || status === 429) return 'retry';
  if (status >= 400 && status < 500) return 'drop';
  return 'retry';
}

/** Delay after the n-th failure in a row (n ≥ 1), ±20%. */
export function backoffMs(failures: number, random: () => number = Math.random): number {
  const base = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, failures - 1));
  return Math.round(base * (0.8 + 0.4 * random()));
}

export type FlushOutcome = 'empty' | 'waiting' | 'no_session' | 'done' | 'retry';

export type FlusherDeps = {
  queue: TelemetryQueue;
  send(items: TelemetryItem[], token: string): Promise<SendResult>;
  /** The signed-in user's access token, or null (then nothing is sent). */
  getToken(): Promise<string | null>;
  now?: () => number;
  random?: () => number;
  batchSize?: number;
  maxBatches?: number;
};

export type Flusher = {
  flush(): Promise<FlushOutcome>;
  /** Consecutive failures and when the next try is allowed (ms since epoch, 0 = now). */
  backoff(): { failures: number; nextAttemptAt: number };
};

export function createFlusher({
  queue,
  send,
  getToken,
  now = Date.now,
  random = Math.random,
  batchSize = BATCH_SIZE,
  maxBatches = MAX_BATCHES,
}: FlusherDeps): Flusher {
  let running: Promise<FlushOutcome> | null = null;
  let failures = 0;
  let nextAttemptAt = 0;

  async function run(): Promise<FlushOutcome> {
    if (queue.size() === 0) return 'empty';
    if (now() < nextAttemptAt) return 'waiting';
    const token = await getToken().catch(() => null);
    if (!token) return 'no_session';

    for (let i = 0; i < maxBatches; i++) {
      const batch = queue.peek(batchSize);
      if (batch.length === 0) return 'done';
      let result: SendResult;
      try {
        result = await send(
          batch.map((queued) => queued.item),
          token,
        );
      } catch {
        result = 'retry';
      }
      if (result === 'retry') {
        failures += 1;
        nextAttemptAt = now() + backoffMs(failures, random);
        return 'retry';
      }
      failures = 0;
      nextAttemptAt = 0;
      queue.removeThrough(batch[batch.length - 1].seq);
    }
    return 'done';
  }

  return {
    flush() {
      if (!running) {
        running = run().finally(() => {
          running = null;
        });
      }
      return running;
    },
    backoff: () => ({ failures, nextAttemptAt }),
  };
}

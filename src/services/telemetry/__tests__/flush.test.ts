/// <reference types="jest" />
import { backoffMs, classifyStatus, createFlusher } from '../flush';
import { createTelemetryQueue, type KeyValueStore } from '../queue';
import type { SendResult, TelemetryItem } from '../types';

const context = { app_version: '1.0.0 (1)', platform: 'ios', os_major: 18 } as const;
const event = (name: string): TelemetryItem => ({ type: 'event', name, props: {}, ...context });

function memoryStore(): KeyValueStore {
  const data: Record<string, string> = {};
  return { getItemSync: (key) => data[key] ?? null, setItemSync: (key, value) => void (data[key] = value) };
}

function setup({ items = 3, token = 'jwt' as string | null, results = [] as SendResult[] } = {}) {
  const queue = createTelemetryQueue(memoryStore());
  for (let i = 0; i < items; i++) queue.push(event(`e${i}`));
  let clock = 1_000_000;
  const sent: TelemetryItem[][] = [];
  const send = jest.fn(async (batch: TelemetryItem[]) => {
    sent.push(batch);
    return results.shift() ?? 'sent';
  });
  const flusher = createFlusher({
    queue,
    send,
    getToken: async () => token,
    now: () => clock,
    random: () => 0.5,
    batchSize: 2,
  });
  return { queue, flusher, send, sent, advance: (ms: number) => (clock += ms) };
}

describe('classifyStatus', () => {
  it.each([
    [200, 'sent'],
    [204, 'sent'],
    [400, 'drop'],
    [413, 'drop'],
    [422, 'drop'],
    [401, 'retry'],
    [408, 'retry'],
    [429, 'retry'],
    [500, 'retry'],
    [503, 'retry'],
    [0, 'retry'],
  ])('%i → %s', (status, expected) => {
    expect(classifyStatus(status)).toBe(expected);
  });
});

describe('backoffMs', () => {
  it('doubles from 5 s and stops at 30 minutes', () => {
    const mid = () => 0.5;
    expect(backoffMs(1, mid)).toBe(5_000);
    expect(backoffMs(2, mid)).toBe(10_000);
    expect(backoffMs(4, mid)).toBe(40_000);
    expect(backoffMs(20, mid)).toBe(30 * 60_000);
  });

  it('adds ±20% jitter', () => {
    expect(backoffMs(1, () => 0)).toBe(4_000);
    expect(backoffMs(1, () => 1)).toBe(6_000);
  });
});

describe('telemetry flush', () => {
  it('sends the whole queue in batches and empties it', async () => {
    const { queue, flusher, sent } = setup({ items: 5 });
    await expect(flusher.flush()).resolves.toBe('done');
    expect(sent.map((batch) => batch.map((item) => item.name))).toEqual([['e0', 'e1'], ['e2', 'e3'], ['e4']]);
    expect(queue.size()).toBe(0);
  });

  it('never sends the local sequence number', async () => {
    const { flusher, sent } = setup({ items: 1 });
    await flusher.flush();
    expect(sent[0][0]).not.toHaveProperty('seq');
    expect(Object.keys(sent[0][0]).sort()).toEqual(['app_version', 'name', 'os_major', 'platform', 'props', 'type']);
  });

  it('sends nothing without a signed-in session and keeps the queue', async () => {
    const { queue, flusher, send } = setup({ token: null });
    await expect(flusher.flush()).resolves.toBe('no_session');
    expect(send).not.toHaveBeenCalled();
    expect(queue.size()).toBe(3);
  });

  it('does not call the server for an empty queue', async () => {
    const { flusher, send } = setup({ items: 0 });
    await expect(flusher.flush()).resolves.toBe('empty');
    expect(send).not.toHaveBeenCalled();
  });

  it('drops a batch the server refuses (4xx) and goes on', async () => {
    const { queue, flusher, sent } = setup({ items: 3, results: ['drop'] });
    await expect(flusher.flush()).resolves.toBe('done');
    expect(sent).toHaveLength(2);
    expect(queue.size()).toBe(0);
  });

  it('keeps the batch on a server or network error and backs off', async () => {
    const { queue, flusher, send, advance } = setup({ items: 3, results: ['retry', 'retry'] });
    await expect(flusher.flush()).resolves.toBe('retry');
    expect(queue.size()).toBe(3);
    expect(flusher.backoff().failures).toBe(1);

    // Within the 5 s wait nothing is sent.
    advance(4_000);
    await expect(flusher.flush()).resolves.toBe('waiting');
    expect(send).toHaveBeenCalledTimes(1);

    // Second failure: the wait doubles.
    advance(2_000);
    await expect(flusher.flush()).resolves.toBe('retry');
    expect(flusher.backoff().failures).toBe(2);
    advance(9_000);
    await expect(flusher.flush()).resolves.toBe('waiting');

    // Then it works and the backoff resets.
    advance(2_000);
    await expect(flusher.flush()).resolves.toBe('done');
    expect(queue.size()).toBe(0);
    expect(flusher.backoff()).toEqual({ failures: 0, nextAttemptAt: 0 });
  });

  it('treats a throwing sender like a network error', async () => {
    const queue = createTelemetryQueue(memoryStore());
    queue.push(event('app_opened'));
    const flusher = createFlusher({
      queue,
      send: async () => {
        throw new Error('offline');
      },
      getToken: async () => 'jwt',
    });
    await expect(flusher.flush()).resolves.toBe('retry');
    expect(queue.size()).toBe(1);
  });

  it('runs one flush at a time', async () => {
    const { flusher, send } = setup({ items: 1 });
    const [a, b] = [flusher.flush(), flusher.flush()];
    await Promise.all([a, b]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends at most maxBatches per flush; the rest waits for the next one', async () => {
    const queue = createTelemetryQueue(memoryStore());
    for (let i = 0; i < 7; i++) queue.push(event(`e${i}`));
    const send = jest.fn(async () => 'sent' as const);
    const flusher = createFlusher({ queue, send, getToken: async () => 'jwt', batchSize: 2, maxBatches: 2 });
    await flusher.flush();
    expect(send).toHaveBeenCalledTimes(2);
    expect(queue.size()).toBe(3);
  });

  it('keeps items that arrive while a batch is on its way', async () => {
    const queue = createTelemetryQueue(memoryStore());
    queue.push(event('first'));
    let release: (value: SendResult) => void = () => {};
    const flusher = createFlusher({
      queue,
      send: () => new Promise<SendResult>((resolve) => (release = resolve)),
      getToken: async () => 'jwt',
      maxBatches: 1,
    });
    const running = flusher.flush();
    await Promise.resolve();
    await Promise.resolve();
    queue.push(event('second'));
    release('sent');
    await running;
    expect(queue.peek(10).map((q) => q.item.name)).toEqual(['second']);
  });
});

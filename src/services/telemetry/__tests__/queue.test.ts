/// <reference types="jest" />
import { createTelemetryQueue, type KeyValueStore } from '../queue';
import type { TelemetryItem } from '../types';

const context = { app_version: '1.0.0 (1)', platform: 'ios', os_major: 18 } as const;
const event = (name: string): TelemetryItem => ({ type: 'event', name, props: {}, ...context });
const crash = (name: string): TelemetryItem => ({ type: 'crash', name, message: '', stack: '', fatal: false, ...context });

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItemSync: (key) => data[key] ?? null,
    setItemSync: (key, value) => {
      data[key] = value;
    },
  };
}

const names = (items: { item: TelemetryItem }[]) => items.map((q) => q.item.name);

describe('telemetry queue', () => {
  it('keeps items in order and survives a restart (device-wide storage)', () => {
    const store = memoryStore();
    const queue = createTelemetryQueue(store);
    queue.push(event('app_opened'));
    queue.push(event('progress_viewed'));

    const reopened = createTelemetryQueue(store);
    expect(names(reopened.peek(10))).toEqual(['app_opened', 'progress_viewed']);
    expect(reopened.size()).toBe(2);
  });

  it('drops the oldest items above the cap', () => {
    const queue = createTelemetryQueue(memoryStore(), { maxItems: 3 });
    for (const name of ['a', 'b', 'c', 'd', 'e']) queue.push(event(name));
    expect(names(queue.peek(10))).toEqual(['c', 'd', 'e']);
  });

  it('keeps at most maxCrashes crash reports so a crash loop cannot push out the events', () => {
    const queue = createTelemetryQueue(memoryStore(), { maxItems: 10, maxCrashes: 2 });
    queue.push(event('app_opened'));
    queue.push(crash('E1'));
    queue.push(crash('E2'));
    queue.push(crash('E3'));
    expect(names(queue.peek(10))).toEqual(['app_opened', 'E2', 'E3']);
  });

  it('removes only what was sent, even when the cap trimmed items in between', () => {
    const queue = createTelemetryQueue(memoryStore(), { maxItems: 3 });
    queue.push(event('a'));
    queue.push(event('b'));
    const sent = queue.peek(2);
    // Two more arrive while the batch is in flight; "a" falls off the cap.
    queue.push(event('c'));
    queue.push(event('d'));
    queue.removeThrough(sent[sent.length - 1].seq);
    expect(names(queue.peek(10))).toEqual(['c', 'd']);
  });

  it('starts empty when the stored value is broken or missing', () => {
    const queue = createTelemetryQueue(memoryStore({ 'studyflow.telemetry.queue': '{not json' }));
    expect(queue.size()).toBe(0);
    queue.push(event('app_opened'));
    expect(queue.size()).toBe(1);
  });

  it('keeps working in memory when storage throws', () => {
    const broken: KeyValueStore = {
      getItemSync: () => {
        throw new Error('no sqlite');
      },
      setItemSync: () => {
        throw new Error('no sqlite');
      },
    };
    const queue = createTelemetryQueue(broken);
    queue.push(event('app_opened'));
    expect(names(queue.peek(1))).toEqual(['app_opened']);
  });

  it('writes every change synchronously (a fatal crash may end the app right after)', () => {
    const store = memoryStore();
    const queue = createTelemetryQueue(store);
    queue.push(crash('TypeError'));
    expect(JSON.parse(store.data['studyflow.telemetry.queue']).items).toHaveLength(1);
  });
});

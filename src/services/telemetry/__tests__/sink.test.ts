/// <reference types="jest" />
import { createTelemetryQueue, type KeyValueStore } from '../queue';
import { createTelemetrySink, osMajor, toPlatform } from '../sink';

function memoryStore(): KeyValueStore {
  const data: Record<string, string> = {};
  return { getItemSync: (key) => data[key] ?? null, setItemSync: (key, value) => void (data[key] = value) };
}

const context = { app_version: '1.0.0 (1)', platform: 'ios', os_major: 18 } as const;

describe('osMajor', () => {
  it.each([
    ['18.2', 18],
    ['17', 17],
    [35, 35],
    [34.0, 34],
    ['', null],
    ['beta', null],
    [-1, null],
  ])('%p → %p', (input, expected) => {
    expect(osMajor(input)).toBe(expected);
  });
});

describe('toPlatform', () => {
  it('keeps ios and android; everything else counts as web', () => {
    expect([toPlatform('ios'), toPlatform('android'), toPlatform('macos'), toPlatform('web')]).toEqual([
      'ios',
      'android',
      'web',
      'web',
    ]);
  });
});

describe('telemetry sink', () => {
  it('queues events with the app context and without the KPI', () => {
    const queue = createTelemetryQueue(memoryStore());
    createTelemetrySink(queue, context).capture('quiz_completed', { correct: 7 }, 'G-03');
    expect(queue.peek(1)[0].item).toEqual({ type: 'event', name: 'quiz_completed', props: { correct: 7 }, ...context });
  });

  it('queues crash reports with the major OS version only and tells the service', () => {
    const queue = createTelemetryQueue(memoryStore());
    const onCrash = jest.fn();
    createTelemetrySink(queue, context, { onCrash }).captureCrash({
      name: 'TypeError',
      message: 'x is undefined',
      stack: 'main.jsbundle:1:2',
      fatal: false,
      platform: 'ios',
      os_version: '18.2',
      app_version: '1.0.0 (1)',
    });
    expect(queue.peek(1)[0].item).toEqual({
      type: 'crash',
      name: 'TypeError',
      message: 'x is undefined',
      stack: 'main.jsbundle:1:2',
      fatal: false,
      ...context,
    });
    expect(onCrash).toHaveBeenCalledWith(expect.objectContaining({ fatal: false }));
  });
});

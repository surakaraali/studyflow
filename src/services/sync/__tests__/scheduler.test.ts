import { createScheduler, INTERVAL_MS, LOCAL_DEBOUNCE_MS, type RunOutcome } from '../scheduler';

/** Lets pending promise callbacks and zero-delay timers run. */
async function flush() {
  for (let i = 0; i < 5; i++) await jest.advanceTimersByTimeAsync(1);
}

describe('sync scheduler', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function setup(outcomes: RunOutcome[] = []) {
    const run = jest.fn(async (): Promise<RunOutcome> => outcomes.shift() ?? 'done');
    const scheduler = createScheduler(run);
    return { run, scheduler };
  }

  it('starts a sync within 30 seconds after the connection comes back (US-05)', async () => {
    const { run, scheduler } = setup();
    scheduler.start();
    scheduler.network(false);
    expect(run).not.toHaveBeenCalled();

    scheduler.network(true);
    await jest.advanceTimersByTimeAsync(30_000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs every minute while active and stops in the background', async () => {
    const { run, scheduler } = setup();
    scheduler.start();
    await jest.advanceTimersByTimeAsync(INTERVAL_MS * 3);
    await flush();
    expect(run).toHaveBeenCalledTimes(3);

    scheduler.stop();
    await jest.advanceTimersByTimeAsync(INTERVAL_MS * 3);
    await flush();
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('waits 2 seconds after the last local write', async () => {
    const { run, scheduler } = setup();
    scheduler.start();
    scheduler.localChange();
    await jest.advanceTimersByTimeAsync(1_500);
    scheduler.localChange();
    await jest.advanceTimersByTimeAsync(1_500);
    expect(run).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(LOCAL_DEBOUNCE_MS);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('backs off after a failure and retries', async () => {
    const { run, scheduler } = setup(['retry', 'done']);
    scheduler.start();
    scheduler.trigger(0);
    await jest.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(4_000);
    expect(run).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1_000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('runs again right away when more changes are waiting', async () => {
    const { run, scheduler } = setup(['more', 'done']);
    scheduler.start();
    scheduler.trigger(0);
    await flush();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('never runs twice at the same time', async () => {
    let release: () => void = () => {};
    const run = jest.fn(
      () =>
        new Promise<RunOutcome>((resolve) => {
          release = () => resolve('done');
        }),
    );
    const scheduler = createScheduler(run);
    scheduler.start();
    scheduler.trigger(0);
    await jest.advanceTimersByTimeAsync(0);
    scheduler.trigger(0);
    await jest.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);

    release();
    await flush();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('does nothing before start or after stop', async () => {
    const { run, scheduler } = setup();
    scheduler.trigger(0);
    scheduler.localChange();
    await jest.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(run).not.toHaveBeenCalled();
  });
});

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** The current time, refreshed every `intervalMs` and when the app returns to the foreground. */
export function useNow(intervalMs: number, active = true): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(new Date());
    const id = setInterval(tick, intervalMs);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(id);
      subscription.remove();
    };
  }, [intervalMs, active]);

  return now;
}

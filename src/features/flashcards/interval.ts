/** Turns the time until a card's next review into one rounded unit ("10 dk", "3 gün"). */

export type IntervalUnit = 'minutes' | 'hours' | 'days' | 'months' | 'years';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function intervalParts(from: Date, to: Date): { unit: IntervalUnit; count: number } {
  const ms = Math.max(0, to.getTime() - from.getTime());
  if (ms < HOUR) return { unit: 'minutes', count: Math.max(1, Math.round(ms / MINUTE)) };
  if (ms < DAY) return { unit: 'hours', count: Math.round(ms / HOUR) };
  const days = Math.round(ms / DAY);
  if (days < 30) return { unit: 'days', count: days };
  if (days < 365) return { unit: 'months', count: Math.round(days / 30) };
  return { unit: 'years', count: Math.round((days / 365) * 10) / 10 };
}

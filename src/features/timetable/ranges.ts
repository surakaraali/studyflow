/**
 * Time ranges inside one day ("HH:MM"–"HH:MM"), shared by the school timetable (US-23)
 * and study availability (US-47). Pure functions only.
 */

import { fromMinutes, toMinutes } from '@/domain/rules';

export type TimeRange = { start: string; end: string };

export type RangeError = 'endBeforeStart' | 'overlap';

/** Two ranges overlap when they share at least one minute; touching ends do not count. */
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);
}

/**
 * One error (or null) per range, in the same order.
 * A range whose end is not after its start is reported as such and skipped for overlaps.
 */
export function validateRanges(ranges: readonly TimeRange[]): (RangeError | null)[] {
  const errors: (RangeError | null)[] = ranges.map((r) =>
    toMinutes(r.end) <= toMinutes(r.start) ? 'endBeforeStart' : null,
  );
  for (let i = 0; i < ranges.length; i++) {
    if (errors[i]) continue;
    for (let j = 0; j < ranges.length; j++) {
      if (i === j || errors[j] === 'endBeforeStart') continue;
      if (rangesOverlap(ranges[i], ranges[j])) {
        errors[i] = 'overlap';
        break;
      }
    }
  }
  return errors;
}

export function rangesAreValid(ranges: readonly TimeRange[]): boolean {
  return validateRanges(ranges).every((e) => e === null);
}

export function sortRanges<T extends TimeRange>(ranges: readonly T[]): T[] {
  return [...ranges].sort((a, b) => toMinutes(a.start) - toMinutes(b.start) || toMinutes(a.end) - toMinutes(b.end));
}

/**
 * A sensible next range to add: right after the latest one plus a gap,
 * or `first` when the list is empty. Never runs past midnight.
 */
export function nextRange(
  ranges: readonly TimeRange[],
  options: { first: TimeRange; length: number; gap: number },
): TimeRange {
  if (ranges.length === 0) return options.first;
  const lastEnd = Math.max(...ranges.map((r) => toMinutes(r.end)));
  const start = Math.min(lastEnd + options.gap, 24 * 60 - options.length);
  return { start: fromMinutes(start), end: fromMinutes(start + options.length) };
}

/** Total minutes covered by valid ranges (overlaps are not merged). */
export function totalMinutes(ranges: readonly TimeRange[]): number {
  return ranges.reduce((sum, r) => sum + Math.max(0, toMinutes(r.end) - toMinutes(r.start)), 0);
}

/** "16:00–21:30, 22:00–22:30" */
export function formatRanges(ranges: readonly TimeRange[]): string {
  return sortRanges(ranges)
    .map((r) => `${r.start}–${r.end}`)
    .join(', ');
}

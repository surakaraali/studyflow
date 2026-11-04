import type { DayType } from '@/db/types';
import type { Segment } from '@/domain/rules';
import type { TimeRange } from '@/features/timetable/ranges';

export type Availability = Record<DayType, TimeRange[]>;

/**
 * US-47: study hours we suggest until the student sets their own.
 * Weekdays start after school; weekends leave the morning and lunch free.
 */
export function defaultAvailability(segment: Segment): Availability {
  const weekday: TimeRange =
    segment === 'lise' ? { start: '16:00', end: '21:30' } : { start: '15:30', end: '20:30' };
  return {
    weekday: [weekday],
    weekend: [
      { start: '10:00', end: '12:30' },
      { start: '14:00', end: '19:00' },
    ],
  };
}

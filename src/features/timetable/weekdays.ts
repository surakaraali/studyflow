/** ISO weekdays, Monday first. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export const SCHOOL_DAYS = [1, 2, 3, 4, 5] as const;

/** "Pazartesi" for 1 … "Pazar" for 7, in the app language. */
export function weekdayName(weekday: number, tag: string): string {
  // 1 January 2024 was a Monday.
  return new Intl.DateTimeFormat(tag, { weekday: 'long' }).format(new Date(2024, 0, weekday));
}

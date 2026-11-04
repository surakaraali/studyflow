import type { Language } from '@/i18n';

const LOCALE_TAGS: Record<Language, string> = {
  tr: 'tr-TR',
  en: 'en-US',
};

export function localeTag(language: string): string {
  return LOCALE_TAGS[language as Language] ?? LOCALE_TAGS.tr;
}

export type GreetingKey = 'morning' | 'day' | 'evening' | 'night';

export function greetingKey(date: Date = new Date()): GreetingKey {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'day';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

/** "3 Kasım Salı" */
export function formatLongDate(date: Date, tag: string): string {
  return new Intl.DateTimeFormat(tag, { weekday: 'long', day: 'numeric', month: 'long' }).format(
    date,
  );
}

/** "Kasım 2026" */
export function formatMonthYear(date: Date, tag: string): string {
  return new Intl.DateTimeFormat(tag, { month: 'long', year: 'numeric' }).format(date);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** The seven days of the week containing `date`, starting on Monday. */
export function weekDays(date: Date): Date[] {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (monday.getDay() + 6) % 7; // Sunday = 6, Monday = 0
  monday.setDate(monday.getDate() - offset);

  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return day;
  });
}

/** "2026-11-04" in local time. */
export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

/** Parses "YYYY-MM-DD" as a local date at midnight. */
export function parseDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayString(now: Date = new Date()): string {
  return formatDate(now);
}

export function addDays(value: string, days: number): string {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

/** Whole days from `from` to `to` (both "YYYY-MM-DD"); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const a = parseDate(from);
  const b = parseDate(to);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** 1 = Monday … 7 = Sunday */
export function isoWeekday(value: string): number {
  const day = parseDate(value).getDay();
  return day === 0 ? 7 : day;
}

export function isWeekend(value: string): boolean {
  return isoWeekday(value) >= 6;
}

/** ISO week id, e.g. "2026-W45" (weeks start on Monday). */
export function isoWeek(value: string): string {
  const date = parseDate(value);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = (target.getTime() - firstThursday.getTime()) / 86_400_000;
  const week = 1 + Math.round((diff - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `${target.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Monday of the week containing `value`. */
export function weekStart(value: string): string {
  return addDays(value, 1 - isoWeekday(value));
}

/** "4 Kas" */
export function formatShortDate(value: string, tag: string): string {
  return new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short' }).format(parseDate(value));
}

/** "4 Kasım Çarşamba" from "YYYY-MM-DD" */
export function formatDayLong(value: string, tag: string): string {
  return formatLongDate(parseDate(value), tag);
}

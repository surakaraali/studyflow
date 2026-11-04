import { localeTag, parseDate } from '@/lib/dates';

/** "4 Kasım 2026" from "YYYY-MM-DD" or an ISO timestamp. */
export function formatFullDate(value: string, language: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseDate(value) : new Date(value);
  return new Intl.DateTimeFormat(localeTag(language), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** "4 Kasım 2026 14:30" from an ISO timestamp. */
export function formatDateTime(iso: string, language: string): string {
  return new Intl.DateTimeFormat(localeTag(language), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

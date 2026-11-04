import type { TFunction } from 'i18next';

import { daysBetween } from '@/lib/dates';

/** US-28 / BR-11: exams this close are highlighted with the exam color. */
export const EXAM_SOON_DAYS = 7;

export type Countdown = {
  /** Whole days from today to the date; negative when it has passed. */
  days: number;
  kind: 'past' | 'today' | 'tomorrow' | 'days';
  /** Today up to EXAM_SOON_DAYS days ahead. */
  soon: boolean;
};

export function countdown(date: string, today: string): Countdown {
  const days = daysBetween(today, date);
  const kind = days < 0 ? 'past' : days === 0 ? 'today' : days === 1 ? 'tomorrow' : 'days';
  return { days, kind, soon: days >= 0 && days <= EXAM_SOON_DAYS };
}

/** "Bugün", "Yarın", "3 gün kaldı" or "Geçti". */
export function countdownText(value: Countdown, t: TFunction): string {
  switch (value.kind) {
    case 'today':
      return t('common.today');
    case 'tomorrow':
      return t('common.tomorrow');
    case 'days':
      return t('common.daysLeft', { count: value.days });
    case 'past':
      return t('exams.past');
  }
}

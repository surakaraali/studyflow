import { describe, expect, it } from '@jest/globals';

import type { CardRow } from '@/db/types';

import {
  buildReviewQueue,
  comesBackToday,
  endOfDay,
  fromFsrsCard,
  isDueToday,
  newCardFields,
  newCardsLeft,
  previewDue,
  Rating,
  review,
  State,
  toFsrsCard,
  todayCount,
} from '../fsrs';

const NOW = new Date(2026, 10, 4, 9, 0, 0); // 4 Nov 2026, 09:00 local

let seq = 0;
function card(overrides: Partial<CardRow> = {}): CardRow {
  seq += 1;
  const id = overrides.id ?? `card-${String(seq).padStart(3, '0')}`;
  return {
    id,
    deck_id: 'deck-1',
    document_id: null,
    front: 'Ön',
    back: 'Arka',
    source_page: null,
    ai_generated: 0,
    edited: 0,
    hidden: 0,
    created_at: new Date(2026, 9, 1, 0, 0, seq).toISOString(),
    updated_at: NOW.toISOString(),
    deleted_at: null,
    ...newCardFields(new Date(2026, 9, 1)),
    ...overrides,
  };
}

function hoursFromNow(hours: number) {
  return new Date(NOW.getTime() + hours * 3_600_000).toISOString();
}

describe('row ↔ ts-fsrs card mapping', () => {
  it('round-trips every scheduling column', () => {
    const row = card({
      due: '2026-11-10T06:00:00.000Z',
      stability: 4.2,
      difficulty: 5.1,
      elapsed_days: 3,
      scheduled_days: 6,
      learning_steps: 0,
      reps: 4,
      lapses: 1,
      state: State.Review,
      last_review: '2026-11-04T06:00:00.000Z',
    });
    const mapped = fromFsrsCard(toFsrsCard(row));
    expect(mapped).toEqual({
      due: row.due,
      stability: 4.2,
      difficulty: 5.1,
      elapsed_days: 3,
      scheduled_days: 6,
      learning_steps: 0,
      reps: 4,
      lapses: 1,
      state: State.Review,
      last_review: row.last_review,
    });
  });

  it('keeps a missing last review as null', () => {
    expect(fromFsrsCard(toFsrsCard(card())).last_review).toBeNull();
  });
});

describe('US-45 rating a card', () => {
  it('"İyi" on a review card sets the next due date with FSRS and logs the review', () => {
    const due = card({
      state: State.Review,
      due: hoursFromNow(-1),
      last_review: new Date(2026, 10, 1, 9).toISOString(),
      stability: 3,
      difficulty: 5,
      scheduled_days: 3,
      reps: 3,
    });

    const { fields, log } = review(due, Rating.Good, NOW);

    expect(fields.state).toBe(State.Review);
    expect(new Date(fields.due).getTime()).toBeGreaterThan(endOfDay(NOW).getTime());
    expect(fields.scheduled_days).toBeGreaterThanOrEqual(1);
    expect(fields.reps).toBe(4);
    expect(fields.last_review).toBe(NOW.toISOString());
    // A longer interval than the last one, because the student remembered it.
    expect(fields.stability).toBeGreaterThan(3);

    expect(log).toMatchObject({
      card_id: due.id,
      rating: Rating.Good,
      was_new: 0,
      state: State.Review,
      reviewed_at: NOW.toISOString(),
    });
  });

  it('a new card answered "İyi" moves to learning and is marked as new in the log', () => {
    const { fields, log } = review(card(), Rating.Good, NOW);
    expect(fields.state).toBe(State.Learning);
    expect(log.was_new).toBe(1);
    expect(log.state).toBe(State.New);
    expect(comesBackToday(fields, NOW)).toBe(true);
  });

  it('"Kolay" on a new card graduates it straight to review', () => {
    const { fields } = review(card(), Rating.Easy, NOW);
    expect(fields.state).toBe(State.Review);
    expect(comesBackToday(fields, NOW)).toBe(false);
  });

  it('"Tekrar" on a review card counts a lapse and brings it back today', () => {
    const due = card({
      state: State.Review,
      due: hoursFromNow(-2),
      last_review: new Date(2026, 10, 1, 9).toISOString(),
      stability: 3,
      difficulty: 5,
      scheduled_days: 3,
      reps: 3,
    });
    const { fields } = review(due, Rating.Again, NOW);
    expect(fields.state).toBe(State.Relearning);
    expect(fields.lapses).toBe(1);
    expect(comesBackToday(fields, NOW)).toBe(true);
  });

  it('previews a later date for each better answer', () => {
    const preview = previewDue(card(), NOW);
    const times = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].map((r) =>
      preview[r as 1 | 2 | 3 | 4].getTime(),
    );
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(times[0]).toBeGreaterThan(NOW.getTime());
  });
});

describe('isDueToday', () => {
  it('counts studied cards due any time today, but never new cards', () => {
    expect(isDueToday({ state: State.Review, due: hoursFromNow(10) }, NOW)).toBe(true);
    expect(isDueToday({ state: State.Review, due: hoursFromNow(24) }, NOW)).toBe(false);
    expect(isDueToday({ state: State.New, due: hoursFromNow(-5) }, NOW)).toBe(false);
  });
});

describe('BR-22 new card limit', () => {
  it('is 10 / 20 / 30 per segment minus what was seen today', () => {
    expect(newCardsLeft('ilkokul', 0)).toBe(10);
    expect(newCardsLeft('ortaokul', 5)).toBe(15);
    expect(newCardsLeft('lise', 30)).toBe(0);
    expect(newCardsLeft('lise', 45)).toBe(0);
  });

  it('todayCount adds due cards and the new cards still allowed', () => {
    expect(todayCount(12, 50, 'ortaokul', 0)).toBe(32);
    expect(todayCount(12, 3, 'ortaokul', 0)).toBe(15);
    expect(todayCount(12, 50, 'lise', 30)).toBe(12);
  });
});

describe('US-45 review queue', () => {
  it('puts due cards first by due date, then new cards oldest first', () => {
    const lateDue = card({ id: 'late', state: State.Review, due: hoursFromNow(3) });
    const earlyDue = card({ id: 'early', state: State.Review, due: hoursFromNow(-30) });
    const learning = card({ id: 'learning', state: State.Learning, due: hoursFromNow(-1) });
    const tomorrow = card({ id: 'tomorrow', state: State.Review, due: hoursFromNow(30) });
    const newOld = card({ id: 'new-old', created_at: '2026-10-01T00:00:00.000Z' });
    const newYoung = card({ id: 'new-young', created_at: '2026-10-20T00:00:00.000Z' });

    const queue = buildReviewQueue(
      [newYoung, lateDue, tomorrow, newOld, learning, earlyDue],
      0,
      'ortaokul',
      NOW,
    );
    expect(queue.map((c) => c.id)).toEqual(['early', 'learning', 'late', 'new-old', 'new-young']);
  });

  it('leaves out hidden and deleted cards', () => {
    const queue = buildReviewQueue(
      [
        card({ id: 'ok', state: State.Review, due: hoursFromNow(-1) }),
        card({ id: 'reported', state: State.Review, due: hoursFromNow(-1), hidden: 1 }),
        card({ id: 'deleted', deleted_at: NOW.toISOString() }),
        card({ id: 'reported-new', hidden: 1 }),
      ],
      0,
      'lise',
      NOW,
    );
    expect(queue.map((c) => c.id)).toEqual(['ok']);
  });

  it('caps new cards at the daily limit minus the ones already seen', () => {
    const fresh = Array.from({ length: 25 }, () => card());
    expect(buildReviewQueue(fresh, 0, 'ortaokul', NOW)).toHaveLength(20);
    expect(buildReviewQueue(fresh, 15, 'ortaokul', NOW)).toHaveLength(5);
    expect(buildReviewQueue(fresh, 0, 'ilkokul', NOW)).toHaveLength(10);
  });

  it('scenario: a lise student who saw 30 new cards today only gets due cards', () => {
    const due = Array.from({ length: 15 }, (_, i) =>
      card({ state: State.Review, due: hoursFromNow(-i - 1) }),
    );
    const fresh = Array.from({ length: 40 }, () => card());

    const queue = buildReviewQueue([...fresh, ...due], 30, 'lise', NOW);

    expect(queue).toHaveLength(15);
    expect(queue.every((c) => c.state !== State.New)).toBe(true);
  });
});

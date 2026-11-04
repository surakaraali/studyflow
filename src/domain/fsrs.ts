/**
 * Spaced repetition (BR-22, US-45) on top of ts-fsrs.
 *
 * Our `cards` rows keep the FSRS fields as plain columns (dates as ISO strings);
 * this module converts them to ts-fsrs cards and back, rates a card and builds
 * the day's review queue. Pure functions only: no I/O, no React.
 */

import {
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type Grade,
  type ReviewLog,
} from 'ts-fsrs';

import type { CardReview, CardRow } from '@/db/types';
import { FSRS_RETENTION, newCardLimit, type Segment } from '@/domain/rules';

export { Rating, State };
export type { Grade };

/** The four answers a student can give, in button order (Tekrar, Zor, İyi, Kolay). */
export const GRADES: readonly Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];

// Fuzz stays off so the same review always gives the same date (predictable, testable).
const scheduler = fsrs(
  generatorParameters({ request_retention: FSRS_RETENTION, enable_fuzz: false }),
);

/** The scheduling columns of a `cards` row. */
export type FsrsFields = Pick<
  CardRow,
  | 'due'
  | 'stability'
  | 'difficulty'
  | 'elapsed_days'
  | 'scheduled_days'
  | 'learning_steps'
  | 'reps'
  | 'lapses'
  | 'state'
  | 'last_review'
>;

/** A `card_reviews` row without id and created_at (the writer adds them). */
export type ReviewLogRow = Omit<CardReview, 'id' | 'created_at'>;

/** Scheduling columns for a card nobody has studied yet. */
export function newCardFields(now: Date): FsrsFields {
  return {
    due: now.toISOString(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: State.New,
    last_review: null,
  };
}

export function toFsrsCard(row: FsrsFields): Card {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  };
}

export function fromFsrsCard(card: Card): FsrsFields {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}

/**
 * The review log mirrors ts-fsrs' ReviewLog: state, due, stability, difficulty and
 * scheduled_days describe the card *before* this answer, so a review can be undone
 * or replayed later. The card row holds the new values.
 */
function toLogRow(cardId: string, log: ReviewLog): ReviewLogRow {
  return {
    card_id: cardId,
    rating: log.rating,
    was_new: log.state === State.New ? 1 : 0,
    state: log.state,
    due: log.due.toISOString(),
    stability: log.stability,
    difficulty: log.difficulty,
    scheduled_days: log.scheduled_days,
    reviewed_at: log.review.toISOString(),
  };
}

/** Rates a card: the new scheduling columns for the card row, and the row for `card_reviews`. */
export function review(
  card: FsrsFields & { id: string },
  rating: Grade,
  now: Date,
): { fields: FsrsFields; log: ReviewLogRow } {
  const result = scheduler.next(toFsrsCard(card), now, rating);
  return { fields: fromFsrsCard(result.card), log: toLogRow(card.id, result.log) };
}

/** When the card would come back for each answer (shown on the rating buttons). */
export function previewDue(card: FsrsFields, now: Date): Record<Grade, Date> {
  const preview = scheduler.repeat(toFsrsCard(card), now);
  return {
    [Rating.Again]: preview[Rating.Again].card.due,
    [Rating.Hard]: preview[Rating.Hard].card.due,
    [Rating.Good]: preview[Rating.Good].card.due,
    [Rating.Easy]: preview[Rating.Easy].card.due,
  } as Record<Grade, Date>;
}

export function startOfDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Last millisecond of the local day. Cards due any time today count as due. */
export function endOfDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}

/** A studied card (learning, review or relearning) that is due today. */
export function isDueToday(card: Pick<CardRow, 'due' | 'state'>, now: Date): boolean {
  return card.state !== State.New && new Date(card.due).getTime() <= endOfDay(now).getTime();
}

/** BR-22: how many new cards may still be shown today. */
export function newCardsLeft(segment: Segment, newSeenToday: number): number {
  return Math.max(0, newCardLimit(segment) - newSeenToday);
}

/** What the queue builder needs from a card row. */
export type QueueCard = Pick<CardRow, 'id' | 'due' | 'state' | 'hidden' | 'deleted_at' | 'created_at'>;

/**
 * Today's review queue (US-45):
 * due learning/review cards first, earliest due date first; then new cards, oldest first,
 * up to the segment's daily limit minus the new cards already seen today.
 * Hidden (reported) and deleted cards never show up.
 */
export function buildReviewQueue<T extends QueueCard>(
  cards: readonly T[],
  newSeenToday: number,
  segment: Segment,
  now: Date,
): T[] {
  const visible = cards.filter((c) => !c.hidden && c.deleted_at == null);

  const due = visible
    .filter((c) => isDueToday(c, now))
    .sort((a, b) => Date.parse(a.due) - Date.parse(b.due) || a.id.localeCompare(b.id));

  const fresh = visible
    .filter((c) => c.state === State.New)
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    .slice(0, newCardsLeft(segment, newSeenToday));

  return [...due, ...fresh];
}

/** How many cards today's session would show: due cards plus the new cards still allowed. */
export function todayCount(dueCount: number, newCount: number, segment: Segment, newSeenToday: number) {
  return dueCount + Math.min(newCount, newCardsLeft(segment, newSeenToday));
}

/** After an answer: does the card come back later in this same session? */
export function comesBackToday(fields: Pick<FsrsFields, 'due' | 'state'>, now: Date): boolean {
  return (
    (fields.state === State.Learning || fields.state === State.Relearning) &&
    isDueToday(fields, now)
  );
}

import { getDb } from '@/db/client';
import { newId, nowIso } from '@/db/ids';
import type { CardRow, Course, Deck } from '@/db/types';
import { patch, softDelete, upsert } from '@/db/write';
import {
  buildReviewQueue,
  endOfDay,
  newCardFields,
  newCardsLeft,
  startOfDay,
  State,
  todayCount,
  type FsrsFields,
  type ReviewLogRow,
} from '@/domain/fsrs';
import type { Segment } from '@/domain/rules';

/** Cards this user reported and the team has not decided on yet (BR-23). */
const OPEN_REPORTED = `SELECT item_id FROM content_reports
  WHERE item_type = 'card' AND status = 'open' AND deleted_at IS NULL`;

/** Visible cards: not deleted, not hidden, not reported, in a deck that still exists. */
const VISIBLE = `c.deleted_at IS NULL AND c.hidden = 0 AND d.deleted_at IS NULL
  AND c.id NOT IN (${OPEN_REPORTED})`;

/** BR-22: new cards already shown today (each new card logs exactly one was_new review). */
export async function countNewSeenToday(now: Date = new Date()): Promise<number> {
  const row = await getDb().getFirstAsync<{ n: number }>(
    'SELECT COUNT(DISTINCT card_id) AS n FROM card_reviews WHERE was_new = 1 AND reviewed_at >= ?',
    startOfDay(now).toISOString(),
  );
  return row?.n ?? 0;
}

type Counts = { total: number; due: number; fresh: number };

async function cardCounts(now: Date, deckId?: string): Promise<Map<string, Counts>> {
  const rows = await getDb().getAllAsync<{ deck_id: string; total: number; due: number; fresh: number }>(
    `SELECT c.deck_id AS deck_id,
            COUNT(*) AS total,
            SUM(CASE WHEN c.state != ${State.New} AND c.due <= ? THEN 1 ELSE 0 END) AS due,
            SUM(CASE WHEN c.state = ${State.New} THEN 1 ELSE 0 END) AS fresh
     FROM cards c JOIN decks d ON d.id = c.deck_id
     WHERE ${VISIBLE} ${deckId ? 'AND c.deck_id = ?' : ''}
     GROUP BY c.deck_id`,
    ...(deckId ? [endOfDay(now).toISOString(), deckId] : [endOfDay(now).toISOString()]),
  );
  return new Map(rows.map((r) => [r.deck_id, { total: r.total, due: r.due ?? 0, fresh: r.fresh ?? 0 }]));
}

export type DueSummary = {
  /** All visible cards (0 → the user has no cards at all). */
  total: number;
  /** Cards today's session would show (due + allowed new). */
  today: number;
};

/** For the Today screen and deck headers: how many cards wait today. */
export async function dueSummary(segment: Segment, deckId?: string, now: Date = new Date()): Promise<DueSummary> {
  const [counts, seen] = await Promise.all([cardCounts(now, deckId), countNewSeenToday(now)]);
  let total = 0;
  let due = 0;
  let fresh = 0;
  for (const c of counts.values()) {
    total += c.total;
    due += c.due;
    fresh += c.fresh;
  }
  return { total, today: todayCount(due, fresh, segment, seen) };
}

export type DeckListItem = {
  deck: Deck;
  course: Course | null;
  cardCount: number;
  todayCount: number;
};

/** US-44: decks with card counts and "bugün N kart". */
export async function listDecks(segment: Segment, now: Date = new Date()): Promise<DeckListItem[]> {
  const db = getDb();
  const [decks, courses, counts, seen] = await Promise.all([
    db.getAllAsync<Deck>('SELECT * FROM decks WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE'),
    db.getAllAsync<Course>('SELECT * FROM courses WHERE deleted_at IS NULL'),
    cardCounts(now),
    countNewSeenToday(now),
  ]);
  const courseById = new Map(courses.map((c) => [c.id, c]));
  return decks.map((deck) => {
    const c = counts.get(deck.id) ?? { total: 0, due: 0, fresh: 0 };
    return {
      deck,
      course: courseById.get(deck.course_id) ?? null,
      cardCount: c.total,
      todayCount: todayCount(c.due, c.fresh, segment, seen),
    };
  });
}

export async function getDeck(id: string): Promise<Deck | null> {
  return getDb().getFirstAsync<Deck>('SELECT * FROM decks WHERE id = ? AND deleted_at IS NULL', id);
}

/** Cards of a deck for the deck screen, newest first. Reported cards stay hidden (BR-23). */
export async function listDeckCards(deckId: string): Promise<CardRow[]> {
  return getDb().getAllAsync<CardRow>(
    `SELECT c.* FROM cards c JOIN decks d ON d.id = c.deck_id
     WHERE c.deck_id = ? AND ${VISIBLE} ORDER BY c.created_at DESC`,
    deckId,
  );
}

export async function getCard(id: string): Promise<CardRow | null> {
  return getDb().getFirstAsync<CardRow>('SELECT * FROM cards WHERE id = ? AND deleted_at IS NULL', id);
}

export async function createDeck(courseId: string, name: string): Promise<string> {
  const id = newId();
  await upsert('decks', { id, course_id: courseId, name: name.trim() });
  return id;
}

export async function renameDeck(id: string, name: string) {
  await patch('decks', id, { name: name.trim() });
}

/** Deletes a deck and its cards (soft delete, so it syncs). */
export async function deleteDeck(id: string) {
  const cards = await getDb().getAllAsync<{ id: string }>(
    'SELECT id FROM cards WHERE deck_id = ? AND deleted_at IS NULL',
    id,
  );
  for (const card of cards) await softDelete('cards', card.id);
  await softDelete('decks', id);
}

/** US-44: a card the student wrote. It is new and due right away. */
export async function createCard(deckId: string, front: string, back: string): Promise<string> {
  const id = newId();
  await upsert('cards', {
    id,
    deck_id: deckId,
    document_id: null,
    front: front.trim(),
    back: back.trim(),
    source_page: null,
    ai_generated: 0,
    edited: 0,
    hidden: 0,
    ...newCardFields(new Date()),
  });
  return id;
}

/** US-36: edits a card's text and marks it "Düzenlendi". */
export async function saveCard(id: string, front: string, back: string) {
  await patch('cards', id, { front: front.trim(), back: back.trim(), edited: 1 });
}

export async function deleteCard(id: string) {
  await softDelete('cards', id);
}

export type ReviewCard = CardRow & { deck_name: string };

/** US-45: today's queue, everything read once so the session runs from memory. */
export async function loadReviewQueue(
  segment: Segment,
  deckId?: string,
  now: Date = new Date(),
): Promise<ReviewCard[]> {
  const db = getDb();
  const seen = await countNewSeenToday(now);
  const deckFilter = deckId ? 'AND c.deck_id = ?' : '';
  const deckArgs = deckId ? [deckId] : [];

  const [due, fresh] = await Promise.all([
    db.getAllAsync<ReviewCard>(
      `SELECT c.*, d.name AS deck_name FROM cards c JOIN decks d ON d.id = c.deck_id
       WHERE ${VISIBLE} AND c.state != ${State.New} AND c.due <= ? ${deckFilter}
       ORDER BY c.due`,
      endOfDay(now).toISOString(),
      ...deckArgs,
    ),
    db.getAllAsync<ReviewCard>(
      `SELECT c.*, d.name AS deck_name FROM cards c JOIN decks d ON d.id = c.deck_id
       WHERE ${VISIBLE} AND c.state = ${State.New} ${deckFilter}
       ORDER BY c.created_at LIMIT ?`,
      ...deckArgs,
      newCardsLeft(segment, 0),
    ),
  ]);

  return buildReviewQueue([...due, ...fresh], seen, segment, now);
}

/** Saves one answer: new scheduling on the card, one appended review row (works offline). */
export async function saveReview(cardId: string, fields: FsrsFields, log: ReviewLogRow) {
  await patch('cards', cardId, { ...fields });
  await upsert('card_reviews', { id: newId(), ...log, created_at: nowIso() });
}

/**
 * Local writes for AI jobs.
 *
 * Job state (status, attempts, error_code …) and generated content are written with raw SQL
 * plus notifyTables, not through upsert(): in local mode there is no server, and in Supabase
 * mode the Edge Function owns these rows on the server, so echoing them back through the sync
 * outbox could overwrite a newer server status.
 */

import { getDb } from '@/db/client';
import { notifyTables } from '@/db/events';
import { newId, nowIso } from '@/db/ids';
import type { TableName } from '@/db/schema';
import type { Course, DocumentRow } from '@/db/types';
import { upsert } from '@/db/write';

import type { AiResult, AiUsageEntry } from './types';

const CONTENT_TABLES: TableName[] = ['documents', 'summaries', 'quizzes', 'questions', 'decks', 'cards', 'ai_usage'];

type JobState = Partial<
  Pick<DocumentRow, 'status' | 'error_code' | 'attempts' | 'next_attempt_at' | 'counted' | 'storage_path' | 'quota_month'>
>;

export async function setJobState(id: string, changes: JobState): Promise<void> {
  const columns = Object.keys(changes) as (keyof JobState)[];
  if (columns.length === 0) return;
  const now = nowIso();
  await getDb().runAsync(
    `UPDATE documents SET ${columns.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
    ...columns.map((c) => changes[c] ?? null),
    now,
    id,
  );
  notifyTables(['documents']);
}

/** One deck per course (contract with the flashcards feature). */
export async function findOrCreateDeck(course: Pick<Course, 'id' | 'name'>): Promise<string> {
  const existing = await getDb().getFirstAsync<{ id: string }>(
    'SELECT id FROM decks WHERE course_id = ? AND deleted_at IS NULL ORDER BY created_at LIMIT 1',
    course.id,
  );
  if (existing) return existing.id;
  const id = newId();
  await upsert('decks', { id, course_id: course.id, name: course.name });
  return id;
}

async function insertUsage(documentId: string, usage: AiUsageEntry[], createdAt: string) {
  const db = getDb();
  for (const u of usage) {
    await db.runAsync(
      `INSERT INTO ai_usage (id, document_id, task, model, input_tokens, output_tokens, cache_read_tokens,
         cache_write_tokens, duration_ms, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newId(),
      documentId,
      u.task,
      u.model,
      u.input_tokens,
      u.output_tokens,
      u.cache_read_tokens,
      u.cache_write_tokens,
      u.duration_ms,
      u.cost_usd,
      createdAt,
    );
  }
}

/** Cost and tokens of a job that produced no content (flagged or failed). */
export async function logUsage(documentId: string, usage: AiUsageEntry[]): Promise<void> {
  if (usage.length === 0) return;
  await insertUsage(documentId, usage, nowIso());
  notifyTables(['ai_usage']);
}

/** The model numbers pages of the trimmed PDF; shift them back to the original file. */
export function shiftPage(page: number | null, pageFrom: number): number | null {
  return page == null ? null : page + Math.max(0, pageFrom - 1);
}

/**
 * Stores a finished job from the development server (local mode): summary, quiz with its
 * questions, cards in the course deck, usage, and marks the document ready.
 */
export async function saveLocalResult(doc: DocumentRow, course: Course | null, result: AiResult): Promise<void> {
  const db = getDb();
  const deckId = await findOrCreateDeck(course ?? { id: doc.course_id, name: doc.title });
  const now = nowIso();
  const shift = (page: number | null) => shiftPage(page, doc.page_from);
  const sections = result.summary.sections.map((s) => ({
    ...s,
    pages: s.pages.map((p) => shift(p) ?? p),
  }));

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO summaries (id, document_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      newId(),
      doc.id,
      JSON.stringify({ sections }),
      now,
      now,
    );

    const quizId = newId();
    await db.runAsync(
      'INSERT INTO quizzes (id, document_id, course_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      quizId,
      doc.id,
      doc.course_id,
      doc.title,
      now,
      now,
    );
    for (const [index, q] of result.quiz.questions.entries()) {
      await db.runAsync(
        `INSERT INTO questions (id, quiz_id, stem, options, correct_index, explanation, source_page, topic, sort,
           created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        newId(),
        quizId,
        q.stem,
        JSON.stringify(q.options),
        q.correct_index,
        q.explanation,
        shift(q.source_page),
        q.topic || null,
        index,
        now,
        now,
      );
    }

    for (const c of result.cards.cards) {
      await db.runAsync(
        `INSERT INTO cards (id, deck_id, document_id, front, back, source_page, ai_generated, due, state,
           created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, 0, ?, ?)`,
        newId(),
        deckId,
        doc.id,
        c.front,
        c.back,
        shift(c.source_page),
        now,
        now,
        now,
      );
    }

    await insertUsage(doc.id, result.usage, now);
    await db.runAsync(
      `UPDATE documents SET status = 'ready', error_code = NULL, next_attempt_at = NULL, updated_at = ? WHERE id = ?`,
      now,
      doc.id,
    );
  });
  notifyTables(CONTENT_TABLES);
}

const columnCache = new Map<string, Set<string>>();

async function localColumns(table: string): Promise<Set<string>> {
  let columns = columnCache.get(table);
  if (!columns) {
    const info = await getDb().getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    columns = new Set(info.map((c) => c.name));
    columnCache.set(table, columns);
  }
  return columns;
}

/** Postgres returns "…+00:00"; the app stores and compares ISO strings with "Z". */
const TIMESTAMP_COLUMNS = new Set(['created_at', 'updated_at', 'deleted_at', 'due', 'last_review']);

function toSqlite(value: unknown, column: string): string | number | null {
  if (value === undefined || value === null) return null;
  if (TIMESTAMP_COLUMNS.has(column) && typeof value === 'string') {
    const time = Date.parse(value);
    return Number.isNaN(time) ? value : new Date(time).toISOString();
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'string') return value;
  return JSON.stringify(value);
}

export type ServerRows = Partial<Record<'summaries' | 'quizzes' | 'questions' | 'decks' | 'cards' | 'ai_usage', Record<string, unknown>[]>>;

/**
 * Copies rows the Edge Function wrote on the server into the local database with the same
 * ids (Supabase mode). Server-only columns such as user_id are dropped. Existing local rows are
 * kept, so a card the student already reviewed is never overwritten.
 */
export async function importServerRows(documentId: string, rows: ServerRows): Promise<void> {
  const db = getDb();
  const order = ['decks', 'summaries', 'quizzes', 'questions', 'cards', 'ai_usage'] as const;
  const prepared: { table: string; columns: string[]; values: (string | number | null)[] }[] = [];

  for (const table of order) {
    const columns = await localColumns(table);
    for (const row of rows[table] ?? []) {
      const keys = Object.keys(row).filter((k) => columns.has(k));
      if (!keys.includes('id')) continue;
      prepared.push({ table, columns: keys, values: keys.map((k) => toSqlite(row[k], k)) });
    }
  }

  const now = nowIso();
  await db.withTransactionAsync(async () => {
    for (const p of prepared) {
      await db.runAsync(
        `INSERT INTO ${p.table} (${p.columns.join(', ')}) VALUES (${p.columns.map(() => '?').join(', ')})
         ON CONFLICT(id) DO NOTHING`,
        ...p.values,
      );
    }
    await db.runAsync(
      `UPDATE documents SET status = 'ready', error_code = NULL, next_attempt_at = NULL, updated_at = ? WHERE id = ?`,
      now,
      documentId,
    );
  });
  notifyTables(CONTENT_TABLES);
}

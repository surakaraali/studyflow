/**
 * Documents: queries and student actions (US-31, US-33).
 */

import { getDb } from '@/db/client';
import { notifyTables } from '@/db/events';
import { nowIso } from '@/db/ids';
import type { DocumentRow, Quiz, Summary, SummarySection, Topic } from '@/db/types';
import { quotaMonth } from '@/domain/rules';
import { isLocalMode } from '@/services/config';
import { resetRemoteForRetry } from '@/services/ai/client';
import { kickAiRunner } from '@/services/ai/runner';

export type DocumentListItem = DocumentRow & {
  course_name: string | null;
  course_color: string | null;
};

export async function listDocuments(): Promise<DocumentListItem[]> {
  return getDb().getAllAsync<DocumentListItem>(
    `SELECT d.*, c.name AS course_name, c.color AS course_color
     FROM documents d LEFT JOIN courses c ON c.id = d.course_id
     WHERE d.deleted_at IS NULL AND c.deleted_at IS NULL
     ORDER BY d.created_at DESC`,
  );
}

export async function getDocument(id: string): Promise<DocumentListItem | null> {
  return getDb().getFirstAsync<DocumentListItem>(
    `SELECT d.*, c.name AS course_name, c.color AS course_color
     FROM documents d LEFT JOIN courses c ON c.id = d.course_id
     WHERE d.id = ? AND d.deleted_at IS NULL AND c.deleted_at IS NULL`,
    id,
  );
}

export type DocumentContent = {
  sections: SummarySection[];
  quizId: string | null;
  questionCount: number;
  deckId: string | null;
  cardCount: number;
};

export function parseSummaryContent(content: string | null | undefined): SummarySection[] {
  if (!content) return [];
  try {
    const parsed = JSON.parse(content) as { sections?: unknown };
    return Array.isArray(parsed.sections) ? (parsed.sections as SummarySection[]) : [];
  } catch {
    return [];
  }
}

/** The generated content of a ready document. Hidden questions and cards are not counted. */
export async function getDocumentContent(documentId: string): Promise<DocumentContent> {
  const db = getDb();
  const summary = await db.getFirstAsync<Pick<Summary, 'content'>>(
    'SELECT content FROM summaries WHERE document_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1',
    documentId,
  );
  const quiz = await db.getFirstAsync<Pick<Quiz, 'id'>>(
    'SELECT id FROM quizzes WHERE document_id = ? AND deleted_at IS NULL ORDER BY created_at LIMIT 1',
    documentId,
  );
  const questions = quiz
    ? await db.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM questions WHERE quiz_id = ? AND deleted_at IS NULL AND hidden = 0',
        quiz.id,
      )
    : null;
  const cards = await db.getFirstAsync<{ n: number; deck_id: string | null }>(
    `SELECT COUNT(*) AS n, MIN(deck_id) AS deck_id FROM cards
     WHERE document_id = ? AND deleted_at IS NULL AND hidden = 0`,
    documentId,
  );

  return {
    sections: parseSummaryContent(summary?.content),
    quizId: quiz?.id ?? null,
    questionCount: questions?.n ?? 0,
    deckId: cards?.deck_id ?? null,
    cardCount: cards?.n ?? 0,
  };
}

export async function listTopics(courseId: string): Promise<Topic[]> {
  return getDb().getAllAsync<Topic>(
    'SELECT * FROM topics WHERE course_id = ? AND deleted_at IS NULL ORDER BY sort, name COLLATE NOCASE',
    courseId,
  );
}

export type NewDocument = {
  id: string;
  courseId: string;
  topicId: string | null;
  title: string;
  fileUri: string;
  sizeBytes: number;
  pageCount: number;
  pageFrom: number;
  pageTo: number;
};

/**
 * Adds a queued document and wakes the job runner. It counts toward this month's quota right
 * away; a permanent failure gives it back (BR-14).
 *
 * Written with raw SQL: in Supabase mode the runner uploads the row itself right before the
 * Edge Function starts, and the server owns the job state from then on.
 */
export async function createDocument(input: NewDocument): Promise<void> {
  const now = nowIso();
  await getDb().runAsync(
    `INSERT INTO documents (id, course_id, topic_id, title, file_uri, size_bytes, page_count, page_from, page_to,
       status, attempts, quota_month, counted, under_review, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', 0, ?, 1, 0, ?, ?)`,
    input.id,
    input.courseId,
    input.topicId,
    input.title,
    input.fileUri,
    input.sizeBytes,
    input.pageCount,
    input.pageFrom,
    input.pageTo,
    quotaMonth(),
    now,
    now,
  );
  notifyTables(['documents']);
  kickAiRunner();
}

export type RetryResult = 'queued' | 'quota' | 'offline';

/**
 * "Tekrar dene" after a permanent failure. The refunded upload is used again, in the current
 * month, so the caller checks the quota first and passes `quotaFull`.
 */
export async function retryDocument(doc: DocumentRow, quotaFull: boolean): Promise<RetryResult> {
  if (quotaFull && doc.counted === 0) return 'quota';
  const month = quotaMonth();
  if (!isLocalMode && !(await resetRemoteForRetry({ ...doc, quota_month: month }))) return 'offline';

  await getDb().runAsync(
    `UPDATE documents SET status = 'queued', error_code = NULL, attempts = 0, next_attempt_at = NULL,
       counted = 1, quota_month = ?, created_at = ?, updated_at = ? WHERE id = ?`,
    month,
    // A fresh 24-hour queue window (REL-06).
    nowIso(),
    nowIso(),
    doc.id,
  );
  notifyTables(['documents']);
  kickAiRunner();
  return 'queued';
}

export { deleteDocument } from './cleanup';

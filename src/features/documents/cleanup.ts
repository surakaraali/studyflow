/**
 * Removing a document and what was generated from it. Also tidies documents that were deleted
 * elsewhere (deleting a course soft-deletes its documents but leaves their PDFs and content).
 */

import { getDb } from '@/db/client';
import { notifyTables } from '@/db/events';
import type { DocumentRow } from '@/db/types';
import { softDelete } from '@/db/write';
import { removeRemoteFile } from '@/services/ai/client';

import { deleteFileQuietly } from './storage';

type DocRef = Pick<DocumentRow, 'id' | 'file_uri' | 'storage_path'>;

async function liveIds(sql: string, ...params: string[]): Promise<string[]> {
  const rows = await getDb().getAllAsync<{ id: string }>(sql, ...params);
  return rows.map((r) => r.id);
}

/** Soft-deletes the summary, quiz, questions and cards of a document and removes its PDF. */
export async function deleteDocumentContent(doc: DocRef): Promise<void> {
  const quizIds = await liveIds('SELECT id FROM quizzes WHERE document_id = ? AND deleted_at IS NULL', doc.id);
  // Questions of a quiz that was already deleted (with its course) are cleaned up too.
  const questionIds = await liveIds(
    `SELECT id FROM questions WHERE deleted_at IS NULL
     AND quiz_id IN (SELECT id FROM quizzes WHERE document_id = ?)`,
    doc.id,
  );
  const summaryIds = await liveIds('SELECT id FROM summaries WHERE document_id = ? AND deleted_at IS NULL', doc.id);
  const cardIds = await liveIds('SELECT id FROM cards WHERE document_id = ? AND deleted_at IS NULL', doc.id);

  for (const id of questionIds) await softDelete('questions', id);
  for (const id of quizIds) await softDelete('quizzes', id);
  for (const id of summaryIds) await softDelete('summaries', id);
  for (const id of cardIds) await softDelete('cards', id);

  if (doc.file_uri) {
    deleteFileQuietly(doc.file_uri);
    // file_uri is a device path; clearing it needs no sync.
    await getDb().runAsync('UPDATE documents SET file_uri = NULL WHERE id = ?', doc.id);
    notifyTables(['documents']);
  }
  removeRemoteFile(doc as DocumentRow).catch(() => {});
}

/** Deletes a document and everything generated from it (soft deletes, so it syncs). */
export async function deleteDocument(doc: DocRef): Promise<void> {
  await deleteDocumentContent(doc);
  await softDelete('documents', doc.id);
}

/** Finishes the cleanup for documents deleted by another feature (e.g. with their course). */
export async function cleanupDeletedDocuments(): Promise<void> {
  const rows = await getDb().getAllAsync<DocRef>(
    `SELECT d.id, d.file_uri, d.storage_path FROM documents d
     WHERE d.deleted_at IS NOT NULL AND (
       d.file_uri IS NOT NULL
       OR EXISTS (SELECT 1 FROM summaries s WHERE s.document_id = d.id AND s.deleted_at IS NULL)
       OR EXISTS (SELECT 1 FROM quizzes q WHERE q.document_id = d.id AND q.deleted_at IS NULL)
       OR EXISTS (SELECT 1 FROM questions x JOIN quizzes q ON q.id = x.quiz_id
                  WHERE q.document_id = d.id AND x.deleted_at IS NULL)
       OR EXISTS (SELECT 1 FROM cards c WHERE c.document_id = d.id AND c.deleted_at IS NULL)
     )`,
  );
  for (const doc of rows) await deleteDocumentContent(doc);
}

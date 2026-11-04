import { getDb } from '@/db/client';
import { newId } from '@/db/ids';
import type { CardRow, ContentReport, DocumentRow, Question, ReportReason } from '@/db/types';
import { patch, softDelete, upsert } from '@/db/write';

import { decisionEffect, groupOpenReports, shouldReviewDocument, type ReportDecision } from './logic';

export type ReportableType = 'question' | 'card';

const TABLE = { question: 'questions', card: 'cards' } as const;

/**
 * US-37 / BR-23: records the report, hides the item from this user right away and,
 * when the document has collected more than three reports, puts it under review.
 */
export async function reportItem(input: {
  itemType: ReportableType;
  itemId: string;
  documentId: string | null;
  reason: ReportReason;
}) {
  await upsert('content_reports', {
    id: newId(),
    item_type: input.itemType,
    item_id: input.itemId,
    document_id: input.documentId,
    reason: input.reason,
    status: 'open',
  });
  await patch(TABLE[input.itemType], input.itemId, { hidden: 1 });

  if (!input.documentId) return;
  const db = getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM content_reports WHERE document_id = ? AND deleted_at IS NULL',
    input.documentId,
  );
  if (!shouldReviewDocument(row?.n ?? 0)) return;
  const doc = await db.getFirstAsync<Pick<DocumentRow, 'under_review'>>(
    'SELECT under_review FROM documents WHERE id = ?',
    input.documentId,
  );
  if (doc && !doc.under_review) await patch('documents', input.documentId, { under_review: 1 });
}

export type ReportGroup = {
  itemId: string;
  itemType: ContentReport['item_type'];
  reports: ContentReport[];
  question: Question | null;
  card: CardRow | null;
  document: Pick<DocumentRow, 'id' | 'title' | 'under_review'> | null;
};

/** Team review queue: open reports grouped by item, with the item and its document. */
export async function listOpenReports(): Promise<ReportGroup[]> {
  const db = getDb();
  const reports = await db.getAllAsync<ContentReport>(
    "SELECT * FROM content_reports WHERE status = 'open' AND deleted_at IS NULL ORDER BY created_at",
  );
  const groups = groupOpenReports(reports);

  return Promise.all(
    groups.map(async ({ itemId, reports: list }) => {
      const itemType = list[0].item_type;
      const documentId = list.find((r) => r.document_id)?.document_id ?? null;
      const [question, card, document] = await Promise.all([
        itemType === 'question'
          ? db.getFirstAsync<Question>('SELECT * FROM questions WHERE id = ? AND deleted_at IS NULL', itemId)
          : null,
        itemType === 'card'
          ? db.getFirstAsync<CardRow>('SELECT * FROM cards WHERE id = ? AND deleted_at IS NULL', itemId)
          : null,
        documentId
          ? db.getFirstAsync<Pick<DocumentRow, 'id' | 'title' | 'under_review'>>(
              'SELECT id, title, under_review FROM documents WHERE id = ?',
              documentId,
            )
          : null,
      ]);
      return { itemId, itemType, reports: list, question, card, document };
    }),
  );
}

/** Closes every open report on an item with the team's decision and applies it to the item. */
export async function decideReports(
  itemType: ContentReport['item_type'],
  itemId: string,
  decision: ReportDecision,
) {
  const db = getDb();
  const open = await db.getAllAsync<{ id: string }>(
    "SELECT id FROM content_reports WHERE item_id = ? AND status = 'open' AND deleted_at IS NULL",
    itemId,
  );
  for (const report of open) await patch('content_reports', report.id, { status: decision });

  if (itemType === 'summary') return;
  const table = TABLE[itemType];
  // The item may already be gone (deleted by the student); patching it would insert a stub row.
  const exists = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM ${table} WHERE id = ? AND deleted_at IS NULL`,
    itemId,
  );
  if (!exists) return;
  const effect = decisionEffect(decision);
  if (effect.deleteItem) {
    await softDelete(table, itemId);
  } else {
    await patch(table, itemId, { hidden: effect.hidden });
  }
}

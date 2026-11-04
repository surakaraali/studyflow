/** Study sessions (FR-TR-02): from the focus timer or added by hand (US-55). */

import { getDb } from '@/db/client';
import { newId } from '@/db/ids';
import { upsert } from '@/db/write';
import { MANUAL_SESSION_RANGE } from '@/domain/rules';
import { track } from '@/services/analytics';

export type SessionDraft = {
  courseId: string | null;
  topicId: string | null;
  planItemId: string | null;
  date: string;
  minutes: number;
  source: 'timer' | 'manual';
  startedAt: string | null;
  endedAt: string | null;
};

export async function addStudySession(draft: SessionDraft): Promise<string> {
  const id = newId();
  await upsert('study_sessions', {
    id,
    course_id: draft.courseId,
    topic_id: draft.topicId,
    plan_item_id: draft.planItemId,
    date: draft.date,
    minutes: Math.round(draft.minutes),
    source: draft.source,
    started_at: draft.startedAt,
    ended_at: draft.endedAt,
  });
  track('study_session_saved', { source: draft.source, minutes: Math.round(draft.minutes) });
  return id;
}

export type ManualSessionError = 'course' | 'minutes' | 'future';

/** US-55: course required, 5–240 minutes, today or earlier. */
export function validateManualSession(
  draft: { courseId: string | null; minutes: number; date: string },
  today: string,
): ManualSessionError | null {
  if (!draft.courseId) return 'course';
  if (
    !Number.isFinite(draft.minutes) ||
    draft.minutes < MANUAL_SESSION_RANGE.min ||
    draft.minutes > MANUAL_SESSION_RANGE.max
  ) {
    return 'minutes';
  }
  if (draft.date > today) return 'future';
  return null;
}

/**
 * Minutes studied on a day: every logged session, plus finished blocks that have no session
 * of their own (marked done without the timer).
 */
export async function minutesStudied(date: string): Promise<number> {
  const row = await getDb().getFirstAsync<{ sessions: number; blocks: number }>(
    `SELECT
       (SELECT COALESCE(SUM(minutes), 0) FROM study_sessions
        WHERE deleted_at IS NULL AND date = ?) AS sessions,
       (SELECT COALESCE(SUM(p.minutes), 0) FROM plan_items p
        WHERE p.deleted_at IS NULL AND p.status = 'done' AND p.date = ?
          AND NOT EXISTS (SELECT 1 FROM study_sessions s
                          WHERE s.plan_item_id = p.id AND s.deleted_at IS NULL)) AS blocks`,
    date,
    date,
  );
  return (row?.sessions ?? 0) + (row?.blocks ?? 0);
}

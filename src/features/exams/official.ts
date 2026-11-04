import { getDb, hasDb } from '@/db/client';
import { newId } from '@/db/ids';
import { patch, softDelete, upsert } from '@/db/write';
import type { TargetExam, Track } from '@/domain/rules';
import {
  officialExamsFor,
  planOfficialSync,
  type ExistingOfficialRow,
} from '@/features/exams/official-exams';
import { schedulePlanRegeneration } from '@/features/plan/regenerate';

let queue: Promise<void> = Promise.resolve();

/**
 * CONTRACT (owned by the exams feature): makes sure the official exam(s) for the target exam
 * exist as rows in `exams` (kind 'official') and removes the ones for another target.
 *
 * Idempotent and safe to call often: rows are matched by `official_key`, a second call
 * writes nothing. Calls run one after another so two callers never double-insert.
 * `track` defaults to the profile's track (YKS: AYT or YDT, see officialExamsFor).
 */
export async function syncOfficialExams(
  target: TargetExam | null,
  track?: Track | null,
): Promise<void> {
  const run = queue.then(() => sync(target, track));
  queue = run.catch(() => undefined);
  return run;
}

async function sync(target: TargetExam | null, trackArg: Track | null | undefined) {
  if (!hasDb()) return;
  const db = getDb();
  const track =
    trackArg !== undefined
      ? trackArg
      : ((await db.getFirstAsync<{ track: Track | null }>('SELECT track FROM profile LIMIT 1'))
          ?.track ?? null);

  const existing = await db.getAllAsync<ExistingOfficialRow>(
    `SELECT id, official_key, title, date, time, deleted_at, created_at
     FROM exams WHERE kind = 'official' AND official_key IS NOT NULL`,
  );
  const plan = planOfficialSync(officialExamsFor(target, track), existing);

  for (const def of plan.insert) {
    await upsert('exams', {
      id: newId(),
      course_id: null,
      kind: 'official',
      title: def.title,
      date: def.date,
      time: def.time,
      topic_ids: '[]',
      official_key: def.key,
      score: null,
    });
  }
  for (const { id, def } of plan.update) {
    await patch('exams', id, { title: def.title, date: def.date, time: def.time, deleted_at: null });
  }
  for (const id of plan.remove) await softDelete('exams', id);

  if (plan.insert.length + plan.update.length + plan.remove.length > 0) {
    schedulePlanRegeneration('exams');
  }
}

/**
 * Weekly school timetable (US-23). The plan engine reads these slots and never puts a
 * study block inside them (BR-09).
 */

import { getDb } from '@/db/client';
import { newId } from '@/db/ids';
import type { TimetableSlot } from '@/db/types';
import { patch, softDelete, upsert } from '@/db/write';
import { schedulePlanRegeneration } from '@/features/plan/regenerate';
import { sortRanges } from '@/features/timetable/ranges';

/** Slots of one weekday (1 = Monday … 7 = Sunday) or of the whole week, in time order. */
export async function listTimetable(weekday?: number): Promise<TimetableSlot[]> {
  const rows =
    weekday == null
      ? await getDb().getAllAsync<TimetableSlot>(
          'SELECT * FROM timetable_slots WHERE deleted_at IS NULL ORDER BY weekday, start_time',
        )
      : await getDb().getAllAsync<TimetableSlot>(
          'SELECT * FROM timetable_slots WHERE deleted_at IS NULL AND weekday = ? ORDER BY start_time',
          weekday,
        );
  return rows;
}

/** A slot being edited. `id` is set for slots that already exist. */
export type SlotDraft = {
  key: string;
  id?: string;
  course_id: string | null;
  start: string;
  end: string;
};

/**
 * Replaces the slots of every weekday in `days` with the drafts: changed rows are patched,
 * new ones inserted and missing ones soft-deleted. Validate the drafts first.
 */
export async function saveTimetable(days: Record<number, SlotDraft[]>) {
  const weekdays = Object.keys(days).map(Number);
  const current = await listTimetable();
  const byId = new Map(current.map((s) => [s.id, s]));
  const kept = new Set<string>();

  for (const weekday of weekdays) {
    for (const draft of sortRanges(days[weekday])) {
      const existing = draft.id ? byId.get(draft.id) : undefined;
      if (existing) {
        kept.add(existing.id);
        if (
          existing.weekday !== weekday ||
          existing.start_time !== draft.start ||
          existing.end_time !== draft.end ||
          existing.course_id !== draft.course_id
        ) {
          await patch('timetable_slots', existing.id, {
            weekday,
            start_time: draft.start,
            end_time: draft.end,
            course_id: draft.course_id,
          });
        }
      } else {
        await upsert('timetable_slots', {
          id: newId(),
          weekday,
          start_time: draft.start,
          end_time: draft.end,
          course_id: draft.course_id,
        });
      }
    }
  }

  for (const slot of current) {
    if (weekdays.includes(slot.weekday) && !kept.has(slot.id)) {
      await softDelete('timetable_slots', slot.id);
    }
  }
  schedulePlanRegeneration('timetable');
}

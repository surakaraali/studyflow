/**
 * When the student can study (US-47, FR-PL-01). Several ranges per day type are allowed.
 */

import { getDb } from '@/db/client';
import { newId } from '@/db/ids';
import type { AvailabilityRange, DayType } from '@/db/types';
import { softDelete, upsert } from '@/db/write';
import { segmentForGrade, type Segment } from '@/domain/rules';
import { defaultAvailability, type Availability } from '@/features/availability/defaults';
import { schedulePlanRegeneration } from '@/features/plan/regenerate';
import { sortRanges } from '@/features/timetable/ranges';

export { defaultAvailability, type Availability } from '@/features/availability/defaults';

export type AvailabilityResult = Availability & {
  /** True when the student has not saved anything yet and these are our suggestions. */
  isDefault: boolean;
};

export async function listAvailabilityRows(): Promise<AvailabilityRange[]> {
  return getDb().getAllAsync<AvailabilityRange>(
    'SELECT * FROM availability WHERE deleted_at IS NULL ORDER BY day_type, start_time',
  );
}

/** The profile's segment, for defaults. Falls back to ortaokul (the shorter day). */
async function profileSegment(): Promise<Segment> {
  const row = await getDb().getFirstAsync<{ segment: Segment | null; grade: number | null }>(
    'SELECT segment, grade FROM profile LIMIT 1',
  );
  if (row?.segment) return row.segment;
  if (row?.grade) return segmentForGrade(row.grade);
  return 'ortaokul';
}

/**
 * Study ranges for weekdays and weekends, sorted by start time.
 * Until the student saves their own, returns `defaultAvailability(segment)` with isDefault.
 * The plan engine reads this.
 */
export async function getAvailability(segment?: Segment): Promise<AvailabilityResult> {
  const rows = await listAvailabilityRows();
  if (rows.length === 0) {
    return { ...defaultAvailability(segment ?? (await profileSegment())), isDefault: true };
  }
  const pick = (type: DayType) =>
    sortRanges(rows.filter((r) => r.day_type === type).map((r) => ({ start: r.start_time, end: r.end_time })));
  return { weekday: pick('weekday'), weekend: pick('weekend'), isDefault: false };
}

/**
 * Replaces all ranges. Keep at least one range in total: an empty table means
 * "use the defaults". Validate the ranges first.
 */
export async function saveAvailability(value: Availability) {
  const current = await listAvailabilityRows();
  const remaining = [...current];

  for (const dayType of ['weekday', 'weekend'] as const) {
    for (const range of sortRanges(value[dayType])) {
      const index = remaining.findIndex(
        (r) => r.day_type === dayType && r.start_time === range.start && r.end_time === range.end,
      );
      if (index >= 0) {
        // Unchanged range: keep the row.
        remaining.splice(index, 1);
        continue;
      }
      await upsert('availability', {
        id: newId(),
        day_type: dayType,
        start_time: range.start,
        end_time: range.end,
      });
    }
  }

  for (const row of remaining) await softDelete('availability', row.id);
  schedulePlanRegeneration('availability');
}

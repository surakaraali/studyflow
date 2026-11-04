/**
 * Official exam dates (US-27, FR-EXM-02) and the pure logic that decides which rows
 * `syncOfficialExams` writes.
 *
 * In production these dates come from the admin-managed `official_exams` table
 * (FR-ADM-05, created by the backend), and a date change notifies the students who
 * picked that exam. Until that table exists this bundled copy is the source.
 *
 * ESTIMATES: MEB (LGS) and ÖSYM (YKS) announce the 2027 dates later. The dates below are
 * our mid-June guesses and every screen that shows them says so.
 */

import type { TargetExam, Track } from '@/domain/rules';

export type OfficialKey = 'LGS' | 'YKS-TYT' | 'YKS-AYT' | 'YKS-YDT';

export type OfficialExamDef = {
  key: OfficialKey;
  target: TargetExam;
  title: string;
  date: string;
  time: string;
  /** True until the official calendar is announced. */
  estimated: boolean;
};

export const OFFICIAL_EXAMS: readonly OfficialExamDef[] = [
  { key: 'LGS', target: 'LGS', title: 'LGS', date: '2027-06-12', time: '09:30', estimated: true },
  { key: 'YKS-TYT', target: 'YKS', title: 'YKS · TYT', date: '2027-06-19', time: '10:15', estimated: true },
  { key: 'YKS-AYT', target: 'YKS', title: 'YKS · AYT', date: '2027-06-20', time: '10:15', estimated: true },
  { key: 'YKS-YDT', target: 'YKS', title: 'YKS · YDT', date: '2027-06-20', time: '15:45', estimated: true },
];

export function officialExamDef(key: string | null | undefined): OfficialExamDef | undefined {
  return key ? OFFICIAL_EXAMS.find((d) => d.key === key) : undefined;
}

/** True when the row's date is still our estimate (show the "Tahmini tarih" note). */
export function isEstimatedOfficialDate(key: string | null | undefined): boolean {
  return officialExamDef(key)?.estimated ?? false;
}

/**
 * The sessions a student sits. YKS: TYT for everyone, AYT for the sayısal / eşit ağırlık /
 * sözel tracks and YDT for the dil track; without a track we keep all three.
 */
export function officialExamsFor(
  target: TargetExam | null | undefined,
  track: Track | null | undefined = null,
): OfficialExamDef[] {
  if (!target) return [];
  return OFFICIAL_EXAMS.filter((def) => {
    if (def.target !== target) return false;
    if (!track) return true;
    if (def.key === 'YKS-AYT') return track !== 'dil';
    if (def.key === 'YKS-YDT') return track === 'dil';
    return true;
  });
}

export type ExistingOfficialRow = {
  id: string;
  official_key: string | null;
  title: string;
  date: string;
  time: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type OfficialSyncPlan = {
  insert: OfficialExamDef[];
  /** Rows to bring in line with the table (also revives soft-deleted ones). */
  update: { id: string; def: OfficialExamDef }[];
  /** Row ids to soft-delete: other targets and duplicates. */
  remove: string[];
};

/**
 * Compares the wanted sessions with the official rows already on the device
 * (including soft-deleted ones, so a row keeps its id when the target flips back).
 * Running the plan twice in a row gives an empty second plan.
 */
export function planOfficialSync(
  wanted: readonly OfficialExamDef[],
  existing: readonly ExistingOfficialRow[],
): OfficialSyncPlan {
  const plan: OfficialSyncPlan = { insert: [], update: [], remove: [] };
  const wantedKeys = new Set(wanted.map((d) => d.key));

  // Group rows by key; the oldest live row wins, then the oldest deleted one.
  const byKey = new Map<string, ExistingOfficialRow[]>();
  for (const row of existing) {
    if (!row.official_key) continue;
    const list = byKey.get(row.official_key) ?? [];
    list.push(row);
    byKey.set(row.official_key, list);
  }
  for (const list of byKey.values()) {
    list.sort(
      (a, b) =>
        Number(a.deleted_at != null) - Number(b.deleted_at != null) ||
        a.created_at.localeCompare(b.created_at),
    );
  }

  for (const def of wanted) {
    const rows = byKey.get(def.key) ?? [];
    const [keep, ...rest] = rows;
    if (!keep) {
      plan.insert.push(def);
    } else if (
      keep.deleted_at != null ||
      keep.date !== def.date ||
      keep.time !== def.time ||
      keep.title !== def.title
    ) {
      plan.update.push({ id: keep.id, def });
    }
    for (const dup of rest) if (dup.deleted_at == null) plan.remove.push(dup.id);
  }

  for (const [key, rows] of byKey) {
    if (wantedKeys.has(key as OfficialKey)) continue;
    for (const row of rows) if (row.deleted_at == null) plan.remove.push(row.id);
  }

  return plan;
}

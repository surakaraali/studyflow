import {
  isEstimatedOfficialDate,
  OFFICIAL_EXAMS,
  officialExamDef,
  officialExamsFor,
  planOfficialSync,
  type ExistingOfficialRow,
  type OfficialExamDef,
} from '../official-exams';

const keys = (defs: readonly OfficialExamDef[]) => defs.map((d) => d.key);

function row(key: string, overrides: Partial<ExistingOfficialRow> = {}): ExistingOfficialRow {
  const def = officialExamDef(key);
  return {
    id: `id-${key}`,
    official_key: key,
    title: def?.title ?? key,
    date: def?.date ?? '2027-06-01',
    time: def?.time ?? null,
    deleted_at: null,
    created_at: '2026-11-01T10:00:00.000Z',
    ...overrides,
  };
}

/** Applies a plan to rows, like syncOfficialExams does, to check idempotency. */
function apply(rows: ExistingOfficialRow[], plan: ReturnType<typeof planOfficialSync>) {
  const next = rows.map((r) => ({ ...r }));
  for (const { id, def } of plan.update) {
    Object.assign(next.find((r) => r.id === id)!, { date: def.date, time: def.time, title: def.title, deleted_at: null });
  }
  for (const id of plan.remove) next.find((r) => r.id === id)!.deleted_at = '2026-11-04T00:00:00.000Z';
  for (const def of plan.insert) next.push(row(def.key, { id: `new-${def.key}`, created_at: '2026-11-04T00:00:00.000Z' }));
  return next;
}

describe('US-27 official exams', () => {
  it('has the four sessions with estimated mid-June 2027 dates', () => {
    expect(keys(OFFICIAL_EXAMS)).toEqual(['LGS', 'YKS-TYT', 'YKS-AYT', 'YKS-YDT']);
    expect(officialExamDef('LGS')?.date).toBe('2027-06-12');
    expect(officialExamDef('YKS-TYT')?.date).toBe('2027-06-19');
    expect(officialExamDef('YKS-AYT')?.date).toBe('2027-06-20');
    expect(officialExamDef('YKS-YDT')?.date).toBe('2027-06-20');
    for (const def of OFFICIAL_EXAMS) expect(isEstimatedOfficialDate(def.key)).toBe(true);
    expect(isEstimatedOfficialDate(null)).toBe(false);
  });

  it('picks the sessions for the target and track', () => {
    expect(keys(officialExamsFor(null))).toEqual([]);
    expect(keys(officialExamsFor('LGS'))).toEqual(['LGS']);
    expect(keys(officialExamsFor('YKS'))).toEqual(['YKS-TYT', 'YKS-AYT', 'YKS-YDT']);
    expect(keys(officialExamsFor('YKS', 'sayisal'))).toEqual(['YKS-TYT', 'YKS-AYT']);
    expect(keys(officialExamsFor('YKS', 'sozel'))).toEqual(['YKS-TYT', 'YKS-AYT']);
    expect(keys(officialExamsFor('YKS', 'dil'))).toEqual(['YKS-TYT', 'YKS-YDT']);
  });

  it('inserts the missing sessions', () => {
    const plan = planOfficialSync(officialExamsFor('LGS'), []);
    expect(keys(plan.insert)).toEqual(['LGS']);
    expect(plan.update).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it('is idempotent', () => {
    const wanted = officialExamsFor('YKS', 'esit');
    const first = planOfficialSync(wanted, []);
    const rows = apply([], first);
    expect(planOfficialSync(wanted, rows)).toEqual({ insert: [], update: [], remove: [] });
  });

  it('removes the other target when the target changes', () => {
    const plan = planOfficialSync(officialExamsFor('YKS', 'sayisal'), [row('LGS')]);
    expect(keys(plan.insert)).toEqual(['YKS-TYT', 'YKS-AYT']);
    expect(plan.remove).toEqual(['id-LGS']);
  });

  it('removes everything when there is no target', () => {
    const plan = planOfficialSync([], [row('YKS-TYT'), row('YKS-AYT'), row('LGS', { deleted_at: 'x' })]);
    expect(plan.remove.sort()).toEqual(['id-YKS-AYT', 'id-YKS-TYT']);
    expect(plan.insert).toEqual([]);
  });

  it('revives a soft-deleted row instead of inserting a new one', () => {
    const plan = planOfficialSync(officialExamsFor('LGS'), [row('LGS', { deleted_at: '2026-11-02' })]);
    expect(plan.insert).toEqual([]);
    expect(plan.update).toEqual([{ id: 'id-LGS', def: officialExamDef('LGS') }]);
  });

  it('updates a row whose date changed in the table', () => {
    const plan = planOfficialSync(officialExamsFor('LGS'), [row('LGS', { date: '2027-06-05' })]);
    expect(plan.update.map((u) => u.id)).toEqual(['id-LGS']);
  });

  it('keeps the oldest live row and removes duplicates', () => {
    const plan = planOfficialSync(officialExamsFor('LGS'), [
      row('LGS', { id: 'newer', created_at: '2026-11-03T00:00:00.000Z' }),
      row('LGS', { id: 'older', created_at: '2026-11-01T00:00:00.000Z' }),
      row('LGS', { id: 'deleted', created_at: '2026-10-01T00:00:00.000Z', deleted_at: 'x' }),
    ]);
    expect(plan.insert).toEqual([]);
    expect(plan.update).toEqual([]);
    expect(plan.remove).toEqual(['newer']);
  });

  it('switches YKS sessions when the track changes', () => {
    const rows = [row('YKS-TYT'), row('YKS-AYT')];
    const plan = planOfficialSync(officialExamsFor('YKS', 'dil'), rows);
    expect(keys(plan.insert)).toEqual(['YKS-YDT']);
    expect(plan.remove).toEqual(['id-YKS-AYT']);
  });
});

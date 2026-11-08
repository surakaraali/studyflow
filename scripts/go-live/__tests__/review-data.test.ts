import type { SyncedTable } from '@/db/schema';
import type { Row } from '@/services/sync/types';

import { istanbulDay, prepareReviewRows, REVIEW_AGE, shiftDate } from '../review-data';

const NOW = new Date('2027-03-20T09:00:00Z');
const USER = '11111111-1111-4111-8111-111111111111';

function source(): Map<SyncedTable, Row[]> {
  return new Map<SyncedTable, Row[]>([
    [
      'profile',
      [{ id: 'device-user', email: 'demo-full@studyflow.local', birth_year: 2010, grade: 11, parent_email: 'veli@ornek.com', ai_notice_accepted_at: '2026-11-04T12:00:00.000Z', created_at: '2026-11-04T12:13:31.383Z', updated_at: '2026-11-04T12:20:00.000Z' }],
    ],
    ['consent_records', [{ id: 'c1', action: 'granted', created_at: '2026-11-04T12:13:31.383Z' }]],
    [
      'study_sessions',
      [
        { id: 's1', date: '2026-11-03', started_at: '2026-11-03T17:00:00', created_at: '2026-11-04T12:14:00.000Z', updated_at: '2026-11-04T12:14:00.000Z', deleted_at: null },
        { id: 's2', date: '2026-10-22', started_at: '2026-10-22T17:00:00', created_at: '2026-11-04T12:14:00.000Z', updated_at: '2026-11-04T12:14:00.000Z', deleted_at: null },
        { id: 'gone', date: '2026-11-03', deleted_at: '2026-11-04T13:00:00.000Z', created_at: '2026-11-04T12:14:00.000Z', updated_at: '2026-11-04T13:00:00.000Z' },
      ],
    ],
    [
      'exams',
      [
        { id: 'e1', date: '2026-11-08', official_key: null, created_at: '2026-11-04T12:14:00.000Z', updated_at: '2026-11-04T12:14:00.000Z' },
        { id: 'lgs', date: '2027-06-12', official_key: 'LGS', created_at: '2026-11-04T12:14:00.000Z', updated_at: '2026-11-04T12:14:00.000Z' },
      ],
    ],
    ['documents', [{ id: 'd1', storage_path: 'x/y.pdf', quota_month: '2026-11', created_at: '2026-11-04T12:14:00.000Z', updated_at: '2026-11-04T12:14:00.000Z' }]],
    ['feedback', [{ id: 'f1', created_at: '2026-11-04T12:14:00.000Z', updated_at: '2026-11-04T12:14:00.000Z' }]],
  ]);
}

describe('review account data', () => {
  const rows = prepareReviewRows(source(), { userId: USER, now: NOW });

  it('moves the history so it ends yesterday', () => {
    expect(istanbulDay(NOW)).toBe('2027-03-20');
    expect(rows.lastStudyDay).toBe('2027-03-19');
    const sessions = rows.tables.get('study_sessions')!;
    expect(sessions.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(sessions[0]).toMatchObject({ date: '2027-03-19', started_at: '2027-03-19T17:00:00' });
    expect(sessions[1].date).toBe(shiftDate('2026-10-22', rows.shiftDays));
  });

  it('keeps exams ahead and official exam dates fixed', () => {
    const exams = new Map(rows.tables.get('exams')!.map((e) => [e.id, e]));
    expect(exams.get('e1')!.date).toBe('2027-03-24');
    expect(exams.get('lgs')!.date).toBe('2027-06-12');
  });

  it('makes an adult account without parent data', () => {
    const profile = rows.tables.get('profile')![0];
    expect(profile).toMatchObject({ id: USER, birth_year: 2027 - REVIEW_AGE, grade: 12, parent_email: null, ai_notice_accepted_at: null });
    expect(rows.tables.has('consent_records')).toBe(false);
    expect(rows.tables.has('feedback')).toBe(false);
  });

  it('never puts past events in the future and refreshes updated_at', () => {
    for (const table of rows.tables.values()) {
      for (const row of table) {
        expect(row.updated_at).toBe(NOW.toISOString());
        if (typeof row.created_at === 'string') expect(Date.parse(row.created_at)).toBeLessThanOrEqual(NOW.getTime());
      }
    }
  });

  it('detaches the sample document from storage and this month counts', () => {
    expect(rows.tables.get('documents')![0]).toMatchObject({ storage_path: null, quota_month: '2027-03' });
  });
});

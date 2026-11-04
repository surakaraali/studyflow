import type { Course, DocumentRow, Profile } from '@/db/types';

import { buildAiRequest } from '../request';

/** A profile full of personal data that must never reach the AI provider (BR-05, PRIV-02). */
const profile: Profile = {
  id: '7d1f3c2a-5b6e-4f80-9a1b-2c3d4e5f6a7b',
  email: 'ayse.yilmaz@example.com',
  nickname: 'Ayşecik',
  birth_year: 2012,
  grade: 8,
  segment: 'ortaokul',
  track: null,
  target_exam: 'LGS',
  daily_goal_min: 60,
  block_min: 25,
  break_min: 5,
  daily_cap_override: null,
  bedtime: '22:00',
  wake_time: '07:00',
  consent_status: 'granted',
  parent_email: 'veli.yilmaz@example.com',
  ai_notice_accepted_at: '2026-11-01T10:00:00.000Z',
  onboarding_done: 1,
  plan: 'free',
  notif_plan: 1,
  notif_exam: 1,
  notif_homework: 1,
  notif_ai: 1,
  notif_permission_asked: 1,
  waitlist_parent_email: 'bekleme@example.com',
  created_at: '2026-10-01T10:00:00.000Z',
  updated_at: '2026-10-01T10:00:00.000Z',
};

const doc = {
  id: 'f0e1d2c3-b4a5-4697-8879-6a5b4c3d2e1f',
  title: 'Ayşe Yılmaz - Atatürk Ortaokulu fen notları',
  file_uri: 'file:///var/mobile/Containers/Data/Application/ABC/Documents/documents/7d1f/f0e1.pdf',
  page_from: 3,
  page_to: 12,
} as DocumentRow;

const course = { id: 'c1', name: 'Fen Bilimleri' } as Course;

describe('buildAiRequest (US-32: no personal data)', () => {
  const request = buildAiRequest(doc, profile, course, 'JVBERi0xLjcK');
  const serialized = JSON.stringify(request);

  it('contains only the allowed fields', () => {
    expect(Object.keys(request).sort()).toEqual(
      ['cardCount', 'courseName', 'grade', 'optionCount', 'pageCount', 'pdf', 'quizCount', 'segment'].sort(),
    );
  });

  it('sends the document, grade level and course name', () => {
    expect(request).toMatchObject({
      pdf: 'JVBERi0xLjcK',
      grade: 8,
      segment: 'ortaokul',
      courseName: 'Fen Bilimleri',
      optionCount: 4,
      quizCount: 10,
      cardCount: 15,
      pageCount: 10,
    });
  });

  it.each([
    ['e-mail', profile.email!],
    ['nickname', profile.nickname!],
    ['birth year', String(profile.birth_year)],
    ['parent e-mail', profile.parent_email!],
    ['waitlist parent e-mail', profile.waitlist_parent_email!],
    ['user id', profile.id],
    ['document id', doc.id],
    ['document title (may hold a name or school)', doc.title],
    ['local file path (device details)', doc.file_uri!],
    ['bedtime', profile.bedtime!],
  ])('does not contain the %s', (_label, value) => {
    expect(serialized).not.toContain(value);
  });

  it('has no e-mail address or device fields at all', () => {
    expect(serialized).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(serialized).not.toMatch(/"(deviceId|deviceName|platform|osVersion|model|userId|email|name|school)"/i);
  });

  it('uses the segment option count (BR-12)', () => {
    expect(buildAiRequest(doc, { ...profile, grade: 10, segment: 'lise' }, course, 'x').optionCount).toBe(5);
    expect(buildAiRequest(doc, { ...profile, grade: 10, segment: null }, course, 'x').segment).toBe('lise');
  });

  it('needs a grade', () => {
    expect(() => buildAiRequest(doc, { ...profile, grade: null }, course, 'x')).toThrow();
  });
});

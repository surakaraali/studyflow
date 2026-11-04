/**
 * Suggested courses by grade (US-21, FR-CRS-01).
 *
 * Source: MEB weekly course schedules (haftalık ders çizelgeleri) for ortaokul (5–8) and
 * Anadolu lisesi (9–12). Elective courses are left out; students add them as custom courses.
 * AWAITING APPROVAL: the education advisor still has to approve this list (backlog US-21).
 *
 * Names are stored as the course name, so they stay in Turkish here (MEB data, not UI copy).
 */

import type { Track } from '@/domain/rules';

export type CatalogCourse = {
  /** Stable id, saved in `courses.catalog_key`. */
  key: string;
  name: string;
  grades: readonly number[];
  /** Only for the grades in `trackGrades`: the course is shown for these tracks only. */
  tracks?: readonly Track[];
  /** Grades where the track filter applies (default 11 and 12). */
  trackGrades?: readonly number[];
};

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

const ORTAOKUL = range(5, 8);
const LISE = range(9, 12);
const ALL = range(5, 12);

/** Listed in the order of the MEB schedule: core courses first. */
export const COURSE_CATALOG: readonly CatalogCourse[] = [
  // Ortaokul and lise
  { key: 'turkce', name: 'Türkçe', grades: ORTAOKUL },
  { key: 'edebiyat', name: 'Türk Dili ve Edebiyatı', grades: LISE },
  { key: 'matematik', name: 'Matematik', grades: ALL, tracks: ['sayisal', 'esit'] },
  { key: 'fen', name: 'Fen Bilimleri', grades: ORTAOKUL },
  { key: 'fizik', name: 'Fizik', grades: LISE, tracks: ['sayisal'] },
  { key: 'kimya', name: 'Kimya', grades: LISE, tracks: ['sayisal'] },
  { key: 'biyoloji', name: 'Biyoloji', grades: LISE, tracks: ['sayisal'] },
  { key: 'sosyal', name: 'Sosyal Bilgiler', grades: range(5, 7) },
  { key: 'inkilap', name: 'T.C. İnkılap Tarihi ve Atatürkçülük', grades: [8, 12] },
  // Tarih is compulsory in 9–11; in 12 it is a field course for eşit ağırlık and sözel.
  { key: 'tarih', name: 'Tarih', grades: LISE, tracks: ['esit', 'sozel'], trackGrades: [12] },
  { key: 'cografya', name: 'Coğrafya', grades: LISE, tracks: ['esit', 'sozel'] },
  { key: 'felsefe', name: 'Felsefe', grades: [10, 11] },
  { key: 'psikoloji', name: 'Psikoloji', grades: [11, 12], tracks: ['sozel'] },
  { key: 'sosyoloji', name: 'Sosyoloji', grades: [11, 12], tracks: ['sozel'] },
  { key: 'mantik', name: 'Mantık', grades: [11, 12], tracks: ['sozel'] },
  { key: 'ingilizce', name: 'İngilizce', grades: ALL },
  { key: 'ikinci-dil', name: 'İkinci Yabancı Dil', grades: LISE },
  { key: 'din', name: 'Din Kültürü ve Ahlak Bilgisi', grades: ALL },
  { key: 'bilisim', name: 'Bilişim Teknolojileri ve Yazılım', grades: [5, 6] },
  { key: 'teknoloji', name: 'Teknoloji ve Tasarım', grades: [7, 8] },
  { key: 'saglik', name: 'Sağlık Bilgisi ve Trafik Kültürü', grades: [9] },
  { key: 'gorsel', name: 'Görsel Sanatlar', grades: ALL },
  { key: 'muzik', name: 'Müzik', grades: ALL },
  { key: 'beden', name: 'Beden Eğitimi ve Spor', grades: ALL },
];

const DEFAULT_TRACK_GRADES = [11, 12] as const;

/**
 * Courses to suggest for a grade. In grades 11–12 a track narrows the field courses;
 * without a track every course of the grade is suggested.
 */
export function suggestedCourses(
  grade: number | null | undefined,
  track: Track | null | undefined,
  catalog: readonly CatalogCourse[] = COURSE_CATALOG,
): CatalogCourse[] {
  if (grade == null) return [];
  return catalog.filter((course) => {
    if (!course.grades.includes(grade)) return false;
    if (!course.tracks || !track) return true;
    const trackGrades = course.trackGrades ?? DEFAULT_TRACK_GRADES;
    if (!trackGrades.includes(grade)) return true;
    return course.tracks.includes(track);
  });
}

/** True when the grade has a track choice (lise 11–12). */
export function gradeHasTracks(grade: number | null | undefined): boolean {
  return grade === 11 || grade === 12;
}

export function catalogCourse(key: string | null | undefined): CatalogCourse | undefined {
  return key ? COURSE_CATALOG.find((c) => c.key === key) : undefined;
}

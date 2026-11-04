import type { Course, DocumentRow, Profile } from '@/db/types';
import { quizOptionCount, segmentForGrade } from '@/domain/rules';

import { CARD_COUNT, QUIZ_QUESTION_COUNT, type AiRequest } from './types';

/**
 * Builds the AI request for a document (BR-05). Only the PDF, the grade level and the course
 * name leave the device, plus the counts the server needs. Never add profile fields such as
 * name, e-mail, school, birth year, parent e-mail, ids or device details: the PII test in
 * __tests__/request.test.ts guards this.
 */
export function buildAiRequest(
  doc: Pick<DocumentRow, 'page_from' | 'page_to'>,
  profile: Pick<Profile, 'grade' | 'segment'>,
  course: Pick<Course, 'name'> | null,
  pdfBase64: string,
): AiRequest {
  if (profile.grade == null) throw new Error('Grade is required for AI requests');
  const segment = profile.segment ?? segmentForGrade(profile.grade);

  return {
    pdf: pdfBase64,
    grade: profile.grade,
    segment,
    courseName: course?.name.trim().slice(0, 80) ?? '',
    optionCount: quizOptionCount(segment),
    quizCount: QUIZ_QUESTION_COUNT,
    cardCount: CARD_COUNT,
    pageCount: Math.max(1, doc.page_to - doc.page_from + 1),
  };
}

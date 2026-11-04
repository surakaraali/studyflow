import type { ProcessInput, Segment } from '../supabase/functions/_shared/ai/types.ts';

const SEGMENTS: readonly Segment[] = ['ilkokul', 'ortaokul', 'lise'];

/** Base64 of a 25 MB PDF is ≈ 33.4 MB; anything bigger is not from the app. */
export const MAX_PDF_BASE64_CHARS = 34 * 1024 * 1024;

function int(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

/**
 * Validates the JSON body of POST /v1/process. Unknown fields are ignored (and never logged).
 * Returns the input, or an error message for a 400 answer.
 */
export function parseProcessRequest(body: unknown): { input: ProcessInput } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Body must be a JSON object.' };
  const b = body as Record<string, unknown>;

  if (typeof b.pdf !== 'string' || b.pdf.length === 0) return { error: 'pdf (base64) is required.' };
  if (b.pdf.length > MAX_PDF_BASE64_CHARS) return { error: 'pdf is larger than 25 MB.' };

  const grade = int(b.grade, 1, 12);
  if (grade == null) return { error: 'grade must be 1–12.' };
  if (!SEGMENTS.includes(b.segment as Segment)) return { error: 'segment must be ilkokul, ortaokul or lise.' };
  if (typeof b.courseName !== 'string') return { error: 'courseName is required.' };

  const optionCount = int(b.optionCount, 3, 5);
  const quizCount = int(b.quizCount, 1, 30);
  const cardCount = int(b.cardCount, 1, 40);
  const pageCount = int(b.pageCount, 1, 600);
  if (optionCount == null) return { error: 'optionCount must be 3–5.' };
  if (quizCount == null) return { error: 'quizCount must be 1–30.' };
  if (cardCount == null) return { error: 'cardCount must be 1–40.' };
  if (pageCount == null) return { error: 'pageCount must be 1–600.' };

  return {
    input: {
      pdf: b.pdf,
      grade,
      segment: b.segment as Segment,
      courseName: b.courseName.slice(0, 80),
      optionCount,
      quizCount,
      cardCount,
      pageCount,
    },
  };
}

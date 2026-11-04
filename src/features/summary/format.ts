/**
 * Formatting helpers for the AI summary (US-33). Pure functions.
 */

/** [3, 4, 5, 8] → "3–5, 8". Unsorted or repeated pages are fine. */
export function formatPageList(pages: readonly number[]): string {
  const sorted = [...new Set(pages.filter((p) => Number.isInteger(p) && p > 0))].sort((a, b) => a - b);
  const parts: string[] = [];
  let start: number | null = null;
  let prev: number | null = null;

  for (const page of sorted) {
    if (start === null) {
      start = page;
    } else if (prev !== null && page !== prev + 1) {
      parts.push(start === prev ? `${start}` : `${start}–${prev}`);
      start = page;
    }
    prev = page;
  }
  if (start !== null && prev !== null) parts.push(start === prev ? `${start}` : `${start}–${prev}`);
  return parts.join(', ');
}

export type TextPiece = { text: string; term: boolean };

/**
 * Splits a paragraph so key terms can be drawn with the highlighter. Matching ignores case
 * (Turkish rules) and prefers the longest term when two overlap.
 */
export function splitByTerms(text: string, terms: readonly string[]): TextPiece[] {
  const lower = text.toLocaleLowerCase('tr-TR');
  const needles = [...new Set(terms.map((t) => t.trim().toLocaleLowerCase('tr-TR')).filter((t) => t.length > 1))].sort(
    (a, b) => b.length - a.length,
  );
  // Lowercasing can change the length (e.g. "İ"); only highlight when positions stay aligned.
  if (needles.length === 0 || lower.length !== text.length) return [{ text, term: false }];

  const pieces: TextPiece[] = [];
  let index = 0;
  let plainStart = 0;

  while (index < text.length) {
    const match = needles.find((needle) => lower.startsWith(needle, index));
    if (match) {
      if (plainStart < index) pieces.push({ text: text.slice(plainStart, index), term: false });
      pieces.push({ text: text.slice(index, index + match.length), term: true });
      index += match.length;
      plainStart = index;
    } else {
      index += 1;
    }
  }
  if (plainStart < text.length) pieces.push({ text: text.slice(plainStart), term: false });
  return pieces;
}

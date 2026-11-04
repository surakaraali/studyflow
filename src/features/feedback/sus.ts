/**
 * System Usability Scale (US-70 beta). Ten statements answered on a 1–5 scale.
 * Odd items are positive, even items negative; the score runs from 0 to 100.
 */

export const SUS_ITEM_COUNT = 10;

export const SUS_ITEMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type SusItem = (typeof SUS_ITEMS)[number];

export const SUS_SCALE = [1, 2, 3, 4, 5] as const;
export type SusAnswer = (typeof SUS_SCALE)[number];

function isAnswer(value: unknown): value is SusAnswer {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

/** True when all ten items have an answer between 1 and 5. */
export function isSusComplete(answers: readonly (number | null | undefined)[]): boolean {
  return answers.length === SUS_ITEM_COUNT && answers.every(isAnswer);
}

/**
 * Standard SUS scoring: odd items contribute (answer − 1), even items (5 − answer);
 * the sum times 2.5. Returns null unless all ten answers are valid.
 */
export function susScore(answers: readonly (number | null | undefined)[]): number | null {
  if (!isSusComplete(answers)) return null;
  const sum = answers.reduce<number>((total, answer, index) => {
    const value = answer as SusAnswer;
    return total + (index % 2 === 0 ? value - 1 : 5 - value);
  }, 0);
  return sum * 2.5;
}

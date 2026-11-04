/**
 * Course colors (US-21, US-22).
 *
 * Twelve mid-tone colors that keep at least 3:1 contrast on both the light and the dark
 * paper, so a course dot reads in either theme. They stay clear of the exam pink, the
 * highlighter yellow, the pen blue and the success green, which already mean something.
 * The order spreads hues, so the first few courses look clearly different.
 */

export const COURSE_COLORS = [
  { key: 'sky', hex: '#2A86D1' },
  { key: 'vermilion', hex: '#E0562A' },
  { key: 'grass', hex: '#5E9C1E' },
  { key: 'violet', hex: '#9157D6' },
  { key: 'amber', hex: '#C27400' },
  { key: 'teal', hex: '#14989E' },
  { key: 'orchid', hex: '#BF4FA8' },
  { key: 'brown', hex: '#99673A' },
  { key: 'mustard', hex: '#9A8700' },
  { key: 'slate', hex: '#62708A' },
  { key: 'olive', hex: '#6F7F3A' },
  { key: 'rose', hex: '#A65E6E' },
] as const;

export type CourseColorKey = (typeof COURSE_COLORS)[number]['key'];

const normalize = (hex: string) => hex.trim().toUpperCase();

/** The palette color used by the fewest courses; ties go to the earlier color. */
export function pickCourseColor(usedColors: readonly string[]): string {
  return assignCourseColors(1, usedColors)[0];
}

/** Colors for `count` new courses, each one picked after the previous was taken. */
export function assignCourseColors(count: number, usedColors: readonly string[]): string[] {
  const uses = new Map<string, number>(COURSE_COLORS.map((c) => [c.hex, 0]));
  for (const color of usedColors) {
    const hex = normalize(color);
    if (uses.has(hex)) uses.set(hex, (uses.get(hex) ?? 0) + 1);
  }

  const picked: string[] = [];
  for (let i = 0; i < count; i++) {
    let best: string = COURSE_COLORS[0].hex;
    let bestUses = Number.POSITIVE_INFINITY;
    for (const { hex } of COURSE_COLORS) {
      const n = uses.get(hex) ?? 0;
      if (n < bestUses) {
        best = hex;
        bestUses = n;
      }
    }
    picked.push(best);
    uses.set(best, bestUses + 1);
  }
  return picked;
}

/** Palette key for a stored color, used for the color's spoken name. */
export function courseColorKey(hex: string): CourseColorKey | undefined {
  const value = normalize(hex);
  return COURSE_COLORS.find((c) => c.hex === value)?.key;
}

import { Colors } from '@/constants/theme';

import { assignCourseColors, COURSE_COLORS, courseColorKey, pickCourseColor } from '../colors';

const channel = (hex: string, i: number) => {
  const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) =>
  0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('course colors', () => {
  it('has about a dozen unique colors', () => {
    const hexes = COURSE_COLORS.map((c) => c.hex);
    expect(hexes.length).toBeGreaterThanOrEqual(10);
    expect(new Set(hexes).size).toBe(hexes.length);
  });

  it('never reuses the colors that already mean something', () => {
    const reserved = [
      Colors.light.exam,
      Colors.dark.exam,
      Colors.light.highlight,
      Colors.dark.highlight,
      Colors.light.pen,
      Colors.dark.pen,
      Colors.light.success,
    ].map((c) => c.toUpperCase());
    for (const { hex } of COURSE_COLORS) expect(reserved).not.toContain(hex);
  });

  it.each(COURSE_COLORS.map((c) => [c.key, c.hex]))(
    '%s reads on light and dark paper (≥ 3:1)',
    (_key, hex) => {
      for (const scheme of ['light', 'dark'] as const) {
        expect(contrast(hex, Colors[scheme].paper)).toBeGreaterThanOrEqual(3);
        expect(contrast(hex, Colors[scheme].surface)).toBeGreaterThanOrEqual(3);
      }
    },
  );

  it('starts with the first palette color', () => {
    expect(pickCourseColor([])).toBe(COURSE_COLORS[0].hex);
  });

  it('picks the least-used color', () => {
    const [first, second, third] = COURSE_COLORS.map((c) => c.hex);
    expect(pickCourseColor([first])).toBe(second);
    expect(pickCourseColor([first, second])).toBe(third);
    // Every color used once, the first one twice: the second is now least used.
    const all = COURSE_COLORS.map((c) => c.hex);
    expect(pickCourseColor([...all, first])).toBe(second);
  });

  it('ignores case and colors outside the palette', () => {
    const [first, second] = COURSE_COLORS.map((c) => c.hex);
    expect(pickCourseColor([first.toLowerCase(), '#123456'])).toBe(second);
  });

  it('gives different colors to a batch of new courses', () => {
    const batch = assignCourseColors(COURSE_COLORS.length, []);
    expect(new Set(batch).size).toBe(COURSE_COLORS.length);
  });

  it('wraps around after the whole palette is used', () => {
    const batch = assignCourseColors(COURSE_COLORS.length + 2, []);
    expect(batch[COURSE_COLORS.length]).toBe(COURSE_COLORS[0].hex);
    expect(batch[COURSE_COLORS.length + 1]).toBe(COURSE_COLORS[1].hex);
  });

  it('continues after the colors already in use', () => {
    const used = [COURSE_COLORS[0].hex, COURSE_COLORS[2].hex];
    expect(assignCourseColors(2, used)).toEqual([COURSE_COLORS[1].hex, COURSE_COLORS[3].hex]);
  });

  it('finds the key of a stored color', () => {
    expect(courseColorKey(COURSE_COLORS[3].hex.toLowerCase())).toBe(COURSE_COLORS[3].key);
    expect(courseColorKey('#000000')).toBeUndefined();
  });
});

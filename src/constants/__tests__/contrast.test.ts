/**
 * NFR ACC-01: text colors meet WCAG 2.2 AA (4.5:1) on every background they are used on,
 * in both themes. `inkFaint` is for decorative strokes only, so it is not checked.
 */
import { Colors, type ColorName, type ThemeColors } from '@/constants/theme';

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const BACKGROUNDS: ColorName[] = ['paper', 'surface', 'sunken'];
const TEXT_ON_BACKGROUNDS: ColorName[] = ['ink', 'inkSoft', 'pen', 'exam', 'success'];
const TEXT_ON_FILL: [ColorName, ColorName][] = [
  ['onPen', 'pen'],
  ['onHighlight', 'highlight'],
];

describe.each(['light', 'dark'] as const)('%s theme contrast', (scheme) => {
  const colors: ThemeColors = Colors[scheme];

  it.each(TEXT_ON_BACKGROUNDS.flatMap((text) => BACKGROUNDS.map((bg) => [text, bg] as const)))(
    '%s on %s is at least 4.5:1',
    (text, bg) => {
      expect(contrast(colors[text], colors[bg])).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(TEXT_ON_FILL)('%s on %s is at least 4.5:1', (text, fill) => {
    expect(contrast(colors[text], colors[fill])).toBeGreaterThanOrEqual(4.5);
  });
});

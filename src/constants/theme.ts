/**
 * StudyFlow design tokens.
 *
 * The palette comes from a student's desk: cool paper, blue ballpoint ink,
 * highlighter yellow, and the pink-red ink of an exam answer sheet (optik form).
 */

import { Platform, type TextStyle } from 'react-native';

export type ThemeColors = {
  /** Screen background */
  paper: string;
  /** Raised blocks such as today's plan */
  surface: string;
  /** Pressed states, inputs */
  sunken: string;
  /** Hairline borders */
  line: string;
  /** Primary text */
  ink: string;
  /** Secondary text */
  inkSoft: string;
  /** Decorative strokes only, not for text that must be read */
  inkFaint: string;
  /** Primary action color (ballpoint blue) */
  pen: string;
  /** Text and icons on top of `pen` */
  onPen: string;
  /** Highlighter yellow: today, current selection */
  highlight: string;
  /** Text on top of `highlight` */
  onHighlight: string;
  /** Exams and deadlines; also the optik bubble outline */
  exam: string;
  success: string;
};

export const Colors: Record<'light' | 'dark', ThemeColors> = {
  light: {
    paper: '#F4F6FB',
    surface: '#FFFFFF',
    sunken: '#E9EDF6',
    line: '#D9DFEC',
    ink: '#161C3A',
    inkSoft: '#5A6282',
    inkFaint: '#8C93AE',
    pen: '#2A3FD1',
    onPen: '#FFFFFF',
    highlight: '#FFE650',
    onHighlight: '#161C3A',
    exam: '#C92A63',
    success: '#1F9D6B',
  },
  dark: {
    paper: '#0E1226',
    surface: '#171C36',
    sunken: '#1F2545',
    line: '#2A3157',
    ink: '#EDF0FA',
    inkSoft: '#A3AACB',
    inkFaint: '#6E76A0',
    pen: '#8C9BFF',
    onPen: '#0E1226',
    highlight: '#F5DC3C',
    onHighlight: '#161C3A',
    exam: '#FF6B98',
    success: '#3CCB8F',
  },
};

export type ColorName = keyof ThemeColors;

/** Headlines use Literata (a book serif); everything else uses the platform font. */
export const Fonts = {
  display: 'Literata_600SemiBold',
  displayBold: 'Literata_700Bold',
} as const;

export const Type = {
  display: { fontFamily: Fonts.display, fontSize: 34, lineHeight: 41, letterSpacing: -0.4 },
  title: { fontFamily: Fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 24 },
  callout: { fontSize: 15, lineHeight: 21 },
  footnote: { fontSize: 13, lineHeight: 18 },
  bubble: { fontSize: 12, lineHeight: 14, fontWeight: '700' },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof Type;

export const Space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Horizontal page margin */
export const Gutter = 20;

export const Radius = {
  sm: 8,
  md: 14,
  lg: 20,
} as const;

/** Extra bottom padding so content clears the tab bar where the system does not add it. */
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;

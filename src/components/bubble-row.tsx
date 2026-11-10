import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { HighlightMark } from '@/components/highlight-mark';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const BUBBLE_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

const SIZES = {
  small: { bubble: 24, letter: 11, gap: Space.sm },
  regular: { bubble: 26, letter: 11, gap: Space.sm },
  large: { bubble: 44, letter: 16, gap: Space.md },
} as const;

type BubbleProps = {
  letter: string;
  filled?: boolean;
  size?: keyof typeof SIZES;
};

/**
 * One answer-sheet (optik form) bubble. Empty: a soft pink ring with the letter in exam ink.
 * Filled: ballpoint blue. Decorative for screen readers; the row around it says the state.
 */
export function Bubble({ letter, filled = false, size = 'regular' }: BubbleProps) {
  const { colors } = useTheme();
  const dims = SIZES[size];

  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        styles.bubble,
        {
          width: dims.bubble,
          height: dims.bubble,
          borderRadius: dims.bubble / 2,
          borderColor: filled ? colors.pen : colors.bubble,
          backgroundColor: filled ? colors.pen : 'transparent',
        },
      ]}>
      <AppText
        variant="bubble"
        color={filled ? 'onPen' : 'exam'}
        maxFontSizeMultiplier={1}
        style={{ fontSize: dims.letter, lineHeight: dims.letter + 3 }}>
        {letter}
      </AppText>
    </View>
  );
}

type BubbleRowProps = {
  /** How many bubbles are filled, counting from the left. */
  filled?: number;
  /** Which bubbles are filled, by position. Wins over `filled`, so bubble C can be filled while B is not. */
  filledMask?: readonly boolean[];
  size?: keyof typeof SIZES;
  /** Leading label, like the question number on an answer sheet. */
  label?: string;
  /** Puts the highlighter behind the label (used for today). */
  highlightLabel?: boolean;
  /** How many bubbles to draw (1–5). Defaults to a full row. */
  count?: number;
};

/**
 * A row of answer-sheet (optik form) bubbles, A to E.
 * Each finished study block fills one bubble.
 */
export function BubbleRow({
  filled = 0,
  filledMask,
  size = 'regular',
  label,
  highlightLabel = false,
  count = BUBBLE_LETTERS.length,
}: BubbleRowProps) {
  const { t } = useTranslation();
  const dims = SIZES[size];
  const letters = BUBBLE_LETTERS.slice(0, Math.max(1, Math.min(count, BUBBLE_LETTERS.length)));
  const total = letters.length;
  const isFilled = (index: number) =>
    filledMask ? filledMask[index] === true : index < Math.max(0, Math.min(filled, total));
  const done = letters.filter((_, index) => isFilled(index)).length;
  const summary = t('bubbles.a11y', { done, total });

  return (
    <View
      accessible
      accessibilityLabel={label ? `${label}, ${summary}` : summary}
      style={[styles.row, { gap: dims.gap }]}>
      {label ? (
        <View style={styles.labelColumn}>
          <HighlightMark active={highlightLabel}>
            <AppText variant="footnote" color={highlightLabel ? 'onHighlight' : 'inkSoft'}>
              {label}
            </AppText>
          </HighlightMark>
        </View>
      ) : null}

      {letters.map((letter, index) => (
        <Bubble key={letter} letter={letter} filled={isFilled(index)} size={size} />
      ))}
    </View>
  );
}

/**
 * The bubble a block carries in the day's answer sheet: A–E, and from the sixth block on the row
 * number in front (2A, 2B …), matching DayBubbles.
 */
export function blockBubbleLetter(index: number, total: number): string {
  const letter = BUBBLE_LETTERS[index % BUBBLE_LETTERS.length];
  return total > BUBBLE_LETTERS.length ? `${Math.floor(index / BUBBLE_LETTERS.length) + 1}${letter}` : letter;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelColumn: {
    width: 48,
    alignItems: 'flex-start',
  },
  bubble: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

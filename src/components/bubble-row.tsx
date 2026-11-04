import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { HighlightMark } from '@/components/highlight-mark';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

const SIZES = {
  regular: { bubble: 26, letter: 11, gap: Space.sm },
  large: { bubble: 44, letter: 16, gap: Space.md },
} as const;

type BubbleRowProps = {
  /** How many bubbles are filled, counting from the left. */
  filled?: number;
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
  size = 'regular',
  label,
  highlightLabel = false,
  count = LETTERS.length,
}: BubbleRowProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const dims = SIZES[size];
  const letters = LETTERS.slice(0, Math.max(1, Math.min(count, LETTERS.length)));
  const total = letters.length;
  const done = Math.max(0, Math.min(filled, total));
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

      {letters.map((letter, index) => {
        const isFilled = index < done;
        return (
          <View
            key={letter}
            style={[
              styles.bubble,
              {
                width: dims.bubble,
                height: dims.bubble,
                borderRadius: dims.bubble / 2,
                borderColor: isFilled ? colors.pen : colors.exam,
                backgroundColor: isFilled ? colors.pen : 'transparent',
              },
            ]}>
            <AppText
              variant="bubble"
              color={isFilled ? 'onPen' : 'exam'}
              maxFontSizeMultiplier={1}
              style={{ fontSize: dims.letter, lineHeight: dims.letter + 3 }}>
              {letter}
            </AppText>
          </View>
        );
      })}
    </View>
  );
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

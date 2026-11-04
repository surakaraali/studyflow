import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;
/** Which bubble is marked in each row. */
const ANSWERS = [1, 3, 0, 2] as const;

/**
 * Decorative corner of an optik answer sheet for the welcome screen: timing marks on the
 * edge, numbered rows, one bubble filled in per row. Hidden from screen readers.
 */
export function OptikSheet() {
  const { colors } = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.marks}>
        {ANSWERS.map((_, i) => (
          <View key={i} style={[styles.mark, { backgroundColor: colors.ink }]} />
        ))}
      </View>
      <View style={styles.rows}>
        {ANSWERS.map((answer, row) => (
          <View key={row} style={styles.row}>
            <AppText variant="footnote" color="inkSoft" maxFontSizeMultiplier={1} style={styles.number}>
              {row + 1}
            </AppText>
            {LETTERS.map((letter, i) => {
              const filled = i === answer;
              return (
                <View
                  key={letter}
                  style={[
                    styles.bubble,
                    {
                      borderColor: filled ? colors.pen : colors.exam,
                      backgroundColor: filled ? colors.pen : 'transparent',
                    },
                  ]}>
                  <AppText variant="bubble" maxFontSizeMultiplier={1} color={filled ? 'onPen' : 'exam'}>
                    {letter}
                  </AppText>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: Space.md,
    paddingVertical: Space.lg,
    paddingLeft: Space.md,
    paddingRight: Space.lg + 4,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    transform: [{ rotate: '-3deg' }],
  },
  marks: {
    justifyContent: 'space-around',
  },
  mark: {
    width: 10,
    height: 4,
    borderRadius: 1,
  },
  rows: {
    gap: Space.sm + 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  number: {
    width: 14,
    textAlign: 'right',
  },
  bubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

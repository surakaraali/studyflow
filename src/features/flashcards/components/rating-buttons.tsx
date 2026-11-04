import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import { GRADES, Rating, type Grade } from '@/domain/fsrs';
import { useTheme } from '@/hooks/use-theme';

const KEYS = {
  [Rating.Again]: 'again',
  [Rating.Hard]: 'hard',
  [Rating.Good]: 'good',
  [Rating.Easy]: 'easy',
} as const;

type RatingButtonsProps = {
  /** Already formatted "next review in" text for each grade, e.g. "10 dk". */
  intervals: Record<Grade, string>;
  onRate: (grade: Grade) => void;
};

/** Tekrar / Zor / İyi / Kolay, each with when the card would come back. */
export function RatingButtons({ intervals, onRate }: RatingButtonsProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <AppText variant="callout" color="inkSoft">
        {t('review.howWell')}
      </AppText>
      <View style={styles.row}>
        {GRADES.map((grade) => {
          const label = t(`review.ratings.${KEYS[grade as keyof typeof KEYS]}`);
          const isGood = grade === Rating.Good;
          const isAgain = grade === Rating.Again;
          return (
            <Pressable
              key={grade}
              accessibilityRole="button"
              accessibilityLabel={t('review.ratingA11y', { label, interval: intervals[grade] })}
              onPress={() => onRate(grade)}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: isGood ? colors.pen : colors.surface,
                  borderColor: isGood ? colors.pen : isAgain ? colors.exam : colors.line,
                },
                pressed && styles.pressed,
              ]}>
              <AppText variant="heading" color={isGood ? 'onPen' : isAgain ? 'exam' : 'ink'}>
                {label}
              </AppText>
              <AppText variant="footnote" color={isGood ? 'onPen' : 'inkSoft'}>
                {intervals[grade]}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  button: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 72,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space.sm,
    paddingHorizontal: Space.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.75,
  },
});

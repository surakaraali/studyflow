import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/ui/progress-bar';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import type { StreakResult } from '@/domain/streak';
import { useTheme } from '@/hooks/use-theme';

type GoalStreakProps = {
  minutesToday: number;
  goal: number;
  streak: StreakResult | undefined;
};

/** Daily goal progress and the streak (US-56, BR-17), side by side on Today. */
export function GoalStreak({ minutesToday, goal, streak }: GoalStreakProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reached = minutesToday >= goal;
  const days = streak?.current ?? 0;

  const hint = !streak
    ? null
    : streak.todayCounts
      ? t('streak.hintDone')
      : days > 0
        ? t('streak.hintKeep')
        : t('streak.hintStart');

  return (
    <View style={styles.wrap}>
      <View style={styles.block}>
        <View style={styles.line}>
          <AppText variant="heading" style={styles.flex}>
            {t('today.goalTitle')}
          </AppText>
          <AppText variant="callout" color={reached ? 'success' : 'inkSoft'}>
            {t('today.goalValue', { done: minutesToday, goal })}
          </AppText>
        </View>
        <ProgressBar
          value={goal > 0 ? minutesToday / goal : 0}
          color={reached ? colors.success : colors.pen}
          accessibilityLabel={t('today.goalA11y', { done: minutesToday, goal })}
        />
        {reached ? (
          <AppText variant="footnote" color="success">
            {t('today.goalReached')}
          </AppText>
        ) : null}
      </View>

      <View style={styles.block} accessible>
        <View style={styles.line}>
          <SymbolView
            name={{ ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' }}
            size={20}
            tintColor={days > 0 ? colors.exam : colors.inkFaint}
          />
          <AppText variant="heading" style={styles.flex}>
            {days > 0 ? t('streak.days', { count: days }) : t('streak.none')}
          </AppText>
        </View>
        {hint ? (
          <AppText variant="footnote" color="inkSoft">
            {hint}
          </AppText>
        ) : null}
        {streak && days > 0 ? (
          <AppText variant="footnote" color="inkSoft">
            {streak.freezeUsedThisWeek ? t('streak.freezeUsed') : t('streak.freezeAvailable')}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.lg,
  },
  block: {
    gap: Space.sm,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  flex: {
    flex: 1,
  },
});

import { useTranslation } from 'react-i18next';
import { View, StyleSheet } from 'react-native';

import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';

import type { Adherence } from '../stats';

/** Finished blocks out of the blocks planned so far this week (FR-AN-03, KPI G-02). */
export function AdherenceSection({ adherence }: { adherence: Adherence }) {
  const { t } = useTranslation();
  const { done, planned, remaining, ratio } = adherence;

  return (
    <Card>
      <AppText variant="title" accessibilityRole="header">
        {t('progress.plan.title')}
      </AppText>
      {ratio == null ? (
        <AppText variant="callout" color="inkSoft">
          {t('progress.plan.empty')}
        </AppText>
      ) : (
        <View style={styles.body}>
          <ProgressBar
            value={ratio}
            height={10}
            accessibilityLabel={t('progress.plan.barA11y', { done, planned })}
          />
          <AppText variant="callout">{t('progress.plan.summary', { done, planned })}</AppText>
        </View>
      )}
      {remaining > 0 ? (
        <AppText variant="footnote" color="inkSoft">
          {t('progress.plan.remaining', { count: remaining })}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Space.sm,
  },
});

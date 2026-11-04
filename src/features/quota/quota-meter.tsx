import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { QuotaStatus } from './quota';

type QuotaMeterProps = {
  quota: QuotaStatus;
  /** Show the limit explanation and the Pro offer when the quota is used up. */
  explainWhenFull?: boolean;
};

/** "Bu ay 2/3 belge" with a bar (US-38). When full, says why and offers Pro. */
export function QuotaMeter({ quota, explainWhenFull = true }: QuotaMeterProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <View
        style={styles.row}
        accessible
        accessibilityLabel={t('quota.lineA11y', { used: quota.used, limit: quota.limit })}>
        <AppText variant="heading">{t('quota.line', { used: quota.used, limit: quota.limit })}</AppText>
        <AppText variant="footnote" color="inkSoft">
          {t('quota.pages', { pages: quota.pages })}
        </AppText>
      </View>
      <ProgressBar value={quota.ratio} color={quota.full ? colors.exam : colors.pen} />

      {explainWhenFull && quota.full ? (
        <View style={styles.full}>
          <AppText variant="heading" color="exam">
            {t('quota.fullTitle')}
          </AppText>
          <AppText variant="callout" color="inkSoft">
            {quota.plan === 'pro'
              ? t('quota.fullBodyPro', { limit: quota.limit })
              : t('quota.fullBody', { limit: quota.limit })}
          </AppText>
          {quota.plan === 'free' ? (
            <Button
              label={t('quota.goPro')}
              icon={{ ios: 'star.fill', android: 'star', web: 'star' }}
              onPress={() => router.push({ pathname: '/paywall', params: { source: 'quota' } })}
            />
          ) : null}
        </View>
      ) : null}
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
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Space.sm,
  },
  full: {
    gap: Space.sm,
    alignItems: 'flex-start',
    paddingTop: Space.xs,
  },
});

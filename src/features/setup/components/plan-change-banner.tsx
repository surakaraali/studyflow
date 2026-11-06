import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import { useDbQuery } from '@/db/use-query';
import { quota } from '@/domain/rules';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/stores/session';

import { dismissPlanNotice, loadPlanMemory, recordPlan } from '../repo';

/**
 * US-79: when the plan goes from Pro to free, Today and Study show this note once, with a
 * way back to the paywall. It stays until the student closes it or opens the paywall.
 */
export function PlanChangeBanner() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const plan = useSession((s) => s.profile?.plan ?? null);
  const { data: memory } = useDbQuery('setup:planMemory', () => loadPlanMemory(), ['kv']);

  useEffect(() => {
    if (plan) recordPlan(plan).catch(() => undefined);
  }, [plan]);

  if (plan !== 'free' || !memory?.expiredNotice) return null;

  const renew = () => {
    void dismissPlanNotice();
    router.push('/paywall');
  };

  return (
    <View
      accessibilityRole="summary"
      style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.line, borderLeftColor: colors.pen }]}>
      <SymbolView
        name={{ ios: 'info.circle', android: 'info', web: 'info' }}
        size={20}
        tintColor={colors.pen}
        style={styles.icon}
      />
      <View style={styles.text}>
        <AppText variant="heading">{t('planChange.title')}</AppText>
        <AppText variant="callout" color="inkSoft">
          {t('planChange.body', { documents: quota('free').documents })}
        </AppText>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={renew} hitSlop={8} style={styles.action}>
            <AppText variant="callout" color="pen" style={styles.actionText}>
              {t('planChange.renew')}
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('planChange.dismissA11y')}
            onPress={() => void dismissPlanNotice()}
            hitSlop={8}
            style={styles.action}>
            <AppText variant="callout" color="inkSoft" style={styles.actionText}>
              {t('planChange.dismiss')}
            </AppText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: Space.md,
    padding: Space.lg,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4,
  },
  icon: {
    width: 22,
    height: 22,
    marginTop: 1,
  },
  text: {
    flex: 1,
    gap: Space.xs,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Space.xl,
  },
  action: {
    minHeight: 44,
    justifyContent: 'center',
  },
  actionText: {
    fontWeight: '600',
  },
});

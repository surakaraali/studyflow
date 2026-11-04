import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Radius, Space, type ColorName } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { DisplayStatus } from '../status';

const LOOK: Record<DisplayStatus, { icon: SymbolViewProps['name']; color: ColorName }> = {
  queued: { icon: { ios: 'clock', android: 'schedule', web: 'schedule' }, color: 'inkSoft' },
  retrying: { icon: { ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }, color: 'inkSoft' },
  waiting: { icon: { ios: 'hourglass', android: 'hourglass_empty', web: 'hourglass_empty' }, color: 'inkSoft' },
  processing: { icon: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }, color: 'pen' },
  ready: { icon: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }, color: 'success' },
  error: { icon: { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }, color: 'exam' },
};

/** Document status as icon + text, so it never relies on color alone. */
export function StatusChip({ status }: { status: DisplayStatus }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const look = LOOK[status];

  return (
    <View style={[styles.chip, { backgroundColor: colors.sunken }]}>
      <SymbolView name={look.icon} size={13} tintColor={colors[look.color]} />
      <AppText variant="footnote" color={look.color} style={styles.text}>
        {t(`documents.status.${status}`)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    paddingHorizontal: Space.sm,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    flexShrink: 0,
  },
  text: {
    fontWeight: '600',
  },
});

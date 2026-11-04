import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type BannerProps = {
  tone?: 'info' | 'warning' | 'success';
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

const ICONS = {
  info: { ios: 'info.circle', android: 'info', web: 'info' },
  warning: { ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' },
  success: { ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' },
} as const;

/** A note pinned to the page: explains a state and, when possible, the way out. */
export function Banner({ tone = 'info', title, message, actionLabel, onAction }: BannerProps) {
  const { colors } = useTheme();
  const accent = tone === 'warning' ? colors.exam : tone === 'success' ? colors.success : colors.pen;

  return (
    <View
      accessible={!onAction}
      accessibilityRole={tone === 'warning' ? 'alert' : undefined}
      style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.line, borderLeftColor: accent }]}>
      <SymbolView name={ICONS[tone]} size={20} tintColor={accent} style={styles.icon} />
      <View style={styles.text}>
        {title ? <AppText variant="heading">{title}</AppText> : null}
        <AppText variant="callout" color="inkSoft">
          {message}
        </AppText>
        {actionLabel && onAction ? (
          <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8} style={styles.action}>
            <AppText variant="callout" color="pen" style={styles.actionText}>
              {actionLabel}
            </AppText>
          </Pressable>
        ) : null}
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
  action: {
    alignSelf: 'flex-start',
    minHeight: 32,
    justifyContent: 'center',
  },
  actionText: {
    fontWeight: '600',
  },
});

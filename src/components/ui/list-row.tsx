import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ListRowProps = {
  title: string;
  subtitle?: string;
  /** Small text on the right, e.g. "3 gün kaldı" */
  detail?: string;
  detailColor?: 'inkSoft' | 'exam' | 'pen' | 'success';
  /** A course color dot */
  color?: string;
  icon?: SymbolViewProps['name'];
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  /** Shows a chevron when the row opens another screen (default: when onPress is set). */
  chevron?: boolean;
  accessibilityHint?: string;
};

export function ListRow({
  title,
  subtitle,
  detail,
  detailColor = 'inkSoft',
  color,
  icon,
  leading,
  trailing,
  onPress,
  destructive,
  chevron,
  accessibilityHint,
}: ListRowProps) {
  const { colors } = useTheme();
  const showChevron = chevron ?? (onPress != null && !destructive);
  const label = [title, subtitle, detail].filter(Boolean).join(', ');

  const content = (
    <>
      {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      {icon ? (
        <SymbolView
          name={icon}
          size={20}
          tintColor={destructive ? colors.exam : colors.pen}
          style={styles.icon}
        />
      ) : null}
      {leading}
      <View style={styles.text}>
        <AppText variant="body" color={destructive ? 'exam' : 'ink'}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="footnote" color="inkSoft">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {detail ? (
        <AppText variant="footnote" color={detailColor} style={styles.detail}>
          {detail}
        </AppText>
      ) : null}
      {trailing}
      {showChevron ? (
        <SymbolView
          name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          size={13}
          weight="semibold"
          tintColor={colors.inkFaint}
        />
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.row} accessible accessibilityLabel={label}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.sunken }]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm + 2,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  icon: {
    width: 24,
    height: 24,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  detail: {
    textAlign: 'right',
    flexShrink: 0,
  },
});

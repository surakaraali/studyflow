import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'destructive' | 'plain';
  /** SF Symbol on iOS, Material Symbol on Android */
  icon?: SymbolViewProps['name'];
  disabled?: boolean;
  loading?: boolean;
  /** Stretch to the container width (forms, pinned footers). */
  block?: boolean;
  accessibilityHint?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  block = false,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;

  // The ballpoint blue marks the one main action (and plain links); a secondary button stays ink on
  // paper, so a screen with several of them still has a single blue thing to look at.
  const palette = {
    primary: { bg: colors.pen, border: colors.pen, fg: colors.onPen, icon: colors.onPen },
    secondary: { bg: colors.surface, border: colors.line, fg: colors.ink, icon: colors.inkSoft },
    destructive: { bg: colors.exam, border: colors.exam, fg: '#FFFFFF', icon: '#FFFFFF' },
    plain: { bg: 'transparent', border: 'transparent', fg: colors.pen, icon: colors.pen },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        block && styles.block,
        { backgroundColor: palette.bg, borderColor: palette.border },
        inactive && styles.disabled,
        pressed && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : icon ? (
        <SymbolView name={icon} size={18} weight="semibold" tintColor={palette.icon} />
      ) : null}
      <AppText variant="heading" style={{ color: palette.fg }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    paddingHorizontal: Space.lg + 2,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  block: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
});

import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A square check mark. Checked = filled pen box, unchecked = empty outline. */
export function CheckBox({ checked, muted = false }: { checked: boolean; muted?: boolean }) {
  const { colors } = useTheme();
  return (
    <SymbolView
      name={
        checked
          ? { ios: 'checkmark.square.fill', android: 'check_box', web: 'check_box' }
          : { ios: 'square', android: 'check_box_outline_blank', web: 'check_box_outline_blank' }
      }
      size={24}
      tintColor={muted ? colors.inkFaint : checked ? colors.pen : colors.inkSoft}
      style={styles.box}
    />
  );
}

type CheckRowProps = {
  title: string;
  subtitle?: string;
  /** Small text on the right, e.g. "Eklendi" */
  detail?: string;
  checked: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  /** Course color dot */
  color?: string;
};

/** A row in a multi-select list (catalog courses, exam topics). */
export function CheckRow({ title, subtitle, detail, checked, onToggle, disabled, color }: CheckRowProps) {
  const { colors } = useTheme();
  const label = [title, subtitle, detail].filter(Boolean).join(', ');

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: !!disabled }}
      disabled={disabled || !onToggle}
      onPress={onToggle}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.sunken }]}>
      <CheckBox checked={checked} muted={disabled} />
      {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <View style={styles.text}>
        <AppText variant="body" color={disabled ? 'inkSoft' : 'ink'}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="footnote" color="inkSoft">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {detail ? (
        <AppText variant="footnote" color="inkSoft" style={styles.detail}>
          {detail}
        </AppText>
      ) : null}
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
  box: {
    width: 24,
    height: 24,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
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

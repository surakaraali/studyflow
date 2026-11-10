import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type IconButtonProps = {
  icon: SymbolViewProps['name'];
  /** Required: icon-only buttons need a spoken name. */
  label: string;
  onPress: () => void;
  /** inkSoft by default: header and toolbar icons stay quiet; pen for controls like a stepper. */
  tone?: 'pen' | 'inkSoft' | 'exam';
  size?: number;
};

export function IconButton({ icon, label, onPress, tone = 'inkSoft', size = 22 }: IconButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}>
      <SymbolView name={icon} size={size} tintColor={colors[tone]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/ui/icon-button';
import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type StepperProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** How the value is shown, e.g. v => `${v} dk` */
  format?: (value: number) => string;
};

/** A number with − and + buttons. Works with VoiceOver's adjustable gestures too. */
export function Stepper({ label, value, onChange, min, max, step = 5, format = String }: StepperProps) {
  const { colors } = useTheme();
  const set = (next: number) => onChange(Math.max(min, Math.min(max, next)));

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: format(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) =>
        set(event.nativeEvent.actionName === 'increment' ? value + step : value - step)
      }
      style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <AppText variant="body" style={styles.label}>
        {label}
      </AppText>
      <IconButton
        icon={{ ios: 'minus.circle', android: 'remove_circle', web: 'remove_circle' }}
        label={`${label} −`}
        onPress={() => set(value - step)}
        tone={value <= min ? 'inkSoft' : 'pen'}
      />
      <AppText variant="heading" style={styles.value}>
        {format(value)}
      </AppText>
      <IconButton
        icon={{ ios: 'plus.circle', android: 'add_circle', web: 'add_circle' }}
        label={`${label} +`}
        onPress={() => set(value + step)}
        tone={value >= max ? 'inkSoft' : 'pen'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Space.lg,
    paddingRight: Space.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  label: {
    flex: 1,
  },
  value: {
    minWidth: 64,
    textAlign: 'center',
  },
});

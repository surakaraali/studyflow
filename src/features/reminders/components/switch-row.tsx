import { StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SwitchRowProps = {
  title: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
};

/** A settings row with a switch. The switch itself carries the spoken name. */
export function SwitchRow({ title, hint, value, onChange, disabled }: SwitchRowProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <View style={styles.text} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <AppText variant="body">{title}</AppText>
        {hint ? (
          <AppText variant="footnote" color="inkSoft">
            {hint}
          </AppText>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={title}
        accessibilityHint={hint}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.pen, false: colors.line }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm + 2,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});

import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SegmentOption<T extends string | number> = {
  value: T;
  label: string;
  /** Longer text for screen readers. */
  a11yLabel?: string;
};

type SegmentedProps<T extends string | number> = {
  options: SegmentOption<T>[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  /** Wraps onto several lines (grades, chips) instead of one equal-width row. */
  wrap?: boolean;
  label?: string;
};

/** Single choice as a row of chips. The selected chip gets the ink fill. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  wrap = false,
  label,
}: SegmentedProps<T>) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      {label ? (
        <AppText variant="footnote" color="inkSoft">
          {label}
        </AppText>
      ) : null}
      <View accessibilityRole="radiogroup" style={[styles.row, wrap && styles.rowWrap]}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={option.a11yLabel ?? option.label}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.chip,
                !wrap && styles.chipFlex,
                {
                  backgroundColor: selected ? colors.pen : colors.surface,
                  borderColor: selected ? colors.pen : colors.line,
                },
                pressed && { opacity: 0.75 },
              ]}>
              <AppText variant="callout" color={selected ? 'onPen' : 'ink'} style={styles.text}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.xs + 2,
  },
  row: {
    flexDirection: 'row',
    gap: Space.sm,
  },
  rowWrap: {
    flexWrap: 'wrap',
  },
  chip: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: Space.md + 2,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipFlex: {
    flex: 1,
  },
  text: {
    fontWeight: '600',
  },
});

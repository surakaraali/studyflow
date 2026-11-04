import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const COLUMNS = 4;

type YearGridProps = {
  years: number[];
  value: number | null;
  onChange: (year: number) => void;
};

/** Birth years as a grid of large chips. Nothing is preselected (a neutral age question). */
export function YearGrid({ years, value, onChange }: YearGridProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rows: number[][] = [];
  for (let i = 0; i < years.length; i += COLUMNS) rows.push(years.slice(i, i + COLUMNS));

  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
      {rows.map((row) => (
        <View key={row[0]} style={styles.row}>
          {row.map((year) => {
            const selected = year === value;
            return (
              <Pressable
                key={year}
                accessibilityRole="radio"
                accessibilityLabel={t('onboarding.birthYear.option', { year })}
                accessibilityState={{ checked: selected, selected }}
                onPress={() => onChange(year)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.pen : colors.surface,
                    borderColor: selected ? colors.pen : colors.line,
                  },
                  pressed && { opacity: 0.75 },
                ]}>
                <AppText variant="heading" color={selected ? 'onPen' : 'ink'}>
                  {year}
                </AppText>
              </Pressable>
            );
          })}
          {/* Keep the last row's chips the same width as the others. */}
          {Array.from({ length: COLUMNS - row.length }, (_, i) => (
            <View key={`spacer-${i}`} style={styles.spacer} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.sm,
  },
  row: {
    flexDirection: 'row',
    gap: Space.sm,
  },
  chip: {
    flex: 1,
    minHeight: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    flex: 1,
  },
});

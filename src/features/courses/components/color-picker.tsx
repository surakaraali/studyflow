import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { COURSE_COLORS, courseColorKey } from '@/features/courses/colors';
import { useTheme } from '@/hooks/use-theme';

type ColorPickerProps = {
  value: string;
  onChange: (hex: string) => void;
};

/** The course palette as round swatches. The chosen one gets a ring and a check mark. */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const options: { hex: string; name: string }[] = COURSE_COLORS.map((c) => ({
    hex: c.hex,
    name: t(`courses.colors.${c.key}`),
  }));
  // A color picked on another device that is not in this palette stays selectable.
  if (value && !courseColorKey(value)) options.push({ hex: value, name: t('courses.colors.custom') });

  return (
    <View style={styles.wrap}>
      <AppText variant="footnote" color="inkSoft">
        {t('courses.colorLabel')}
      </AppText>
      <View accessibilityRole="radiogroup" style={styles.grid}>
        {options.map((option) => {
          const selected = option.hex.toUpperCase() === value.toUpperCase();
          return (
            <Pressable
              key={option.hex}
              accessibilityRole="radio"
              accessibilityLabel={t('courses.colorA11y', { color: option.name })}
              accessibilityState={{ selected, checked: selected }}
              onPress={() => onChange(option.hex)}
              style={({ pressed }) => [
                styles.target,
                { borderColor: selected ? colors.ink : 'transparent' },
                pressed && { opacity: 0.7 },
              ]}>
              <View style={[styles.swatch, { backgroundColor: option.hex }]}>
                {selected ? (
                  <SymbolView
                    name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                    size={16}
                    weight="bold"
                    tintColor="#FFFFFF"
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  target: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

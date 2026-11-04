import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Fonts, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const GROUPS = [
  { key: 'primary', grades: [1, 2, 3, 4] },
  { key: 'middle', grades: [5, 6, 7, 8] },
  { key: 'high', grades: [9, 10, 11, 12] },
] as const;

type GradePickerProps = {
  value: number | null;
  onChange: (grade: number) => void;
};

/** Grades 1–12 as big answer-sheet bubbles, one row per school level. */
export function GradePicker({ value, onChange }: GradePickerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
      {GROUPS.map((group) => (
        <View key={group.key} style={styles.group}>
          <AppText variant="footnote" color="inkSoft" style={styles.groupLabel}>
            {t(`onboarding.grade.${group.key}`)}
          </AppText>
          <View style={styles.row}>
            {group.grades.map((grade) => {
              const selected = grade === value;
              return (
                <Pressable
                  key={grade}
                  accessibilityRole="radio"
                  accessibilityLabel={t('onboarding.grade.option', { grade })}
                  accessibilityState={{ checked: selected, selected }}
                  onPress={() => onChange(grade)}
                  hitSlop={4}
                  style={({ pressed }) => [
                    styles.bubble,
                    {
                      borderColor: selected ? colors.pen : colors.exam,
                      backgroundColor: selected ? colors.pen : colors.surface,
                    },
                    pressed && styles.pressed,
                  ]}>
                  <AppText
                    maxFontSizeMultiplier={1.4}
                    style={[styles.number, { color: selected ? colors.onPen : colors.exam }]}>
                    {grade}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.lg + 4,
  },
  group: {
    gap: Space.sm,
  },
  groupLabel: {
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Space.md,
  },
  bubble: {
    flex: 1,
    maxWidth: 72,
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    fontFamily: Fonts.display,
    fontSize: 24,
    lineHeight: 30,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
});

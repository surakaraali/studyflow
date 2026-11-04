import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import type { Course } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';

type CourseSelectProps = {
  label: string;
  courses: readonly Course[];
  value: string | null;
  onChange: (courseId: string | null) => void;
  /** Adds a "no course" option (timetable slots). */
  allowNone?: boolean;
  error?: string | null;
};

/**
 * Picks one course. Closed it shows the choice; tapping opens the list in place,
 * which works the same on iOS and Android and with any number of courses.
 */
export function CourseSelect({ label, courses, value, onChange, allowNone, error }: CourseSelectProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = courses.find((c) => c.id === value) ?? null;
  const shown = selected?.name ?? (allowNone ? t('courses.noCourse') : t('courses.choose'));

  const choose = (id: string | null) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.box,
          { backgroundColor: colors.surface, borderColor: error ? colors.exam : colors.line },
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${shown}`}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((o) => !o)}
          style={({ pressed }) => [styles.header, pressed && { backgroundColor: colors.sunken }]}>
          <AppText variant="body" style={styles.label}>
            {label}
          </AppText>
          <View style={styles.value}>
            {selected ? <View style={[styles.dot, { backgroundColor: selected.color }]} /> : null}
            <AppText variant="body" color={selected ? 'pen' : 'inkSoft'} style={styles.valueText}>
              {shown}
            </AppText>
            <SymbolView
              name={
                open
                  ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' }
                  : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }
              }
              size={13}
              weight="semibold"
              tintColor={colors.inkFaint}
            />
          </View>
        </Pressable>

        {open ? (
          <View accessibilityRole="radiogroup">
            {allowNone ? (
              <Option
                name={t('courses.noCourse')}
                selected={value == null}
                onPress={() => choose(null)}
              />
            ) : null}
            {courses.map((course) => (
              <Option
                key={course.id}
                name={course.name}
                color={course.color}
                selected={course.id === value}
                onPress={() => choose(course.id)}
              />
            ))}
          </View>
        ) : null}
      </View>
      {error ? (
        <AppText variant="footnote" color="exam" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

function Option({
  name,
  color,
  selected,
  onPress,
}: {
  name: string;
  color?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={name}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        { borderTopColor: colors.line },
        pressed && { backgroundColor: colors.sunken },
      ]}>
      {color ? (
        <View style={[styles.dot, { backgroundColor: color }]} />
      ) : (
        <View style={styles.dotSpace} />
      )}
      <AppText variant="body" style={styles.optionText}>
        {name}
      </AppText>
      {selected ? (
        <SymbolView
          name={{ ios: 'checkmark', android: 'check', web: 'check' }}
          size={16}
          weight="semibold"
          tintColor={colors.pen}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.xs,
  },
  box: {
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
  },
  label: {
    flexShrink: 1,
  },
  value: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Space.sm,
  },
  valueText: {
    flexShrink: 1,
    textAlign: 'right',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotSpace: {
    width: 12,
  },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  optionText: {
    flex: 1,
  },
});

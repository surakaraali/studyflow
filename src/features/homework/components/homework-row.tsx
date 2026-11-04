import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { CheckBox } from '@/features/courses/components/check-row';
import { setHomeworkDone, type HomeworkWithCourse } from '@/features/homework/repo';
import { useTheme } from '@/hooks/use-theme';
import { addDays, formatShortDate, localeTag } from '@/lib/dates';

type HomeworkRowProps = {
  homework: HomeworkWithCourse;
  today: string;
  /** Hide the course name (inside a course's own screen). */
  showCourse?: boolean;
};

/**
 * Homework with a check box on the left (marks it done) and the rest of the row opening
 * the homework. Two separate controls, so screen readers reach both.
 */
export function HomeworkRow({ homework, today, showCourse = true }: HomeworkRowProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const done = homework.done_at != null;
  const overdue = !done && homework.due_date < today;

  const due =
    homework.due_date === today
      ? t('homework.dueToday')
      : homework.due_date === addDays(today, 1)
        ? t('homework.dueTomorrow')
        : overdue
          ? t('homework.overdue')
          : t('homework.dueOn', { date: formatShortDate(homework.due_date, localeTag(i18n.language)) });
  const subtitle = [showCourse ? homework.course_name : null, due].filter(Boolean).join(' · ');

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={t('homework.checkA11y', { description: homework.description })}
        accessibilityState={{ checked: done }}
        onPress={() => setHomeworkDone(homework.id, !done)}
        hitSlop={4}
        style={({ pressed }) => [styles.check, pressed && { opacity: 0.6 }]}>
        <CheckBox checked={done} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${homework.description}, ${subtitle}`}
        onPress={() => router.push({ pathname: '/homework/[id]', params: { id: homework.id } })}
        style={({ pressed }) => [styles.body, pressed && { backgroundColor: colors.sunken }]}>
        <View style={[styles.dot, { backgroundColor: homework.course_color }]} />
        <View style={styles.text}>
          <AppText
            variant="body"
            color={done ? 'inkSoft' : 'ink'}
            style={done ? styles.doneText : undefined}
            numberOfLines={3}>
            {homework.description}
          </AppText>
          <View style={styles.subtitle}>
            {overdue ? (
              <SymbolView
                name={{ ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' }}
                size={14}
                tintColor={colors.exam}
              />
            ) : null}
            <AppText variant="footnote" color={overdue ? 'exam' : 'inkSoft'} style={styles.flex}>
              {subtitle}
            </AppText>
          </View>
        </View>
        <SymbolView
          name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          size={13}
          weight="semibold"
          tintColor={colors.inkFaint}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  check: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: Space.xs,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingRight: Space.lg,
    paddingVertical: Space.sm + 2,
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
  subtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  flex: {
    flex: 1,
  },
  doneText: {
    textDecorationLine: 'line-through',
  },
});

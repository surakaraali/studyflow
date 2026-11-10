import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { HighlightMark } from '@/components/highlight-mark';
import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDayLong, localeTag, parseDate } from '@/lib/dates';

export type DayInfo = { blocks: number; done: number; exam: boolean };

type WeekPickerProps = {
  /** Seven "YYYY-MM-DD" dates, Monday first. */
  days: string[];
  today: string;
  selected: string;
  onSelect: (date: string) => void;
  info: Record<string, DayInfo>;
};

/**
 * The week strip of the calendar tab: today under the highlighter, the chosen day raised onto the
 * surface with a hairline (one emphasis each, no blue frame on top of the yellow). Each day shows
 * how many blocks it has and a pink mark when there is an exam.
 */
export function WeekPicker({ days, today, selected, onSelect, info }: WeekPickerProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const tag = localeTag(i18n.language);
  const weekday = new Intl.DateTimeFormat(tag, { weekday: 'short' });

  return (
    <View style={styles.row}>
      {days.map((date) => {
        const isToday = date === today;
        const isSelected = date === selected;
        const day = info[date] ?? { blocks: 0, done: 0, exam: false };
        const label = [
          t('calendar.dayA11y', { date: formatDayLong(date, tag), count: day.blocks }),
          day.exam ? t('calendar.dayExamA11y') : null,
        ]
          .filter(Boolean)
          .join(', ');

        return (
          <Pressable
            key={date}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(date)}
            style={({ pressed }) => [
              styles.day,
              {
                borderColor: isSelected ? colors.line : 'transparent',
                backgroundColor: isSelected ? colors.surface : 'transparent',
              },
              pressed && { opacity: 0.6 },
            ]}>
            <AppText variant="footnote" color={isToday || isSelected ? 'ink' : 'inkSoft'}>
              {weekday.format(parseDate(date))}
            </AppText>
            <HighlightMark active={isToday}>
              <AppText variant="heading" color={isToday ? 'onHighlight' : 'ink'}>
                {parseDate(date).getDate()}
              </AppText>
            </HighlightMark>
            <View style={styles.marks}>
              {day.blocks > 0 ? (
                <AppText variant="footnote" color="inkSoft" maxFontSizeMultiplier={1.3}>
                  {day.blocks}
                </AppText>
              ) : null}
              {day.exam ? <View style={[styles.examDot, { backgroundColor: colors.exam }]} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 2,
  },
  day: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    gap: Space.xs,
    paddingVertical: Space.sm,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  marks: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  examDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});

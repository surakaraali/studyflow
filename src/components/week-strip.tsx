import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { HighlightMark } from '@/components/highlight-mark';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { formatLongDate, isSameDay, localeTag, weekDays } from '@/lib/dates';

type WeekStripProps = {
  /** Any day inside the week to show. Defaults to today. */
  date?: Date;
};

/** Monday-first week with today marked by the highlighter. */
export function WeekStrip({ date }: WeekStripProps) {
  const { i18n } = useTranslation();
  const tag = localeTag(i18n.language);
  const today = new Date();
  const days = weekDays(date ?? today);
  const weekday = new Intl.DateTimeFormat(tag, { weekday: 'short' });

  return (
    <View style={styles.row}>
      {days.map((day) => {
        const isToday = isSameDay(day, today);
        return (
          <View
            key={day.toDateString()}
            accessible
            accessibilityLabel={formatLongDate(day, tag)}
            accessibilityState={{ selected: isToday }}
            style={styles.day}>
            <AppText variant="footnote" color={isToday ? 'ink' : 'inkSoft'}>
              {weekday.format(day)}
            </AppText>
            <HighlightMark active={isToday}>
              <AppText variant="heading" color={isToday ? 'onHighlight' : 'ink'}>
                {day.getDate()}
              </AppText>
            </HighlightMark>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  day: {
    flex: 1,
    alignItems: 'center',
    gap: Space.sm,
  },
});

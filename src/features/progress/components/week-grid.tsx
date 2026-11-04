import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { BubbleRow } from '@/components/bubble-row';
import { Card } from '@/components/ui/card';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { formatLongDate, isSameDay, localeTag, parseDate, weekDays } from '@/lib/dates';

/** Bubbles on one answer-sheet row (A–E). */
const BUBBLES = 5;

type WeekGridProps = {
  /** Any day of the week to show, "YYYY-MM-DD". */
  weekStart: string;
  /** Finished blocks per day, Monday first. */
  blocksPerDay: number[];
};

/**
 * The week as an optik answer sheet: one row per day, one filled bubble per finished block.
 * Days with more than five blocks show the rest as "+N".
 */
export function WeekGrid({ weekStart, blocksPerDay }: WeekGridProps) {
  const { t, i18n } = useTranslation();
  const tag = localeTag(i18n.language);
  const today = new Date();
  const weekday = new Intl.DateTimeFormat(tag, { weekday: 'short' });

  return (
    <Card>
      <AppText variant="title" accessibilityRole="header">
        {t('progress.weekTitle')}
      </AppText>
      <View style={styles.sheet}>
        {weekDays(parseDate(weekStart)).map((day, index) => {
          const count = blocksPerDay[index] ?? 0;
          const extra = Math.max(0, count - BUBBLES);
          return (
            <View
              key={day.toDateString()}
              accessible
              accessibilityLabel={t('progress.grid.dayA11y', {
                day: formatLongDate(day, tag),
                count,
              })}
              style={styles.row}>
              <BubbleRow
                label={weekday.format(day)}
                highlightLabel={isSameDay(day, today)}
                filled={Math.min(count, BUBBLES)}
              />
              {extra > 0 ? (
                <AppText variant="callout" color="pen" style={styles.extra}>
                  {t('progress.grid.more', { count: extra })}
                </AppText>
              ) : null}
            </View>
          );
        })}
      </View>
      <AppText variant="footnote" color="inkSoft">
        {t('progress.grid.footnote')}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  sheet: {
    gap: Space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  extra: {
    fontWeight: '700',
  },
});

import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import type { Course } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { formatShortDate, localeTag } from '@/lib/dates';

import type { CourseMinutes } from '../stats';

const TREND_HEIGHT = 88;

type MinutesSectionProps = {
  weeklyMinutes: number[];
  weekStarts: string[];
  byCourse: CourseMinutes[];
  courses: Map<string, Course>;
};

/** Study time (FR-AN-01): the last four weeks side by side, then this week per course. */
export function MinutesSection({ weeklyMinutes, weekStarts, byCourse, courses }: MinutesSectionProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const tag = localeTag(i18n.language);

  const last = weeklyMinutes.length - 1;
  const thisWeek = weeklyMinutes[last] ?? 0;
  const lastWeek = weeklyMinutes[last - 1] ?? 0;
  const diff = thisWeek - lastWeek;
  const comparison =
    lastWeek === 0
      ? t('progress.time.vsLastWeekNone')
      : diff > 0
        ? t('progress.time.vsLastWeekUp', { minutes: diff })
        : diff < 0
          ? t('progress.time.vsLastWeekDown', { minutes: -diff })
          : t('progress.time.vsLastWeekSame');

  const weekLabel = (index: number) =>
    index === last
      ? t('progress.time.thisWeek')
      : t('progress.time.weekLabel', { date: formatShortDate(weekStarts[index], tag) });
  const trendMax = Math.max(1, ...weeklyMinutes);
  const trendA11y = t('progress.time.weeksA11y', {
    list: weeklyMinutes
      .map((minutes, i) => t('progress.time.weekItemA11y', { label: weekLabel(i), minutes }))
      .join(', '),
  });

  const courseMax = Math.max(1, ...byCourse.map((row) => row.minutes));

  return (
    <Card>
      <View style={styles.head}>
        <AppText variant="title" accessibilityRole="header">
          {t('progress.time.title')}
        </AppText>
        <AppText variant="callout" color="inkSoft">
          {comparison}
        </AppText>
      </View>

      <View style={styles.block}>
        <AppText variant="heading">{t('progress.time.weeksTitle')}</AppText>
        <View accessible accessibilityLabel={trendA11y} style={styles.trend}>
          {weeklyMinutes.map((minutes, i) => {
            const current = i === last;
            return (
              <View key={weekStarts[i]} style={styles.trendColumn}>
                <AppText variant="footnote" color={current ? 'ink' : 'inkSoft'}>
                  {t('common.minutes', { count: minutes })}
                </AppText>
                <View style={[styles.trendTrack, { height: TREND_HEIGHT }]}>
                  <View
                    style={[
                      styles.trendBar,
                      {
                        height: Math.max(minutes > 0 ? 4 : 0, (minutes / trendMax) * TREND_HEIGHT),
                        backgroundColor: current ? colors.pen : colors.inkFaint,
                      },
                    ]}
                  />
                </View>
                <AppText
                  variant="footnote"
                  color={current ? 'ink' : 'inkSoft'}
                  style={[styles.center, current && styles.bold]}>
                  {weekLabel(i)}
                </AppText>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.block}>
        <AppText variant="heading">{t('progress.time.byCourse')}</AppText>
        {byCourse.length === 0 ? (
          <AppText variant="callout" color="inkSoft">
            {t('progress.time.byCourseEmpty')}
          </AppText>
        ) : (
          byCourse.map((row) => {
            const course = row.courseId ? courses.get(row.courseId) : undefined;
            const name = course?.name ?? t('progress.time.noCourse');
            const color = course?.color ?? colors.inkFaint;
            return (
              <View
                key={row.courseId ?? 'none'}
                accessible
                accessibilityLabel={t('progress.time.courseA11y', {
                  course: name,
                  minutes: row.minutes,
                  lastWeek: row.lastWeek,
                })}
                style={styles.courseRow}>
                <View style={styles.courseHead}>
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <AppText variant="callout" style={styles.flex}>
                    {name}
                  </AppText>
                  <AppText variant="callout" style={styles.bold}>
                    {t('common.minutes', { count: row.minutes })}
                  </AppText>
                </View>
                <View style={[styles.barTrack, { backgroundColor: colors.sunken }]}>
                  <View
                    style={[
                      styles.bar,
                      { width: `${(row.minutes / courseMax) * 100}%`, backgroundColor: color },
                    ]}
                  />
                </View>
                {row.lastWeek > 0 ? (
                  <AppText variant="footnote" color="inkSoft">
                    {t('progress.time.lastWeek', { minutes: row.lastWeek })}
                  </AppText>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: {
    gap: Space.xs,
  },
  block: {
    gap: Space.md,
  },
  trend: {
    flexDirection: 'row',
    gap: Space.sm,
  },
  trendColumn: {
    flex: 1,
    alignItems: 'center',
    gap: Space.xs,
  },
  trendTrack: {
    width: '100%',
    maxWidth: 44,
    justifyContent: 'flex-end',
  },
  trendBar: {
    width: '100%',
    borderTopLeftRadius: Radius.sm / 2,
    borderTopRightRadius: Radius.sm / 2,
  },
  center: {
    textAlign: 'center',
  },
  bold: {
    fontWeight: '600',
  },
  courseRow: {
    gap: Space.xs + 2,
  },
  courseHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  flex: {
    flex: 1,
  },
  barTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  bar: {
    height: 10,
    borderRadius: 5,
  },
});

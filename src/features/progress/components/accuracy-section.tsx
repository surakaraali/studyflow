import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import type { Course } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { localeTag } from '@/lib/dates';

import type { AccuracyStat, CourseAccuracy } from '../stats';

type AccuracySectionProps = {
  accuracy: CourseAccuracy[];
  courses: Map<string, Course>;
};

function useAccuracyText() {
  const { t, i18n } = useTranslation();
  const percent = new Intl.NumberFormat(localeTag(i18n.language), { style: 'percent' });

  const trend = (change: number | null) => {
    if (change == null) return t('progress.accuracy.noTrend');
    if (change > 0) return t('progress.accuracy.up', { points: change });
    if (change < 0) return t('progress.accuracy.down', { points: -change });
    return t('progress.accuracy.same');
  };

  const label = (name: string, stat: AccuracyStat) => {
    const weeks = stat.weekly
      .map((w) => (w == null ? t('progress.accuracy.weekNone') : percent.format(w)))
      .join(', ');
    return [
      t('progress.accuracy.a11y', {
        name,
        percent: Math.round((stat.ratio ?? 0) * 100),
        questions: t('progress.accuracy.questions', { count: stat.total }),
        trend: trend(stat.change),
      }),
      t('progress.accuracy.weeksA11y', { list: weeks }),
    ].join('. ');
  };

  return { percent, trend, label };
}

/** Up/down arrow plus words, so the change never relies on color alone (ACC-05). */
function TrendBadge({ change }: { change: number | null }) {
  const { colors } = useTheme();
  const { trend } = useAccuracyText();
  const tone = change == null || change === 0 ? 'inkSoft' : change > 0 ? 'success' : 'exam';
  const icon =
    change == null || change === 0
      ? ({ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' } as const)
      : change > 0
        ? ({ ios: 'arrow.up.right', android: 'trending_up', web: 'trending_up' } as const)
        : ({ ios: 'arrow.down.right', android: 'trending_down', web: 'trending_down' } as const);

  return (
    <View style={styles.badge}>
      {change != null ? <SymbolView name={icon} size={12} weight="bold" tintColor={colors[tone]} /> : null}
      <AppText variant="footnote" color={tone}>
        {trend(change)}
      </AppText>
    </View>
  );
}

/** Four small boxes, one per week, oldest first. */
function WeekBoxes({ weekly }: { weekly: (number | null)[] }) {
  const { colors } = useTheme();
  const { percent } = useAccuracyText();
  return (
    <View style={styles.weeks}>
      {weekly.map((value, i) => (
        <View
          key={i}
          style={[
            styles.week,
            { borderColor: colors.line, backgroundColor: value == null ? 'transparent' : colors.sunken },
          ]}>
          <AppText variant="footnote" color={value == null ? 'inkFaint' : 'ink'}>
            {value == null ? '–' : percent.format(value)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/** Quiz accuracy per course and topic over the last four weeks (FR-AN-02, KPI G-03). */
export function AccuracySection({ accuracy, courses }: AccuracySectionProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { percent, label } = useAccuracyText();

  return (
    <Card>
      <View style={styles.head}>
        <AppText variant="title" accessibilityRole="header">
          {t('progress.accuracy.title')}
        </AppText>
        <AppText variant="callout" color="inkSoft">
          {accuracy.length === 0 ? t('progress.accuracy.empty') : t('progress.accuracy.intro')}
        </AppText>
      </View>

      {accuracy.map((row) => {
        const course = courses.get(row.courseId);
        const name = course?.name ?? t('progress.time.noCourse');
        return (
          <View key={row.courseId} style={[styles.course, { borderTopColor: colors.line }]}>
            <View accessible accessibilityLabel={label(name, row)} style={styles.courseBody}>
              <View style={styles.line}>
                <View style={[styles.dot, { backgroundColor: course?.color ?? colors.inkFaint }]} />
                <AppText variant="heading" style={styles.flex}>
                  {name}
                </AppText>
                <AppText variant="title">{percent.format(row.ratio ?? 0)}</AppText>
              </View>
              <View style={styles.line}>
                <AppText variant="footnote" color="inkSoft" style={styles.flex}>
                  {t('progress.accuracy.questions', { count: row.total })}
                </AppText>
                <TrendBadge change={row.change} />
              </View>
              <WeekBoxes weekly={row.weekly} />
            </View>

            {row.topics.length > 0 ? (
              <View style={styles.topics}>
                <AppText variant="footnote" color="inkSoft">
                  {t('progress.accuracy.topicsTitle')}
                </AppText>
                {row.topics.map((topic) => (
                  <View
                    key={topic.topic}
                    accessible
                    accessibilityLabel={label(topic.topic, topic)}
                    style={styles.topic}>
                    <View style={styles.line}>
                      <AppText variant="callout" style={styles.flex}>
                        {topic.topic}
                      </AppText>
                      <AppText variant="callout" style={styles.bold}>
                        {percent.format(topic.ratio ?? 0)}
                      </AppText>
                    </View>
                    <View style={styles.line}>
                      <AppText variant="footnote" color="inkSoft" style={styles.flex}>
                        {t('progress.accuracy.questions', { count: topic.total })}
                      </AppText>
                      <TrendBadge change={topic.change} />
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: {
    gap: Space.xs,
  },
  course: {
    gap: Space.md,
    paddingTop: Space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  courseBody: {
    gap: Space.sm,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  flex: {
    flex: 1,
    minWidth: 120,
  },
  bold: {
    fontWeight: '600',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  weeks: {
    flexDirection: 'row',
    gap: Space.xs,
  },
  week: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Space.xs,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  topics: {
    gap: Space.sm,
    paddingLeft: Space.lg,
  },
  topic: {
    gap: 2,
  },
});

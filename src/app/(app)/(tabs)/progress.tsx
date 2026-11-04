import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/empty-state';
import { Banner } from '@/components/ui/banner';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { useDbQuery } from '@/db/use-query';
import { courseMap } from '@/features/courses/repo';
import { AccuracySection } from '@/features/progress/components/accuracy-section';
import { AdherenceSection } from '@/features/progress/components/adherence-section';
import { MinutesSection } from '@/features/progress/components/minutes-section';
import { StatTiles } from '@/features/progress/components/stat-tiles';
import { WeekGrid } from '@/features/progress/components/week-grid';
import { PROGRESS_TABLES, loadProgressInput } from '@/features/progress/repo';
import { buildProgress } from '@/features/progress/stats';
import { addDays, formatShortDate, localeTag, todayString, weekStart } from '@/lib/dates';
import { track } from '@/services/analytics';

async function loadProgress(today: string) {
  const [input, courses] = await Promise.all([loadProgressInput(today), courseMap()]);
  return { stats: buildProgress(input, today), courses };
}

/** US-57: this week against the last weeks — time, accuracy, plan adherence and streak. */
export default function ProgressScreen() {
  const { t, i18n } = useTranslation();
  const tag = localeTag(i18n.language);
  const today = todayString();
  const monday = weekStart(today);
  const { data, error } = useDbQuery(`progress:${today}`, () => loadProgress(today), PROGRESS_TABLES);

  useFocusEffect(
    useCallback(() => {
      track('progress_viewed');
    }, []),
  );

  const subtitle = t('progress.weekRange', {
    from: formatShortDate(monday, tag),
    to: formatShortDate(addDays(monday, 6), tag),
  });

  const settingsLink = (
    <Section>
      <ListRow
        title={t('progress.settingsLink')}
        subtitle={t('progress.settingsHint')}
        icon={{ ios: 'gearshape', android: 'settings', web: 'settings' }}
        onPress={() => router.push('/settings')}
      />
    </Section>
  );

  if (error) {
    return (
      <Screen title={t('tabs.progress')} subtitle={subtitle}>
        <Banner tone="warning" message={t('progress.loadError')} />
        {settingsLink}
      </Screen>
    );
  }

  if (!data) return <Screen title={t('tabs.progress')} subtitle={subtitle} />;

  const { stats, courses } = data;

  if (!stats.hasHistory) {
    return (
      <Screen title={t('tabs.progress')} subtitle={subtitle}>
        <WeekGrid weekStart={stats.weekStart} blocksPerDay={stats.blocksPerDay} />
        <EmptyState
          title={t('progress.emptyTitle')}
          body={t('progress.emptyBody')}
          actions={[
            {
              label: t('actions.startStudying'),
              icon: { ios: 'play.fill', android: 'play_arrow' },
              onPress: () => router.navigate('/study'),
            },
          ]}
        />
        {settingsLink}
      </Screen>
    );
  }

  return (
    <Screen title={t('tabs.progress')} subtitle={subtitle}>
      <StatTiles streak={stats.streak} weekMinutes={stats.weekMinutes} adherence={stats.adherence} />
      <WeekGrid weekStart={stats.weekStart} blocksPerDay={stats.blocksPerDay} />
      <MinutesSection
        weeklyMinutes={stats.weeklyMinutes}
        weekStarts={stats.weekStarts}
        byCourse={stats.byCourse}
        courses={courses}
      />
      <AdherenceSection adherence={stats.adherence} />
      <AccuracySection accuracy={stats.accuracy} courses={courses} />
      {settingsLink}
    </Screen>
  );
}

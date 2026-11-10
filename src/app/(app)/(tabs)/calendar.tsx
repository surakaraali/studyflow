import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { useDbQuery } from '@/db/use-query';
import { blockBubbleLetter } from '@/components/bubble-row';
import { DayBubbles } from '@/features/plan/components/day-bubbles';
import { PlanBlockRow } from '@/features/plan/components/plan-block-row';
import { WeekPicker, type DayInfo } from '@/features/plan/components/week-picker';
import { loadWeek, WEEK_TABLES } from '@/features/plan/today';
import { useNow } from '@/features/plan/use-now';
import {
  addDays,
  formatDate,
  formatDayLong,
  formatMonthYear,
  localeTag,
  parseDate,
  weekStart,
} from '@/lib/dates';

export default function CalendarScreen() {
  const { t, i18n } = useTranslation();
  const tag = localeTag(i18n.language);
  const now = useNow(60_000);
  const today = formatDate(now);
  const [weekOffset, setWeekOffset] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  const monday = addDays(weekStart(today), weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const selected =
    picked && days.includes(picked) ? picked : days.includes(today) ? today : monday;

  const { data } = useDbQuery(`calendar:${monday}`, () => loadWeek(monday), WEEK_TABLES);

  const info: Record<string, DayInfo> = {};
  for (const date of days) info[date] = { blocks: 0, done: 0, exam: false };
  for (const item of data?.items ?? []) {
    const day = info[item.date];
    if (!day) continue;
    day.blocks += 1;
    if (item.status === 'done') day.done += 1;
  }
  for (const exam of data?.exams ?? []) {
    if (info[exam.date]) info[exam.date].exam = true;
  }

  const dayItems = (data?.items ?? []).filter((i) => i.date === selected);
  const dayExams = (data?.exams ?? []).filter((e) => e.date === selected);
  const weekHasBlocks = (data?.items.length ?? 0) > 0;

  // US-74: add an exam or homework from the day you're looking at. The day goes along as
  // ?date= for the forms to prefill; a past day is left out (exams can't be in the past).
  const dayParams = selected >= today ? { date: selected } : {};

  const changeWeek = (delta: number) => {
    setPicked(null);
    setWeekOffset((w) => w + delta);
  };

  return (
    <Screen title={t('tabs.calendar')} subtitle={formatMonthYear(parseDate(selected), tag)}>
      <View style={styles.week}>
        <View style={styles.nav}>
          <IconButton
            icon={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
            label={t('calendar.prevWeek')}
            onPress={() => changeWeek(-1)}
          />
          <View style={styles.navCenter}>
            {weekOffset !== 0 ? (
              <Button variant="plain" label={t('calendar.thisWeek')} onPress={() => changeWeek(-weekOffset)} />
            ) : null}
          </View>
          <IconButton
            icon={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            label={t('calendar.nextWeek')}
            onPress={() => changeWeek(1)}
          />
        </View>
        <WeekPicker days={days} today={today} selected={selected} onSelect={setPicked} info={info} />
      </View>

      {!data ? null : !data.hasCourses ? (
        <EmptyState
          title={t('calendar.emptyTitle')}
          body={t('calendar.emptyBody')}
          actions={[
            {
              label: t('actions.addCourse'),
              icon: { ios: 'plus', android: 'add' },
              onPress: () => router.push('/course/new'),
            },
          ]}
        />
      ) : (
        <>
          <View style={styles.day}>
            <AppText variant="title" accessibilityRole="header">
              {formatDayLong(selected, tag)}
            </AppText>
            {dayItems.length > 0 ? (
              <DayBubbles
                total={dayItems.length}
                done={dayItems.filter((i) => i.status === 'done').length}
                doneMask={dayItems.map((i) => i.status === 'done')}
              />
            ) : null}
          </View>

          {dayExams.length > 0 ? (
            <Section title={t('calendar.examsTitle')}>
              {dayExams.map((exam) => (
                <ListRow
                  key={exam.id}
                  title={exam.title}
                  subtitle={exam.course_name ?? undefined}
                  color={exam.course_color ?? undefined}
                  icon={{ ios: 'pencil.and.list.clipboard', android: 'assignment', web: 'assignment' }}
                  detail={exam.time ?? undefined}
                  detailColor="exam"
                  onPress={() => router.push(`/exam/${exam.id}`)}
                />
              ))}
            </Section>
          ) : null}

          {dayItems.length > 0 ? (
            <Section title={t('calendar.blocksTitle')}>
              {dayItems.map((item, index) => {
                const course = item.course_id ? data.courses.get(item.course_id) : undefined;
                return (
                  <View key={item.id} style={styles.blockRow}>
                    <PlanBlockRow
                      item={item}
                      courseName={course?.name ?? t('plan.generalReview')}
                      courseColor={course?.color}
                      topicName={item.topic_id ? data.topics.get(item.topic_id) : null}
                      letter={blockBubbleLetter(index, dayItems.length)}
                      onPress={() => router.push(`/block/${item.id}`)}
                    />
                  </View>
                );
              })}
            </Section>
          ) : (
            <AppText variant="callout" color="inkSoft">
              {weekHasBlocks ? t('calendar.dayEmpty') : t('calendar.weekEmpty')}
            </AppText>
          )}

          <Section title={t('setup.shortcuts.calendarTitle')}>
            <ListRow
              title={t('setup.shortcuts.addExam')}
              subtitle={t('setup.shortcuts.examHint')}
              icon={{ ios: 'pencil.and.list.clipboard', android: 'assignment', web: 'assignment' }}
              onPress={() => router.push({ pathname: '/exam/new', params: dayParams })}
            />
            <ListRow
              title={t('setup.shortcuts.addHomework')}
              subtitle={t('setup.shortcuts.homeworkHint')}
              icon={{ ios: 'checklist', android: 'task', web: 'task' }}
              onPress={() => router.push({ pathname: '/homework/new', params: dayParams })}
            />
          </Section>

          <Section title={t('calendar.setupTitle')}>
            <ListRow
              title={t('calendar.availability')}
              subtitle={t('calendar.availabilityHint')}
              icon={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
              onPress={() => router.push('/availability')}
            />
            <ListRow
              title={t('calendar.timetable')}
              subtitle={t('calendar.timetableHint')}
              icon={{ ios: 'building.columns', android: 'school', web: 'school' }}
              onPress={() => router.push('/timetable')}
            />
          </Section>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  week: {
    gap: Space.sm,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navCenter: {
    flex: 1,
    alignItems: 'center',
  },
  day: {
    gap: Space.md,
  },
  blockRow: {
    paddingHorizontal: Space.lg,
    paddingVertical: Space.xs,
  },
});

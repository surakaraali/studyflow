import { router } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { blockBubbleLetter, BubbleRow } from '@/components/bubble-row';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { TopEdge, useScrolled } from '@/components/ui/top-edge';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { AppText } from '@/components/ui/text';
import { BottomTabInset, Gutter, Space } from '@/constants/theme';
import { useDbQuery } from '@/db/use-query';
import { defaultDailyGoal } from '@/domain/rules';
import { ConsentBanner } from '@/features/consent/consent-banner';
import { UpcomingExams } from '@/features/exams/components/upcoming-exams';
import { DueCardsSummary } from '@/features/flashcards/components/due-cards-summary';
import { HomeworkDue } from '@/features/homework/components/homework-due';
import { DayBubbles } from '@/features/plan/components/day-bubbles';
import { PlanBlockRow } from '@/features/plan/components/plan-block-row';
import { PlanWarningBanner } from '@/features/plan/components/plan-warning-banner';
import { schedulePlanRegeneration } from '@/features/plan/regenerate';
import { nextBlock, profileSegment } from '@/features/plan/repo';
import { loadToday, TODAY_TABLES } from '@/features/plan/today';
import { useNow } from '@/features/plan/use-now';
import { ReminderPermissionCard } from '@/features/reminders/components/reminder-permission-card';
import { NewYearCard } from '@/features/setup/components/new-year-card';
import { PlanChangeBanner } from '@/features/setup/components/plan-change-banner';
import { SetupChecklist } from '@/features/setup/components/setup-checklist';
import { useFirstRunSetup } from '@/features/setup/use-first-run-setup';
import { GoalStreak } from '@/features/streak/components/goal-streak';
import { loadStreak, STREAK_TABLES } from '@/features/streak/repo';
import { loadTimer } from '@/features/timer/timer-store';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatLongDate, localeTag } from '@/lib/dates';
import { useProfile } from '@/stores/session';

export default function TodayScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { scrolled, onScroll } = useScrolled();
  const { profile } = useProfile();
  const now = useNow(60_000);
  const today = formatDate(now);

  const { data } = useDbQuery(`today:${today}`, () => loadToday(today), TODAY_TABLES);
  const { data: streak } = useDbQuery(`streak:${today}`, () => loadStreak(today), STREAK_TABLES);
  const { data: timer } = useDbQuery('timer', () => loadTimer(), ['kv']);

  // The plan also rebuilds on sign-in and on foreground; opening Today is a cheap safety net.
  useEffect(() => {
    schedulePlanRegeneration('today-open');
  }, []);

  // US-74: a brand-new student without courses gets the course picker once.
  useFirstRunSetup(data?.hasCourses);

  const segment = profileSegment(profile) ?? 'ortaokul';
  const goal = profile?.daily_goal_min ?? defaultDailyGoal(segment);
  const items = data?.items ?? [];
  const done = items.filter((i) => i.status === 'done').length;
  const next = nextBlock(items, now);
  const timerActive = timer != null && (timer.phase === 'focus' || timer.phase === 'break');
  const isIOS = Platform.OS === 'ios';

  const courseOf = (id: string | null) => (id ? data?.courses.get(id) : undefined);

  const availabilityButton = (
    <Button
      variant="secondary"
      label={t('setup.shortcuts.availability')}
      icon={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
      onPress={() => router.push('/availability')}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      onScroll={onScroll}
      scrollEventThrottle={32}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.content,
        isIOS
          ? styles.contentIOS
          : {
              paddingTop: insets.top + Space.xl,
              paddingBottom: insets.bottom + BottomTabInset + Space.xl,
            },
      ]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="display" accessibilityRole="header">
            {t('tabs.today')}
          </AppText>
          <AppText variant="callout" color="inkSoft">
            {formatLongDate(now, localeTag(i18n.language))}
          </AppText>
        </View>
        <IconButton
          icon={{ ios: 'gearshape', android: 'settings', web: 'settings' }}
          label={t('today.settings')}
          onPress={() => router.push('/settings')}
        />
      </View>

      <ConsentBanner />
      <PlanChangeBanner />
      <PlanWarningBanner />
      <NewYearCard today={today} />

      {timerActive ? (
        <Banner
          message={t('today.timerRunning')}
          actionLabel={t('today.timerOpen')}
          onAction={() => router.push('/timer')}
        />
      ) : null}

      {profile && data?.hasPlan && profile.notif_permission_asked === 0 ? (
        <ReminderPermissionCard profileId={profile.id} />
      ) : null}

      <Card>
        <AppText variant="title" accessibilityRole="header">
          {t('today.planTitle')}
        </AppText>

        {!data ? null : !data.hasCourses ? (
          <>
            <BubbleRow size="large" filled={0} />
            <AppText variant="callout" color="inkSoft">
              {t('today.planEmpty')}
            </AppText>
            <View style={styles.actions}>
              <Button
                label={t('actions.addCourse')}
                icon={{ ios: 'plus', android: 'add' }}
                onPress={() => router.push('/course/new')}
              />
              <Button
                variant="secondary"
                label={t('actions.uploadPdf')}
                icon={{ ios: 'doc.badge.plus', android: 'upload_file' }}
                onPress={() => router.navigate('/study')}
              />
              {availabilityButton}
            </View>
          </>
        ) : (
          <>
            {items.length > 0 ? (
              <>
                <DayBubbles
                  total={items.length}
                  done={done}
                  doneMask={items.map((i) => i.status === 'done')}
                  size="large"
                />
                <View style={styles.rows}>
                  {items.map((item, index) => {
                    const course = courseOf(item.course_id);
                    const isNext = next?.id === item.id;
                    return (
                      <PlanBlockRow
                        key={item.id}
                        item={item}
                        courseName={course?.name ?? t('plan.generalReview')}
                        courseColor={course?.color}
                        topicName={item.topic_id ? data.topics.get(item.topic_id) : null}
                        isNext={isNext}
                        letter={blockBubbleLetter(index, items.length)}
                        onPress={() => router.push(`/block/${item.id}`)}
                        onStart={
                          isNext && !timerActive
                            ? () => router.push({ pathname: '/timer', params: { blockId: item.id } })
                            : undefined
                        }
                      />
                    );
                  })}
                </View>
                {done === items.length ? (
                  <AppText variant="callout" color="success">
                    {t('today.allDone')}
                  </AppText>
                ) : null}
              </>
            ) : (
              <AppText variant="callout" color="inkSoft">
                {t('today.noBlocks')}
              </AppText>
            )}
            <View style={styles.actions}>
              {items.length === 0 ? availabilityButton : null}
              <Button
                variant="secondary"
                label={t('today.addManual')}
                icon={{ ios: 'square.and.pencil', android: 'edit_note', web: 'edit_note' }}
                onPress={() => router.push('/session/new')}
              />
            </View>
          </>
        )}
      </Card>

      {data?.hasCourses ? (
        <View style={styles.quickAdd}>
          <View style={styles.quickAddItem}>
            <Button
              variant="secondary"
              label={t('setup.shortcuts.addExam')}
              icon={{ ios: 'pencil.and.list.clipboard', android: 'assignment', web: 'assignment' }}
              onPress={() => router.push('/exam/new')}
              block
            />
          </View>
          <View style={styles.quickAddItem}>
            <Button
              variant="secondary"
              label={t('setup.shortcuts.addHomework')}
              icon={{ ios: 'checklist', android: 'task', web: 'task' }}
              onPress={() => router.push('/homework/new')}
              block
            />
          </View>
        </View>
      ) : null}

      <SetupChecklist />

      {data?.hasCourses ? (
        <Card>
          <GoalStreak minutesToday={data.minutesToday} goal={goal} streak={streak} />
        </Card>
      ) : null}

      <DueCardsSummary />
      <UpcomingExams />
      <HomeworkDue />
    </ScrollView>
    <TopEdge scrolled={scrolled} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Gutter,
    gap: Space.xxl,
  },
  contentIOS: {
    paddingTop: Space.xl,
    paddingBottom: Space.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.md,
  },
  headerText: {
    flex: 1,
    gap: Space.xs,
  },
  rows: {
    gap: Space.xs,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.md,
  },
  // Exam and homework shortcuts under the plan card (US-74).
  quickAdd: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.md,
    marginTop: -Space.md,
  },
  quickAddItem: {
    flexGrow: 1,
    flexBasis: 140,
  },
});

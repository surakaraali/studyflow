import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { Page } from '@/components/ui/page';
import { Section } from '@/components/ui/section';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import type { PlanItemStatus } from '@/db/types';
import { useDbQuery } from '@/db/use-query';
import { getBlockDetails, postponeBlock, setBlockStatus } from '@/features/plan/repo';
import { useNow } from '@/features/plan/use-now';
import { daysBetween, formatDate, formatDayLong, formatShortDate, localeTag } from '@/lib/dates';

const STATUS_ICON = {
  planned: { ios: 'circle', android: 'radio_button_unchecked', web: 'radio_button_unchecked' },
  done: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  skipped: { ios: 'arrow.uturn.right.circle', android: 'redo', web: 'redo' },
} as const;

export default function BlockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const tag = localeTag(i18n.language);
  const today = formatDate(useNow(60_000));
  const [busy, setBusy] = useState<'status' | 'postpone' | null>(null);

  const { data, loading } = useDbQuery(`block:${id}`, () => getBlockDetails(id), [
    'plan_items',
    'courses',
    'topics',
    'exams',
    'homework',
  ]);

  const header = <Stack.Screen options={{ title: t('block.title') }} />;

  if (loading && !data) return <Page>{header}</Page>;

  if (!data) {
    return (
      <Page>
        {header}
        <EmptyState
          title={t('block.title')}
          body={t('block.notFound')}
          actions={[{ label: t('common.back'), onPress: () => router.back() }]}
        />
      </Page>
    );
  }

  const { item, course, topic, exam, homework } = data;
  const kind = t(`plan.kind.${item.kind}`);
  const examDays = exam ? daysBetween(today, exam.date) : null;

  const changeStatus = async (status: PlanItemStatus) => {
    setBusy('status');
    try {
      await setBlockStatus(item.id, status);
      if (status !== 'planned') router.back();
    } catch {
      Alert.alert(t('common.genericError'));
    } finally {
      setBusy(null);
    }
  };

  const confirmSkip = () =>
    Alert.alert(t('block.skipConfirmTitle'), t('block.skipConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('block.skip'), style: 'destructive', onPress: () => void changeStatus('skipped') },
    ]);

  const postpone = async () => {
    setBusy('postpone');
    try {
      const slot = await postponeBlock(item.id);
      if (slot) {
        Alert.alert(
          t('block.postponedTitle'),
          t('block.postponed', { date: formatDayLong(slot.date, tag), time: slot.start }),
        );
      } else {
        Alert.alert(t('block.noSlotTitle'), t('block.noSlot'));
      }
    } catch {
      Alert.alert(t('common.genericError'));
    } finally {
      setBusy(null);
    }
  };

  const footer =
    item.status === 'planned' ? (
      <>
        <Button
          block
          label={t('block.startTimer')}
          icon={{ ios: 'timer', android: 'timer', web: 'timer' }}
          disabled={busy != null}
          onPress={() => router.push({ pathname: '/timer', params: { blockId: item.id } })}
        />
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button
              block
              variant="secondary"
              label={t('block.markDone')}
              icon={{ ios: 'checkmark', android: 'check', web: 'check' }}
              loading={busy === 'status'}
              disabled={busy != null}
              onPress={() => void changeStatus('done')}
            />
          </View>
          <View style={styles.flex}>
            <Button
              block
              variant="secondary"
              label={t('block.postpone')}
              icon={{ ios: 'calendar.badge.clock', android: 'update', web: 'update' }}
              loading={busy === 'postpone'}
              disabled={busy != null}
              onPress={() => void postpone()}
            />
          </View>
        </View>
        <Button block variant="plain" label={t('block.skip')} disabled={busy != null} onPress={confirmSkip} />
      </>
    ) : (
      <Button
        block
        variant="secondary"
        label={t('block.undo')}
        icon={{ ios: 'arrow.uturn.backward', android: 'undo', web: 'undo' }}
        loading={busy === 'status'}
        onPress={() => void changeStatus('planned')}
      />
    );

  return (
    <Page footer={footer}>
      {header}
      <View style={styles.title}>
        <AppText variant="display" accessibilityRole="header">
          {course?.name ?? t('plan.generalReview')}
        </AppText>
        <AppText variant="callout" color="inkSoft">
          {kind}
        </AppText>
      </View>

      <Section>
        <ListRow
          title={formatDayLong(item.date, tag)}
          subtitle={t('block.duration', { study: item.minutes, rest: item.break_min })}
          detail={`${item.start_time}–${item.end_time}`}
          icon={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
        />
        {course ? (
          <ListRow title={course.name} subtitle={t('block.course')} color={course.color} />
        ) : null}
        <ListRow
          title={topic?.name ?? t('block.noTopic')}
          subtitle={t('block.topic')}
          icon={{ ios: 'text.book.closed', android: 'menu_book', web: 'menu_book' }}
        />
        {exam ? (
          <ListRow
            title={
              examDays === 0
                ? t('block.examToday', { title: exam.title })
                : t('block.examCountdown', { title: exam.title, count: Math.max(0, examDays ?? 0) })
            }
            subtitle={t('block.exam')}
            detailColor="exam"
            icon={{ ios: 'pencil.and.list.clipboard', android: 'assignment', web: 'assignment' }}
            onPress={() => router.push(`/exam/${exam.id}`)}
          />
        ) : null}
        {homework ? (
          <ListRow
            title={homework.description}
            subtitle={t('block.homework')}
            icon={{ ios: 'checklist', android: 'checklist', web: 'checklist' }}
            onPress={() => router.push(`/homework/${homework.id}`)}
          />
        ) : null}
        <ListRow
          title={t(`plan.status.${item.status}`)}
          subtitle={t('block.status')}
          icon={STATUS_ICON[item.status]}
        />
      </Section>

      {item.carried_from && item.carried_from !== item.date ? (
        <AppText variant="footnote" color="inkSoft">
          {t('block.carried', { date: formatShortDate(item.carried_from, tag) })}
        </AppText>
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  title: {
    gap: Space.xs,
  },
  row: {
    flexDirection: 'row',
    gap: Space.sm,
  },
  flex: {
    flex: 1,
  },
});

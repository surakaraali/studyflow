import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Page } from '@/components/ui/page';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { useDbQuery } from '@/db/use-query';
import { ExamForm } from '@/features/exams/components/exam-form';
import { countdown, countdownText } from '@/features/exams/countdown';
import { isEstimatedOfficialDate } from '@/features/exams/official-exams';
import { deleteExam, examTopicIds, getExam, type ExamWithCourse } from '@/features/exams/repo';
import type { SchoolExamKind } from '@/features/exams/validation';
import { formatDayLong, localeTag, todayString } from '@/lib/dates';

/** US-26 edit and delete; official exams (US-27) are read-only here. */
export default function ExamScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useDbQuery(`exam:${id}`, () => getExam(id), ['exams', 'courses']);
  // The form edits the exam as it was when the screen opened.
  const [snapshot, setSnapshot] = useState<ExamWithCourse | null | undefined>(undefined);
  if (data !== undefined && snapshot === undefined) setSnapshot(data);

  if (snapshot === undefined) return <Stack.Screen options={{ title: '' }} />;
  if (snapshot === null) {
    return (
      <>
        <Stack.Screen options={{ title: t('exams.editTitle') }} />
        <Page>
          <AppText variant="callout" color="inkSoft">
            {t('exams.notFound')}
          </AppText>
        </Page>
      </>
    );
  }

  if (snapshot.kind === 'official') return <OfficialExam exam={data ?? snapshot} />;

  const remove = () =>
    Alert.alert(t('exams.deleteConfirmTitle'), t('exams.deleteConfirmBody', { title: snapshot.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteExam(snapshot.id);
          router.back();
        },
      },
    ]);

  return (
    <>
      <Stack.Screen options={{ title: t('exams.editTitle') }} />
      <ExamForm
        examId={snapshot.id}
        originalDate={snapshot.date}
        initial={{
          courseId: snapshot.course_id,
          kind: snapshot.kind as SchoolExamKind,
          title: snapshot.title,
          date: snapshot.date,
          time: snapshot.time,
          topicIds: examTopicIds(snapshot),
        }}
        onSaved={() => router.back()}
        onDelete={remove}
      />
    </>
  );
}

function OfficialExam({ exam }: { exam: ExamWithCourse }) {
  const { t, i18n } = useTranslation();
  const tag = localeTag(i18n.language);
  const value = countdown(exam.date, todayString());
  const date = formatDayLong(exam.date, tag);

  return (
    <>
      <Stack.Screen options={{ title: t('exams.officialTitle') }} />
      <Page title={exam.title}>
        <View style={styles.when}>
          <AppText variant="heading">
            {exam.time ? t('exams.dateTime', { date, time: exam.time }) : date}
          </AppText>
          <AppText variant="callout" color={value.soon ? 'exam' : 'inkSoft'}>
            {countdownText(value, t)}
          </AppText>
        </View>
        {isEstimatedOfficialDate(exam.official_key) ? (
          <Banner tone="info" message={t('exams.estimated')} />
        ) : null}
        <Card>
          <AppText variant="callout" color="inkSoft">
            {t('exams.officialBody')}
          </AppText>
          <View style={styles.action}>
            <Button
              variant="secondary"
              label={t('exams.officialLink')}
              onPress={() => router.push('/settings/profile')}
            />
          </View>
        </Card>
      </Page>
    </>
  );
}

const styles = StyleSheet.create({
  when: {
    gap: Space.xs,
  },
  action: {
    alignItems: 'flex-start',
  },
});

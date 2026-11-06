import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ExamForm } from '@/features/exams/components/exam-form';
import { addDays, todayString } from '@/lib/dates';

/** US-26: add a school exam, optionally for a given course (?courseId=). */
export default function NewExamScreen() {
  const { t } = useTranslation();
  const { courseId, date } = useLocalSearchParams<{ courseId?: string; date?: string }>();
  // Calendar passes the selected day; only a day from today on makes sense for a new exam.
  const startDate = date && date >= todayString() ? date : addDays(todayString(), 7);

  return (
    <>
      <Stack.Screen options={{ title: t('exams.newTitle') }} />
      <ExamForm
        initial={{
          courseId: courseId ?? null,
          kind: 'yazili',
          title: '',
          date: startDate,
          time: null,
          topicIds: [],
        }}
        onSaved={() => router.back()}
      />
    </>
  );
}

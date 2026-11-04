import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ExamForm } from '@/features/exams/components/exam-form';
import { addDays, todayString } from '@/lib/dates';

/** US-26: add a school exam, optionally for a given course (?courseId=). */
export default function NewExamScreen() {
  const { t } = useTranslation();
  const { courseId } = useLocalSearchParams<{ courseId?: string }>();

  return (
    <>
      <Stack.Screen options={{ title: t('exams.newTitle') }} />
      <ExamForm
        initial={{
          courseId: courseId ?? null,
          kind: 'yazili',
          title: '',
          date: addDays(todayString(), 7),
          time: null,
          topicIds: [],
        }}
        onSaved={() => router.back()}
      />
    </>
  );
}

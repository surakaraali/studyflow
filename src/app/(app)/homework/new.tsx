import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { HomeworkForm } from '@/features/homework/components/homework-form';
import { addDays, todayString } from '@/lib/dates';

/** US-29: add homework, optionally for a given course (?courseId=). */
export default function NewHomeworkScreen() {
  const { t } = useTranslation();
  const { courseId, date } = useLocalSearchParams<{ courseId?: string; date?: string }>();
  const dueDate = date && date >= todayString() ? date : addDays(todayString(), 1);

  return (
    <>
      <Stack.Screen options={{ title: t('homework.newTitle') }} />
      <HomeworkForm
        initial={{ courseId: courseId ?? null, description: '', dueDate }}
        onSaved={() => router.back()}
      />
    </>
  );
}

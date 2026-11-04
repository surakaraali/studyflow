import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { DateTimeField } from '@/components/ui/date-time-field';
import { Page } from '@/components/ui/page';
import { TextField } from '@/components/ui/text-field';
import { Space } from '@/constants/theme';
import { useDbQuery } from '@/db/use-query';
import { CourseSelect } from '@/features/courses/components/course-select';
import { listCourses } from '@/features/courses/repo';
import { saveHomework } from '@/features/homework/repo';
import {
  HOMEWORK_DESCRIPTION_MAX,
  validateHomework,
  type HomeworkDraft,
} from '@/features/homework/validation';
import { parseDate, todayString } from '@/lib/dates';

type HomeworkFormProps = {
  initial: HomeworkDraft;
  /** Set when editing */
  homeworkId?: string;
  originalDueDate?: string;
  onSaved: (id: string) => void;
  /** Shown above the fields (e.g. the done state). */
  header?: ReactNode;
  /** Shown under the fields (e.g. mark done, delete). */
  children?: ReactNode;
};

/** US-29: add or edit homework. */
export function HomeworkForm({
  initial,
  homeworkId,
  originalDueDate,
  onSaved,
  header,
  children,
}: HomeworkFormProps) {
  const { t } = useTranslation();
  const { data: courses } = useDbQuery('courses:active', () => listCourses(), ['courses']);
  const [draft, setDraft] = useState<HomeworkDraft>(initial);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const today = todayString();
  const errors = validateHomework(draft, today, originalDueDate);
  const shown = showErrors ? errors : {};
  const minDate = originalDueDate && originalDueDate < today ? originalDueDate : today;
  const noCourses = courses != null && courses.length === 0;

  const descriptionError =
    shown.description === 'required'
      ? t('homework.descriptionRequired')
      : shown.description === 'tooLong'
        ? t('homework.descriptionTooLong', { max: HOMEWORK_DESCRIPTION_MAX })
        : null;

  const save = async () => {
    if (Object.values(errors).some(Boolean)) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      const id = await saveHomework(draft, homeworkId);
      onSaved(id);
    } catch {
      Alert.alert(t('common.genericError'));
      setSaving(false);
    }
  };

  return (
    <Page footer={<Button label={t('common.save')} onPress={save} loading={saving} disabled={noCourses} block />}>
      {noCourses ? (
        <Banner
          tone="warning"
          message={t('courses.noCoursesYet')}
          actionLabel={t('courses.add')}
          onAction={() => router.push('/course/new')}
        />
      ) : null}
      {header}
      <View style={styles.fields}>
        <CourseSelect
          label={t('courses.courseLabel')}
          courses={courses ?? []}
          value={draft.courseId}
          error={shown.course ? t('courses.courseRequired') : null}
          onChange={(courseId) => setDraft((d) => ({ ...d, courseId }))}
        />
        <TextField
          label={t('homework.descriptionLabel')}
          placeholder={t('homework.descriptionPlaceholder')}
          value={draft.description}
          onChangeText={(description) => setDraft((d) => ({ ...d, description }))}
          maxLength={HOMEWORK_DESCRIPTION_MAX}
          multiline
          error={descriptionError}
        />
        <DateTimeField
          label={t('homework.dueLabel')}
          mode="date"
          value={draft.dueDate}
          minimumDate={parseDate(minDate)}
          error={shown.dueDate ? t('homework.duePast') : null}
          onChange={(dueDate) => setDraft((d) => ({ ...d, dueDate }))}
        />
      </View>
      {children}
    </Page>
  );
}

const styles = StyleSheet.create({
  fields: {
    gap: Space.lg,
  },
});

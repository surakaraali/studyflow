import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { DateTimeField } from '@/components/ui/date-time-field';
import { Page } from '@/components/ui/page';
import { Segmented } from '@/components/ui/segmented';
import { TextField } from '@/components/ui/text-field';
import { Space } from '@/constants/theme';
import { useDbQuery } from '@/db/use-query';
import { CourseSelect } from '@/features/courses/components/course-select';
import { listCourses } from '@/features/courses/repo';
import { saveExam } from '@/features/exams/repo';
import {
  EXAM_TITLE_MAX,
  hasErrors,
  SCHOOL_EXAM_KINDS,
  validateExam,
  type ExamDraft,
} from '@/features/exams/validation';
import { TopicPicker } from '@/features/topics/components/topic-picker';
import { parseDate, todayString } from '@/lib/dates';

type ExamFormProps = {
  initial: ExamDraft;
  /** Set when editing */
  examId?: string;
  /** The saved date when editing; a passed exam may keep it. */
  originalDate?: string;
  onSaved: (id: string) => void;
  onDelete?: () => void;
};

/** US-26: add or edit a school exam. */
export function ExamForm({ initial, examId, originalDate, onSaved, onDelete }: ExamFormProps) {
  const { t } = useTranslation();
  const { data: courses } = useDbQuery('courses:active', () => listCourses(), ['courses']);
  const [draft, setDraft] = useState<ExamDraft>(initial);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const today = todayString();
  const errors = validateExam(draft, today, originalDate);
  const shown = showErrors ? errors : {};
  const course = courses?.find((c) => c.id === draft.courseId);
  const defaultTitle = course ? t(`exams.defaultTitles.${draft.kind}`, { course: course.name }) : '';
  const minDate = originalDate && originalDate < today ? originalDate : today;

  const set = <K extends keyof ExamDraft>(key: K, value: ExamDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    if (hasErrors(errors)) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      const id = await saveExam({ ...draft, title: draft.title.trim() || defaultTitle }, examId);
      onSaved(id);
    } catch {
      Alert.alert(t('common.genericError'));
      setSaving(false);
    }
  };

  const noCourses = courses != null && courses.length === 0;

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

      <View style={styles.fields}>
        <CourseSelect
          label={t('courses.courseLabel')}
          courses={courses ?? []}
          value={draft.courseId}
          error={shown.course ? t('courses.courseRequired') : null}
          onChange={(courseId) =>
            setDraft((d) => ({
              ...d,
              courseId,
              topicIds: d.courseId === courseId ? d.topicIds : [],
            }))
          }
        />
        <Segmented
          label={t('exams.kindLabel')}
          options={SCHOOL_EXAM_KINDS.map((kind) => ({ value: kind, label: t(`exams.kinds.${kind}`) }))}
          value={draft.kind}
          onChange={(kind) => set('kind', kind)}
        />
        <DateTimeField
          label={t('exams.dateLabel')}
          mode="date"
          value={draft.date}
          minimumDate={parseDate(minDate)}
          error={shown.date ? t('exams.datePast') : null}
          onChange={(date) => set('date', date)}
        />
        {draft.time ? (
          <View style={styles.time}>
            <DateTimeField
              label={t('exams.timeLabel')}
              mode="time"
              value={draft.time}
              onChange={(time) => set('time', time)}
            />
            <View style={styles.inlineAction}>
              <Button variant="plain" label={t('exams.removeTime')} onPress={() => set('time', null)} />
            </View>
          </View>
        ) : (
          <View style={styles.inlineAction}>
            <Button
              variant="plain"
              label={t('exams.addTime')}
              icon={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
              onPress={() => set('time', '09:00')}
            />
          </View>
        )}
        <TextField
          label={`${t('exams.titleLabel')} (${t('common.optional').toLocaleLowerCase('tr-TR')})`}
          placeholder={defaultTitle}
          hint={defaultTitle ? t('exams.titleHint', { example: defaultTitle }) : undefined}
          error={shown.title ? t('exams.titleTooLong', { max: EXAM_TITLE_MAX }) : null}
          value={draft.title}
          onChangeText={(title) => set('title', title)}
          maxLength={EXAM_TITLE_MAX}
        />
      </View>

      <TopicPicker
        courseId={draft.courseId}
        value={draft.topicIds}
        onChange={(ids) => set('topicIds', ids)}
      />

      {onDelete ? (
        <View style={styles.inlineAction}>
          <Button variant="destructive" label={t('exams.delete')} onPress={onDelete} />
        </View>
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  fields: {
    gap: Space.lg,
  },
  time: {
    gap: Space.xs,
  },
  inlineAction: {
    alignItems: 'flex-start',
  },
});

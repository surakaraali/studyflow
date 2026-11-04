import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { AppText } from '@/components/ui/text';
import type { Course } from '@/db/types';
import { useDbQuery } from '@/db/use-query';
import { CourseForm } from '@/features/courses/components/course-form';
import { getCourse, listCourses, updateCourse } from '@/features/courses/repo';
import { validateCourseName } from '@/features/courses/validation';

/** US-22: rename a course or change its color. */
export default function EditCourseScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useDbQuery(`course:${id}`, () => getCourse(id), ['courses']);
  const [snapshot, setSnapshot] = useState<Course | null | undefined>(undefined);
  if (data !== undefined && snapshot === undefined) setSnapshot(data);

  return (
    <>
      <Stack.Screen options={{ title: t('courses.editTitle') }} />
      {snapshot === undefined ? null : snapshot === null || snapshot.deleted_at ? (
        <Page>
          <AppText variant="callout" color="inkSoft">
            {t('courses.notFound')}
          </AppText>
        </Page>
      ) : (
        <EditForm course={snapshot} />
      )}
    </>
  );
}

function EditForm({ course }: { course: Course }) {
  const { t } = useTranslation();
  const { data: courses } = useDbQuery(
    'courses:all',
    () => listCourses({ includeArchived: true }),
    ['courses'],
  );
  const [name, setName] = useState(course.name);
  const [color, setColor] = useState(course.color);
  const [showError, setShowError] = useState(false);
  const [saving, setSaving] = useState(false);
  const error = validateCourseName(name, courses ?? [], course.id);

  const save = async () => {
    if (error) {
      setShowError(true);
      return;
    }
    setSaving(true);
    try {
      await updateCourse(course.id, { name, color });
      router.back();
    } catch {
      Alert.alert(t('common.genericError'));
      setSaving(false);
    }
  };

  return (
    <Page
      footer={
        <Button label={t('common.save')} onPress={save} loading={saving} disabled={!courses} block />
      }>
      <CourseForm
        name={name}
        onChangeName={(text) => {
          setName(text);
          if (showError) setShowError(false);
        }}
        color={color}
        onChangeColor={setColor}
        error={showError ? error : null}
        onSubmit={save}
      />
    </Page>
  );
}

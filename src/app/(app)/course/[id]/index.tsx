import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { Page } from '@/components/ui/page';
import { Section } from '@/components/ui/section';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import type { Course } from '@/db/types';
import { useDbQuery } from '@/db/use-query';
import {
  archiveCourse,
  courseLinkCounts,
  deleteCourse,
  getCourse,
  unarchiveCourse,
} from '@/features/courses/repo';
import { ExamRow } from '@/features/exams/components/exam-row';
import { listExams } from '@/features/exams/repo';
import { HomeworkRow } from '@/features/homework/components/homework-row';
import { listHomework } from '@/features/homework/repo';
import { TopicList } from '@/features/topics/components/topic-list';
import { todayString } from '@/lib/dates';

/** Course detail: upcoming exams, homework, topics, materials; edit, archive, delete. */
export default function CourseScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: course } = useDbQuery(`course:${id}`, () => getCourse(id), ['courses']);
  // Set while deleting, so the screen does not flash "not found" on the way out.
  const [leaving, setLeaving] = useState(false);

  if (course === undefined || leaving) return <Stack.Screen options={{ title: '' }} />;
  if (course === null || course.deleted_at) {
    return (
      <>
        <Stack.Screen options={{ title: '' }} />
        <Page>
          <AppText variant="callout" color="inkSoft">
            {t('courses.notFound')}
          </AppText>
        </Page>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: course.name,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('courses.editA11y', { name: course.name })}
              hitSlop={8}
              onPress={() => router.push({ pathname: '/course/[id]/edit', params: { id: course.id } })}
              style={styles.headerButton}>
              <AppText variant="body" color="pen">
                {t('courses.edit')}
              </AppText>
            </Pressable>
          ),
        }}
      />
      <CourseDetail course={course} onLeaving={() => setLeaving(true)} />
    </>
  );
}

function CourseDetail({ course, onLeaving }: { course: Course; onLeaving: () => void }) {
  const { t } = useTranslation();
  const today = todayString();
  const [showDone, setShowDone] = useState(false);

  const { data: exams } = useDbQuery(
    `course-exams:${course.id}:${today}`,
    () => listExams({ courseId: course.id, from: today, includeArchivedCourses: true }),
    ['exams', 'courses'],
  );
  const { data: homework } = useDbQuery(
    `course-homework:${course.id}`,
    () => listHomework({ courseId: course.id, includeArchivedCourses: true }),
    ['homework', 'courses'],
  );
  const open = (homework ?? []).filter((h) => h.done_at == null);
  const done = (homework ?? []).filter((h) => h.done_at != null).reverse();

  const archive = () =>
    Alert.alert(t('courses.archiveConfirmTitle', { name: course.name }), t('courses.archiveConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('courses.archiveAction'), onPress: () => archiveCourse(course.id) },
    ]);

  const remove = async () => {
    const counts = await courseLinkCounts(course.id);
    const parts = [
      counts.exams > 0 ? t('courses.countExams', { count: counts.exams }) : null,
      counts.homework > 0 ? t('courses.countHomework', { count: counts.homework }) : null,
      counts.documents > 0 ? t('courses.countDocuments', { count: counts.documents }) : null,
    ].filter((p): p is string => p != null);
    const items =
      parts.length <= 1
        ? parts.join('')
        : `${parts.slice(0, -1).join(', ')} ${t('courses.and')} ${parts[parts.length - 1]}`;

    Alert.alert(
      t('courses.deleteConfirmTitle', { name: course.name }),
      parts.length > 0 ? t('courses.deleteConfirmBody', { items }) : t('courses.deleteConfirmBodyEmpty'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            onLeaving();
            await deleteCourse(course.id);
            router.back();
          },
        },
      ],
    );
  };

  const addAction = (label: string, onPress: () => void) => (
    <Button variant="plain" label={label} icon={{ ios: 'plus', android: 'add', web: 'add' }} onPress={onPress} />
  );

  return (
    <Page>
      {exams && homework ? (
        <View style={styles.header} accessible>
          <View style={[styles.swatch, { backgroundColor: course.color }]} />
          <AppText variant="callout" color="inkSoft" style={styles.flex}>
            {exams.length + open.length > 0
              ? [
                  exams.length > 0 ? t('courses.summaryExams', { count: exams.length }) : null,
                  open.length > 0 ? t('courses.summaryHomework', { count: open.length }) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : t('courses.summaryNone')}
          </AppText>
        </View>
      ) : null}

      {course.archived_at ? (
        <Banner
          tone="info"
          message={t('courses.archivedBanner')}
          actionLabel={t('courses.unarchive')}
          onAction={() => unarchiveCourse(course.id)}
        />
      ) : null}

      <View style={styles.block}>
        <Section
          title={t('courses.examsTitle')}
          action={addAction(t('exams.add'), () =>
            router.push({ pathname: '/exam/new', params: { courseId: course.id } }),
          )}>
          {(exams ?? []).map((exam) => (
            <ExamRow key={exam.id} exam={exam} today={today} showCourse={false} />
          ))}
        </Section>
        {exams && exams.length === 0 ? (
          <AppText variant="callout" color="inkSoft">
            {t('courses.examsEmpty')}
          </AppText>
        ) : null}
      </View>

      <View style={styles.block}>
        <Section
          title={t('courses.homeworkTitle')}
          action={addAction(t('homework.add'), () =>
            router.push({ pathname: '/homework/new', params: { courseId: course.id } }),
          )}>
          {open.map((item) => (
            <HomeworkRow key={item.id} homework={item} today={today} showCourse={false} />
          ))}
          {showDone
            ? done.map((item) => (
                <HomeworkRow key={item.id} homework={item} today={today} showCourse={false} />
              ))
            : null}
        </Section>
        {homework && open.length === 0 && !showDone ? (
          <AppText variant="callout" color="inkSoft">
            {t('courses.homeworkEmpty')}
          </AppText>
        ) : null}
        {done.length > 0 ? (
          <View style={styles.inline}>
            <Button
              variant="plain"
              label={showDone ? t('courses.hideDone') : t('courses.showDone', { count: done.length })}
              onPress={() => setShowDone((v) => !v)}
            />
          </View>
        ) : null}
      </View>

      <TopicList courseId={course.id} />

      <Section title={t('courses.materialsTitle')} footer={t('courses.materialsFooter')}>
        <ListRow
          title={t('actions.uploadPdf')}
          icon={{ ios: 'doc.badge.plus', android: 'upload_file', web: 'upload_file' }}
          onPress={() => router.push({ pathname: '/document/upload', params: { courseId: course.id } })}
        />
      </Section>

      <View style={styles.dangerZone}>
        {course.archived_at ? (
          <Button
            variant="secondary"
            label={t('courses.unarchive')}
            icon={{ ios: 'tray.and.arrow.up', android: 'unarchive', web: 'unarchive' }}
            onPress={() => unarchiveCourse(course.id)}
          />
        ) : (
          <Button
            variant="secondary"
            label={t('courses.archive')}
            icon={{ ios: 'archivebox', android: 'archive', web: 'archive' }}
            onPress={archive}
          />
        )}
        <Button variant="destructive" label={t('courses.delete')} onPress={remove} />
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    paddingHorizontal: Space.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  swatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  flex: {
    flex: 1,
  },
  block: {
    gap: Space.sm,
  },
  inline: {
    alignItems: 'flex-start',
  },
  dangerZone: {
    alignItems: 'flex-start',
    gap: Space.md,
    marginTop: Space.lg,
  },
});

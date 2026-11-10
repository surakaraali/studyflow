import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import type { Course } from '@/db/types';
import { useDbQuery } from '@/db/use-query';
import { getAvailability } from '@/features/availability/repo';
import {
  listArchivedCourses,
  listCourseSummaries,
  unarchiveCourse,
  type CourseSummary,
} from '@/features/courses/repo';
import { formatRanges } from '@/features/timetable/ranges';
import { listTimetable } from '@/features/timetable/repo';
import { useTheme } from '@/hooks/use-theme';
import { todayString } from '@/lib/dates';

export default function CoursesScreen() {
  const { t } = useTranslation();
  const today = todayString();
  const { data: courses } = useDbQuery(
    `courses:summaries:${today}`,
    () => listCourseSummaries(today),
    ['courses', 'exams', 'homework'],
  );
  const { data: archived } = useDbQuery('courses:archived', () => listArchivedCourses(), ['courses']);

  if (!courses || !archived) return <Screen title={t('tabs.courses')} />;

  const empty = courses.length === 0 && archived.length === 0;

  return (
    <Screen title={t('tabs.courses')}>
      {empty ? (
        <EmptyState
          title={t('courses.emptyTitle')}
          body={t('courses.emptyBody')}
          actions={[
            {
              label: t('actions.addCourse'),
              icon: { ios: 'plus', android: 'add', web: 'add' },
              onPress: () => router.push('/course/new'),
            },
          ]}
        />
      ) : (
        <>
          <View style={styles.actions}>
            <Button
              label={t('actions.addCourse')}
              icon={{ ios: 'plus', android: 'add', web: 'add' }}
              onPress={() => router.push('/course/new')}
            />
          </View>
          {courses.length > 0 ? (
            <Section>
              {courses.map((course) => (
                <CourseRow key={course.id} course={course} />
              ))}
            </Section>
          ) : null}
        </>
      )}

      <WeekSection />

      {archived.length > 0 ? (
        <Section title={t('courses.archiveTitle')} footer={t('courses.archiveFooter')}>
          {archived.map((course) => (
            <ArchivedRow key={course.id} course={course} />
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}

function CourseRow({ course }: { course: CourseSummary }) {
  const { t } = useTranslation();
  const parts = [
    course.exam_count > 0 ? t('courses.summaryExams', { count: course.exam_count }) : null,
    course.homework_count > 0 ? t('courses.summaryHomework', { count: course.homework_count }) : null,
  ].filter(Boolean);

  return (
    <ListRow
      title={course.name}
      subtitle={parts.length > 0 ? parts.join(' · ') : t('courses.summaryNone')}
      color={course.color}
      onPress={() => router.push({ pathname: '/course/[id]', params: { id: course.id } })}
    />
  );
}

/** School timetable and study hours: what the plan works around. */
function WeekSection() {
  const { t } = useTranslation();
  const { data: slots } = useDbQuery('timetable', () => listTimetable(), ['timetable_slots']);
  const { data: availability } = useDbQuery('availability', () => getAvailability(), [
    'availability',
    'profile',
  ]);

  const timetableSubtitle =
    slots == null
      ? undefined
      : slots.length === 0
        ? t('courses.timetableEmpty')
        : t('courses.timetableSummary', { count: slots.length });
  const availabilitySubtitle =
    availability == null
      ? undefined
      : availability.isDefault
        ? t('courses.availabilityDefault')
        : t('courses.availabilitySummary', {
            weekday: formatRanges(availability.weekday) || t('courses.availabilityNone'),
            weekend: formatRanges(availability.weekend) || t('courses.availabilityNone'),
          });

  return (
    <Section title={t('courses.weekTitle')} footer={t('courses.weekFooter')}>
      <ListRow
        title={t('courses.timetableRow')}
        subtitle={timetableSubtitle}
        icon={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }}
        onPress={() => router.push('/timetable')}
      />
      <ListRow
        title={t('courses.availabilityRow')}
        subtitle={availabilitySubtitle}
        icon={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
        onPress={() => router.push('/availability')}
      />
    </Section>
  );
}

/** Opens the course, with a separate button to bring it back from the archive. */
function ArchivedRow({ course }: { course: Course }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={styles.archivedRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={course.name}
        onPress={() => router.push({ pathname: '/course/[id]', params: { id: course.id } })}
        style={({ pressed }) => [styles.archivedName, pressed && { backgroundColor: colors.sunken }]}>
        <View style={[styles.dot, { backgroundColor: course.color }]} />
        <AppText variant="body" color="inkSoft" style={styles.flex}>
          {course.name}
        </AppText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('courses.unarchiveA11y', { name: course.name })}
        hitSlop={4}
        onPress={() => unarchiveCourse(course.id)}
        style={({ pressed }) => [styles.unarchive, pressed && { opacity: 0.6 }]}>
        <AppText variant="callout" color="pen" style={styles.unarchiveText}>
          {t('courses.unarchive')}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.md,
  },
  archivedRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  archivedName: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingLeft: Space.lg,
    paddingVertical: Space.sm + 2,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  flex: {
    flex: 1,
  },
  unarchive: {
    minWidth: 44,
    justifyContent: 'center',
    paddingHorizontal: Space.lg,
  },
  unarchiveText: {
    fontWeight: '600',
  },
});

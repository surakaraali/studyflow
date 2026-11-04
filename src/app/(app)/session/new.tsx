import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { DateTimeField } from '@/components/ui/date-time-field';
import { Page } from '@/components/ui/page';
import { Segmented } from '@/components/ui/segmented';
import { Stepper } from '@/components/ui/stepper';
import { AppText } from '@/components/ui/text';
import { useDbQuery } from '@/db/use-query';
import { blockRules, MANUAL_SESSION_RANGE } from '@/domain/rules';
import { listCourses } from '@/features/courses/repo';
import { profileSegment } from '@/features/plan/repo';
import { addStudySession, validateManualSession, type ManualSessionError } from '@/features/sessions/repo';
import { listTopics } from '@/features/topics/repo';
import { todayString } from '@/lib/dates';
import { useProfile } from '@/stores/session';

const NO_TOPIC = '';

/** Rounds to the stepper's 5-minute steps inside the allowed range. */
function startMinutes(value: number) {
  const rounded = Math.round(value / 5) * 5;
  return Math.min(MANUAL_SESSION_RANGE.max, Math.max(MANUAL_SESSION_RANGE.min, rounded));
}

/** US-55: log study done without the timer. Counts for the streak and the daily goal. */
export default function NewSessionScreen() {
  const params = useLocalSearchParams<{ courseId?: string }>();
  const { t } = useTranslation();
  const { profile } = useProfile();
  const today = todayString();

  const { data: courses } = useDbQuery('courses:active', () => listCourses(), ['courses']);
  const [courseId, setCourseId] = useState<string | null>(params.courseId ?? null);
  const [topicId, setTopicId] = useState<string>(NO_TOPIC);
  const { data: topics } = useDbQuery(
    `topics:${courseId ?? ''}`,
    () => (courseId ? listTopics(courseId) : Promise.resolve([])),
    ['topics'],
  );
  const segment = profileSegment(profile) ?? 'ortaokul';
  const [minutes, setMinutes] = useState(() =>
    startMinutes(profile?.block_min ?? blockRules(segment).study),
  );
  const [date, setDate] = useState(today);
  const [error, setError] = useState<ManualSessionError | null>(null);
  const [saving, setSaving] = useState(false);

  const header = <Stack.Screen options={{ title: t('session.title') }} />;

  if (courses && courses.length === 0) {
    return (
      <Page>
        {header}
        <EmptyState
          title={t('session.title')}
          body={t('session.noCourses')}
          actions={[
            {
              label: t('actions.addCourse'),
              icon: { ios: 'plus', android: 'add' },
              onPress: () => router.replace('/course/new'),
            },
          ]}
        />
      </Page>
    );
  }

  const save = async () => {
    const problem = validateManualSession({ courseId, minutes, date }, todayString());
    setError(problem);
    if (problem) return;
    setSaving(true);
    try {
      await addStudySession({
        courseId,
        topicId: topicId === NO_TOPIC ? null : topicId,
        planItemId: null,
        date,
        minutes,
        source: 'manual',
        startedAt: null,
        endedAt: null,
      });
      router.back();
    } catch {
      setSaving(false);
      Alert.alert(t('session.saveError'));
    }
  };

  const errorText =
    error === 'course'
      ? t('session.pickCourse')
      : error === 'minutes'
        ? t('session.minutesError', MANUAL_SESSION_RANGE)
        : error === 'future'
          ? t('session.futureError')
          : null;

  return (
    <Page
      intro={t('session.intro')}
      footer={<Button block label={t('session.save')} loading={saving} onPress={() => void save()} />}>
      {header}
      <Segmented
        wrap
        label={t('session.course')}
        options={(courses ?? []).map((c) => ({ value: c.id, label: c.name }))}
        value={courseId}
        onChange={(id) => {
          setCourseId(id);
          setTopicId(NO_TOPIC);
          if (error === 'course') setError(null);
        }}
      />
      {courseId && topics && topics.length > 0 ? (
        <Segmented
          wrap
          label={`${t('session.topic')} (${t('common.optional')})`}
          options={[
            { value: NO_TOPIC, label: t('session.noTopic') },
            ...topics.map((topic) => ({ value: topic.id, label: topic.name })),
          ]}
          value={topicId}
          onChange={setTopicId}
        />
      ) : null}
      <Stepper
        label={t('session.minutes')}
        value={minutes}
        onChange={setMinutes}
        min={MANUAL_SESSION_RANGE.min}
        max={MANUAL_SESSION_RANGE.max}
        step={5}
        format={(v) => t('common.minutes', { count: v })}
      />
      <DateTimeField
        label={t('session.date')}
        mode="date"
        value={date}
        onChange={setDate}
        maximumDate={new Date()}
      />
      {errorText ? (
        <AppText variant="footnote" color="exam" accessibilityRole="alert">
          {errorText}
        </AppText>
      ) : null}
    </Page>
  );
}

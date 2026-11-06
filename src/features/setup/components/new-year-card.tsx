import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import type { Course, Profile } from '@/db/types';
import { useDbQuery } from '@/db/use-query';
import { patch } from '@/db/write';
import { applyGradeChange } from '@/features/account/onboarding-logic';
import { CheckRow } from '@/features/courses/components/check-row';
import { archiveCourse } from '@/features/courses/repo';
import { syncOfficialExams } from '@/features/exams/official';
import { schedulePlanRegeneration } from '@/features/plan/regenerate';
import { formatDate } from '@/lib/dates';
import { useProfile } from '@/stores/session';

import { answerNewYear, coursesOutsideGrade, newYearPrompt, type NewYearPrompt } from '../new-year';
import { listActiveCourses, loadNewYearData, NEW_YEAR_TABLES, saveNewYearMemory } from '../repo';

/** After "Evet" the card walks through two more steps before it closes. */
type Stage =
  | { kind: 'ask' }
  /** Writing the answer; the question stays frozen while the profile changes under it. */
  | { kind: 'answering'; prompt: NewYearPrompt; moved: boolean }
  | { kind: 'archive'; grade: number; courses: Course[] }
  | { kind: 'done'; grade: number }
  | { kind: 'closed' };

/** Same writes as saving a new grade on the profile screen. */
async function moveToGrade(profile: Profile, grade: number) {
  const { changes } = applyGradeChange(profile, grade);
  await patch('profile', profile.id, changes);
  schedulePlanRegeneration('profile');
  if (changes.target_exam !== profile.target_exam || changes.track !== profile.track) {
    await syncOfficialExams(changes.target_exam, changes.track);
  }
}

/**
 * US-78: from 1 September (or once the target exam has passed) Today asks "X. sınıfa geçtin
 * mi?". "Evet" applies the grade change the profile screen uses (segment rules, target exam,
 * official exams, plan rebuild) and offers to archive courses the new grade doesn't have.
 * "Hayır" hides the card for that school year.
 */
export function NewYearCard({ today }: { today: string }) {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const { data } = useDbQuery('setup:newYear', () => loadNewYearData(), NEW_YEAR_TABLES);
  const [stage, setStage] = useState<Stage>({ kind: 'ask' });

  if (!profile || !data || stage.kind === 'closed') return null;
  if (stage.kind === 'archive') {
    return (
      <ArchiveStep
        grade={stage.grade}
        courses={stage.courses}
        onDone={() => setStage({ kind: 'done', grade: stage.grade })}
      />
    );
  }
  if (stage.kind === 'done') {
    return <DoneStep grade={stage.grade} onClose={() => setStage({ kind: 'closed' })} />;
  }

  const prompt =
    stage.kind === 'answering'
      ? stage.prompt
      : newYearPrompt({
          today,
          createdOn: formatDate(new Date(profile.created_at)),
          grade: profile.grade,
          targetExamDate: data.targetExamDate,
          memory: data.memory,
        });
  if (!prompt) return null;

  const answer = async (moved: boolean) => {
    setStage({ kind: 'answering', prompt, moved });
    try {
      if (moved) await moveToGrade(profile, prompt.nextGrade);
      await saveNewYearMemory(answerNewYear(data.memory, prompt, moved));
      if (!moved) {
        setStage({ kind: 'closed' });
        return;
      }
      const outside = coursesOutsideGrade(await listActiveCourses(), prompt.nextGrade, profile.track);
      setStage(
        outside.length > 0
          ? { kind: 'archive', grade: prompt.nextGrade, courses: outside }
          : { kind: 'done', grade: prompt.nextGrade },
      );
    } catch {
      Alert.alert(t('common.genericError'));
      setStage({ kind: 'ask' });
    }
  };

  const busy = stage.kind === 'answering' ? (stage.moved ? 'yes' : 'no') : null;

  return (
    <Card>
      <View style={styles.text}>
        <AppText variant="title" accessibilityRole="header">
          {t(`newYear.title.${prompt.reason}`)}
        </AppText>
        <AppText variant="heading">{t('newYear.question', { grade: prompt.nextGrade })}</AppText>
        <AppText variant="callout" color="inkSoft">
          {t('newYear.body')}
        </AppText>
      </View>
      <View style={styles.actions}>
        <Button
          label={t('newYear.yes', { grade: prompt.nextGrade })}
          icon={{ ios: 'graduationcap', android: 'school', web: 'school' }}
          loading={busy === 'yes'}
          disabled={busy != null}
          onPress={() => void answer(true)}
        />
        <Button
          variant="plain"
          label={t('newYear.no', { grade: prompt.grade })}
          loading={busy === 'no'}
          disabled={busy != null}
          onPress={() => void answer(false)}
        />
      </View>
    </Card>
  );
}

function ArchiveStep({ grade, courses, onDone }: { grade: number; courses: Course[]; onDone: () => void }) {
  const { t } = useTranslation();
  // Every course starts ticked; the student keeps the ones they still take.
  const [kept, setKept] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const chosen = courses.filter((c) => !kept.includes(c.id));

  const toggle = (id: string) =>
    setKept((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]));

  const archive = async () => {
    setBusy(true);
    try {
      for (const course of chosen) await archiveCourse(course.id);
      onDone();
    } catch {
      Alert.alert(t('common.genericError'));
      setBusy(false);
    }
  };

  return (
    <Card>
      <View style={styles.text}>
        <AppText variant="title" accessibilityRole="header">
          {t('newYear.archiveTitle', { grade })}
        </AppText>
        <AppText variant="callout" color="inkSoft">
          {t('newYear.archiveBody')}
        </AppText>
      </View>
      <View style={styles.list}>
        {courses.map((course) => (
          <CheckRow
            key={course.id}
            title={course.name}
            color={course.color}
            checked={!kept.includes(course.id)}
            onToggle={() => toggle(course.id)}
          />
        ))}
      </View>
      <View style={styles.actions}>
        <Button
          label={t('newYear.archive', { count: chosen.length })}
          icon={{ ios: 'archivebox', android: 'archive', web: 'archive' }}
          loading={busy}
          disabled={chosen.length === 0}
          onPress={() => void archive()}
        />
        <Button variant="plain" label={t('newYear.keepAll')} disabled={busy} onPress={onDone} />
      </View>
    </Card>
  );
}

function DoneStep({ grade, onClose }: { grade: number; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Card>
      <View style={styles.text}>
        <AppText variant="title" accessibilityRole="header">
          {t('newYear.doneTitle', { grade })}
        </AppText>
        <AppText variant="callout" color="inkSoft">
          {t('newYear.doneBody')}
        </AppText>
      </View>
      <View style={styles.actions}>
        <Button
          label={t('newYear.addCourses')}
          icon={{ ios: 'plus', android: 'add', web: 'add' }}
          onPress={() => {
            onClose();
            router.push('/course/new');
          }}
        />
        <Button variant="plain" label={t('common.close')} onPress={onClose} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  text: {
    gap: Space.sm,
  },
  list: {
    marginHorizontal: -Space.lg,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Space.md,
  },
});

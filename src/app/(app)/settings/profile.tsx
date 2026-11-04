import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { DateTimeField } from '@/components/ui/date-time-field';
import { Page } from '@/components/ui/page';
import { Segmented } from '@/components/ui/segmented';
import { Stepper } from '@/components/ui/stepper';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Space } from '@/constants/theme';
import type { Profile } from '@/db/types';
import { patch } from '@/db/write';
import {
  blockRules,
  breakMinutesFor,
  clampBlockMinutes,
  segmentForGrade,
  type TargetExam,
  type Track,
} from '@/domain/rules';
import {
  applyGradeChange,
  clampDailyGoal,
  consentStatusForAge,
  DAILY_GOAL_STEP,
  dailyGoalRange,
  needsTrack,
  NICKNAME_MAX,
  normalizeNickname,
  segmentDefaults,
  targetExamChoices,
  TRACKS,
} from '@/features/account/onboarding-logic';
import { syncOfficialExams } from '@/features/exams/official';
import { schedulePlanRegeneration } from '@/features/plan/regenerate';
import { useProfile } from '@/stores/session';

const SUPPORTED_GRADES = [5, 6, 7, 8, 9, 10, 11, 12];
/** Changes to these columns rebuild the plan. */
const PLAN_COLUMNS = ['grade', 'bedtime', 'wake_time', 'block_min', 'break_min', 'daily_goal_min'];

/** US-12: nickname, grade, sleep, daily goal, block length, target exam and track. */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const { profile, age } = useProfile();

  return (
    <>
      <Stack.Screen options={{ title: t('profile.title') }} />
      {profile ? <ProfileForm profile={profile} age={age} /> : null}
    </>
  );
}

function ProfileForm({ profile, age }: { profile: Profile; age: number | null }) {
  const { t } = useTranslation();
  const initialSegment = segmentForGrade(profile.grade ?? 5);
  const defaults = segmentDefaults(initialSegment);

  const [nickname, setNickname] = useState(profile.nickname ?? '');
  const [grade, setGrade] = useState(profile.grade ?? 5);
  const [target, setTarget] = useState<TargetExam | null>(profile.target_exam);
  const [track, setTrack] = useState<Track | null>(profile.track);
  const [bedtime, setBedtime] = useState(profile.bedtime ?? defaults.bedtime);
  const [wake, setWake] = useState(profile.wake_time ?? defaults.wake);
  const [dailyGoal, setDailyGoal] = useState(profile.daily_goal_min ?? defaults.dailyGoal);
  const [blockMin, setBlockMin] = useState(profile.block_min ?? defaults.blockMin);
  const [segmentNotice, setSegmentNotice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const segment = segmentForGrade(grade);
  const block = blockRules(segment);
  const goalRange = dailyGoalRange(segment);
  const minutes = (value: number) => t('common.minutes', { count: value });

  const changeGrade = (next: number) => {
    const { segmentChanged, changes } = applyGradeChange(
      { grade, segment, target_exam: target, track, block_min: blockMin, daily_goal_min: dailyGoal },
      next,
    );
    setGrade(next);
    setTarget(changes.target_exam);
    setTrack(changes.track);
    setBlockMin(changes.block_min);
    setDailyGoal(changes.daily_goal_min);
    if (segmentChanged) setSegmentNotice(true);
  };

  const save = async () => {
    setBusy(true);
    setFailed(false);
    const blockClamped = clampBlockMinutes(segment, blockMin);
    const next: Record<string, unknown> = {
      nickname: normalizeNickname(nickname),
      grade,
      segment,
      target_exam: target,
      track: needsTrack(grade, target) ? track : null,
      bedtime,
      wake_time: wake,
      daily_goal_min: clampDailyGoal(segment, dailyGoal),
      block_min: blockClamped,
      break_min: breakMinutesFor(segment, blockClamped),
      consent_status: consentStatusForAge(age, profile.consent_status),
    };
    const current = profile as unknown as Record<string, unknown>;
    const changed = Object.keys(next).filter((key) => current[key] !== next[key]);

    try {
      if (changed.length > 0) {
        await patch('profile', profile.id, Object.fromEntries(changed.map((key) => [key, next[key]])));
      }
      if (changed.some((key) => PLAN_COLUMNS.includes(key))) schedulePlanRegeneration('profile');
      if (changed.includes('target_exam') || changed.includes('track')) {
        await syncOfficialExams(target, next.track as Track | null);
      }
      if (router.canGoBack()) router.back();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const examOptions = [
    { value: 'none' as const, label: t('profile.noTarget') },
    ...targetExamChoices(grade).map((exam) => ({ value: exam, label: exam })),
  ];

  return (
    <Page footer={<Button label={t('common.save')} onPress={save} loading={busy} block />}>
      <View style={styles.group}>
        <AppText variant="title" accessibilityRole="header">
          {t('profile.about')}
        </AppText>
        <TextField
          label={t('profile.nickname')}
          hint={t('profile.nicknameHint')}
          value={nickname}
          onChangeText={setNickname}
          maxLength={NICKNAME_MAX}
          autoCorrect={false}
          autoComplete="off"
          textContentType="nickname"
        />
      </View>

      <View style={styles.group}>
        <AppText variant="title" accessibilityRole="header">
          {t('profile.grade')}
        </AppText>
        <Segmented
          wrap
          options={SUPPORTED_GRADES.map((value) => ({
            value,
            label: String(value),
            a11yLabel: t('profile.gradeOption', { grade: value }),
          }))}
          value={grade}
          onChange={changeGrade}
        />
        <AppText variant="footnote" color="inkSoft">
          {t('profile.gradeFooter')}
        </AppText>
        {segmentNotice ? <Banner tone="info" message={t('profile.segmentChanged')} /> : null}
      </View>

      {examOptions.length > 1 ? (
        <View style={styles.group}>
          <Segmented<TargetExam | 'none'>
            label={t('profile.targetExam')}
            options={examOptions}
            value={target ?? 'none'}
            onChange={(value) => setTarget(value === 'none' ? null : value)}
          />
          {needsTrack(grade, target) ? (
            <Segmented<Track | 'none'>
              wrap
              label={t('profile.track')}
              options={[
                { value: 'none', label: t('profile.noTrack') },
                ...TRACKS.map((value) => ({ value, label: t(`onboarding.tracks.${value}`) })),
              ]}
              value={track ?? 'none'}
              onChange={(value) => setTrack(value === 'none' ? null : value)}
            />
          ) : null}
        </View>
      ) : null}

      <View style={styles.group}>
        <AppText variant="title" accessibilityRole="header">
          {t('profile.study')}
        </AppText>
        <Stepper
          label={t('profile.dailyGoal')}
          value={dailyGoal}
          min={goalRange.min}
          max={goalRange.max}
          step={DAILY_GOAL_STEP}
          format={minutes}
          onChange={setDailyGoal}
        />
        <Stepper
          label={t('profile.block')}
          value={blockMin}
          min={block.min}
          max={block.max}
          step={5}
          format={minutes}
          onChange={setBlockMin}
        />
        <AppText variant="footnote" color="inkSoft">
          {t('profile.breakNote', { count: breakMinutesFor(segment, blockMin) })}
        </AppText>
      </View>

      <View style={styles.group}>
        <AppText variant="title" accessibilityRole="header">
          {t('profile.sleep')}
        </AppText>
        <DateTimeField label={t('profile.bedtime')} mode="time" value={bedtime} onChange={setBedtime} />
        <DateTimeField label={t('profile.wake')} mode="time" value={wake} onChange={setWake} />
        <AppText variant="footnote" color="inkSoft">
          {t('profile.sleepFooter')}
        </AppText>
      </View>

      {failed ? <Banner tone="warning" message={t('profile.saveError')} /> : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Space.md,
  },
});

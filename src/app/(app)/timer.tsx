import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { AppText } from '@/components/ui/text';
import { Fonts, Space } from '@/constants/theme';
import { useDbQuery } from '@/db/use-query';
import { useNow } from '@/features/plan/use-now';
import { elapsedSeconds, formatClock, isRunning, remainingSeconds } from '@/features/timer/clock';
import {
  loadTimer,
  pauseTimer,
  resumeTimer,
  settleTimer,
  startBreak,
  startTimerFor,
  stopTimer,
  timerLabel,
} from '@/features/timer/timer-store';
import { useProfile } from '@/stores/session';

/**
 * Focus timer (US-54). Kept plain on purpose (USE-08): what you study, the time left and
 * two buttons. Ticks once a second only while running and on screen (PERF-09).
 */
export default function TimerScreen() {
  const { blockId, courseId } = useLocalSearchParams<{ blockId?: string; courseId?: string }>();
  const { t } = useTranslation();
  const { profile } = useProfile();
  const started = useRef(false);

  const { data: state, loading } = useDbQuery('timer', () => loadTimer(), ['kv']);
  const running = state ? isRunning(state) : false;
  const now = useNow(1000, running);
  const remaining = state ? remainingSeconds(state, now.getTime()) : 0;
  const { data: label } = useDbQuery(
    `timer-label:${state?.courseId ?? ''}:${state?.topicId ?? ''}`,
    () => timerLabel(state ?? null),
    ['courses', 'topics'],
  );

  // Opened from a block or a course: start right away (one open timer at a time).
  useEffect(() => {
    if (loading || state || started.current || (!blockId && !courseId)) return;
    started.current = true;
    void startTimerFor({ blockId, courseId }, profile);
  }, [loading, state, blockId, courseId, profile]);

  // The phase reached zero: save the session / end the break.
  useEffect(() => {
    if (running && remaining === 0) void settleTimer();
  }, [running, remaining]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const confirmStop = () => {
    if (!state) return;
    if (state.phase === 'break') {
      void stopTimer().then(close);
      return;
    }
    const minutes = Math.floor(elapsedSeconds(state, Date.now()) / 60);
    Alert.alert(t('timer.cancelTitle'), t('timer.cancelBody', { count: minutes }), [
      { text: t('timer.cancelKeep'), style: 'cancel' },
      { text: t('timer.cancelDiscard'), style: 'destructive', onPress: () => void stopTimer().then(close) },
      ...(minutes >= 1
        ? [{ text: t('timer.cancelSave'), onPress: () => void stopTimer({ save: true }).then(close) }]
        : []),
    ]);
  };

  const header = <Stack.Screen options={{ title: t('timer.title') }} />;

  if (!state) {
    // With a block or course the timer is starting (or just ended and the screen is closing).
    const starting = loading || Boolean(blockId || courseId);
    return (
      <Page scroll={false}>
        {header}
        {starting ? null : (
          <View style={styles.center}>
            <AppText variant="callout" color="inkSoft" style={styles.centerText}>
              {t('timer.idle')}
            </AppText>
            <Button variant="secondary" label={t('timer.idleAction')} onPress={close} />
          </View>
        )}
      </Page>
    );
  }

  if (state.phase === 'focusDone') {
    return (
      <Page
        scroll={false}
        footer={
          <>
            <Button
              block
              label={t('timer.startBreak', { minutes: state.breakMin })}
              icon={{ ios: 'cup.and.saucer', android: 'coffee', web: 'coffee' }}
              onPress={() => void startBreak()}
            />
            <Button block variant="plain" label={t('timer.skipBreak')} onPress={() => void stopTimer().then(close)} />
          </>
        }>
        {header}
        <View style={styles.center}>
          <AppText variant="display" accessibilityRole="header" style={styles.centerText}>
            {t('timer.finishedTitle')}
          </AppText>
          <AppText variant="callout" color="inkSoft" style={styles.centerText}>
            {t('timer.finishedBody', { minutes: state.savedMinutes ?? 0 })}
          </AppText>
        </View>
      </Page>
    );
  }

  if (state.phase === 'breakDone') {
    return (
      <Page
        scroll={false}
        footer={<Button block label={t('timer.close')} onPress={() => void stopTimer().then(close)} />}>
        {header}
        <View style={styles.center}>
          <AppText variant="display" accessibilityRole="header" style={styles.centerText}>
            {t('timer.breakDoneTitle')}
          </AppText>
          <AppText variant="callout" color="inkSoft" style={styles.centerText}>
            {t('timer.breakDoneBody')}
          </AppText>
        </View>
      </Page>
    );
  }

  const minutesLeft = Math.floor(remaining / 60);
  const secondsLeft = remaining % 60;

  return (
    <Page
      scroll={false}
      footer={
        <>
          <Button
            block
            label={running ? t('timer.pause') : t('timer.resume')}
            icon={
              running
                ? { ios: 'pause.fill', android: 'pause', web: 'pause' }
                : { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }
            }
            onPress={() => void (running ? pauseTimer() : resumeTimer())}
          />
          <Button block variant="plain" label={t('timer.cancel')} onPress={confirmStop} />
        </>
      }>
      {header}
      <View style={styles.center}>
        <AppText variant="heading" color={state.phase === 'break' ? 'success' : 'pen'}>
          {state.phase === 'break' ? t('timer.break') : t('timer.focus')}
        </AppText>
        <AppText variant="callout" color="inkSoft" style={styles.centerText}>
          {label ?? t('timer.freeStudy')}
        </AppText>
        <AppText
          variant="display"
          accessibilityRole="timer"
          accessibilityLabel={t('timer.remainingA11y', { minutes: minutesLeft, seconds: secondsLeft })}
          maxFontSizeMultiplier={1.2}
          style={styles.clock}>
          {formatClock(remaining)}
        </AppText>
        {!running ? (
          <AppText variant="callout" color="inkSoft">
            {t('timer.paused')}
          </AppText>
        ) : null}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.md,
  },
  centerText: {
    textAlign: 'center',
  },
  clock: {
    fontFamily: Fonts.display,
    fontSize: 80,
    lineHeight: 96,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0,
  },
});

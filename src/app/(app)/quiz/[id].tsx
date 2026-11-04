import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, AppState, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { AiLabel } from '@/components/ui/ai-label';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Page } from '@/components/ui/page';
import { ProgressBar } from '@/components/ui/progress-bar';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import type { ReportReason } from '@/db/types';
import { OptionRow, type OptionState } from '@/features/quiz/components/option-row';
import { FLAG_ICON } from '@/features/quiz/components/tag';
import { AttemptClock, loadPlayer, type PlayerState } from '@/features/quiz/player';
import { discardAttempt, finishAttempt, saveAttemptProgress } from '@/features/quiz/repo';
import { dropQuestion, optionLetter, parseOptions, type Answers } from '@/features/quiz/scoring';
import { ReportSheet } from '@/features/reports/report-sheet';
import { reportItem } from '@/features/reports/repo';
import { useTheme } from '@/hooks/use-theme';

type Status = 'loading' | 'missing' | 'empty' | 'ready';

const RIGHT_ICON = { ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' } as const;
const WRONG_ICON = {
  ios: 'arrow.uturn.backward.circle.fill',
  android: 'replay',
  web: 'replay',
} as const;

/** US-41: one question at a time with instant feedback; resumes an unfinished attempt. */
export default function QuizPlayerScreen() {
  const { id, retry } = useLocalSearchParams<{ id: string; retry?: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [status, setStatus] = useState<Status>('loading');
  const [data, setData] = useState<PlayerState | null>(null);
  const [ids, setIds] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mutable bits that must not re-render: the running attempt and its clock.
  const live = useRef({ attemptId: null as string | null, done: false, clock: new AttemptClock() });

  useEffect(() => {
    let alive = true;
    loadPlayer(id, retry ?? null)
      .then((result) => {
        if (!alive) return;
        if (result.kind === 'finished') {
          router.replace({ pathname: '/quiz/result/[attemptId]', params: { attemptId: result.attemptId } });
          return;
        }
        if (result.kind !== 'ready') {
          setStatus(result.kind);
          return;
        }
        const { state } = result;
        live.current.attemptId = state.attempt.id;
        live.current.done = false;
        live.current.clock.start(state.attempt.duration_sec);
        const current = state.ids[state.index];
        setData(state);
        setIds(state.ids);
        setAnswers(state.answers);
        setIndex(state.index);
        setSelected(typeof state.answers[current] === 'number' ? state.answers[current] : null);
        setStatus('ready');
      })
      .catch(() => {
        if (alive) setStatus('missing');
      });
    return () => {
      alive = false;
    };
  }, [id, retry]);

  // Pause the clock in the background, and save the time spent when leaving the screen.
  useEffect(() => {
    const session = live.current;
    const saveTime = () => {
      if (!session.attemptId || session.done) return;
      session.clock.pause();
      saveAttemptProgress(session.attemptId, { durationSec: session.clock.seconds() }).catch(() => {});
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') session.clock.resume();
      else saveTime();
    });
    return () => {
      subscription.remove();
      saveTime();
    };
  }, []);

  if (status === 'loading') return <Page />;

  if (status !== 'ready' || !data) {
    const key = status === 'empty' ? 'quiz.empty' : 'quiz.notFound';
    return (
      <Page>
        <Stack.Screen options={{ title: t('quiz.title') }} />
        <EmptyState
          title={t(`${key}.title`)}
          body={t(`${key}.body`)}
          actions={[{ label: t('common.back'), onPress: () => router.back() }]}
        />
      </Page>
    );
  }

  const questionId = ids[index];
  const question = data.questions.get(questionId);
  const options = parseOptions(question?.options);
  const checkedChoice = answers[questionId];
  const checked = typeof checkedChoice === 'number';
  const isLast = index >= ids.length - 1;
  const isRight = checked && checkedChoice === question?.correct_index;

  const persist = (next: { answers?: Answers; currentIndex?: number; questionIds?: string[] }) => {
    saveAttemptProgress(data.attempt.id, {
      ...next,
      durationSec: live.current.clock.seconds(),
    }).catch(() => setError(t('quiz.saveError')));
  };

  const finish = (finalIds: string[], finalAnswers: Answers) => {
    const session = live.current;
    session.clock.pause();
    session.done = true;
    setBusy(true);
    finishAttempt(data.attempt, finalIds, finalAnswers, session.clock.seconds())
      .then(() =>
        router.replace({ pathname: '/quiz/result/[attemptId]', params: { attemptId: data.attempt.id } }),
      )
      .catch(() => {
        session.done = false;
        session.clock.resume();
        setBusy(false);
        setError(t('quiz.saveError'));
      });
  };

  const goTo = (nextIndex: number, nextAnswers: Answers, nextIds: string[] = ids) => {
    if (nextIndex >= nextIds.length) {
      finish(nextIds, nextAnswers);
      return;
    }
    const nextId = nextIds[nextIndex];
    setIndex(nextIndex);
    setSelected(typeof nextAnswers[nextId] === 'number' ? nextAnswers[nextId] : null);
    setNotice(null);
    persist({ answers: nextAnswers, currentIndex: nextIndex, questionIds: nextIds });
  };

  const check = () => {
    if (selected == null || !question) return;
    const nextAnswers = { ...answers, [questionId]: selected };
    setAnswers(nextAnswers);
    persist({ answers: nextAnswers, currentIndex: index });

    const right = selected === question.correct_index;
    Haptics.notificationAsync(
      right ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
    ).catch(() => {});
    AccessibilityInfo.announceForAccessibility(
      right
        ? t('quiz.feedbackRight')
        : t('quiz.feedbackWrong', { letter: optionLetter(question.correct_index) }),
    );
  };

  const skip = () => {
    const nextAnswers = { ...answers, [questionId]: null };
    setAnswers(nextAnswers);
    goTo(index + 1, nextAnswers);
  };

  const report = async (reason: ReportReason) => {
    setReportOpen(false);
    try {
      await reportItem({
        itemType: 'question',
        itemId: questionId,
        documentId: data.quiz.document_id,
        reason,
      });
    } catch {
      setError(t('reports.error'));
      return;
    }
    // BR-23: the question disappears for this student right away.
    const next = dropQuestion(ids, answers, index, questionId);
    setIds(next.ids);
    setAnswers(next.answers);
    if (next.ids.length === 0) {
      live.current.done = true;
      discardAttempt(data.attempt.id).catch(() => {});
      setStatus('empty');
      return;
    }
    goTo(next.currentIndex, next.answers, next.ids);
    setNotice(t('quiz.reported'));
  };

  const optionState = (i: number): OptionState => {
    if (!checked) return selected === i ? 'selected' : 'idle';
    if (i === question?.correct_index) return 'correct';
    if (i === checkedChoice) return 'wrong';
    return 'dimmed';
  };

  const footer = checked ? (
    <Button
      label={isLast ? t('quiz.finish') : t('quiz.next')}
      block
      loading={busy}
      onPress={() => goTo(index + 1, answers)}
    />
  ) : (
    <>
      <Button
        label={t('quiz.check')}
        block
        disabled={selected == null || busy}
        accessibilityHint={selected == null ? t('quiz.checkHint') : undefined}
        onPress={check}
      />
      <Button label={t('quiz.skip')} variant="plain" block disabled={busy} onPress={skip} />
    </>
  );

  return (
    <Page footer={footer}>
      <Stack.Screen options={{ title: retry ? t('quiz.retryTitle') : data.quiz.title }} />

      <View style={styles.top}>
        <View style={styles.progressLine}>
          <AppText
            variant="heading"
            accessibilityLabel={t('quiz.progressA11y', { current: index + 1, total: ids.length })}>
            {t('quiz.progress', { current: index + 1, total: ids.length })}
          </AppText>
          <Button
            label={t('quiz.report')}
            variant="plain"
            icon={FLAG_ICON}
            accessibilityHint={t('quiz.reportA11y')}
            onPress={() => setReportOpen(true)}
          />
        </View>
        <ProgressBar value={(index + (checked ? 1 : 0)) / ids.length} />
        {data.quiz.document_id ? <AiLabel /> : null}
      </View>

      {notice ? (
        <Banner tone="success" message={notice} />
      ) : data.resumed && index === data.index ? (
        <Banner message={t('quiz.resumed')} />
      ) : null}
      {error ? <Banner tone="warning" message={error} /> : null}

      <AppText variant="title" accessibilityRole="header">
        {question?.stem}
      </AppText>

      <View accessibilityRole="radiogroup" style={styles.options}>
        {options.map((text, i) => (
          <OptionRow
            key={i}
            index={i}
            text={text}
            state={optionState(i)}
            chosen={checked ? i === checkedChoice : selected === i}
            enabled={!checked && !busy}
            onPress={() => setSelected(i)}
          />
        ))}
      </View>

      {checked && question ? (
        <Card accessibilityLiveRegion="polite">
          <View style={styles.feedback}>
            <SymbolView
              name={isRight ? RIGHT_ICON : WRONG_ICON}
              size={24}
              tintColor={isRight ? colors.success : colors.exam}
            />
            <AppText variant="heading" color={isRight ? 'success' : 'exam'} style={styles.flex}>
              {isRight
                ? t('quiz.feedbackRight')
                : t('quiz.feedbackWrong', { letter: optionLetter(question.correct_index) })}
            </AppText>
          </View>
          {question.explanation ? (
            <View style={styles.explanation}>
              <AppText variant="footnote" color="inkSoft">
                {t('quiz.explanation')}
              </AppText>
              <AppText variant="body">{question.explanation}</AppText>
            </View>
          ) : null}
          {question.source_page != null ? (
            <AppText variant="footnote" color="inkSoft">
              {t('quiz.source', { page: question.source_page })}
            </AppText>
          ) : null}
        </Card>
      ) : null}

      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} onSelect={report} />
    </Page>
  );
}

const styles = StyleSheet.create({
  top: {
    gap: Space.sm,
  },
  progressLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  options: {
    gap: Space.sm + 2,
  },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  explanation: {
    gap: Space.xs,
  },
  flex: {
    flex: 1,
  },
});

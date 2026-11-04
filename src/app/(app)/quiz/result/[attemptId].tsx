import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { AiLabel } from '@/components/ui/ai-label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Page } from '@/components/ui/page';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Section } from '@/components/ui/section';
import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import { useDbQuery } from '@/db/use-query';
import { getAttempt, getQuiz, listQuestionsByIds } from '@/features/quiz/repo';
import {
  optionLetter,
  outcome,
  parseAnswers,
  parseIds,
  parseOptions,
  scoreAttempt,
  splitDuration,
} from '@/features/quiz/scoring';
import { useTheme } from '@/hooks/use-theme';

async function loadResult(attemptId: string) {
  const attempt = await getAttempt(attemptId);
  if (!attempt) return null;
  const quiz = await getQuiz(attempt.quiz_id);
  const ids = parseIds(attempt.question_ids);
  const questions = await listQuestionsByIds(ids);
  return { attempt, quiz, ids, questions, answers: parseAnswers(attempt.answers) };
}

const MARKS = {
  correct: { icon: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }, color: 'success' },
  wrong: { icon: { ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }, color: 'exam' },
  blank: { icon: { ios: 'circle.dashed', android: 'radio_button_unchecked', web: 'radio_button_unchecked' }, color: 'inkSoft' },
} as const;

/** US-42: counts, time, per-topic results and the wrong answers with the right ones. */
export default function QuizResultScreen() {
  const { attemptId } = useLocalSearchParams<{ attemptId: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data, loading } = useDbQuery(`quiz-result:${attemptId}`, () => loadResult(attemptId), [
    'quiz_attempts',
    'questions',
  ]);

  if (loading && !data) return <Page />;

  if (!data) {
    return (
      <Page>
        <Stack.Screen options={{ title: t('quiz.result.title') }} />
        <EmptyState
          title={t('quiz.result.notFound.title')}
          body={t('quiz.result.notFound.body')}
          actions={[{ label: t('common.back'), onPress: () => router.back() }]}
        />
      </Page>
    );
  }

  const { attempt, quiz, ids, questions, answers } = data;
  // Stored counts are what the Progress screen reads; topics come from the questions.
  const score = scoreAttempt(ids, questions, answers);
  const counts = { correct: attempt.correct, wrong: attempt.wrong, blank: attempt.blank };
  const total = counts.correct + counts.wrong + counts.blank;
  const { minutes, seconds } = splitDuration(attempt.duration_sec);
  const byId = new Map(questions.map((q) => [q.id, q]));
  const missed = ids
    .map((id) => byId.get(id))
    .filter((q): q is NonNullable<typeof q> => q != null && outcome(q, answers) !== 'correct');
  const quizId = attempt.quiz_id;

  const answerText = (options: string[], index: number) =>
    `${optionLetter(index)}) ${options[index] ?? ''}`;

  return (
    <Page
      footer={
        missed.length > 0 ? (
          <>
            <Button
              label={t('quiz.result.retryWrong')}
              icon={{ ios: 'arrow.counterclockwise', android: 'replay', web: 'replay' }}
              block
              onPress={() =>
                router.replace({ pathname: '/quiz/[id]', params: { id: quizId, retry: attempt.id } })
              }
            />
            <Button label={t('quiz.result.done')} variant="plain" block onPress={() => router.back()} />
          </>
        ) : (
          <>
            <Button label={t('quiz.result.done')} block onPress={() => router.back()} />
            <Button
              label={t('quiz.result.restart')}
              variant="plain"
              block
              onPress={() => router.replace({ pathname: '/quiz/[id]', params: { id: quizId } })}
            />
          </>
        )
      }>
      <Stack.Screen options={{ title: t('quiz.result.title') }} />

      <Card>
        <View style={styles.headline}>
          <AppText variant="display" accessibilityRole="header">
            {t('quiz.result.summary', { correct: counts.correct, total })}
          </AppText>
          {quiz ? (
            <AppText variant="callout" color="inkSoft">
              {quiz.title}
            </AppText>
          ) : null}
        </View>
        <View style={styles.counts}>
          {(['correct', 'wrong', 'blank'] as const).map((kind) => (
            <View
              key={kind}
              accessible
              accessibilityLabel={`${t(`quiz.result.${kind}`)}: ${counts[kind]}`}
              style={[styles.count, { backgroundColor: colors.sunken }]}>
              <SymbolView name={MARKS[kind].icon} size={20} tintColor={colors[MARKS[kind].color]} />
              <AppText variant="title">{counts[kind]}</AppText>
              <AppText variant="footnote" color="inkSoft">
                {t(`quiz.result.${kind}`)}
              </AppText>
            </View>
          ))}
        </View>
        <View style={styles.duration}>
          <AppText variant="callout" color="inkSoft">
            {t('quiz.result.duration')}
          </AppText>
          <AppText variant="heading">{t('quiz.result.durationValue', { minutes, seconds })}</AppText>
        </View>
        {quiz?.document_id ? <AiLabel /> : null}
      </Card>

      {score.topics.length > 0 ? (
        <Section title={t('quiz.result.byTopic')}>
          {score.topics.map((topic) => (
            <View
              key={topic.topic ?? ''}
              style={styles.topic}
              accessible
              accessibilityLabel={`${topic.topic ?? t('quiz.result.noTopic')}, ${t('quiz.result.topicLine', {
                correct: topic.correct,
                total: topic.total,
              })}`}>
              <View style={styles.topicLine}>
                <AppText variant="body" style={styles.flex}>
                  {topic.topic ?? t('quiz.result.noTopic')}
                </AppText>
                <AppText variant="footnote" color="inkSoft">
                  {t('quiz.result.topicLine', { correct: topic.correct, total: topic.total })}
                </AppText>
              </View>
              <ProgressBar
                value={topic.correct / topic.total}
                color={topic.correct === topic.total ? colors.success : colors.pen}
                height={6}
              />
            </View>
          ))}
        </Section>
      ) : null}

      {missed.length === 0 ? (
        <AppText variant="heading" color="success">
          {t('quiz.result.allCorrect')}
        </AppText>
      ) : (
        <Section title={t('quiz.result.wrongList')}>
          {missed.map((q) => {
            const options = parseOptions(q.options);
            const choice = answers[q.id];
            const kind = outcome(q, answers);
            return (
              <View key={q.id} style={styles.missed}>
                <View style={styles.missedHead}>
                  <SymbolView name={MARKS[kind].icon} size={18} tintColor={colors[MARKS[kind].color]} />
                  <AppText variant="footnote" color="inkSoft">
                    {t('question.number', { number: ids.indexOf(q.id) + 1 })}
                  </AppText>
                </View>
                <AppText variant="body">{q.stem}</AppText>
                <AppText variant="callout" color={kind === 'wrong' ? 'exam' : 'inkSoft'}>
                  {typeof choice === 'number'
                    ? t('quiz.result.yourAnswer', { answer: answerText(options, choice) })
                    : t('quiz.result.leftBlank')}
                </AppText>
                <AppText variant="callout" color="success" style={styles.bold}>
                  {t('quiz.result.rightAnswer', { answer: answerText(options, q.correct_index) })}
                </AppText>
                {q.explanation ? (
                  <AppText variant="footnote" color="inkSoft">
                    {q.explanation}
                  </AppText>
                ) : null}
              </View>
            );
          })}
        </Section>
      )}

      <Button
        label={t('quiz.editQuestions')}
        variant="plain"
        icon={{ ios: 'pencil', android: 'edit', web: 'edit' }}
        onPress={() => router.push({ pathname: '/quiz/edit/[id]', params: { id: quizId } })}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  headline: {
    gap: Space.xs,
  },
  counts: {
    flexDirection: 'row',
    gap: Space.sm,
  },
  count: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: Space.md,
    borderRadius: Radius.md,
  },
  duration: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topic: {
    gap: Space.sm,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  topicLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  flex: {
    flex: 1,
  },
  missed: {
    gap: Space.xs + 2,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  missedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs + 2,
  },
  bold: {
    fontWeight: '600',
  },
});

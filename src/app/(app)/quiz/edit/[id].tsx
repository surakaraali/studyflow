import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { AiLabel } from '@/components/ui/ai-label';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { Section } from '@/components/ui/section';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { useDbQuery } from '@/db/use-query';
import { EDITED_ICON, Tag } from '@/features/quiz/components/tag';
import { getQuiz, listPlayableQuestions } from '@/features/quiz/repo';
import { optionLetter, parseOptions } from '@/features/quiz/scoring';
import { useTheme } from '@/hooks/use-theme';

async function load(quizId: string) {
  const [quiz, questions] = await Promise.all([getQuiz(quizId), listPlayableQuestions(quizId)]);
  return { quiz, questions };
}

/** US-36: the questions of a quiz, each opening the question editor. */
export default function QuizEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data } = useDbQuery(`quiz-edit:${id}`, () => load(id), ['quizzes', 'questions', 'content_reports']);

  if (!data) return <Page />;

  const { quiz, questions } = data;
  if (!quiz) {
    return (
      <Page>
        <Stack.Screen options={{ title: t('question.listTitle') }} />
        <EmptyState
          title={t('quiz.notFound.title')}
          body={t('quiz.notFound.body')}
          actions={[{ label: t('common.back'), onPress: () => router.back() }]}
        />
      </Page>
    );
  }

  return (
    <Page
      intro={t('question.listIntro')}
      footer={
        questions.length > 0 ? (
          <Button
            label={t('question.startQuiz')}
            block
            onPress={() => router.push({ pathname: '/quiz/[id]', params: { id: quiz.id } })}
          />
        ) : undefined
      }>
      <Stack.Screen options={{ title: quiz.title }} />
      {quiz.document_id ? <AiLabel /> : null}

      {questions.length === 0 ? (
        <EmptyState title={t('question.listEmpty.title')} body={t('question.listEmpty.body')} />
      ) : (
        <Section title={t('question.listTitle')}>
          {questions.map((q, i) => {
            const options = parseOptions(q.options);
            const answer = `${optionLetter(q.correct_index)}) ${options[q.correct_index] ?? ''}`;
            return (
              <Pressable
                key={q.id}
                accessibilityRole="button"
                accessibilityLabel={[
                  t('question.number', { number: i + 1 }),
                  q.stem,
                  q.edited ? t('question.edited') : null,
                ]
                  .filter(Boolean)
                  .join(', ')}
                onPress={() => router.push({ pathname: '/question/[id]', params: { id: q.id } })}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.sunken }]}>
                <View style={styles.text}>
                  <AppText variant="footnote" color="inkSoft">
                    {t('question.number', { number: i + 1 })}
                  </AppText>
                  <AppText variant="body" numberOfLines={3}>
                    {q.stem}
                  </AppText>
                  <AppText variant="footnote" color="success" numberOfLines={1}>
                    {answer}
                  </AppText>
                  {q.edited ? <Tag label={t('question.edited')} icon={EDITED_ICON} /> : null}
                </View>
                <SymbolView
                  name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                  size={13}
                  weight="semibold"
                  tintColor={colors.inkFaint}
                />
              </Pressable>
            );
          })}
        </Section>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  text: {
    flex: 1,
    gap: Space.xs,
  },
});

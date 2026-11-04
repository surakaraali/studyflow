import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { AiLabel } from '@/components/ui/ai-label';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { Segmented } from '@/components/ui/segmented';
import { TextField } from '@/components/ui/text-field';
import { Space } from '@/constants/theme';
import type { Question } from '@/db/types';
import { useDbQuery } from '@/db/use-query';
import { confirmDestructive } from '@/features/quiz/confirm';
import { EDITED_ICON, HIDDEN_ICON, Tag } from '@/features/quiz/components/tag';
import { deleteQuestion, getQuestion, getQuiz, saveQuestion } from '@/features/quiz/repo';
import { optionLetter, parseOptions } from '@/features/quiz/scoring';
import { decideReports } from '@/features/reports/repo';

async function load(id: string) {
  const question = await getQuestion(id);
  const quiz = question ? await getQuiz(question.quiz_id) : null;
  return { question, isAi: quiz?.document_id != null };
}

/** US-36: edit a question's stem, options, right answer and explanation. */
export default function QuestionEditScreen() {
  const { id, reportId } = useLocalSearchParams<{ id: string; reportId?: string }>();
  const { t } = useTranslation();
  const { data } = useDbQuery(`question:${id}`, () => load(id), ['questions']);

  if (!data) return <Page />;
  if (!data.question) {
    return (
      <Page>
        <Stack.Screen options={{ title: t('question.title') }} />
        <EmptyState
          title={t('question.notFound.title')}
          body={t('question.notFound.body')}
          actions={[{ label: t('common.back'), onPress: () => router.back() }]}
        />
      </Page>
    );
  }

  // Keyed so the form starts from the saved values of this question.
  return (
    <QuestionForm key={data.question.id} question={data.question} isAi={data.isAi} fromReport={!!reportId} />
  );
}

function QuestionForm({
  question,
  isAi,
  fromReport,
}: {
  question: Question;
  isAi: boolean;
  fromReport: boolean;
}) {
  const { t } = useTranslation();
  const [stem, setStem] = useState(question.stem);
  // The option count stays fixed: it follows the student's segment (BR-12).
  const [options, setOptions] = useState(() => parseOptions(question.options));
  const [correct, setCorrect] = useState(question.correct_index);
  const [explanation, setExplanation] = useState(question.explanation);
  const [errors, setErrors] = useState<{ stem?: string; options?: string; save?: string }>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const next = {
      stem: !stem.trim() ? t('question.errors.stem') : undefined,
      options: options.some((o) => !o.trim()) ? t('question.errors.option') : undefined,
    };
    setErrors(next);
    if (next.stem || next.options) return;

    setSaving(true);
    try {
      await saveQuestion(question.id, {
        stem: stem.trim(),
        options: options.map((o) => o.trim()),
        correct_index: correct,
        explanation: explanation.trim(),
      });
      // Saved from the team review queue: close the report as fixed and show the item again.
      if (fromReport) await decideReports('question', question.id, 'fixed');
      router.back();
    } catch {
      setSaving(false);
      setErrors({ save: t('question.errors.save') });
    }
  };

  const remove = async () => {
    const ok = await confirmDestructive({
      title: t('question.deleteTitle'),
      message: t('question.deleteBody'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    await deleteQuestion(question.id);
    router.back();
  };

  return (
    <Page footer={<Button label={t('common.save')} block loading={saving} onPress={save} />}>
      <Stack.Screen options={{ title: t('question.title') }} />

      {isAi || question.edited || question.hidden ? (
        <View style={styles.tags}>
          {isAi ? <AiLabel /> : null}
          {question.edited ? <Tag label={t('question.edited')} icon={EDITED_ICON} /> : null}
          {question.hidden ? <Tag label={t('question.hidden')} icon={HIDDEN_ICON} /> : null}
        </View>
      ) : null}
      {fromReport ? <Banner message={t('reports.queue.fixedNote')} /> : null}
      {errors.save ? <Banner tone="warning" message={errors.save} /> : null}

      <TextField label={t('question.stem')} value={stem} onChangeText={setStem} multiline error={errors.stem} />

      <View style={styles.options}>
        {options.map((option, i) => (
          <TextField
            key={i}
            label={t('question.option', { letter: optionLetter(i) })}
            value={option}
            onChangeText={(text) => setOptions((prev) => prev.map((o, j) => (j === i ? text : o)))}
            error={errors.options && !option.trim() ? errors.options : undefined}
          />
        ))}
      </View>

      <Segmented
        label={t('question.correct')}
        options={options.map((_, i) => ({
          value: i,
          label: optionLetter(i),
          a11yLabel: t('question.correctA11y', { letter: optionLetter(i) }),
        }))}
        value={correct}
        onChange={setCorrect}
      />

      <TextField
        label={t('question.explanation')}
        value={explanation}
        onChangeText={setExplanation}
        multiline
      />

      <Button label={t('question.delete')} variant="plain" icon={DELETE_ICON} onPress={remove} />
    </Page>
  );
}

const DELETE_ICON = { ios: 'trash', android: 'delete', web: 'delete' } as const;

const styles = StyleSheet.create({
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Space.sm,
  },
  options: {
    gap: Space.md,
  },
});

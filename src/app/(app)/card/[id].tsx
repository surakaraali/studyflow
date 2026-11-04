import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { AiLabel } from '@/components/ui/ai-label';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Space } from '@/constants/theme';
import type { CardRow } from '@/db/types';
import { useDbQuery } from '@/db/use-query';
import { deleteCard, getCard, saveCard } from '@/features/flashcards/repo';
import { confirmDestructive } from '@/features/quiz/confirm';
import { EDITED_ICON, HIDDEN_ICON, Tag } from '@/features/quiz/components/tag';
import { decideReports } from '@/features/reports/repo';

/** US-36: edit a card's front and back (marks it "Düzenlendi"), or delete it. */
export default function CardEditScreen() {
  const { id, reportId } = useLocalSearchParams<{ id: string; reportId?: string }>();
  const { t } = useTranslation();
  const { data, loading } = useDbQuery(`card:${id}`, () => getCard(id), ['cards']);

  if (loading && data === undefined) return <Page />;
  if (!data) {
    return (
      <Page>
        <Stack.Screen options={{ title: t('flashcards.card.editTitle') }} />
        <EmptyState
          title={t('flashcards.card.notFound.title')}
          body={t('flashcards.card.notFound.body')}
          actions={[{ label: t('common.back'), onPress: () => router.back() }]}
        />
      </Page>
    );
  }

  return <CardForm key={data.id} card={data} fromReport={!!reportId} />;
}

function CardForm({ card, fromReport }: { card: CardRow; fromReport: boolean }) {
  const { t } = useTranslation();
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [errors, setErrors] = useState<{ front?: string; back?: string; save?: string }>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const next = {
      front: front.trim() ? undefined : t('flashcards.errors.front'),
      back: back.trim() ? undefined : t('flashcards.errors.back'),
    };
    setErrors(next);
    if (next.front || next.back) return;
    setSaving(true);
    try {
      await saveCard(card.id, front, back);
      // Saved from the team review queue: close the report as fixed and show the card again.
      if (fromReport) await decideReports('card', card.id, 'fixed');
      router.back();
    } catch {
      setSaving(false);
      setErrors({ save: t('flashcards.errors.save') });
    }
  };

  const remove = async () => {
    const ok = await confirmDestructive({
      title: t('flashcards.card.deleteTitle'),
      message: t('flashcards.card.deleteBody'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    router.back();
    await deleteCard(card.id);
  };

  return (
    <Page footer={<Button label={t('common.save')} block loading={saving} onPress={save} />}>
      <Stack.Screen options={{ title: t('flashcards.card.editTitle') }} />

      {card.ai_generated || card.edited || card.hidden || card.source_page != null ? (
        <View style={styles.tags}>
          {card.ai_generated ? <AiLabel /> : null}
          {card.edited ? <Tag label={t('flashcards.card.edited')} icon={EDITED_ICON} /> : null}
          {card.hidden ? <Tag label={t('flashcards.card.hidden')} icon={HIDDEN_ICON} /> : null}
          {card.source_page != null ? (
            <AppText variant="footnote" color="inkSoft">
              {t('flashcards.card.source', { page: card.source_page })}
            </AppText>
          ) : null}
        </View>
      ) : null}
      {fromReport ? <Banner message={t('reports.queue.fixedNote')} /> : null}
      {errors.save ? <Banner tone="warning" message={errors.save} /> : null}

      <TextField
        label={t('flashcards.card.front')}
        hint={t('flashcards.card.frontHint')}
        value={front}
        onChangeText={setFront}
        multiline
        error={errors.front}
      />
      <TextField
        label={t('flashcards.card.back')}
        hint={t('flashcards.card.backHint')}
        value={back}
        onChangeText={setBack}
        multiline
        error={errors.back}
      />

      <Button
        label={t('flashcards.card.delete')}
        variant="plain"
        icon={{ ios: 'trash', android: 'delete', web: 'delete' }}
        onPress={remove}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Space.sm,
  },
});

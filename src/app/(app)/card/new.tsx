import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { Segmented } from '@/components/ui/segmented';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Space } from '@/constants/theme';
import { getDb } from '@/db/client';
import type { Deck } from '@/db/types';
import { useDbQuery } from '@/db/use-query';
import { createCard } from '@/features/flashcards/repo';

async function listAllDecks(): Promise<Deck[]> {
  return getDb().getAllAsync<Deck>(
    'SELECT * FROM decks WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE',
  );
}

/** US-44: write a card by hand. Opened from a deck (deckId) or on its own with a deck picker. */
export default function NewCardScreen() {
  const { deckId: initialDeck } = useLocalSearchParams<{ deckId?: string }>();
  const { t } = useTranslation();
  const { data: decks } = useDbQuery('card-new-decks', listAllDecks, ['decks']);

  const [deckId, setDeckId] = useState<string | null>(initialDeck ?? null);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [errors, setErrors] = useState<{ deck?: string; front?: string; back?: string; save?: string }>({});
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(false);
  const frontRef = useRef<ComponentRef<typeof TextInput>>(null);

  if (!decks) return <Page />;

  if (decks.length === 0) {
    return (
      <Page>
        <Stack.Screen options={{ title: t('flashcards.card.newTitle') }} />
        <EmptyState
          title={t('flashcards.empty.title')}
          body={t('flashcards.card.noDecks')}
          actions={[{ label: t('flashcards.newDeck'), onPress: () => router.replace('/decks') }]}
        />
      </Page>
    );
  }

  const save = async (another: boolean) => {
    const next = {
      deck: deckId ? undefined : t('flashcards.errors.deck'),
      front: front.trim() ? undefined : t('flashcards.errors.front'),
      back: back.trim() ? undefined : t('flashcards.errors.back'),
    };
    setErrors(next);
    setAdded(false);
    if (next.deck || next.front || next.back || !deckId) return;

    setSaving(true);
    const ok = await createCard(deckId, front, back).then(
      () => true,
      () => false,
    );
    setSaving(false);
    if (!ok) {
      setErrors({ save: t('flashcards.errors.save') });
      return;
    }
    if (!another) {
      router.back();
      return;
    }
    setFront('');
    setBack('');
    setAdded(true);
    frontRef.current?.focus();
  };

  const showPicker = !initialDeck || !decks.some((d) => d.id === initialDeck);

  return (
    <Page
      footer={
        <>
          <Button label={t('common.save')} block loading={saving} onPress={() => save(false)} />
          <Button
            label={t('flashcards.card.saveAndNew')}
            variant="plain"
            block
            disabled={saving}
            onPress={() => save(true)}
          />
        </>
      }>
      <Stack.Screen options={{ title: t('flashcards.card.newTitle') }} />

      {added ? <Banner tone="success" message={t('flashcards.card.added')} /> : null}
      {errors.save ? <Banner tone="warning" message={errors.save} /> : null}

      {showPicker ? (
        <View style={styles.field}>
          <Segmented
            label={t('flashcards.card.deck')}
            wrap
            options={decks.map((d) => ({ value: d.id, label: d.name }))}
            value={deckId}
            onChange={setDeckId}
          />
          {errors.deck ? (
            <AppText variant="footnote" color="exam" accessibilityLiveRegion="polite">
              {errors.deck}
            </AppText>
          ) : null}
        </View>
      ) : null}

      <TextField
        ref={frontRef}
        label={t('flashcards.card.front')}
        hint={t('flashcards.card.frontHint')}
        value={front}
        onChangeText={setFront}
        multiline
        autoFocus
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
    </Page>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Space.xs,
  },
});

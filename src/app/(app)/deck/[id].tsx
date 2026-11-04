import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { HighlightMark } from '@/components/highlight-mark';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Page } from '@/components/ui/page';
import { Section } from '@/components/ui/section';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Space } from '@/constants/theme';
import { useDbQuery } from '@/db/use-query';
import { getCourse } from '@/features/courses/repo';
import { CardListRow } from '@/features/flashcards/components/card-row';
import {
  deleteDeck,
  dueSummary,
  getDeck,
  listDeckCards,
  renameDeck,
} from '@/features/flashcards/repo';
import { useSegment } from '@/features/flashcards/use-segment';
import { confirmDestructive } from '@/features/quiz/confirm';
import { todayString } from '@/lib/dates';

/** US-44: a deck's cards with "Tekrara başla", add card, rename and delete. */
export default function DeckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const segment = useSegment();
  const [renaming, setRenaming] = useState(false);

  const { data } = useDbQuery(
    `deck:${id}:${segment}:${todayString()}`,
    async () => {
      const deck = await getDeck(id);
      if (!deck) return { deck: null, course: null, cards: [], today: 0 };
      const [course, cards, summary] = await Promise.all([
        getCourse(deck.course_id),
        listDeckCards(id),
        dueSummary(segment, id),
      ]);
      return { deck, course, cards, today: summary.today };
    },
    ['decks', 'cards', 'card_reviews', 'courses', 'content_reports'],
  );

  if (!data) return <Page />;

  const { deck, course, cards, today } = data;
  if (!deck) {
    return (
      <Page>
        <EmptyState
          title={t('flashcards.deck.notFound.title')}
          body={t('flashcards.deck.notFound.body')}
          actions={[{ label: t('common.back'), onPress: () => router.back() }]}
        />
      </Page>
    );
  }

  const remove = async () => {
    const ok = await confirmDestructive({
      title: t('flashcards.deck.deleteTitle'),
      message: t('flashcards.deck.deleteBody', { count: cards.length }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    router.back();
    await deleteDeck(deck.id);
  };

  const addCard = () => router.push({ pathname: '/card/new', params: { deckId: deck.id } });

  return (
    <Page>
      <Stack.Screen options={{ title: deck.name }} />

      {renaming ? (
        <RenameForm
          initial={deck.name}
          onCancel={() => setRenaming(false)}
          onSave={async (name) => {
            await renameDeck(deck.id, name);
            setRenaming(false);
          }}
        />
      ) : (
        <Card>
          {course ? (
            <AppText variant="footnote" color="inkSoft">
              {course.name}
            </AppText>
          ) : null}
          {today > 0 ? (
            <HighlightMark active style={styles.mark}>
              <AppText variant="heading" color="onHighlight">
                {t('flashcards.deck.dueSummary', { count: today })}
              </AppText>
            </HighlightMark>
          ) : (
            <AppText variant="callout" color="inkSoft">
              {t('flashcards.deck.noneDue')}
            </AppText>
          )}
          <View style={styles.actions}>
            <Button
              label={t('flashcards.deck.start')}
              icon={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
              disabled={today === 0}
              onPress={() => router.push({ pathname: '/review', params: { deckId: deck.id } })}
            />
            <Button
              label={t('flashcards.deck.addCard')}
              variant="secondary"
              icon={{ ios: 'plus', android: 'add', web: 'add' }}
              onPress={addCard}
            />
          </View>
        </Card>
      )}

      {cards.length === 0 ? (
        <EmptyState
          title={t('flashcards.deck.empty.title')}
          body={t('flashcards.deck.empty.body')}
          actions={[{ label: t('flashcards.deck.addCard'), onPress: addCard }]}
        />
      ) : (
        <Section title={t('flashcards.deck.cards')} footer={t('flashcards.cardCount', { count: cards.length })}>
          {cards.map((card) => (
            <CardListRow
              key={card.id}
              card={card}
              onPress={() => router.push({ pathname: '/card/[id]', params: { id: card.id } })}
            />
          ))}
        </Section>
      )}

      {!renaming ? (
        <View style={styles.actions}>
          <Button
            label={t('flashcards.deck.rename')}
            variant="plain"
            icon={{ ios: 'pencil', android: 'edit', web: 'edit' }}
            onPress={() => setRenaming(true)}
          />
          <Button
            label={t('flashcards.deck.delete')}
            variant="plain"
            icon={{ ios: 'trash', android: 'delete', web: 'delete' }}
            onPress={remove}
          />
        </View>
      ) : null}
    </Page>
  );
}

function RenameForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      setError(t('flashcards.errors.name'));
      return;
    }
    setSaving(true);
    try {
      await onSave(name);
    } catch {
      setSaving(false);
      setError(t('flashcards.errors.save'));
    }
  };

  return (
    <Card>
      <TextField
        label={t('flashcards.deckName')}
        value={name}
        onChangeText={setName}
        maxLength={60}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={save}
        error={error}
      />
      <View style={styles.actions}>
        <Button label={t('common.save')} loading={saving} onPress={save} />
        <Button label={t('common.cancel')} variant="plain" onPress={onCancel} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
});

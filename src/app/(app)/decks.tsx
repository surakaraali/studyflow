import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { Page } from '@/components/ui/page';
import { Section } from '@/components/ui/section';
import { Segmented } from '@/components/ui/segmented';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Space } from '@/constants/theme';
import type { Course } from '@/db/types';
import { useDbQuery } from '@/db/use-query';
import { listCourses } from '@/features/courses/repo';
import { createDeck, listDecks, type DeckListItem } from '@/features/flashcards/repo';
import { useSegment } from '@/features/flashcards/use-segment';
import { todayString } from '@/lib/dates';

type Group = { key: string; course: Course | null; items: DeckListItem[] };

function groupByCourse(items: DeckListItem[]): Group[] {
  const groups = new Map<string, Group>();
  for (const item of items) {
    const key = item.course?.id ?? '';
    const group = groups.get(key) ?? { key, course: item.course, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) =>
    (a.course?.name ?? '\uffff').localeCompare(b.course?.name ?? '\uffff', 'tr'),
  );
}

/** US-44: decks grouped by course, with card counts and today's cards. */
export default function DecksScreen() {
  const { t } = useTranslation();
  const segment = useSegment();
  const [creating, setCreating] = useState(false);
  const { data } = useDbQuery(
    `decks:${segment}:${todayString()}`,
    async () => {
      const [decks, courses] = await Promise.all([listDecks(segment), listCourses()]);
      return { decks, courses };
    },
    ['decks', 'cards', 'card_reviews', 'courses', 'content_reports'],
  );

  if (!data) return <Page />;

  const { decks, courses } = data;
  const totalToday = decks.reduce((sum, d) => sum + d.todayCount, 0);

  if (courses.length === 0 && decks.length === 0) {
    return (
      <Page>
        <Stack.Screen options={{ title: t('flashcards.decksTitle') }} />
        <EmptyState
          title={t('flashcards.noCourses.title')}
          body={t('flashcards.noCourses.body')}
          actions={[{ label: t('flashcards.noCourses.action'), onPress: () => router.push('/course/new') }]}
        />
      </Page>
    );
  }

  return (
    <Page intro={t('flashcards.decksIntro')}>
      <Stack.Screen options={{ title: t('flashcards.decksTitle') }} />

      <View style={styles.actions}>
        {totalToday > 0 ? (
          <Button
            label={t('flashcards.reviewAll')}
            icon={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
            onPress={() => router.push('/review')}
          />
        ) : null}
        {!creating ? (
          <Button
            label={t('flashcards.newDeck')}
            variant="secondary"
            icon={{ ios: 'plus', android: 'add', web: 'add' }}
            onPress={() => setCreating(true)}
          />
        ) : null}
      </View>

      {creating ? (
        <NewDeckForm
          courses={courses}
          onDone={(deckId) => {
            setCreating(false);
            if (deckId) router.push({ pathname: '/deck/[id]', params: { id: deckId } });
          }}
        />
      ) : null}

      {decks.length === 0 && !creating ? (
        <EmptyState
          title={t('flashcards.empty.title')}
          body={t('flashcards.empty.body')}
          actions={[{ label: t('flashcards.newDeck'), onPress: () => setCreating(true) }]}
        />
      ) : null}

      {groupByCourse(decks).map((group) => (
        <Section key={group.key} title={group.course?.name ?? t('flashcards.noCourse')}>
          {group.items.map(({ deck, course, cardCount, todayCount }) => (
            <ListRow
              key={deck.id}
              title={deck.name}
              subtitle={t('flashcards.cardCount', { count: cardCount })}
              color={course?.color}
              detail={
                todayCount > 0
                  ? t('flashcards.dueToday', { count: todayCount })
                  : t('flashcards.nothingToday')
              }
              detailColor={todayCount > 0 ? 'pen' : 'inkSoft'}
              onPress={() => router.push({ pathname: '/deck/[id]', params: { id: deck.id } })}
            />
          ))}
        </Section>
      ))}
    </Page>
  );
}

function NewDeckForm({
  courses,
  onDone,
}: {
  courses: Course[];
  onDone: (deckId: string | null) => void;
}) {
  const { t } = useTranslation();
  const [courseId, setCourseId] = useState<string | null>(courses.length === 1 ? courses[0].id : null);
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<{ course?: string; name?: string; save?: string }>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const next = {
      course: courseId ? undefined : t('flashcards.errors.course'),
      name: name.trim() ? undefined : t('flashcards.errors.name'),
    };
    setErrors(next);
    if (next.course || next.name || !courseId) return;
    setSaving(true);
    try {
      onDone(await createDeck(courseId, name));
    } catch {
      setSaving(false);
      setErrors({ save: t('flashcards.errors.save') });
    }
  };

  return (
    <Card>
      <AppText variant="title" accessibilityRole="header">
        {t('flashcards.newDeck')}
      </AppText>
      <View style={styles.field}>
        <Segmented
          label={t('flashcards.course')}
          wrap
          options={courses.map((c) => ({ value: c.id, label: c.name }))}
          value={courseId}
          onChange={setCourseId}
        />
        {errors.course ? (
          <AppText variant="footnote" color="exam" accessibilityLiveRegion="polite">
            {errors.course}
          </AppText>
        ) : null}
      </View>
      <TextField
        label={t('flashcards.deckName')}
        placeholder={t('flashcards.deckNamePlaceholder')}
        value={name}
        onChangeText={setName}
        maxLength={60}
        returnKeyType="done"
        onSubmitEditing={save}
        error={errors.name ?? errors.save}
      />
      <View style={styles.actions}>
        <Button label={t('flashcards.createDeck')} loading={saving} onPress={save} />
        <Button label={t('common.cancel')} variant="plain" onPress={() => onDone(null)} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  field: {
    gap: Space.xs,
  },
});

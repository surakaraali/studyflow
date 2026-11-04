import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Section } from '@/components/ui/section';
import { Segmented } from '@/components/ui/segmented';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Space } from '@/constants/theme';
import type { Topic } from '@/db/types';
import { useDbQuery } from '@/db/use-query';
import {
  addTopic,
  deleteTopic,
  listTopics,
  moveTopic,
  TOPIC_NAME_MAX,
  updateTopic,
  type TopicDifficulty,
} from '@/features/topics/repo';
import { useTheme } from '@/hooks/use-theme';

const DIFFICULTY_KEYS = { 1: 'easy', 2: 'medium', 3: 'hard' } as const;

export function useDifficultyOptions() {
  const { t } = useTranslation();
  return ([1, 2, 3] as const).map((value) => ({
    value,
    label: t(`topics.difficulty.${DIFFICULTY_KEYS[value]}`),
  }));
}

export function difficultyKey(value: number) {
  return DIFFICULTY_KEYS[(value >= 1 && value <= 3 ? value : 2) as TopicDifficulty];
}

/** Course detail: the course's topics with difficulty; add, rename, reorder, delete. */
export function TopicList({ courseId }: { courseId: string }) {
  const { t } = useTranslation();
  const options = useDifficultyOptions();
  const { data: topics } = useDbQuery(`topics:${courseId}`, () => listTopics(courseId), ['topics']);
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState<TopicDifficulty>(2);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('topics.nameRequired'));
      return;
    }
    await addTopic(courseId, trimmed, difficulty);
    setName('');
    setDifficulty(2);
    setError(null);
  };

  const list = topics ?? [];

  return (
    <View style={styles.wrap}>
      <Section title={t('topics.title')} footer={list.length > 0 ? t('topics.footer') : undefined}>
        {list.map((topic, index) =>
          editingId === topic.id ? (
            <TopicEditor key={topic.id} topic={topic} onDone={() => setEditingId(null)} />
          ) : (
            <TopicRow
              key={topic.id}
              topic={topic}
              first={index === 0}
              last={index === list.length - 1}
              onEdit={() => setEditingId(topic.id)}
              onMove={(direction) => moveTopic(courseId, topic.id, direction)}
            />
          ),
        )}
      </Section>
      {topics && list.length === 0 ? (
        <AppText variant="callout" color="inkSoft">
          {t('topics.empty')}
        </AppText>
      ) : null}

      <View style={styles.addForm}>
        <TextField
          label={t('topics.newLabel')}
          placeholder={t('topics.newPlaceholder')}
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (error) setError(null);
          }}
          maxLength={TOPIC_NAME_MAX}
          error={error}
          returnKeyType="done"
          onSubmitEditing={add}
        />
        <Segmented
          label={t('topics.difficultyLabel')}
          options={options}
          value={difficulty}
          onChange={setDifficulty}
        />
        <Button
          variant="secondary"
          label={t('topics.add')}
          icon={{ ios: 'plus', android: 'add', web: 'add' }}
          onPress={add}
        />
      </View>
    </View>
  );
}

function TopicRow({
  topic,
  first,
  last,
  onEdit,
  onMove,
}: {
  topic: Topic;
  first: boolean;
  last: boolean;
  onEdit: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const level = t(`topics.difficulty.${difficultyKey(topic.difficulty)}`);

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${topic.name}, ${t('topics.difficultyLabel')}: ${level}`}
        accessibilityHint={t('topics.edit', { name: topic.name })}
        onPress={onEdit}
        style={({ pressed }) => [styles.rowText, pressed && { backgroundColor: colors.sunken }]}>
        <AppText variant="body">{topic.name}</AppText>
        <AppText variant="footnote" color="inkSoft">
          {t('topics.difficultyLabel')}: {level}
        </AppText>
      </Pressable>
      {!first ? (
        <IconButton
          icon={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }}
          label={t('topics.moveUp', { name: topic.name })}
          tone="inkSoft"
          size={18}
          onPress={() => onMove(-1)}
        />
      ) : (
        <View style={styles.iconSpace} />
      )}
      {!last ? (
        <IconButton
          icon={{ ios: 'arrow.down', android: 'arrow_downward', web: 'arrow_downward' }}
          label={t('topics.moveDown', { name: topic.name })}
          tone="inkSoft"
          size={18}
          onPress={() => onMove(1)}
        />
      ) : (
        <View style={styles.iconSpace} />
      )}
    </View>
  );
}

function TopicEditor({ topic, onDone }: { topic: Topic; onDone: () => void }) {
  const { t } = useTranslation();
  const options = useDifficultyOptions();
  const [name, setName] = useState(topic.name);
  const [difficulty, setDifficulty] = useState<TopicDifficulty>(
    (topic.difficulty >= 1 && topic.difficulty <= 3 ? topic.difficulty : 2) as TopicDifficulty,
  );
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('topics.nameRequired'));
      return;
    }
    await updateTopic(topic.id, { name: trimmed, difficulty });
    onDone();
  };

  const remove = () =>
    Alert.alert(t('topics.deleteConfirmTitle', { name: topic.name }), t('topics.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteTopic(topic.id);
          onDone();
        },
      },
    ]);

  return (
    <View style={styles.editor}>
      <TextField
        label={t('topics.nameLabel')}
        value={name}
        onChangeText={setName}
        maxLength={TOPIC_NAME_MAX}
        error={error}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={save}
      />
      <Segmented
        label={t('topics.difficultyLabel')}
        options={options}
        value={difficulty}
        onChange={setDifficulty}
      />
      <View style={styles.editorActions}>
        <Button label={t('common.save')} onPress={save} />
        <Button variant="secondary" label={t('common.cancel')} onPress={onDone} />
        <Button variant="plain" label={t('topics.delete')} onPress={remove} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.md,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: Space.xs,
  },
  rowText: {
    flex: 1,
    gap: 2,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm + 2,
    minHeight: 52,
    justifyContent: 'center',
  },
  iconSpace: {
    width: 44,
  },
  editor: {
    gap: Space.md,
    padding: Space.lg,
  },
  editorActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  addForm: {
    gap: Space.md,
  },
});

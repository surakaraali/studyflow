import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Section } from '@/components/ui/section';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Space } from '@/constants/theme';
import { useDbQuery } from '@/db/use-query';
import { CheckRow } from '@/features/courses/components/check-row';
import { difficultyKey } from '@/features/topics/components/topic-list';
import { addTopic, listTopics, TOPIC_NAME_MAX } from '@/features/topics/repo';

type TopicPickerProps = {
  courseId: string | null;
  value: string[];
  onChange: (ids: string[]) => void;
};

/** Exam form: pick the exam's topics from the course, or add a new one in place. */
export function TopicPicker({ courseId, value, onChange }: TopicPickerProps) {
  const { t } = useTranslation();
  const { data: topics } = useDbQuery(
    `topics:${courseId ?? 'none'}`,
    () => (courseId ? listTopics(courseId) : Promise.resolve([])),
    ['topics'],
  );
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  const add = async () => {
    const trimmed = name.trim();
    if (!courseId || !trimmed) return;
    setAdding(true);
    try {
      const id = await addTopic(courseId, trimmed);
      onChange([...value, id]);
      setName('');
    } finally {
      setAdding(false);
    }
  };

  const list = topics ?? [];

  return (
    <View style={styles.wrap}>
      <Section title={t('exams.topicsLabel')} footer={courseId ? t('exams.topicsHint') : undefined}>
        {list.map((topic) => (
          <CheckRow
            key={topic.id}
            title={topic.name}
            subtitle={t(`topics.difficulty.${difficultyKey(topic.difficulty)}`)}
            checked={value.includes(topic.id)}
            onToggle={() => toggle(topic.id)}
          />
        ))}
      </Section>
      {!courseId ? (
        <AppText variant="callout" color="inkSoft">
          {t('exams.topicsNeedCourse')}
        </AppText>
      ) : (
        <>
          {topics && list.length === 0 ? (
            <AppText variant="callout" color="inkSoft">
              {t('exams.topicsEmpty')}
            </AppText>
          ) : null}
          <View style={styles.add}>
            <TextField
              label={t('exams.newTopic')}
              placeholder={t('topics.newPlaceholder')}
              value={name}
              onChangeText={setName}
              maxLength={TOPIC_NAME_MAX}
              returnKeyType="done"
              onSubmitEditing={add}
            />
            <Button
              variant="secondary"
              label={t('exams.addTopic')}
              icon={{ ios: 'plus', android: 'add', web: 'add' }}
              disabled={!name.trim()}
              loading={adding}
              onPress={add}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.md,
  },
  add: {
    gap: Space.sm,
  },
});

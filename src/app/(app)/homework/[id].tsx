import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { useDbQuery } from '@/db/use-query';
import { HomeworkForm } from '@/features/homework/components/homework-form';
import {
  deleteHomework,
  getHomework,
  setHomeworkDone,
  type HomeworkWithCourse,
} from '@/features/homework/repo';

/** US-29: edit, mark done, delete. */
export default function HomeworkScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useDbQuery(`homework:${id}`, () => getHomework(id), ['homework', 'courses']);
  // The form edits the homework as it was when the screen opened; done state stays live.
  const [snapshot, setSnapshot] = useState<HomeworkWithCourse | null | undefined>(undefined);
  if (data !== undefined && snapshot === undefined) setSnapshot(data);

  if (snapshot === undefined) return <Stack.Screen options={{ title: t('homework.editTitle') }} />;
  if (snapshot === null) {
    return (
      <>
        <Stack.Screen options={{ title: t('homework.editTitle') }} />
        <Page>
          <AppText variant="callout" color="inkSoft">
            {t('homework.notFound')}
          </AppText>
        </Page>
      </>
    );
  }

  const done = (data ?? snapshot).done_at != null;

  const remove = () =>
    Alert.alert(
      t('homework.deleteConfirmTitle'),
      t('homework.deleteConfirmBody', { description: snapshot.description }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteHomework(snapshot.id);
            router.back();
          },
        },
      ],
    );

  return (
    <>
      <Stack.Screen options={{ title: t('homework.editTitle') }} />
      <HomeworkForm
        homeworkId={snapshot.id}
        originalDueDate={snapshot.due_date}
        initial={{
          courseId: snapshot.course_id,
          description: snapshot.description,
          dueDate: snapshot.due_date,
        }}
        onSaved={() => router.back()}
        header={done ? <Banner tone="success" message={t('homework.doneBanner')} /> : null}>
        <View style={styles.actions}>
          <Button
            variant="secondary"
            label={done ? t('homework.markOpen') : t('homework.markDone')}
            icon={
              done
                ? { ios: 'arrow.uturn.backward', android: 'undo', web: 'undo' }
                : { ios: 'checkmark', android: 'check', web: 'check' }
            }
            onPress={() => setHomeworkDone(snapshot.id, !done)}
          />
          <Button variant="destructive" label={t('homework.delete')} onPress={remove} />
        </View>
      </HomeworkForm>
    </>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'flex-start',
    gap: Space.md,
  },
});

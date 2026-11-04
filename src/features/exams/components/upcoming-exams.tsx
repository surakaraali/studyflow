import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Section } from '@/components/ui/section';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { useDbQuery } from '@/db/use-query';
import { ExamRow } from '@/features/exams/components/exam-row';
import { listUpcomingExams } from '@/features/exams/repo';
import { useOfficialExamSync } from '@/features/exams/use-official-sync';
import { todayString } from '@/lib/dates';

/**
 * CONTRACT (owned by the exams feature): the nearest 3 exams with a countdown (US-28).
 * Brings its own "Yaklaşan sınavlar" heading, so the host screen should not add one.
 */
export function UpcomingExams({ limit = 3 }: { limit?: number }) {
  const { t } = useTranslation();
  const today = todayString();
  useOfficialExamSync();
  const { data: exams } = useDbQuery(
    `exams:upcoming:${today}:${limit}`,
    () => listUpcomingExams({ today, limit }),
    ['exams', 'courses'],
  );

  // Nothing while loading, so the screen does not flash the empty text.
  if (!exams) return null;

  if (exams.length === 0) {
    return (
      <View style={styles.empty}>
        <AppText variant="title" accessibilityRole="header">
          {t('exams.upcomingTitle')}
        </AppText>
        <AppText variant="callout" color="inkSoft">
          {t('exams.upcomingEmpty')}
        </AppText>
        <View style={styles.action}>
          <Button
            variant="secondary"
            label={t('exams.add')}
            icon={{ ios: 'plus', android: 'add', web: 'add' }}
            onPress={() => router.push('/exam/new')}
          />
        </View>
      </View>
    );
  }

  return (
    <Section title={t('exams.upcomingTitle')}>
      {exams.map((exam) => (
        <ExamRow key={exam.id} exam={exam} today={today} />
      ))}
    </Section>
  );
}

const styles = StyleSheet.create({
  empty: {
    gap: Space.sm,
  },
  action: {
    alignItems: 'flex-start',
    marginTop: Space.xs,
  },
});

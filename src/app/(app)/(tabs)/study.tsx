import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Space } from '@/constants/theme';
import { useDbQuery } from '@/db/use-query';
import { AiGateNotice } from '@/features/documents/components/ai-gate-notice';
import { StatusChip } from '@/features/documents/components/status-chip';
import { aiGate } from '@/features/documents/gate';
import { listDocuments } from '@/features/documents/repo';
import { displayStatus } from '@/features/documents/status';
import { DueCardsSummary } from '@/features/flashcards/components/due-cards-summary';
import { QuotaMeter } from '@/features/quota/quota-meter';
import { useQuota } from '@/features/quota/use-quota';
import { track } from '@/services/analytics';
import { useAiAllowed } from '@/features/consent/ai-allowed';
import { useProfile } from '@/stores/session';

/** Study tab: quota, PDF upload, the student's documents and a way to their cards (US-31, US-38). */
export default function StudyScreen() {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const ai = useAiAllowed();
  const quota = useQuota();
  const gate = aiGate(profile, ai, quota);
  const aiAllowed = ai.allowed && profile?.ai_notice_accepted_at != null;
  const { data: documents } = useDbQuery('study:documents', () => listDocuments(), ['documents', 'courses']);

  const upload = () => {
    if (gate.kind === 'notice') router.push({ pathname: '/ai-notice', params: { next: 'upload' } });
    else if (gate.kind === 'quota') {
      track('quota_reached', { plan: profile?.plan ?? 'free' });
      router.push({ pathname: '/paywall', params: { source: 'quota' } });
    }
    else router.push('/document/upload');
  };

  const uploadAction = {
    label: t('study.uploadPdf'),
    icon: { ios: 'doc.badge.plus', android: 'upload_file', web: 'upload_file' },
    disabled: gate.kind === 'consent',
    onPress: upload,
  } as const;

  return (
    <Screen title={t('tabs.study')}>
      {gate.kind === 'consent' ? <AiGateNotice gate={gate} /> : null}

      {documents && documents.length === 0 ? (
        <EmptyState title={t('study.emptyTitle')} body={t('study.emptyBody')} actions={[uploadAction]} />
      ) : null}

      {quota && gate.kind !== 'consent' ? (
        <Card>
          <QuotaMeter quota={quota} />
          {!quota.full && documents && documents.length > 0 ? <Button {...uploadAction} block /> : null}
        </Card>
      ) : null}

      <DueCardsSummary />

      <Section>
        <ListRow
          title={t('study.myCards')}
          subtitle={t('study.myCardsHint')}
          icon={{ ios: 'rectangle.stack', android: 'style', web: 'style' }}
          onPress={() => router.push('/decks')}
        />
      </Section>

      {documents && documents.length > 0 ? (
        <Section title={t('study.documentsTitle')}>
          {documents.map((doc) => {
            const status = displayStatus(doc, aiAllowed);
            return (
            <ListRow
              key={doc.id}
              title={doc.title}
              subtitle={[doc.course_name ?? t('study.noCourse'), t('study.pages', { count: doc.page_to - doc.page_from + 1 })].join(
                ' · ',
              )}
              color={doc.course_color ?? undefined}
              trailing={
                <View style={styles.trailing}>
                  <StatusChip status={status} />
                </View>
              }
              // The row's spoken label covers title and subtitle; the status follows.
              accessibilityHint={t(`documents.status.${status}`)}
              onPress={() => router.push({ pathname: '/document/[id]', params: { id: doc.id } })}
            />
            );
          })}
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  trailing: {
    marginLeft: Space.xs,
  },
});

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { Page } from '@/components/ui/page';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Section } from '@/components/ui/section';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { useDbQuery } from '@/db/use-query';
import { StatusChip } from '@/features/documents/components/status-chip';
import {
  deleteDocument,
  getDocument,
  getDocumentContent,
  retryDocument,
  type DocumentListItem,
} from '@/features/documents/repo';
import { canRetry, displayStatus, estimatedProgress, type DisplayStatus } from '@/features/documents/status';
import { useQuota } from '@/features/quota/use-quota';
import { SummaryView } from '@/features/summary/summary-view';
import { asErrorCode } from '@/services/ai/types';
import { useAiAllowed } from '@/features/consent/ai-allowed';
import { useProfile } from '@/stores/session';

/** A bar that keeps moving while the job runs, so waiting feels alive. */
function ProcessingBar({ doc }: { doc: DocumentListItem }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const pages = doc.page_to - doc.page_from + 1;
  return (
    <ProgressBar value={estimatedProgress(now - Date.parse(doc.updated_at), pages)} accessibilityLabel={t('documents.progressA11y')} />
  );
}

function StatusCard({ doc, status }: { doc: DocumentListItem; status: DisplayStatus }) {
  const { t } = useTranslation();
  const body = {
    queued: t('documents.queuedBody'),
    retrying: t('documents.retryingBody'),
    waiting: t('documents.waitingBody'),
    processing: t('documents.processingBody'),
    ready: '',
    error: '',
  }[status];

  return (
    <Card>
      <StatusChip status={status} />
      <AppText variant="callout" color="inkSoft" accessibilityLiveRegion="polite">
        {body}
      </AppText>
      {status === 'processing' ? <ProcessingBar doc={doc} /> : null}
    </Card>
  );
}

/** US-33: a document's status, then its summary and the way to the quiz and the cards. */
export default function DocumentScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useProfile();
  const ai = useAiAllowed();
  const quota = useQuota();
  const [notice, setNotice] = useState<'quota' | 'offline' | null>(null);
  const [retrying, setRetrying] = useState(false);

  const { data: doc, loading } = useDbQuery(`document:${id}`, () => getDocument(id), ['documents', 'courses']);
  const { data: content } = useDbQuery(
    `document-content:${id}`,
    () => getDocumentContent(id),
    ['summaries', 'quizzes', 'questions', 'cards'],
  );

  const header = <Stack.Screen options={{ title: '' }} />;

  if (!doc) {
    return (
      <>
        {header}
        <Page>{loading ? null : <EmptyState title={t('documents.fallbackTitle')} body={t('documents.notFound')} />}</Page>
      </>
    );
  }

  const aiAllowed = ai.allowed && profile?.ai_notice_accepted_at != null;
  const status = displayStatus(doc, aiAllowed);
  const code = asErrorCode(doc.error_code);
  const pages = doc.page_to - doc.page_from + 1;

  const retry = async () => {
    setNotice(null);
    setRetrying(true);
    try {
      const result = await retryDocument(doc, quota?.full ?? false);
      if (result !== 'queued') setNotice(result);
    } finally {
      setRetrying(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(t('documents.deleteTitle'), t('documents.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteDocument(doc);
          if (router.canGoBack()) router.back();
          else router.replace('/study');
        },
      },
    ]);
  };

  const showPro = code === 'quota_exceeded' || notice === 'quota';

  return (
    <>
      {header}
      <Page title={doc.title}>
        <View style={styles.meta}>
          {doc.course_color ? <View style={[styles.dot, { backgroundColor: doc.course_color }]} /> : null}
          <AppText variant="callout" color="inkSoft" style={styles.metaText}>
            {[doc.course_name ?? t('study.noCourse'), t('documents.pagesInfo', { from: doc.page_from, to: doc.page_to, count: pages })].join(' · ')}
          </AppText>
        </View>

        {doc.under_review === 1 ? (
          <Banner title={t('documents.underReviewTitle')} message={t('documents.underReviewBody')} />
        ) : null}

        {notice ? (
          <Banner
            tone="warning"
            message={notice === 'quota' ? t('documents.errors.quota_exceeded') : t('documents.retryOffline')}
          />
        ) : null}

        {status === 'error' ? (
          <Card>
            <StatusChip status="error" />
            <AppText variant="heading" accessibilityRole="header">
              {t('documents.errorTitle')}
            </AppText>
            <AppText variant="callout" color="inkSoft">
              {t(`documents.errors.${code}`)}
            </AppText>
            {doc.counted === 0 ? (
              <AppText variant="footnote" color="inkSoft">
                {t('documents.refunded')}
              </AppText>
            ) : null}
            <View style={styles.actions}>
              {canRetry(doc) && !showPro ? (
                <Button
                  label={t('documents.retry')}
                  icon={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }}
                  loading={retrying}
                  disabled={!aiAllowed}
                  onPress={retry}
                />
              ) : null}
              {showPro && profile?.plan !== 'pro' ? (
                <Button
                  label={t('documents.goPro')}
                  icon={{ ios: 'star.fill', android: 'star', web: 'star' }}
                  onPress={() => router.push({ pathname: '/paywall', params: { source: 'quota' } })}
                />
              ) : null}
            </View>
          </Card>
        ) : status === 'ready' ? (
          <Card>
            <AppText variant="callout" color="inkSoft">
              {t('documents.counts', { questions: content?.questionCount ?? 0, cards: content?.cardCount ?? 0 })}
            </AppText>
            <View style={styles.actions}>
              {content?.quizId ? (
                <Button
                  label={t('documents.takeQuiz')}
                  icon={{ ios: 'checklist', android: 'quiz', web: 'quiz' }}
                  onPress={() => router.push({ pathname: '/quiz/[id]', params: { id: content.quizId! } })}
                />
              ) : null}
              {content?.deckId ? (
                <Button
                  variant="secondary"
                  label={t('documents.studyCards')}
                  icon={{ ios: 'rectangle.stack', android: 'style', web: 'style' }}
                  onPress={() => router.push({ pathname: '/review', params: { deckId: content.deckId! } })}
                />
              ) : null}
            </View>
            {content?.quizId ? (
              <Button
                variant="plain"
                label={t('documents.editQuestions')}
                icon={{ ios: 'pencil', android: 'edit', web: 'edit' }}
                onPress={() => router.push({ pathname: '/quiz/edit/[id]', params: { id: content.quizId! } })}
              />
            ) : null}
          </Card>
        ) : (
          <StatusCard doc={doc} status={status} />
        )}

        {status === 'ready' && content ? <SummaryView sections={content.sections} /> : null}

        <Section>
          <ListRow
            title={t('documents.delete')}
            icon={{ ios: 'trash', android: 'delete', web: 'delete' }}
            destructive
            onPress={confirmDelete}
          />
        </Section>
      </Page>
    </>
  );
}

const styles = StyleSheet.create({
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    marginTop: -Space.md,
  },
  metaText: {
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.md,
  },
});

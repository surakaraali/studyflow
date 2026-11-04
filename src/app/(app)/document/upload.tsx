import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Page } from '@/components/ui/page';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Segmented } from '@/components/ui/segmented';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Space } from '@/constants/theme';
import { newId } from '@/db/ids';
import { useDbQuery } from '@/db/use-query';
import { AiGateNotice } from '@/features/documents/components/ai-gate-notice';
import { PageRangePicker } from '@/features/documents/components/page-range-picker';
import {
  deleteFileQuietly,
  PdfCheckError,
  pickPdfAsset,
  readPickedPdf,
  saveDocumentFile,
  titleFromFileName,
  type PdfProblem,
  type PickedPdf,
} from '@/features/documents/files';
import { aiGate } from '@/features/documents/gate';
import { createDocument, listTopics } from '@/features/documents/repo';
import { listCourses } from '@/features/courses/repo';
import { initialPageRange, rangeLength, type PageRange } from '@/features/quota/quota';
import { QuotaMeter } from '@/features/quota/quota-meter';
import { useQuota } from '@/features/quota/use-quota';
import { localeTag } from '@/lib/dates';
import { track } from '@/services/analytics';
import { useAiAllowed } from '@/features/consent/ai-allowed';
import { useProfile, useSession } from '@/stores/session';

type Phase = 'idle' | 'reading' | 'ready' | 'saving';

const PROBLEM_REASON = {
  notPdf: 'not_pdf',
  tooLarge: 'too_large',
  encrypted: 'encrypted',
  unreadable: 'unknown',
  noPages: 'no_text',
} as const satisfies Record<PdfProblem, string>;

function formatSize(bytes: number, tag: string): string {
  const mb = bytes / (1024 * 1024);
  const format = new Intl.NumberFormat(tag, { maximumFractionDigits: 1 });
  return mb >= 1 ? `${format.format(mb)} MB` : `${format.format(Math.max(1, Math.round(bytes / 1024)))} KB`;
}

/** US-31: pick a PDF, check it, choose course, topic and page range, then queue it. */
export default function UploadScreen() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ courseId?: string }>();
  const { profile } = useProfile();
  const ai = useAiAllowed();
  const userId = useSession((s) => s.user?.id ?? null);
  const quota = useQuota();
  const gate = aiGate(profile, ai, quota);

  const { data: courses } = useDbQuery('upload:courses', () => listCourses(), ['courses']);
  const [chosenCourseId, setCourseId] = useState<string | null>(params.courseId ?? null);
  // Defaults to the first course until the student picks one.
  const courseId = chosenCourseId ?? courses?.[0]?.id ?? null;
  const { data: topics } = useDbQuery(
    `upload:topics:${courseId ?? ''}`,
    async () => (courseId ? listTopics(courseId) : []),
    ['topics'],
  );

  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedPdf | null>(null);
  const [title, setTitle] = useState('');
  const [topicId, setTopicId] = useState('');
  const [range, setRange] = useState<PageRange>({ from: 1, to: 1 });
  const [chooseRange, setChooseRange] = useState(false);

  // The cache copy made by the picker is not needed once we leave.
  useEffect(() => () => deleteFileQuietly(picked?.uri), [picked]);

  // G-05: the student reached the monthly limit while trying to upload.
  const quotaBlocked = gate.kind === 'quota';
  useEffect(() => {
    if (quotaBlocked) track('quota_reached', { plan: profile?.plan ?? 'free' });
  }, [quotaBlocked, profile?.plan]);

  const maxPages = quota?.pages ?? 20;
  const tooManyPages = picked != null && picked.pageCount > maxPages;
  const showRange = picked != null && picked.pageCount > 1 && (tooManyPages || chooseRange);

  const problemMessage = (problem: PdfProblem) => t(`upload.errors.${problem}`);

  const pick = async () => {
    setError(null);
    let asset;
    try {
      asset = await pickPdfAsset();
    } catch {
      setError(t('upload.errors.pickFailed'));
      return;
    }
    if (!asset) return;

    setPhase('reading');
    setProgress({ value: 0.3, label: t('upload.reading') });
    try {
      const pdf = await readPickedPdf(asset);
      setProgress({ value: 1, label: t('upload.reading') });
      setPicked(pdf);
      setTitle(titleFromFileName(pdf.name));
      setRange(initialPageRange(pdf.pageCount, maxPages));
      setChooseRange(false);
      setPhase('ready');
    } catch (err) {
      deleteFileQuietly(asset.uri);
      const problem = err instanceof PdfCheckError ? err.problem : 'unreadable';
      track('document_failed', { reason: PROBLEM_REASON[problem] });
      setError(problemMessage(problem));
      setPhase(picked ? 'ready' : 'idle');
    } finally {
      setProgress(null);
    }
  };

  const submit = async () => {
    if (!picked || !userId) return;
    if (!courseId) {
      setError(t('upload.errors.courseRequired'));
      return;
    }
    if (gate.kind !== 'ok') return;

    const finalRange = showRange ? range : { from: 1, to: picked.pageCount };
    if (rangeLength(finalRange) > maxPages) return;

    setError(null);
    setPhase('saving');
    const whole = finalRange.from === 1 && finalRange.to === picked.pageCount;
    setProgress({ value: 0.35, label: whole ? t('upload.saving') : t('upload.trimming') });
    const id = newId();
    let savedUri: string | null = null;
    try {
      const saved = await saveDocumentFile(userId, id, picked, finalRange);
      savedUri = saved.uri;
      setProgress({ value: 0.85, label: t('upload.saving') });
      await createDocument({
        id,
        courseId,
        topicId: topicId || null,
        title: title.trim() || titleFromFileName(picked.name),
        fileUri: saved.uri,
        sizeBytes: saved.size,
        pageCount: picked.pageCount,
        pageFrom: finalRange.from,
        pageTo: finalRange.to,
      });
      setProgress({ value: 1, label: t('upload.saving') });
      track('document_uploaded', { pages: rangeLength(finalRange), plan: profile?.plan ?? 'free' });
      router.replace({ pathname: '/document/[id]', params: { id } });
    } catch {
      deleteFileQuietly(savedUri);
      setError(t('upload.errors.saveFailed'));
      setPhase('ready');
      setProgress(null);
    }
  };

  const header = <Stack.Screen options={{ title: t('upload.title') }} />;

  // Gates: consent, AI notice, quota (US-17, US-18, US-38).
  if (gate.kind === 'consent' || gate.kind === 'notice') {
    return (
      <>
        {header}
        <Page intro={t('upload.intro')}>
          <AiGateNotice gate={gate} courseId={courseId ?? undefined} />
        </Page>
      </>
    );
  }
  if (gate.kind === 'quota' && quota && phase !== 'saving') {
    return (
      <>
        {header}
        <Page intro={t('upload.intro')}>
          <Card>
            <QuotaMeter quota={quota} />
          </Card>
        </Page>
      </>
    );
  }

  if (courses && courses.length === 0) {
    return (
      <>
        {header}
        <Page>
          <EmptyState
            title={t('upload.noCoursesTitle')}
            body={t('upload.noCoursesBody')}
            actions={[
              { label: t('upload.addCourse'), icon: { ios: 'plus', android: 'add', web: 'add' }, onPress: () => router.push('/course/new') },
            ]}
          />
        </Page>
      </>
    );
  }

  const busy = phase === 'reading' || phase === 'saving';

  return (
    <>
      {header}
      <Page
        intro={t('upload.intro')}
        footer={
          picked ? (
            <>
              <Button
                block
                label={t('upload.submit')}
                icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
                loading={phase === 'saving'}
                disabled={busy || !courseId}
                onPress={submit}
              />
              <AppText variant="footnote" color="inkSoft" style={styles.center}>
                {t('upload.submitHint')}
              </AppText>
            </>
          ) : null
        }>
        {quota ? <QuotaMeter quota={quota} explainWhenFull={false} /> : null}

        {error ? <Banner tone="warning" message={error} /> : null}

        <Card>
          {picked ? (
            <View style={styles.fileInfo}>
              <AppText variant="heading" numberOfLines={2}>
                {picked.name}
              </AppText>
              <AppText variant="footnote" color="inkSoft">
                {t('upload.fileInfo', {
                  pages: t('study.pages', { count: picked.pageCount }),
                  size: formatSize(picked.size, localeTag(i18n.language)),
                })}
              </AppText>
            </View>
          ) : (
            <AppText variant="callout" color="inkSoft">
              {t('upload.pickHint')}
            </AppText>
          )}
          {progress ? <ProgressBar value={progress.value} accessibilityLabel={progress.label} /> : null}
          {progress ? (
            <AppText variant="footnote" color="inkSoft" accessibilityLiveRegion="polite">
              {progress.label}
            </AppText>
          ) : null}
          <Button
            label={picked ? t('upload.pickAgain') : t('upload.pick')}
            variant={picked ? 'secondary' : 'primary'}
            icon={{ ios: 'doc.badge.plus', android: 'upload_file', web: 'upload_file' }}
            loading={phase === 'reading'}
            disabled={busy}
            onPress={pick}
          />
        </Card>

        {picked ? (
          <>
            <TextField
              label={t('upload.titleLabel')}
              hint={t('upload.titleHint')}
              value={title}
              onChangeText={setTitle}
              maxLength={80}
              returnKeyType="done"
            />

            {courses ? (
              <Segmented
                label={t('upload.courseLabel')}
                wrap
                options={courses.map((c) => ({ value: c.id, label: c.name }))}
                value={courseId}
                onChange={(id) => {
                  setCourseId(id);
                  setTopicId('');
                }}
              />
            ) : null}

            {topics && topics.length > 0 ? (
              <Segmented
                label={t('upload.topicLabel')}
                wrap
                options={[{ value: '', label: t('upload.noTopic') }, ...topics.map((tp) => ({ value: tp.id, label: tp.name }))]}
                value={topicId}
                onChange={setTopicId}
              />
            ) : null}

            {picked.pageCount > 1 ? (
              <View style={styles.range}>
                <AppText variant="heading" accessibilityRole="header">
                  {t('upload.rangeTitle')}
                </AppText>
                {tooManyPages ? (
                  <Banner tone="info" message={t('upload.rangeTooMany', { total: picked.pageCount, max: maxPages })} />
                ) : null}
                {showRange ? (
                  <PageRangePicker pageCount={picked.pageCount} maxPages={maxPages} value={range} onChange={setRange} />
                ) : (
                  <View style={styles.rangeRow}>
                    <AppText variant="callout" color="inkSoft" style={styles.flex}>
                      {t('upload.rangeWhole')}
                    </AppText>
                    <Button variant="plain" label={t('upload.rangeChoose')} onPress={() => setChooseRange(true)} />
                  </View>
                )}
              </View>
            ) : null}
          </>
        ) : null}
      </Page>
    </>
  );
}

const styles = StyleSheet.create({
  fileInfo: {
    gap: Space.xs,
  },
  range: {
    gap: Space.sm,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
});

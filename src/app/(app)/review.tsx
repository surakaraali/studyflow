import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { BubbleRow } from '@/components/bubble-row';
import { EmptyState } from '@/components/empty-state';
import { AiLabel } from '@/components/ui/ai-label';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Page } from '@/components/ui/page';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import type { ReportReason } from '@/db/types';
import { comesBackToday, GRADES, previewDue, Rating, review, State, type Grade } from '@/domain/fsrs';
import { FlipCard } from '@/features/flashcards/components/flip-card';
import { RatingButtons } from '@/features/flashcards/components/rating-buttons';
import { intervalParts } from '@/features/flashcards/interval';
import { loadReviewQueue, saveReview, type ReviewCard } from '@/features/flashcards/repo';
import { useSegment } from '@/features/flashcards/use-segment';
import { FLAG_ICON } from '@/features/quiz/components/tag';
import { ReportSheet } from '@/features/reports/report-sheet';
import { reportItem } from '@/features/reports/repo';

type Stats = { reviews: number; learned: number; again: number; remembered: number };

const EMPTY_STATS: Stats = { reviews: 0, learned: 0, again: 0, remembered: 0 };

/**
 * US-45 / US-46: spaced-repetition session. The queue lives in memory, so the next card
 * shows at once (PERF-04); each answer is written to SQLite in the background and synced
 * later through the outbox, so the session works offline.
 */
export default function ReviewScreen() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const { t } = useTranslation();
  const segment = useSegment();

  const [status, setStatus] = useState<'loading' | 'empty' | 'active' | 'done'>('loading');
  const [queue, setQueue] = useState<ReviewCard[]>([]);
  const [intervals, setIntervals] = useState<Record<Grade, string> | null>(null);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [reportOpen, setReportOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Answers are written one after another, after the next card has rendered.
  const writes = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let alive = true;
    loadReviewQueue(segment, deckId)
      .then((cards) => {
        if (!alive) return;
        setQueue(cards);
        setStatus(cards.length > 0 ? 'active' : 'empty');
      })
      .catch(() => {
        if (alive) setStatus('empty');
      });
    return () => {
      alive = false;
    };
  }, [segment, deckId]);

  const current = queue[0];

  const formatIn = (from: Date, to: Date) => {
    const { unit, count } = intervalParts(from, to);
    return t(`review.interval.${unit}`, { count });
  };

  const showAnswer = () => {
    if (!current) return;
    const now = new Date();
    const due = previewDue(current, now);
    const next = {} as Record<Grade, string>;
    for (const grade of GRADES) next[grade] = formatIn(now, due[grade]);
    setIntervals(next);
  };

  const persist = (task: () => Promise<void>) => {
    writes.current = writes.current
      .then(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))
      .then(task)
      .then(() => setSaveError(null))
      .catch(() => setSaveError(t('review.saveError')));
  };

  const rate = (grade: Grade) => {
    if (!current) return;
    const now = new Date();
    const { fields, log } = review(current, grade, now);
    const rest = queue.slice(1);
    // Learning steps are minutes long: the card comes back at the end of this session.
    const next = comesBackToday(fields, now) ? [...rest, { ...current, ...fields }] : rest;

    setQueue(next);
    setIntervals(null);
    setNotice(null);
    setStats((s) => ({
      reviews: s.reviews + 1,
      learned: s.learned + (current.state === State.New ? 1 : 0),
      again: s.again + (grade === Rating.Again ? 1 : 0),
      remembered: s.remembered + (grade === Rating.Again ? 0 : 1),
    }));
    if (next.length === 0) setStatus('done');

    persist(() => saveReview(current.id, fields, log));
  };

  const report = (reason: ReportReason) => {
    setReportOpen(false);
    if (!current) return;
    const card = current;
    // BR-23: gone for this student right away; the write follows in the background.
    const next = queue.filter((c) => c.id !== card.id);
    setQueue(next);
    setIntervals(null);
    setNotice(t('review.reported'));
    if (next.length === 0) setStatus(stats.reviews > 0 ? 'done' : 'empty');
    persist(() =>
      reportItem({ itemType: 'card', itemId: card.id, documentId: card.document_id, reason }),
    );
  };

  if (status === 'loading') return <Page />;

  if (status === 'empty') {
    return (
      <Page>
        <Stack.Screen options={{ title: t('review.title') }} />
        {notice ? <Banner tone="success" message={notice} /> : null}
        <EmptyState
          title={t('review.empty.title')}
          body={t('review.empty.body')}
          actions={[{ label: t('review.empty.action'), onPress: () => router.dismissTo('/decks') }]}
        />
      </Page>
    );
  }

  if (status === 'done' || !current) {
    return (
      <Page
        footer={
          <>
            <Button label={t('review.done.close')} block onPress={() => router.back()} />
            <Button
              label={t('review.done.decks')}
              variant="plain"
              block
              onPress={() => router.dismissTo('/decks')}
            />
          </>
        }>
        <Stack.Screen options={{ title: t('review.title') }} />
        <Card>
          <BubbleRow filled={5} size="large" />
          <AppText variant="display" accessibilityRole="header">
            {t('review.done.title')}
          </AppText>
          <AppText variant="callout" color="inkSoft">
            {t('review.done.body', { count: stats.reviews })}
          </AppText>
          <View style={styles.stats}>
            {(['learned', 'remembered', 'again'] as const).map((key) => (
              <View
                key={key}
                accessible
                accessibilityLabel={`${t(`review.done.${key}`)}: ${stats[key]}`}
                style={styles.stat}>
                <AppText variant="title">{stats[key]}</AppText>
                <AppText variant="footnote" color="inkSoft">
                  {t(`review.done.${key}`)}
                </AppText>
              </View>
            ))}
          </View>
        </Card>
        {saveError ? <Banner tone="warning" message={saveError} /> : null}
      </Page>
    );
  }

  return (
    <Page
      footer={
        intervals ? <RatingButtons intervals={intervals} onRate={rate} /> : undefined
      }>
      <Stack.Screen options={{ title: t('review.title') }} />

      <View style={styles.top}>
        <AppText variant="heading">{t('review.remaining', { count: queue.length })}</AppText>
        <AppText variant="footnote" color="inkSoft" numberOfLines={1} style={styles.deck}>
          {current.deck_name}
        </AppText>
      </View>

      {notice ? <Banner tone="success" message={notice} /> : null}
      {saveError ? <Banner tone="warning" message={saveError} /> : null}

      <FlipCard
        key={`${current.id}:${current.reps}`}
        front={current.front}
        back={current.back}
        onFlip={showAnswer}
        footer={
          <View style={styles.meta}>
            {current.ai_generated ? <AiLabel /> : null}
            {current.source_page != null ? (
              <AppText variant="footnote" color="inkSoft">
                {t('flashcards.card.source', { page: current.source_page })}
              </AppText>
            ) : null}
            <View style={styles.spacer} />
            <Button
              label={t('review.report')}
              variant="plain"
              icon={FLAG_ICON}
              accessibilityHint={t('review.reportA11y')}
              onPress={() => setReportOpen(true)}
            />
          </View>
        }
      />

      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} onSelect={report} />
    </Page>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.md,
  },
  deck: {
    flexShrink: 1,
    textAlign: 'right',
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Space.sm,
  },
  spacer: {
    flexGrow: 1,
  },
  stats: {
    flexDirection: 'row',
    gap: Space.md,
  },
  stat: {
    flex: 1,
    gap: 2,
  },
});

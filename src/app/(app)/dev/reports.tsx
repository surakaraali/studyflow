import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Page } from '@/components/ui/page';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { useDbQuery } from '@/db/use-query';
import { confirmDestructive } from '@/features/quiz/confirm';
import { HIDDEN_ICON, Tag } from '@/features/quiz/components/tag';
import { optionLetter, parseOptions } from '@/features/quiz/scoring';
import type { ReportDecision } from '@/features/reports/logic';
import { decideReports, listOpenReports, type ReportGroup } from '@/features/reports/repo';

/**
 * US-37 team review queue. In production this is an internal tool; in local mode it is
 * reachable from settings so the whole report flow can be tried on one device.
 */
export default function ReportQueueScreen() {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const { data } = useDbQuery('report-queue', listOpenReports, [
    'content_reports',
    'questions',
    'cards',
    'documents',
  ]);

  if (!data) return <Page />;

  const decide = async (group: ReportGroup, decision: ReportDecision) => {
    if (decision === 'removed') {
      const ok = await confirmDestructive({
        title: t('reports.queue.removeTitle'),
        message: t('reports.queue.removeBody'),
        confirmLabel: t('reports.queue.remove'),
        cancelLabel: t('common.cancel'),
      });
      if (!ok) return;
    }
    try {
      setError(null);
      await decideReports(group.itemType, group.itemId, decision);
    } catch {
      setError(t('common.genericError'));
    }
  };

  const fix = (group: ReportGroup) => {
    // The report closes as "fixed" when the editor saves.
    if (group.itemType === 'question') {
      router.push({ pathname: '/question/[id]', params: { id: group.itemId, reportId: group.reports[0].id } });
    } else if (group.itemType === 'card') {
      router.push({ pathname: '/card/[id]', params: { id: group.itemId, reportId: group.reports[0].id } });
    }
  };

  return (
    <Page intro={t('reports.queue.intro')}>
      <Stack.Screen options={{ title: t('reports.queue.title') }} />
      {error ? <Banner tone="warning" message={error} /> : null}

      {data.length === 0 ? (
        <EmptyState title={t('reports.queue.empty.title')} body={t('reports.queue.empty.body')} />
      ) : (
        data.map((group) => (
          <ReportItem
            key={group.itemId}
            group={group}
            onRemove={() => decide(group, 'removed')}
            onFix={() => fix(group)}
            onValid={() => decide(group, 'valid')}
          />
        ))
      )}
    </Page>
  );
}

function ReportItem({
  group,
  onRemove,
  onFix,
  onValid,
}: {
  group: ReportGroup;
  onRemove: () => void;
  onFix: () => void;
  onValid: () => void;
}) {
  const { t } = useTranslation();
  const reasons = [...new Set(group.reports.map((r) => t(`reports.reasons.${r.reason}`)))];
  const exists = group.question != null || group.card != null;
  const hidden = group.question?.hidden || group.card?.hidden;

  return (
    <Card>
      <View style={styles.head}>
        <AppText variant="footnote" color="inkSoft">
          {t(`reports.queue.types.${group.itemType}`)} · {t('reports.queue.count', { count: group.reports.length })}
        </AppText>
        {hidden ? <Tag label={t('question.hidden')} icon={HIDDEN_ICON} /> : null}
      </View>

      {group.question ? (
        <View style={styles.body}>
          <AppText variant="heading">{group.question.stem}</AppText>
          <AppText variant="callout" color="success">
            {t('reports.queue.answer', {
              answer: `${optionLetter(group.question.correct_index)}) ${
                parseOptions(group.question.options)[group.question.correct_index] ?? ''
              }`,
            })}
          </AppText>
        </View>
      ) : group.card ? (
        <View style={styles.body}>
          <AppText variant="heading">{group.card.front}</AppText>
          <AppText variant="callout" color="inkSoft">
            {group.card.back}
          </AppText>
        </View>
      ) : (
        <AppText variant="callout" color="inkSoft">
          {t('reports.queue.missing')}
        </AppText>
      )}

      <View style={styles.tags}>
        {reasons.map((reason) => (
          <Tag key={reason} label={reason} tone="exam" />
        ))}
      </View>

      {group.document ? (
        <View style={styles.head}>
          <AppText variant="footnote" color="inkSoft" style={styles.flex}>
            {t('reports.queue.document', { title: group.document.title })}
          </AppText>
          {group.document.under_review ? <Tag label={t('reports.queue.underReview')} tone="exam" /> : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button label={t('reports.queue.remove')} variant="destructive" onPress={onRemove} />
        {exists && group.itemType !== 'summary' ? (
          <Button label={t('reports.queue.fix')} variant="secondary" onPress={onFix} />
        ) : null}
        <Button label={t('reports.queue.valid')} variant="secondary" onPress={onValid} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Space.sm,
  },
  body: {
    gap: Space.xs,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.xs + 2,
  },
  flex: {
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
});

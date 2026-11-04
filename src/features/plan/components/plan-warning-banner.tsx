import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/ui/banner';
import { useDbQuery } from '@/db/use-query';
import { getPlanWarnings } from '@/features/plan/repo';

/** Shows the plan engine's warning (BR-10 "plan is tight", or no free time) with a way out. */
export function PlanWarningBanner() {
  const { t } = useTranslation();
  const { data: warnings } = useDbQuery('plan-warnings', () => getPlanWarnings(), ['kv']);

  const warning =
    warnings?.find((w) => w.code === 'plan_tight') ?? warnings?.find((w) => w.code === 'no_time');
  if (!warning) return null;

  return (
    <Banner
      tone="warning"
      title={t('plan.warningTitle')}
      message={warning.code === 'plan_tight' ? t('plan.warningTight') : t('plan.warningNoTime')}
      actionLabel={t('today.editAvailability')}
      onAction={() => router.push('/availability')}
    />
  );
}

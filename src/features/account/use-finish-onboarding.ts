import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { finishOnboarding } from './service';

/** Runs the last onboarding step; the root layout then shows the app or the waiting screen. */
export function useFinishOnboarding() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async () => {
    setBusy(true);
    setError(null);
    const result = await finishOnboarding();
    if (!result.ok) {
      setError(result.error === 'parent_email' ? t('onboarding.parent.required') : t('onboarding.saveError'));
      setBusy(false);
    }
    // On success this screen unmounts as the guard switches stacks.
  };

  return { finish, busy, error };
}

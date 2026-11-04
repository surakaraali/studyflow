import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { needsParentConsent } from '@/domain/rules';
import { useParentGate } from '@/features/parent-gate/parent-gate';
import { endTestSubscription, manageSubscription, purchaseMode } from '@/services/purchases';
import { useProfile } from '@/stores/session';

/**
 * Plan actions shared by the paywall and settings. Under 18, purchases and store links sit
 * behind the parent gate (BR-19, FR-CON-06). Render `gateElement` once in the screen.
 */
export function usePlanActions() {
  const { t } = useTranslation();
  const { age } = useProfile();
  const { requestGate, gateElement } = useParentGate();
  // No birth year should not happen after onboarding; gate it to be safe.
  const underAge = age == null || needsParentConsent(age);

  const withGate = (action: () => void) => {
    if (underAge) requestGate(action);
    else action();
  };

  const manage = () => {
    if (purchaseMode === 'test') {
      Alert.alert(t('settings.plan.testCancelTitle'), t('settings.plan.testCancelBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.plan.testCancelConfirm'),
          style: 'destructive',
          onPress: () => {
            endTestSubscription().catch(() => Alert.alert(t('common.genericError')));
          },
        },
      ]);
      return;
    }
    withGate(() => {
      manageSubscription().then((opened) => {
        if (!opened) Alert.alert(t('settings.plan.manage'), t('settings.plan.manageError'));
      });
    });
  };

  return { underAge, withGate, manage, gateElement };
}

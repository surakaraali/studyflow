import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { refreshRemoteConfig, useRemoteConfig } from '@/services/remote-config';

import { GateScreen } from './gate-screen';

/**
 * Maintenance mode: the team's message (or the default text) and a retry button. The gate
 * opens by itself once a check sees maintenance switched off.
 */
export function Maintenance({ message }: { message: string | null }) {
  const { t } = useTranslation();
  const checking = useRemoteConfig((s) => s.checking);
  const [note, setNote] = useState<string | null>(null);

  const retry = async () => {
    setNote(null);
    const reached = await refreshRemoteConfig({ force: true });
    // Still here after a successful check means maintenance is still on.
    setNote(reached ? t('appGate.maintenance.stillOn') : t('appGate.maintenance.offline'));
  };

  return (
    <GateScreen
      greeting={t('appGate.maintenance.greeting')}
      title={t('appGate.maintenance.title')}
      body={message ?? t('appGate.maintenance.body')}
      safe={t('appGate.maintenance.safe')}
      note={note}
      footer={
        <Button
          label={t('appGate.maintenance.retry')}
          icon={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }}
          loading={checking}
          onPress={() => void retry()}
          block
        />
      }
    />
  );
}

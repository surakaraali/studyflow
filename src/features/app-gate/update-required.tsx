import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { Button } from '@/components/ui/button';

import { GateScreen } from './gate-screen';
import { openStore } from './store-link';

/** FR-ADM-04: this app version is below the minimum; only the store button is offered. */
export function UpdateRequired({ storeUrl }: { storeUrl: string | null }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);

  const update = async () => {
    setFailed(!(await openStore(storeUrl)));
  };

  return (
    <GateScreen
      greeting={t('appGate.update.greeting')}
      title={t('appGate.update.title')}
      body={t('appGate.update.body')}
      safe={t('appGate.update.safe')}
      note={failed ? t('appGate.update.openFailed') : null}
      footer={
        <Button
          label={Platform.OS === 'android' ? t('appGate.update.buttonAndroid') : t('appGate.update.buttonIos')}
          icon={{ ios: 'arrow.down.app', android: 'system_update', web: 'system_update' }}
          onPress={() => void update()}
          block
        />
      }
    />
  );
}

import Storage from 'expo-sqlite/kv-store';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AppState, Modal } from 'react-native';

import { currentGateState, useRemoteConfig, type AppGateState } from '@/services/remote-config';

import { Maintenance } from './maintenance';
import { openStore } from './store-link';
import { UpdateRequired } from './update-required';

const PROMPTED_KEY = 'studyflow.appGate.promptedVersion';
const PROMPT_DELAY_MS = 1_500;

/** The gate for this device; re-evaluates when the remote config changes or the app returns. */
export function useAppGate(): AppGateState {
  const config = useRemoteConfig((s) => s.config);
  const fetchedAt = useRemoteConfig((s) => s.fetchedAt);
  const [now, setNow] = useState(() => Date.now());

  // The cached maintenance flag expires with time, so the clock is read again on foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => subscription.remove();
  }, []);

  return currentGateState({ config, fetchedAt }, Math.max(now, fetchedAt ?? 0));
}

function readPrompted(): string | null {
  try {
    return Storage.getItemSync(PROMPTED_KEY);
  } catch {
    return null;
  }
}

/** Asks once per new store version; "Sonra" is remembered for that version. */
function useUpdatePrompt(gate: AppGateState, enabled: boolean) {
  const { t } = useTranslation();
  const available = gate.status === 'open' ? gate.updateAvailable : null;
  const latest = available?.latestVersion ?? null;
  const storeUrl = available?.storeUrl ?? null;

  useEffect(() => {
    if (!enabled || !latest || readPrompted() === latest) return;
    const timer = setTimeout(() => {
      try {
        Storage.setItemSync(PROMPTED_KEY, latest);
      } catch {
        // Asked again next time; harmless.
      }
      Alert.alert(t('appGate.available.title'), t('appGate.available.body'), [
        { text: t('appGate.available.later'), style: 'cancel' },
        { text: t('appGate.available.update'), onPress: () => void openStore(storeUrl) },
      ]);
    }, PROMPT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [enabled, latest, storeUrl, t]);
}

export type AppGateProps = {
  children: ReactNode;
  /** One-time "new version" prompt when the app is older than the latest version. Default true. */
  updatePrompt?: boolean;
};

/**
 * Remote app config gate (FR-ADM-04). Renders `children` always, so the navigator stays mounted,
 * and covers them with a full-screen modal while this version must be updated or the service is
 * in maintenance. In local mode there is no config and it renders only `children`.
 */
export function AppGate({ children, updatePrompt = true }: AppGateProps) {
  const gate = useAppGate();
  useUpdatePrompt(gate, updatePrompt);

  return (
    <>
      {children}
      <Modal
        visible={gate.status !== 'open'}
        animationType="fade"
        presentationStyle="fullScreen"
        // Android back button: the gate stays until the reason is gone.
        onRequestClose={() => {}}>
        {gate.status === 'update_required' ? <UpdateRequired storeUrl={gate.storeUrl} /> : null}
        {gate.status === 'maintenance' ? <Maintenance message={gate.message} /> : null}
      </Modal>
    </>
  );
}

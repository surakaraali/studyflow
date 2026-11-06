import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { hasNotificationPermission } from '@/services/notifications';
import { useSession } from '@/stores/session';

/**
 * Whether the system lets us send notifications; null until the first read. Reads again when
 * the screen gets focus, when the app comes back from the system settings and after the
 * student answered the permission prompt (which sets profile.notif_permission_asked).
 */
export function useNotificationPermission(): boolean | null {
  const [granted, setGranted] = useState<boolean | null>(null);
  const asked = useSession((s) => s.profile?.notif_permission_asked ?? 0);

  const refresh = useCallback(() => {
    hasNotificationPermission()
      .then(setGranted)
      .catch(() => setGranted(false));
  }, []);

  useFocusEffect(refresh);

  useEffect(() => {
    refresh();
  }, [asked, refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return granted;
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { patch } from '@/db/write';
import { useNotificationsAllowed } from '@/features/permissions/notifications-allowed';
import { rescheduleReminders } from '@/features/reminders/schedule';
import { requestNotificationPermission } from '@/services/notifications';

/**
 * US-60: once the first plan exists, explain what reminders do, then ask the system once.
 * Either answer sets `notif_permission_asked`, so the card does not come back.
 * Hidden while the parent's consent doesn't cover notifications (US-76).
 */
export function ReminderPermissionCard({ profileId }: { profileId: string }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const { allowed } = useNotificationsAllowed();

  const allow = async () => {
    setBusy(true);
    try {
      const granted = await requestNotificationPermission();
      await patch('profile', profileId, { notif_permission_asked: 1 });
      if (granted) await rescheduleReminders();
    } finally {
      setBusy(false);
    }
  };

  const later = () => patch('profile', profileId, { notif_permission_asked: 1 });

  if (!allowed) return null;

  return (
    <Card>
      <View style={styles.text}>
        <AppText variant="title" accessibilityRole="header">
          {t('reminders.askTitle')}
        </AppText>
        <AppText variant="callout" color="inkSoft">
          {t('reminders.askBody')}
        </AppText>
      </View>
      <View style={styles.actions}>
        <Button
          label={t('reminders.askAllow')}
          icon={{ ios: 'bell.badge', android: 'notifications_active', web: 'notifications_active' }}
          loading={busy}
          onPress={allow}
        />
        <Button variant="plain" label={t('reminders.askLater')} disabled={busy} onPress={later} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  text: {
    gap: Space.sm,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.md,
  },
});

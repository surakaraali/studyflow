import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AppState, Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { Page } from '@/components/ui/page';
import { Section } from '@/components/ui/section';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { patch } from '@/db/write';
import { quietHours } from '@/domain/rules';
import { examMorningTime } from '@/features/reminders/build';
import { SwitchRow } from '@/features/reminders/components/switch-row';
import { rescheduleReminders } from '@/features/reminders/schedule';
import { requestNotificationPermission } from '@/services/notifications';
import { useProfile } from '@/stores/session';

type SwitchKey = 'notif_plan' | 'notif_exam' | 'notif_homework' | 'notif_ai';
type PermissionState = { granted: boolean; canAskAgain: boolean };

async function readPermission(): Promise<PermissionState> {
  const current = await Notifications.getPermissionsAsync();
  return { granted: current.granted, canAskAgain: current.canAskAgain };
}

/** US-60: system permission, a switch per reminder type and the quiet hours (BR-16). */
export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const { profile, age } = useProfile();
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [asking, setAsking] = useState(false);

  // Read again when the student comes back from the system settings.
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      readPermission().then((value) => {
        if (alive) setPermission(value);
      });
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  const ask = async () => {
    setAsking(true);
    try {
      const granted = await requestNotificationPermission();
      setPermission(await readPermission());
      if (profile) await patch('profile', profile.id, { notif_permission_asked: 1 });
      if (granted) await rescheduleReminders();
    } finally {
      setAsking(false);
    }
  };

  const toggle = async (key: SwitchKey, value: boolean) => {
    if (!profile) return;
    try {
      await patch('profile', profile.id, { [key]: value ? 1 : 0 });
      if (key !== 'notif_ai') await rescheduleReminders();
    } catch {
      Alert.alert(t('notificationSettings.saveError'));
    }
  };

  const quiet = quietHours(age ?? 13);
  const switches: { key: SwitchKey; title: string; hint: string }[] = [
    { key: 'notif_plan', title: t('notificationSettings.plan'), hint: t('notificationSettings.planHint') },
    { key: 'notif_exam', title: t('notificationSettings.exam'), hint: t('notificationSettings.examHint') },
    {
      key: 'notif_homework',
      title: t('notificationSettings.homework'),
      hint: t('notificationSettings.homeworkHint'),
    },
    { key: 'notif_ai', title: t('notificationSettings.ai'), hint: t('notificationSettings.aiHint') },
  ];

  return (
    <Page>
      <Stack.Screen options={{ title: t('notificationSettings.title') }} />

      <View style={styles.group}>
        <Section title={t('notificationSettings.permissionTitle')}>
          <ListRow
            title={
              permission?.granted
                ? t('notificationSettings.permissionOn')
                : t('notificationSettings.permissionOff')
            }
            icon={
              permission?.granted
                ? { ios: 'bell.badge', android: 'notifications_active', web: 'notifications_active' }
                : { ios: 'bell.slash', android: 'notifications_off', web: 'notifications_off' }
            }
          />
        </Section>
        {permission && !permission.granted ? (
          <>
            <AppText variant="footnote" color="inkSoft">
              {t('notificationSettings.permissionOffBody')}
            </AppText>
            <View style={styles.actions}>
              {permission.canAskAgain ? (
                <Button
                  label={t('notificationSettings.permissionAsk')}
                  loading={asking}
                  onPress={() => void ask()}
                />
              ) : (
                <Button
                  variant="secondary"
                  label={t('notificationSettings.openSettings')}
                  icon={{ ios: 'gear', android: 'settings', web: 'settings' }}
                  onPress={() => void Linking.openSettings()}
                />
              )}
            </View>
          </>
        ) : null}
      </View>

      <Section title={t('notificationSettings.typesTitle')}>
        {switches.map((item) => (
          <SwitchRow
            key={item.key}
            title={item.title}
            hint={item.hint}
            value={profile ? profile[item.key] === 1 : true}
            disabled={!profile}
            onChange={(value) => void toggle(item.key, value)}
          />
        ))}
      </Section>

      <View style={styles.group}>
        <AppText variant="title" accessibilityRole="header">
          {t('notificationSettings.quietTitle')}
        </AppText>
        <AppText variant="callout" color="inkSoft">
          {t('notificationSettings.quietBody', {
            start: quiet.start,
            end: quiet.end,
            morning: examMorningTime(age),
          })}
        </AppText>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Space.sm + 2,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.md,
  },
});

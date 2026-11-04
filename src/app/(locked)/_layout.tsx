import { Stack } from 'expo-router';

import { useStackOptions } from '@/hooks/use-stack-options';

export const unstable_settings = { anchor: 'waiting' };

export default function LockedLayout() {
  const options = useStackOptions();
  return <Stack screenOptions={{ ...options, headerTitle: '' }} />;
}

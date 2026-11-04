import { Stack } from 'expo-router';

import { useStackOptions } from '@/hooks/use-stack-options';

export const unstable_settings = { anchor: 'index' };

export default function OnboardingLayout() {
  const options = useStackOptions();
  return <Stack screenOptions={{ ...options, headerTitle: '' }} />;
}

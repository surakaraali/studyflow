import { Stack } from 'expo-router';

import { useStackOptions } from '@/hooks/use-stack-options';

// Signed-out users land on the welcome screen, not the first file alphabetically.
export const unstable_settings = { anchor: 'welcome' };

export default function AuthLayout() {
  const options = useStackOptions();
  return (
    <Stack screenOptions={{ ...options, headerTitle: '' }}>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
    </Stack>
  );
}

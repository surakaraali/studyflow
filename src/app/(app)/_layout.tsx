import { Stack } from 'expo-router';

import { useStackOptions } from '@/hooks/use-stack-options';

const MODAL = { presentation: 'modal', headerTitle: '' } as const;

/**
 * Everything a signed-in, onboarded student can reach. The tab bar is the first screen;
 * every other route is pushed on top of it. Modals are declared here: presentation set from
 * inside a route file arrives after the push has started, so it would open as a normal page.
 */
export default function AppLayout() {
  const options = useStackOptions();

  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="setup" options={MODAL} />
      <Stack.Screen name="paywall" options={MODAL} />
      <Stack.Screen name="ai-notice" options={MODAL} />
    </Stack>
  );
}

import { Stack } from 'expo-router';

import { useStackOptions } from '@/hooks/use-stack-options';

/**
 * Everything a signed-in, onboarded student can reach. The tab bar is the first screen;
 * every other route is pushed on top of it. Routes that need special presentation
 * (modals, full screen) set it with <Stack.Screen options> inside the route file.
 */
export default function AppLayout() {
  const options = useStackOptions();

  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

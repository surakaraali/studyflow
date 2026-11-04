import '@/i18n';

import { Literata_600SemiBold, Literata_700Bold, useFonts } from '@expo-google-fonts/literata';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useStackOptions } from '@/hooks/use-stack-options';
import '@/services/boot';

import { startAppServices } from '@/services/app-services';
import { bootstrapSession, homeHref, profileAccess, useSession } from '@/stores/session';

SplashScreen.preventAutoHideAsync();
startAppServices();

function navigationTheme(scheme: 'light' | 'dark'): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = Colors[scheme];

  return {
    ...base,
    colors: {
      ...base.colors,
      background: colors.paper,
      card: colors.surface,
      text: colors.ink,
      border: colors.line,
      primary: colors.pen,
      notification: colors.exam,
    },
  };
}

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [fontsLoaded, fontError] = useFonts({ Literata_600SemiBold, Literata_700Bold });
  const status = useSession((s) => s.status);
  const profile = useSession((s) => s.profile);
  const stackOptions = useStackOptions();

  useEffect(() => {
    bootstrapSession();
  }, []);

  const ready = (fontsLoaded || fontError != null) && status !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Moving between groups (sign-in, end of onboarding, consent, sign-out) always lands on
  // that group's first screen, even when the current screen is outside the guarded groups.
  const home = homeHref(status, profile);
  const lastHome = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    const previous = lastHome.current;
    lastHome.current = home as string;
    if (previous !== null && previous !== home) router.replace(home);
  }, [ready, home]);

  // Keep the splash screen up until the headline font and the session are ready.
  if (!ready) return null;

  const signedIn = status === 'signedIn';
  const onboarded = signedIn && profile?.onboarding_done === 1;
  const locked = onboarded && profileAccess(profile) === 'locked';

  return (
    <ThemeProvider value={navigationTheme(scheme)}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ ...stackOptions, headerShown: false }}>
        <Stack.Protected guard={!signedIn} redirectTo={home}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !onboarded} redirectTo={home}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={locked} redirectTo={home}>
          <Stack.Screen name="(locked)" />
        </Stack.Protected>
        <Stack.Protected guard={onboarded && !locked} redirectTo={home}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        {/* "/" only redirects to the right group (see app/index.tsx). */}
        <Stack.Screen name="index" />
        {/* Local mode stand-in for the parent's web consent page (US-16). */}
        <Stack.Screen name="parent-consent" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}

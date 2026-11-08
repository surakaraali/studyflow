import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { runSeed, seedAvailable, type SeedMode } from '@/features/dev/seed';
import { useTheme } from '@/hooks/use-theme';

const MODES: SeedMode[] = ['full', 'limited', 'locked', 'fresh'];

/**
 * Development only: studyflow://dev-seed?mode=full|limited|locked|fresh[&reset=1] signs in a demo
 * account with sample data and opens the app. Shows a notice in a development build that
 * uses Supabase; a release build never reaches it.
 */
export default function DevSeedRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DevSeedScreen />;
}

function DevSeedScreen() {
  const { mode, reset } = useLocalSearchParams<{ mode?: string; reset?: string }>();
  const { colors } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const available = seedAvailable();
  const seedMode: SeedMode = MODES.includes(mode as SeedMode) ? (mode as SeedMode) : 'full';

  useEffect(() => {
    if (!available) return;
    runSeed(seedMode, { reset: reset === '1' })
      .then(() => router.replace('/'))
      .catch((e: Error) => setError(e.message));
  }, [available, seedMode, reset]);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.paper }]}>
      {!available ? (
        <AppText variant="body">Demo verisi yalnızca geliştirme modunda kullanılabilir.</AppText>
      ) : error ? (
        <AppText variant="body" color="exam">
          Demo verisi yüklenemedi: {error}
        </AppText>
      ) : (
        <>
          <ActivityIndicator color={colors.pen} />
          <AppText variant="callout" color="inkSoft">
            Demo verisi hazırlanıyor…
          </AppText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.md,
    padding: Space.xl,
  },
});

import { useColorScheme as useSystemColorScheme, type ColorSchemeName } from 'react-native';

import { useAppearance } from '@/features/appearance/store';

/**
 * The color scheme the app draws with: the student's choice in Ayarlar > Görünüm (US-80),
 * or the system's when they chose "Sistem". Same shape as React Native's useColorScheme.
 */
export function useColorScheme(): ColorSchemeName | null {
  const preference = useAppearance((s) => s.preference);
  const system = useSystemColorScheme();
  return preference === 'system' ? system : preference;
}

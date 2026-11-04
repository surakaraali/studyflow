import type { Stack } from 'expo-router';
import type { ComponentProps } from 'react';


import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenOptions = ComponentProps<typeof Stack>['screenOptions'];
export type StackOptions = Exclude<ScreenOptions, ((...args: never[]) => unknown) | undefined>;

/** Header look for every stack: paper background, serif title, ballpoint tint. */
export function useStackOptions(): StackOptions {
  const { colors } = useTheme();

  return {
    headerTintColor: colors.pen,
    headerStyle: { backgroundColor: colors.paper },
    headerShadowVisible: false,
    headerTitleStyle: { fontFamily: Fonts.display, color: colors.ink },
    headerLargeTitleStyle: { fontFamily: Fonts.display, color: colors.ink },
    headerBackButtonDisplayMode: 'minimal',
    contentStyle: { backgroundColor: colors.paper },
  };
}

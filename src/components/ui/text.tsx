import { Text, type TextProps } from 'react-native';

import { Type, type ColorName, type TypeVariant } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type AppTextProps = TextProps & {
  variant?: TypeVariant;
  color?: ColorName;
};

export function AppText({ variant = 'body', color = 'ink', style, ...rest }: AppTextProps) {
  const { colors } = useTheme();

  return <Text style={[Type[variant], { color: colors[color] }, style]} {...rest} />;
}

import { useId, type ComponentRef, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Radius, Space, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextFieldProps = Omit<TextInputProps, 'ref'> & {
  ref?: Ref<ComponentRef<typeof TextInput>>;
  label: string;
  hint?: string;
  error?: string | null;
};

export function TextField({ ref, label, hint, error, style, multiline, ...rest }: TextFieldProps) {
  const { colors } = useTheme();
  const id = useId();

  return (
    <View style={styles.wrap}>
      <AppText variant="footnote" color="inkSoft" nativeID={id}>
        {label}
      </AppText>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityLabelledBy={id}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.inkFaint}
        multiline={multiline}
        style={[
          Type.body,
          styles.input,
          multiline && styles.multiline,
          {
            color: colors.ink,
            backgroundColor: colors.surface,
            borderColor: error ? colors.exam : colors.line,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <AppText variant="footnote" color="exam" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="footnote" color="inkSoft">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.xs + 2,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md + 2,
    paddingVertical: Space.sm + 2,
  },
  multiline: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
});

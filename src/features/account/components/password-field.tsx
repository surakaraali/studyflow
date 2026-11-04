import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { TextField, type TextFieldProps } from '@/components/ui/text-field';
import { AppText } from '@/components/ui/text';

type PasswordFieldProps = Omit<TextFieldProps, 'secureTextEntry'> & {
  /** 'new' for sign-up (lets the OS suggest a strong password). */
  purpose: 'new' | 'current';
};

/** Password input with a "show password" switch underneath. */
export function PasswordField({ purpose, ...rest }: PasswordFieldProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrap}>
      <TextField
        {...rest}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType={purpose === 'new' ? 'newPassword' : 'password'}
        autoComplete={purpose === 'new' ? 'new-password' : 'current-password'}
      />
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: visible }}
        accessibilityLabel={t('auth.fields.showPassword')}
        onPress={() => setVisible((v) => !v)}
        hitSlop={8}
        style={styles.toggle}>
        <AppText variant="footnote" color="pen" style={styles.toggleText}>
          {visible ? t('auth.fields.hidePassword') : t('auth.fields.showPassword')}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 2,
  },
  toggle: {
    alignSelf: 'flex-start',
    minHeight: 36,
    justifyContent: 'center',
  },
  toggleText: {
    fontWeight: '600',
  },
});

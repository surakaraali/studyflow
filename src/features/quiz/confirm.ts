import { Alert, Platform } from 'react-native';

/** Asks before a destructive action. Resolves true when the student confirms. */
export function confirmDestructive(options: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}): Promise<boolean> {
  if (Platform.OS === 'web') {
    // react-native-web has no Alert buttons.
    return Promise.resolve(globalThis.confirm?.(`${options.title}\n\n${options.message}`) ?? false);
  }
  return new Promise((resolve) => {
    Alert.alert(options.title, options.message, [
      { text: options.cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: options.confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

import * as Application from 'expo-application';
import { Platform } from 'react-native';

export type DeviceInfo = {
  app_version: string;
  os: string;
  os_version: string;
};

/** App version and OS that support and feedback messages carry (US-66). No device ids. */
export function deviceInfo(): DeviceInfo {
  return {
    app_version: `${Application.nativeApplicationVersion ?? '?'} (${Application.nativeBuildVersion ?? '?'})`,
    os: Platform.OS,
    os_version: String(Platform.Version),
  };
}

/** "iOS 26.1", "Android 36" */
export function osLabel(info: DeviceInfo = deviceInfo()): string {
  const name = { ios: 'iOS', android: 'Android', web: 'Web' }[info.os] ?? info.os;
  return `${name} ${info.os_version}`;
}

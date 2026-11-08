import * as Application from 'expo-application';
import { Linking, Platform } from 'react-native';

/** Package name from app.json; used when app_config has no Play Store link. */
const ANDROID_PACKAGE = 'com.cobanov.studyflow';

/**
 * The store page to update from: app_config's link, or a fallback (Play Store page by package
 * name; on iOS the App Store app itself until the App Store id is set in app_config).
 */
export function storeLink(configured: string | null): string {
  if (configured) return configured;
  if (Platform.OS === 'android') {
    return `https://play.google.com/store/apps/details?id=${Application.applicationId ?? ANDROID_PACKAGE}`;
  }
  return 'itms-apps://apps.apple.com';
}

/** Opens the store; false when nothing could open it. */
export async function openStore(configured: string | null): Promise<boolean> {
  try {
    await Linking.openURL(storeLink(configured));
    return true;
  } catch {
    return false;
  }
}

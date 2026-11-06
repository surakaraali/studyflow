/**
 * Light / dark choice (US-80). Stored for the whole device, not per account, so the welcome and
 * sign-in screens use it too. Read synchronously at start-up so the first frame is right.
 */

import Storage from 'expo-sqlite/kv-store';
import { Appearance, Platform } from 'react-native';
import { create } from 'zustand';

export type AppearancePreference = 'system' | 'light' | 'dark';

export const APPEARANCE_OPTIONS: readonly AppearancePreference[] = ['system', 'light', 'dark'];

const KEY = 'studyflow.appearance';

function isPreference(value: unknown): value is AppearancePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function readSaved(): AppearancePreference {
  try {
    const value = Storage.getItemSync(KEY);
    return isPreference(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

/**
 * Native views (tab bar, headers, date pickers, alerts, the keyboard) follow the app's choice
 * too; 'auto' gives control back to the system. Not available on web.
 */
function applyToNativeViews(preference: AppearancePreference) {
  if (Platform.OS === 'web') return;
  try {
    Appearance.setColorScheme(preference === 'system' ? 'auto' : preference);
  } catch {
    // Older native module: JS-drawn screens still follow the choice through useColorScheme.
  }
}

export const useAppearance = create<{ preference: AppearancePreference }>(() => ({
  preference: readSaved(),
}));

// 'system' is the native default already; only an explicit choice needs applying at start.
if (useAppearance.getState().preference !== 'system') applyToNativeViews(useAppearance.getState().preference);

export function setAppearance(preference: AppearancePreference) {
  useAppearance.setState({ preference });
  applyToNativeViews(preference);
  try {
    Storage.setItemSync(KEY, preference);
  } catch (error) {
    console.warn('Appearance could not be saved', error);
  }
}

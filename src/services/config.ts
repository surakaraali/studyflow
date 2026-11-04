/**
 * Runtime configuration from EXPO_PUBLIC_* variables (see .env.example).
 *
 * Without Supabase keys the app runs in **local mode**: accounts, data and consent live on
 * the device, and AI jobs go to the development AI server (server/dev-ai.ts). This keeps every
 * flow testable in the simulator before the backend projects exist (US-03).
 */

const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  aiDevUrl: process.env.EXPO_PUBLIC_AI_DEV_URL,
  revenueCatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  revenueCatAndroidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  consentWebUrl: process.env.EXPO_PUBLIC_CONSENT_WEB_URL,
  supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL,
};

export type BackendMode = 'local' | 'supabase';

export const backendMode: BackendMode =
  env.supabaseUrl && env.supabaseAnonKey ? 'supabase' : 'local';

export const config = {
  supabaseUrl: env.supabaseUrl ?? '',
  supabaseAnonKey: env.supabaseAnonKey ?? '',
  /** iOS simulators reach the Mac at 127.0.0.1; a phone needs the Mac's LAN address. */
  aiDevUrl: env.aiDevUrl ?? 'http://127.0.0.1:8787',
  revenueCatIosKey: env.revenueCatIosKey ?? '',
  revenueCatAndroidKey: env.revenueCatAndroidKey ?? '',
  consentWebUrl: env.consentWebUrl ?? 'https://studyflow.app/veli-onayi',
  supportEmail: env.supportEmail ?? 'destek@studyflow.app',
};

export const isLocalMode = backendMode === 'local';

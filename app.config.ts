import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * App config. Values that differ per machine or per build come from the environment:
 * - EAS_PROJECT_ID: the Expo project id from `eas init` (optional). Expo Build workers
 *   also set EAS_BUILD_PROJECT_ID, so cloud builds get the update URL without it.
 * - EAS_BUILD_PROFILE: set by Expo Build. Preview and production builds stop here when the
 *   Supabase settings are missing, so a release build can never ship in local mode.
 */

const RELEASE_PROFILES = ['preview', 'production'];

const projectId = process.env.EAS_PROJECT_ID || process.env.EAS_BUILD_PROJECT_ID || undefined;

function checkReleaseEnv() {
  const profile = process.env.EAS_BUILD_PROFILE;
  if (!profile || !RELEASE_PROFILES.includes(profile)) return;

  const missing = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'].filter(
    (name) => !process.env[name]?.trim(),
  );
  if (missing.length > 0) {
    throw new Error(
      `The "${profile}" build needs ${missing.join(' and ')}. Without them the app would run in ` +
        `local mode. Add them to the Expo environment this profile uses (eas.json "environment") ` +
        `and start the build again.`,
    );
  }
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().startsWith('https://')) {
    throw new Error(`The "${profile}" build needs an https:// EXPO_PUBLIC_SUPABASE_URL.`);
  }
}

export default ({ config }: ConfigContext): ExpoConfig => {
  checkReleaseEnv();

  return {
    ...config,
    name: 'StudyFlow',
    slug: 'studyflow',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'studyflow',
    userInterfaceStyle: 'automatic',
    // A new native layer (module, plugin, SDK) gets a new runtime, so OTA updates only reach
    // builds that can run them.
    runtimeVersion: { policy: 'fingerprint' },
    updates: {
      // Without a project id there is no update server; builds run their embedded bundle.
      ...(projectId ? { url: `https://u.expo.dev/${projectId}` } : {}),
      // Download on launch in the background, apply on the next start.
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
    },
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { projectId } } : {}),
    },
    ios: {
      bundleIdentifier: 'com.cobanov.studyflow',
      icon: './assets/app.icon',
      // R1 is iPhone only.
      supportsTablet: false,
      usesAppleSignIn: true,
      infoPlist: {
        CFBundleDevelopmentRegion: 'tr',
        CFBundleLocalizations: ['tr'],
        ITSAppUsesNonExemptEncryption: false,
      },
      privacyManifests: {
        NSPrivacyTracking: false,
        NSPrivacyTrackingDomains: [],
        NSPrivacyCollectedDataTypes: [
          // Account and parent consent emails.
          collected('EmailAddress', { linked: true, purposes: ['AppFunctionality'] }),
          // Account id (also the RevenueCat app user id) and the nickname.
          collected('UserID', { linked: true, purposes: ['AppFunctionality'] }),
          // Uploaded PDFs and study data (courses, exams, homework, plans, quiz answers).
          collected('OtherUserContent', { linked: true, purposes: ['AppFunctionality'] }),
          // Subscriptions through RevenueCat, tied to the account id.
          collected('PurchaseHistory', { linked: true, purposes: ['AppFunctionality'] }),
          // Birth year and grade, for age rules and parent consent.
          collected('OtherDataTypes', { linked: true, purposes: ['AppFunctionality'] }),
          // Support form messages, stored with the account.
          collected('CustomerSupport', { linked: true, purposes: ['AppFunctionality'] }),
          // Expo push token, stored with the account for reminders and consent news.
          collected('DeviceID', { linked: true, purposes: ['AppFunctionality'] }),
          // App and iOS version attached to support tickets.
          collected('OtherDiagnosticData', { linked: true, purposes: ['AppFunctionality'] }),
          // First-party telemetry without ids.
          collected('ProductInteraction', { linked: false, purposes: ['Analytics'] }),
          collected('CrashData', { linked: false, purposes: ['AppFunctionality'] }),
        ],
        // Repeated here because Apple does not always read the manifests of static pods.
        NSPrivacyAccessedAPITypes: [
          // React Native, expo-constants, expo-updates, expo-notifications, RevenueCat.
          accessed('UserDefaults', ['CA92.1']),
          // React Native, expo-application, expo-file-system (app container); picked PDFs.
          accessed('FileTimestamp', ['C617.1', '3B52.1']),
          // React Native timing, expo-device.
          accessed('SystemBootTime', ['35F9.1']),
          // expo-file-system free space checks before writing files.
          accessed('DiskSpace', ['E174.1']),
        ],
      },
    },
    android: {
      package: 'com.cobanov.studyflow',
      adaptiveIcon: {
        backgroundColor: '#2A3FD1',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: 'server',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#2A3FD1',
          image: './assets/images/splash-icon.png',
          imageWidth: 120,
        },
      ],
      'expo-sqlite',
      'expo-secure-store',
      'expo-sharing',
      '@react-native-community/datetimepicker',
      'expo-apple-authentication',
      // Local reminders plus remote pushes ("Velin onayladı"); no background pushes.
      'expo-notifications',
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    platforms: ['ios', 'android'],
  };
};

type Purpose = 'AppFunctionality' | 'Analytics';

function collected(type: string, { linked, purposes }: { linked: boolean; purposes: Purpose[] }) {
  return {
    NSPrivacyCollectedDataType: `NSPrivacyCollectedDataType${type}`,
    NSPrivacyCollectedDataTypeLinked: linked,
    NSPrivacyCollectedDataTypeTracking: false,
    NSPrivacyCollectedDataTypePurposes: purposes.map((p) => `NSPrivacyCollectedDataTypePurpose${p}`),
  };
}

function accessed(category: string, reasons: string[]) {
  return {
    NSPrivacyAccessedAPIType: `NSPrivacyAccessedAPICategory${category}`,
    NSPrivacyAccessedAPITypeReasons: reasons,
  };
}

import * as Application from 'expo-application';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * The app's version and build. Inside Expo Go the native values belong to Expo Go itself,
 * so the version comes from app.json there and the build is unknown.
 */
export function appVersion(): { version: string | null; build: string | null } {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return { version: Constants.expoConfig?.version ?? null, build: null };
  }
  return { version: Application.nativeApplicationVersion, build: Application.nativeBuildVersion };
}

/** "1.0.0 (42)" for support requests and analytics. */
export function appVersionLabel(): string {
  const { version, build } = appVersion();
  return `${version ?? '?'} (${build ?? '?'})`;
}

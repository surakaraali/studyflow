/// <reference types="jest" />
import {
  compareVersions,
  currentGateState,
  gateState,
  MAINTENANCE_TTL_MS,
  parseAppConfig,
  parseVersion,
  refreshRemoteConfig,
  type AppConfig,
} from '../remote-config';

jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: { getItemSync: jest.fn(() => null), setItemSync: jest.fn() },
}));

describe('versions', () => {
  it('reads store versions with or without a build or suffix', () => {
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('1.2.3 (45)')).toEqual([1, 2, 3]);
    expect(parseVersion('2.0.0-beta.1')).toEqual([2, 0, 0]);
    expect(parseVersion('v1.4')).toEqual([1, 4]);
    expect(parseVersion('?')).toBeNull();
    expect(parseVersion(null)).toBeNull();
  });

  it.each([
    ['1.0.0', '1.0.1', -1],
    ['1.0.10', '1.0.9', 1],
    ['1.10.0', '1.9.9', 1],
    ['2.0', '2.0.0', 0],
    ['1.2.3 (45)', '1.2.3', 0],
    ['0.9.9', '1.0.0', -1],
    ['10.0.0', '9.99.99', 1],
    ['garbage', '1.0.0', 0],
  ])('compareVersions(%s, %s) = %i', (a, b, expected) => {
    expect(compareVersions(a, b)).toBe(expected);
  });
});

const base: AppConfig = {
  iosMinVersion: '1.0.0',
  iosLatestVersion: '1.0.0',
  androidMinVersion: '1.0.0',
  androidLatestVersion: '1.0.0',
  maintenance: false,
  maintenanceMessage: null,
  iosStoreUrl: 'https://apps.apple.com/tr/app/studyflow/id123',
  androidStoreUrl: null,
};
const now = 1_800_000_000_000;
const gate = (config: Partial<AppConfig> | null, extra: Partial<Parameters<typeof gateState>[0]> = {}) =>
  gateState({
    config: config ? { ...base, ...config } : null,
    fetchedAt: now - 60_000,
    platform: 'ios',
    version: '1.2.0',
    now,
    ...extra,
  });

describe('gateState', () => {
  it('is open without a config (local mode, never fetched)', () => {
    expect(gate(null)).toEqual({ status: 'open', updateAvailable: null });
  });

  it('blocks a version below the platform minimum', () => {
    expect(gate({ iosMinVersion: '1.3.0' })).toEqual({
      status: 'update_required',
      storeUrl: 'https://apps.apple.com/tr/app/studyflow/id123',
    });
    expect(gate({ iosMinVersion: '1.2.0' }).status).toBe('open');
    // Android has its own minimum.
    expect(gate({ iosMinVersion: '1.3.0' }, { platform: 'android' }).status).toBe('open');
    expect(gate({ androidMinVersion: '1.3.0' }, { platform: 'android' })).toEqual({
      status: 'update_required',
      storeUrl: null,
    });
  });

  it('shows maintenance with the team message', () => {
    expect(gate({ maintenance: true, maintenanceMessage: 'Saat 22:00’ye kadar.' })).toEqual({
      status: 'maintenance',
      message: 'Saat 22:00’ye kadar.',
    });
  });

  it('forgets a cached maintenance flag after 6 hours without a check (offline phones)', () => {
    expect(gate({ maintenance: true }, { fetchedAt: now - MAINTENANCE_TTL_MS - 1 }).status).toBe('open');
    expect(gate({ maintenance: true }, { fetchedAt: now - MAINTENANCE_TTL_MS }).status).toBe('maintenance');
  });

  it('keeps a cached minimum version for good', () => {
    expect(gate({ iosMinVersion: '2.0.0' }, { fetchedAt: now - 30 * 86_400_000 }).status).toBe('update_required');
  });

  it('asks for the update before maintenance', () => {
    expect(gate({ iosMinVersion: '2.0.0', maintenance: true }).status).toBe('update_required');
  });

  it('offers a soft update when a newer version is out', () => {
    expect(gate({ iosLatestVersion: '1.3.0' })).toEqual({
      status: 'open',
      updateAvailable: { latestVersion: '1.3.0', storeUrl: 'https://apps.apple.com/tr/app/studyflow/id123' },
    });
    expect(gate({ iosLatestVersion: '1.2.0' })).toEqual({ status: 'open', updateAvailable: null });
  });

  it('never blocks when the app version is unknown or on web', () => {
    expect(gate({ iosMinVersion: '9.0.0' }, { version: null }).status).toBe('open');
    expect(gate({ iosMinVersion: '9.0.0' }, { version: '?' }).status).toBe('open');
    expect(gate({ iosMinVersion: '9.0.0', maintenance: true }, { platform: 'web' }).status).toBe('open');
  });
});

describe('parseAppConfig', () => {
  it('maps the API row and ignores bad values', () => {
    expect(
      parseAppConfig({
        ios_min_version: '1.1.0',
        ios_latest_version: 'latest',
        android_min_version: null,
        android_latest_version: '1.2.0',
        maintenance: 'yes',
        maintenance_message: '  ',
        ios_store_url: 'http://insecure.example',
        android_store_url: 'https://play.google.com/store/apps/details?id=com.cobanov.studyflow',
      }),
    ).toEqual({
      iosMinVersion: '1.1.0',
      iosLatestVersion: '0',
      androidMinVersion: '0',
      androidLatestVersion: '1.2.0',
      maintenance: false,
      maintenanceMessage: null,
      iosStoreUrl: null,
      androidStoreUrl: 'https://play.google.com/store/apps/details?id=com.cobanov.studyflow',
    });
    expect(parseAppConfig(null)).toBeNull();
    expect(parseAppConfig([])).toBeNull();
  });

  it('an unreadable version never blocks', () => {
    const config = parseAppConfig({ ios_min_version: 'soon', maintenance: false });
    expect(gateState({ config, fetchedAt: now, platform: 'ios', version: '1.0.0', now }).status).toBe('open');
  });
});

describe('local mode', () => {
  it('has no gate and never calls the server', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    await expect(refreshRemoteConfig({ force: true })).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(currentGateState()).toEqual({ status: 'open', updateAvailable: null });
    fetchSpy.mockRestore();
  });
});

/// <reference types="jest" />
import { Platform } from 'react-native';

import { storeLink } from '../store-link';

describe('storeLink', () => {
  const os = Platform.OS;
  afterEach(() => {
    Platform.OS = os;
  });

  it('uses the link from app_config', () => {
    expect(storeLink('https://apps.apple.com/tr/app/studyflow/id123')).toBe('https://apps.apple.com/tr/app/studyflow/id123');
  });

  it('falls back to the Play Store page by package name on Android', () => {
    Platform.OS = 'android';
    expect(storeLink(null)).toMatch(/^https:\/\/play\.google\.com\/store\/apps\/details\?id=/);
  });

  it('falls back to the App Store app on iOS', () => {
    Platform.OS = 'ios';
    expect(storeLink(null)).toBe('itms-apps://apps.apple.com');
  });
});

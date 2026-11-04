/// <reference types="jest" />
import { PACKAGE_TYPE, PURCHASES_ERROR_CODE } from 'react-native-purchases';

import { failureReason, periodOf, planFromCustomerInfo, purchaseMode } from '../purchases';

// Keep the native SDK, session store and database out of this unit test (jest.mock is hoisted).
// The SDK's enums come from its plain TypeScript package, so the mapping is tested against the
// real error codes.
jest.mock('react-native-purchases', () => {
  const internal = jest.requireActual('@revenuecat/purchases-typescript-internal');
  return {
    __esModule: true,
    default: {},
    LOG_LEVEL: internal.LOG_LEVEL,
    PACKAGE_TYPE: internal.PACKAGE_TYPE,
    PURCHASES_ERROR_CODE: internal.PURCHASES_ERROR_CODE,
  };
});
jest.mock('@/stores/session', () => ({
  onSignedIn: jest.fn(),
  onSignedOut: jest.fn(),
  useSession: { getState: () => ({ status: 'signedOut', profile: null }) },
}));
jest.mock('@/db/write', () => ({ patch: jest.fn() }));

describe('purchases mapping (US-64)', () => {
  it('uses the local test store when no RevenueCat key is set', () => {
    // jest-expo runs as iOS; a key in the environment switches to the real store.
    expect(purchaseMode).toBe(process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ? 'store' : 'test');
  });

  it('grants Pro only with an active "pro" entitlement', () => {
    const info = (active: Record<string, { isActive: boolean }>) =>
      ({ entitlements: { active, all: active } }) as unknown as Parameters<typeof planFromCustomerInfo>[0];
    expect(planFromCustomerInfo(info({ pro: { isActive: true } }))).toBe('pro');
    expect(planFromCustomerInfo(info({ pro: { isActive: false } }))).toBe('free');
    expect(planFromCustomerInfo(info({ other: { isActive: true } }))).toBe('free');
    expect(planFromCustomerInfo(info({}))).toBe('free');
  });

  it('maps package types to periods', () => {
    expect(periodOf(PACKAGE_TYPE.MONTHLY)).toBe('monthly');
    expect(periodOf(PACKAGE_TYPE.ANNUAL)).toBe('annual');
    expect(periodOf(PACKAGE_TYPE.WEEKLY)).toBe('other');
  });

  it('explains store errors', () => {
    expect(failureReason({ code: PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR })).toBe('cancelled');
    expect(failureReason({ code: PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR })).toBe('pending');
    expect(failureReason({ code: PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR })).toBe('not_allowed');
    expect(failureReason({ code: PURCHASES_ERROR_CODE.NETWORK_ERROR })).toBe('network');
    expect(failureReason({ code: PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR })).toBe('network');
    expect(failureReason(new Error('boom'))).toBe('unknown');
    expect(failureReason(null)).toBe('unknown');
  });
});

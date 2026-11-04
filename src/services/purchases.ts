/**
 * Pro subscription (US-64, FR-SUB-02, FR-SUB-03) through RevenueCat.
 *
 * - The RevenueCat app user id is the account id (a random UUID). Email, nickname and other
 *   personal data are never sent; device identifier collection and diagnostics are off.
 * - `profile.plan` mirrors the "pro" entitlement. The store's server notifications reach
 *   Supabase through the RevenueCat webhook (backend); the app also refreshes on sign-in and
 *   whenever it comes to the foreground.
 * - Without a RevenueCat key (local development) a clearly labelled test store stands in:
 *   no money moves, it only switches the plan so the flow can be tried in the simulator.
 *   Release builds without a key show purchases as unavailable instead.
 */

import { AppState, Linking, Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';

import { patch } from '@/db/write';
import type { Plan } from '@/domain/rules';
import { registerAppService } from '@/services/app-services';
import { config, isLocalMode } from '@/services/config';
import { onSignedIn, onSignedOut, useSession } from '@/stores/session';

/** Entitlement id configured in the RevenueCat dashboard. */
export const PRO_ENTITLEMENT = 'pro';

function storeApiKey(): string {
  if (Platform.OS === 'ios') return config.revenueCatIosKey;
  if (Platform.OS === 'android') return config.revenueCatAndroidKey;
  return '';
}

export type PurchaseMode = 'store' | 'test' | 'off';

/** 'store': RevenueCat (its preview mode in Expo Go) · 'test': local stand-in · 'off': not available. */
export const purchaseMode: PurchaseMode = storeApiKey()
  ? 'store'
  : __DEV__ || isLocalMode
    ? 'test'
    : 'off';

export type ProPeriod = 'monthly' | 'annual' | 'other';

export type ProPackage = {
  id: string;
  period: ProPeriod;
  /** The store's localized price, e.g. "₺99,99". Empty for the test store. */
  priceString: string;
  native: PurchasesPackage | null;
};

export type ProOffering = {
  packages: ProPackage[];
  /** True for the local test store: nothing is charged. */
  test: boolean;
};

export type PurchaseFailure =
  | 'cancelled'
  | 'pending'
  | 'not_allowed'
  | 'network'
  | 'unavailable'
  | 'unknown';

export type PurchaseResult = { ok: true; plan: Plan } | { ok: false; reason: PurchaseFailure };
export type RestoreResult = { ok: true; active: boolean } | { ok: false; reason: PurchaseFailure };

const TEST_PACKAGES: ProPackage[] = [
  { id: 'test_monthly', period: 'monthly', priceString: '', native: null },
  { id: 'test_annual', period: 'annual', priceString: '', native: null },
];

let configured = false;
let currentUserId: string | null = null;

/** Plan that a RevenueCat customer info grants. */
export function planFromCustomerInfo(info: Pick<CustomerInfo, 'entitlements'>): Plan {
  return info.entitlements.active[PRO_ENTITLEMENT]?.isActive ? 'pro' : 'free';
}

export function periodOf(packageType: PACKAGE_TYPE | string): ProPeriod {
  if (packageType === PACKAGE_TYPE.MONTHLY) return 'monthly';
  if (packageType === PACKAGE_TYPE.ANNUAL) return 'annual';
  return 'other';
}

/** Maps a RevenueCat error to a reason the paywall can explain. */
export function failureReason(error: unknown): PurchaseFailure {
  const code = (error as { code?: unknown } | null)?.code;
  switch (code) {
    case PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR:
      return 'cancelled';
    case PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR:
      // Ask to Buy: the parent approves in the store later (BR-19).
      return 'pending';
    case PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR:
      return 'not_allowed';
    case PURCHASES_ERROR_CODE.NETWORK_ERROR:
    case PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR:
      return 'network';
    default:
      return 'unknown';
  }
}

/** Writes the plan to the profile when it changed (synced like any other profile change). */
async function setPlan(plan: Plan): Promise<Plan> {
  const { status, profile } = useSession.getState();
  if (status === 'signedIn' && profile && profile.plan !== plan) {
    await patch('profile', profile.id, { plan });
  }
  return plan;
}

async function applyCustomerInfo(info: CustomerInfo): Promise<Plan> {
  // Ignore updates that arrive after sign-out or for another account.
  const profile = useSession.getState().profile;
  if (!profile || profile.id !== currentUserId) return planFromCustomerInfo(info);
  return setPlan(planFromCustomerInfo(info));
}

/** Configures RevenueCat for this account, or switches the account on a later sign-in. */
async function identify(userId: string) {
  if (purchaseMode !== 'store') return;
  currentUserId = userId;
  if (!configured) {
    Purchases.configure({
      apiKey: storeApiKey(),
      appUserID: userId,
      diagnosticsEnabled: false,
      automaticDeviceIdentifierCollectionEnabled: false,
    });
    configured = true;
    Purchases.addCustomerInfoUpdateListener((info) => {
      applyCustomerInfo(info).catch(() => {});
    });
    // Not every mode supports log levels (Expo Go preview); never let that stop the setup.
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.WARN : LOG_LEVEL.ERROR).catch(() => {});
  } else {
    await Purchases.logIn(userId);
  }
  await refreshEntitlement();
}

async function forget() {
  currentUserId = null;
  if (purchaseMode !== 'store' || !configured) return;
  try {
    if (!(await Purchases.isAnonymous())) await Purchases.logOut();
  } catch (error) {
    console.warn('Purchases sign-out failed', error);
  }
}

/** The Pro offering with store prices, or null when it could not be loaded. */
export async function getOffering(): Promise<ProOffering | null> {
  if (purchaseMode === 'test') return { packages: TEST_PACKAGES, test: true };
  if (purchaseMode === 'off' || !configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current || current.availablePackages.length === 0) return null;
    const order: Record<ProPeriod, number> = { monthly: 0, annual: 1, other: 2 };
    const packages = current.availablePackages
      .map((pkg) => ({
        id: pkg.identifier,
        period: periodOf(pkg.packageType),
        priceString: pkg.product.priceString,
        native: pkg,
      }))
      .sort((a, b) => order[a.period] - order[b.period]);
    return { packages, test: false };
  } catch (error) {
    console.warn('Offerings could not be loaded', error);
    return null;
  }
}

/** Opens the store's payment sheet (or switches the plan in the test store). */
export async function purchase(pkg: ProPackage): Promise<PurchaseResult> {
  if (purchaseMode === 'test') return { ok: true, plan: await setPlan('pro') };
  if (purchaseMode === 'off' || !configured || !pkg.native) return { ok: false, reason: 'unavailable' };
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg.native);
    return { ok: true, plan: await applyCustomerInfo(customerInfo) };
  } catch (error) {
    return { ok: false, reason: failureReason(error) };
  }
}

/** Restores earlier purchases for this store account (FR-SUB-03). */
export async function restore(): Promise<RestoreResult> {
  if (purchaseMode === 'test') {
    return { ok: true, active: useSession.getState().profile?.plan === 'pro' };
  }
  if (purchaseMode === 'off' || !configured) return { ok: false, reason: 'unavailable' };
  try {
    const info = await Purchases.restorePurchases();
    return { ok: true, active: (await applyCustomerInfo(info)) === 'pro' };
  } catch (error) {
    return { ok: false, reason: failureReason(error) };
  }
}

/** Reads the entitlement again and updates `profile.plan`. Null when it could not be checked. */
export async function refreshEntitlement(): Promise<Plan | null> {
  if (purchaseMode !== 'store' || !configured || !currentUserId) return null;
  try {
    return await applyCustomerInfo(await Purchases.getCustomerInfo());
  } catch {
    // Offline: keep the plan we have; the server copy still syncs.
    return null;
  }
}

const MANAGE_URLS: Record<string, string> = {
  ios: 'https://apps.apple.com/account/subscriptions',
  android: 'https://play.google.com/store/account/subscriptions',
};

/** Opens the store's subscription management. Returns false when nothing could be opened. */
export async function manageSubscription(): Promise<boolean> {
  try {
    if (purchaseMode === 'store' && configured) {
      if (Platform.OS === 'ios') {
        await Purchases.showManageSubscriptions();
        return true;
      }
      const info = await Purchases.getCustomerInfo();
      if (info.managementURL) {
        await Linking.openURL(info.managementURL);
        return true;
      }
    }
    const url = MANAGE_URLS[Platform.OS];
    if (!url) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Test store only: ends the test subscription so the free plan can be tried again. */
export async function endTestSubscription(): Promise<void> {
  if (purchaseMode !== 'test') return;
  await setPlan('free');
}

registerAppService(() => {
  // Network calls run in the background so they never hold up sign-in.
  onSignedIn((user) => {
    identify(user.id).catch((error) => console.warn('Purchases could not start', error));
  });
  onSignedOut(forget);
  AppState.addEventListener('change', (state) => {
    if (state === 'active') refreshEntitlement().catch(() => {});
  });
});

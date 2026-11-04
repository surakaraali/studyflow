/**
 * POST /functions/v1/revenuecat-webhook   (RevenueCat → server; US-64, FR-SUB-03)
 *
 * RevenueCat sends the value configured in its dashboard as the Authorization header; it must
 * equal REVENUECAT_WEBHOOK_SECRET. Each event is stored once by id (retries are no-ops), the
 * subscription row is upserted by original_transaction_id and profiles.plan is recomputed.
 * The app identifies purchasers with Purchases.logIn(<supabase user id>), so app_user_id (or
 * one of its aliases) is the user's UUID. Sandbox events count too: App Review buys in sandbox.
 *
 * Always answers 200 for events we understand but cannot attach to a user, so RevenueCat does
 * not retry them forever; answers 401 for a wrong secret and 500 when the database fails
 * (RevenueCat retries those).
 */

import 'jsr:@supabase/functions-js@2.118.0/edge-runtime.d.ts';

import { adminClient, type SupabaseClient } from '../_shared/admin.ts';
import { requireSecret } from '../_shared/auth.ts';
import { errorResponse, HttpError, json, readJson, requireMethod } from '../_shared/http.ts';

type RevenueCatEvent = {
  id?: string;
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  entitlement_ids?: string[] | null;
  period_type?: string;
  expiration_at_ms?: number | null;
  environment?: string;
  store?: string;
  original_transaction_id?: string;
  transaction_id?: string;
  transferred_from?: string[];
  transferred_to?: string[];
  event_timestamp_ms?: number;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Status after each event type; undefined = event does not change a subscription. */
const STATUS_BY_EVENT: Record<string, string | undefined> = {
  INITIAL_PURCHASE: 'active',
  RENEWAL: 'active',
  PRODUCT_CHANGE: 'active',
  UNCANCELLATION: 'active',
  SUBSCRIPTION_EXTENDED: 'active',
  TEMPORARY_ENTITLEMENT_GRANT: 'active',
  NON_RENEWING_PURCHASE: 'active',
  // Still Pro until expires_at; the plan check handles that.
  CANCELLATION: 'cancelled',
  BILLING_ISSUE: 'billing_issue',
  SUBSCRIPTION_PAUSED: 'paused',
  EXPIRATION: 'expired',
};

function userIdFrom(event: RevenueCatEvent): string | null {
  const candidates = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])];
  return candidates.find((id): id is string => typeof id === 'string' && UUID_RE.test(id)) ?? null;
}

async function userExists(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle();
  return data != null;
}

async function refreshPlan(admin: SupabaseClient, userId: string) {
  const { error } = await admin.rpc('refresh_subscription_plan', { p_user: userId });
  if (error) throw error;
}

async function handleTransfer(admin: SupabaseClient, event: RevenueCatEvent) {
  // The purchase moved to another app user (e.g. restore on a new account). Move the rows.
  const from = (event.transferred_from ?? []).filter((id) => UUID_RE.test(id));
  const to = (event.transferred_to ?? []).find((id) => UUID_RE.test(id));
  if (!to || !(await userExists(admin, to))) {
    for (const userId of from) {
      await admin.from('subscriptions').update({ status: 'transferred' }).eq('user_id', userId);
      await refreshPlan(admin, userId);
    }
    return;
  }
  for (const userId of from) {
    const { error } = await admin.from('subscriptions').update({ user_id: to }).eq('user_id', userId);
    if (error) throw error;
    await refreshPlan(admin, userId);
  }
  await refreshPlan(admin, to);
}

Deno.serve(async (req) => {
  try {
    requireMethod(req, 'POST');
    requireSecret(req, Deno.env.get('REVENUECAT_WEBHOOK_SECRET'));

    const body = await readJson<{ event: RevenueCatEvent }>(req, 65_536);
    const event = body.event;
    if (!event?.id || !event.type) throw new HttpError(400, 'invalid_event');
    if (event.type === 'TEST') return json({ ok: true, test: true });

    const admin = adminClient();
    const userId = userIdFrom(event);
    const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;

    const result = await applyEvent(admin, event, userId, expiresAt);

    // Logged after it was applied: a failed attempt is retried by RevenueCat and applied again
    // (applying is idempotent), a delivered event is in the payment log exactly once.
    const { error: logError } = await admin.rpc('record_subscription_event', {
      p_id: event.id,
      p_user: userId,
      p_app_user_id: event.app_user_id ?? null,
      p_type: event.type,
      p_store: event.store ?? null,
      p_product_id: event.product_id ?? null,
      p_environment: event.environment ?? null,
      p_original_transaction_id: event.original_transaction_id ?? null,
      p_expires_at: expiresAt,
    });
    if (logError) throw logError;
    return json({ ok: true, result });
  } catch (error) {
    return errorResponse(error);
  }
});

async function applyEvent(
  admin: SupabaseClient,
  event: RevenueCatEvent,
  userId: string | null,
  expiresAt: string | null,
): Promise<'applied' | 'ignored' | 'unknown_user' | 'stale'> {
  if (event.type === 'TRANSFER') {
    await handleTransfer(admin, event);
    return 'applied';
  }

  const status = STATUS_BY_EVENT[event.type ?? ''];
  if (!status || !userId || !event.original_transaction_id || !event.product_id) return 'ignored';
  if (!(await userExists(admin, userId))) return 'unknown_user';

  const eventAt = new Date(event.event_timestamp_ms ?? Date.now()).toISOString();

  // Out-of-order delivery: never let an older event overwrite a newer one.
  const { data: existing } = await admin
    .from('subscriptions')
    .select('last_event_at')
    .eq('original_transaction_id', event.original_transaction_id)
    .maybeSingle<{ last_event_at: string | null }>();
  if (existing?.last_event_at && new Date(existing.last_event_at) > new Date(eventAt)) return 'stale';

  const { error: upsertError } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      store: event.store ?? 'UNKNOWN',
      product_id: event.product_id,
      entitlement: event.entitlement_ids?.[0] ?? null,
      status,
      period_type: event.period_type ?? null,
      environment: event.environment ?? null,
      original_transaction_id: event.original_transaction_id,
      expires_at: expiresAt,
      last_event_type: event.type,
      last_event_at: eventAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'original_transaction_id' },
  );
  if (upsertError) throw upsertError;

  await refreshPlan(admin, userId);
  return 'applied';
}

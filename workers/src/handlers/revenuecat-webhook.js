/**
 * RevenueCat Webhook Handler — GAP-005 Phase 1 (IAP tier sync)
 *
 * POST /api/billing/revenuecat-webhook
 *
 * Receives RevenueCat subscription lifecycle events and syncs the user's
 * tier in Neon.  RevenueCat is the single IAP abstraction layer for both
 * App Store (iOS) and Google Play (Android).
 *
 * Authentication:
 *   RevenueCat sends the configured webhook secret verbatim in the
 *   Authorization header: "Bearer <REVENUECAT_WEBHOOK_SECRET>"
 *   (set in RevenueCat Dashboard → Project → Integrations → Webhooks).
 *
 * Idempotency:
 *   Event IDs are stored in KV (CACHE) with a 7-day TTL.  Duplicate
 *   deliveries from RevenueCat retries are silently ACKed without re-processing.
 *
 * Product → tier mapping:
 *   Product IDs follow the naming convention configured in App Store Connect
 *   and Google Play Console.  The prefix-based map below is intentionally
 *   liberal so that monthly and annual variants both resolve correctly.
 *   Update PRODUCT_TIER_MAP when new products are added to the stores.
 *
 * Handled event types:
 *   INITIAL_PURCHASE  → grant tier
 *   RENEWAL           → re-grant tier (handles lapsed-then-renewed subs)
 *   PRODUCT_CHANGE    → switch to new tier
 *   UNCANCELLATION    → re-grant tier (user re-enabled auto-renew)
 *   SUBSCRIBER_CANCEL → no-op (sub still active until period end)
 *   CANCELLATION      → revert to free
 *   EXPIRATION        → revert to free
 *   TRANSFER          → no-op (RevenueCat internal; tier intact)
 *   BILLING_ISSUE     → no-op (grace period; Stripe handles payments for web)
 */

import { createQueryFn, QUERIES } from '../db/queries.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('revenuecat');

// ── Product → tier map ────────────────────────────────────────────────────────
// Keys are full product IDs from App Store Connect / Google Play Console.
// Extend this map when new products (annual variants, etc.) are added.
// Individual: $19/mo or $190/yr
// Practitioner: $97/mo or $970/yr
// Agency: $349/mo or $3,490/yr
const PRODUCT_TIER_MAP = {
  // Monthly products
  'prime_self_individual_monthly':    'individual',
  'prime_self_practitioner_monthly':  'practitioner',
  'prime_self_agency_monthly':        'agency',
  // Annual products
  'prime_self_individual_annual':     'individual',
  'prime_self_practitioner_annual':   'practitioner',
  'prime_self_agency_annual':         'agency',
  // Aliases that may come from store sandbox testing
  'ps_individual_monthly':            'individual',
  'ps_practitioner_monthly':          'practitioner',
  'ps_agency_monthly':                'agency',
  'ps_individual_annual':             'individual',
  'ps_practitioner_annual':           'practitioner',
  'ps_agency_annual':                 'agency',
};

/**
 * Resolve a RevenueCat product ID to a Prime Self tier.
 * Falls back to a prefix scan so partial product IDs still resolve.
 * Returns null if the product is unrecognised.
 */
function tierFromProductId(productId) {
  if (!productId) return null;
  const exact = PRODUCT_TIER_MAP[productId];
  if (exact) return exact;
  // Prefix scan for unregistered variant IDs (e.g. promotional products)
  const lower = productId.toLowerCase();
  if (lower.includes('agency'))       return 'agency';
  if (lower.includes('practitioner')) return 'practitioner';
  if (lower.includes('individual'))   return 'individual';
  return null;
}

/**
 * Verify the incoming request is genuinely from RevenueCat.
 * RevenueCat sends the shared secret verbatim as:  Authorization: Bearer <secret>
 */
function verifyRevenueCatRequest(request, secret) {
  if (!secret) {
    log.error({ action: 'rc_webhook_misconfigured', message: 'REVENUECAT_WEBHOOK_SECRET not set' });
    return false;
  }
  const authHeader = request.headers.get('Authorization') || '';
  const expected = `Bearer ${secret}`;
  // Constant-time comparison to resist timing attacks.
  if (authHeader.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= authHeader.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Main handler — exported and registered in index.js.
 */
export async function handleRevenueCatWebhook(request, env) {
  // ── 1. Authenticate the request ──────────────────────────────────────────────
  if (!verifyRevenueCatRequest(request, env.REVENUECAT_WEBHOOK_SECRET)) {
    log.warn({ action: 'rc_webhook_auth_failed', ip: request.headers.get('CF-Connecting-IP') });
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = body && body.event;
  if (!event || !event.type) {
    return Response.json({ error: 'Missing event' }, { status: 400 });
  }

  const eventId   = event.id || null;
  const eventType = event.type;
  const appUserId = event.app_user_id || event.original_app_user_id || null;
  const productId = event.product_id || null;
  const store     = event.store || 'UNKNOWN';

  log.info({
    action: 'rc_webhook_received',
    eventType,
    eventId,
    appUserId,
    productId,
    store,
  });

  // ── 3. Idempotency check ─────────────────────────────────────────────────────
  if (eventId && env.CACHE) {
    const dedupKey = `rc_event:${eventId}`;
    const seen = await env.CACHE.get(dedupKey);
    if (seen) {
      log.info({ action: 'rc_webhook_duplicate', eventId, eventType });
      return Response.json({ ok: true, duplicate: true });
    }
  }

  // ── 4. Only process events that affect the tier ──────────────────────────────
  const GRANT_EVENTS  = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION']);
  const REVOKE_EVENTS = new Set(['CANCELLATION', 'EXPIRATION']);
  const NOOP_EVENTS   = new Set(['SUBSCRIBER_CANCEL', 'TRANSFER', 'BILLING_ISSUE', 'TEST']);

  if (NOOP_EVENTS.has(eventType)) {
    log.info({ action: 'rc_webhook_noop', eventType, eventId });
    await markEventProcessed(env, eventId);
    return Response.json({ ok: true, eventType });
  }

  if (!GRANT_EVENTS.has(eventType) && !REVOKE_EVENTS.has(eventType)) {
    log.info({ action: 'rc_webhook_unknown_type', eventType, eventId });
    return Response.json({ ok: true, eventType });
  }

  // ── 5. Resolve the user ───────────────────────────────────────────────────────
  // app_user_id is set to the Prime Self user UUID when the user is identified
  // in RevenueCat (see docs: RevenueCat.logIn(userId)).  Anonymous IDs from
  // RevenueCat begin with "$RCAnonymousID:" — those cannot be resolved to users.
  if (!appUserId || appUserId.startsWith('$RCAnonymousID:')) {
    log.warn({ action: 'rc_webhook_anonymous_user', appUserId, eventType, eventId });
    // ACK so RevenueCat does not retry.  We cannot act on anonymous subscribers.
    await markEventProcessed(env, eventId);
    return Response.json({ ok: true, unresolvable: true });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  const userResult = await query(QUERIES.getUserByIdSafe, [appUserId]).catch(err => {
    log.error({ action: 'rc_webhook_user_lookup_failed', appUserId, error: err.message });
    return null;
  });

  if (!userResult || !userResult.rows || !userResult.rows[0]) {
    log.warn({ action: 'rc_webhook_user_not_found', appUserId, eventType, eventId });
    // ACK — do not retry for a permanently missing user.
    await markEventProcessed(env, eventId);
    return Response.json({ ok: true, userNotFound: true });
  }

  const user = userResult.rows[0];

  // ── 6. Determine new tier ─────────────────────────────────────────────────────
  let newTier;

  if (REVOKE_EVENTS.has(eventType)) {
    newTier = 'free';
  } else {
    newTier = tierFromProductId(productId);
    if (!newTier) {
      log.error({
        action: 'rc_webhook_unknown_product',
        productId,
        eventType,
        eventId,
        userId: user.id,
        message: 'Product ID not in PRODUCT_TIER_MAP. Add it to revenuecat-webhook.js.',
      });
      // Return 200 so RevenueCat does not retry (ops must fix product map).
      return Response.json({ ok: true, error: 'unknown_product', productId });
    }
  }

  // ── 7. Apply tier update ─────────────────────────────────────────────────────
  if (user.tier !== newTier) {
    await query(QUERIES.updateUserTier, [newTier, user.id]).catch(err => {
      log.error({
        action: 'rc_webhook_tier_update_failed',
        userId: user.id,
        newTier,
        error: err.message,
      });
      throw err;
    });

    log.info({
      action: 'rc_webhook_tier_updated',
      userId: user.id,
      previousTier: user.tier,
      newTier,
      eventType,
      productId,
      store,
    });
  } else {
    log.info({
      action: 'rc_webhook_tier_unchanged',
      userId: user.id,
      tier: user.tier,
      eventType,
    });
  }

  // ── 8. Mark processed ────────────────────────────────────────────────────────
  await markEventProcessed(env, eventId);
  return Response.json({ ok: true, eventType, userId: user.id, newTier });
}

async function markEventProcessed(env, eventId) {
  if (!eventId || !env.CACHE) return;
  try {
    // 7-day TTL — long enough to absorb any RevenueCat retry window.
    await env.CACHE.put(`rc_event:${eventId}`, '1', { expirationTtl: 604800 });
  } catch (_) {
    // KV failure is non-fatal; worst case a retry re-processes the event.
  }
}

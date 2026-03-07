/**
 * Analytics Event Tracking — Core Library (BL-ANA-001)
 *
 * Lightweight, non-blocking event capture for the Prime Self platform.
 * All tracking is fire-and-forget — failures never block user requests.
 *
 * Design principles:
 *   1. Zero-latency on the hot path (uses ctx.waitUntil)
 *   2. Graceful degradation (silent fail if DB unavailable)
 *   3. Minimal payload — only capture what's needed for analysis
 *   4. Privacy-first — no PII in event properties, user_id is UUID
 *
 * Usage:
 *   import { trackEvent, trackPageView, trackFunnel } from '../lib/analytics.js';
 *
 *   // In a handler:
 *   ctx.waitUntil(trackEvent(env, 'chart_calculate', {
 *     userId: request._user?.sub,
 *     properties: { tier: 'seeker', source: 'web' },
 *     request
 *   }));
 */

import { createQueryFn } from '../db/queries.js';

// ─── Standard Event Names ────────────────────────────────────────────
// Use these constants to avoid typos and enable autocomplete.

export const EVENTS = Object.freeze({
  // Auth
  SIGNUP:              'signup',
  LOGIN:               'login',
  LOGOUT:              'logout',
  TOKEN_REFRESH:       'token_refresh',

  // Core features
  CHART_CALCULATE:     'chart_calculate',
  CHART_SAVE:          'chart_save',
  PROFILE_GENERATE:    'profile_generate',
  PROFILE_VIEW:        'profile_view',
  PDF_EXPORT:          'pdf_export',
  COMPOSITE_GENERATE:  'composite_generate',
  RECTIFY_RUN:         'rectify_run',
  TRANSIT_VIEW:        'transit_view',
  FORECAST_VIEW:       'forecast_view',
  CYCLE_VIEW:          'cycle_view',

  // Engagement
  CHECKIN_COMPLETE:    'checkin_complete',
  ACHIEVEMENT_UNLOCK:  'achievement_unlock',
  SHARE_CREATE:        'share_create',
  REFERRAL_SEND:       'referral_send',
  CELEBRITY_COMPARE:   'celebrity_compare',

  // Revenue
  CHECKOUT_START:      'checkout_start',
  CHECKOUT_COMPLETE:   'checkout_complete',
  UPGRADE:             'upgrade',
  DOWNGRADE:           'downgrade',
  CANCEL:              'cancel',
  BILLING_PORTAL:      'billing_portal',

  // Platform
  PAGE_VIEW:           'page_view',
  API_CALL:            'api_call',
  ERROR:               'error',
  SEARCH:              'search',

  // Practitioner
  CLIENT_ADD:          'client_add',
  CLIENT_REMOVE:       'client_remove',
  CLUSTER_CREATE:      'cluster_create',
  CLUSTER_SYNTHESIZE:  'cluster_synthesize',
});

// ─── Funnel Definitions ──────────────────────────────────────────────

export const FUNNELS = Object.freeze({
  ONBOARDING: {
    name: 'onboarding',
    steps: [
      { name: 'signup',         order: 1 },
      { name: 'first_chart',    order: 2 },
      { name: 'first_profile',  order: 3 },
      { name: 'first_checkin',  order: 4 },
      { name: 'first_share',    order: 5 },
    ],
  },
  UPGRADE: {
    name: 'upgrade',
    steps: [
      { name: 'pricing_view',   order: 1 },
      { name: 'checkout_start', order: 2 },
      { name: 'checkout_complete', order: 3 },
    ],
  },
  PRACTITIONER: {
    name: 'practitioner',
    steps: [
      { name: 'register',        order: 1 },
      { name: 'first_client',    order: 2 },
      { name: 'first_synthesis', order: 3 },
      { name: 'upgrade_guide',   order: 4 },
    ],
  },
});

// ─── Device Detection ────────────────────────────────────────────────

/**
 * Infer device type from User-Agent header.
 * Lightweight — no full UA parser needed.
 */
function getDeviceType(request) {
  const ua = (request?.headers?.get('User-Agent') || '').toLowerCase();
  if (/mobile|android|iphone|ipod/.test(ua)) return 'mobile';
  if (/tablet|ipad/.test(ua)) return 'tablet';
  return 'desktop';
}

/**
 * Extract country from Cloudflare headers (set automatically on CF Workers).
 */
function getCountry(request) {
  return request?.headers?.get('CF-IPCountry') || request?.cf?.country || null;
}

// ─── Core Track Function ─────────────────────────────────────────────

/**
 * Track a single analytics event. Fire-and-forget — never throws.
 *
 * @param {object} env - Worker environment bindings
 * @param {string} eventName - One of EVENTS.* constants
 * @param {object} opts
 * @param {string} [opts.userId] - Authenticated user UUID
 * @param {string} [opts.sessionId] - Client-generated session ID
 * @param {object} [opts.properties] - Arbitrary key-value metadata
 * @param {Request} [opts.request] - Request object for device/geo extraction
 * @returns {Promise<void>}
 */
export async function trackEvent(env, eventName, opts = {}) {
  try {
    if (!env?.NEON_CONNECTION_STRING) return;

    const { userId = null, sessionId = null, properties = {}, request = null } = opts;
    const deviceType = request ? getDeviceType(request) : null;
    const country = request ? getCountry(request) : null;

    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    await query(
      `INSERT INTO analytics_events (event_name, user_id, session_id, properties, device_type, country)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [eventName, userId, sessionId, JSON.stringify(properties), deviceType, country]
    );
  } catch (err) {
    // Analytics must never block or crash user requests
    console.error('[Analytics] Track event failed:', eventName, err.message);
  }
}

/**
 * Track a page view event with referrer and path.
 *
 * @param {object} env
 * @param {object} opts
 * @param {string} opts.path - Page path (e.g. '/chart', '/profile')
 * @param {string} [opts.referrer] - HTTP referrer
 * @param {string} [opts.userId]
 * @param {string} [opts.sessionId]
 * @param {Request} [opts.request]
 */
export async function trackPageView(env, opts = {}) {
  const { path, referrer, ...rest } = opts;
  return trackEvent(env, EVENTS.PAGE_VIEW, {
    ...rest,
    properties: { path, referrer },
  });
}

/**
 * Track progression through a conversion funnel.
 * Idempotent — records each step only once per user per funnel.
 *
 * @param {object} env
 * @param {string} userId
 * @param {string} funnelName - Key from FUNNELS (e.g. 'onboarding')
 * @param {string} stepName - Step within the funnel (e.g. 'first_chart')
 */
export async function trackFunnel(env, userId, funnelName, stepName) {
  try {
    if (!env?.NEON_CONNECTION_STRING || !userId) return;

    const funnelDef = Object.values(FUNNELS).find(f => f.name === funnelName);
    if (!funnelDef) return;

    const step = funnelDef.steps.find(s => s.name === stepName);
    if (!step) return;

    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    await query(
      `INSERT INTO funnel_events (user_id, funnel_name, step_name, step_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, funnel_name, step_name) DO NOTHING`,
      [userId, funnelName, stepName, step.order]
    );
  } catch (err) {
    console.error('[Analytics] Funnel tracking failed:', funnelName, stepName, err.message);
  }
}

/**
 * Track an error event with context.
 *
 * @param {object} env
 * @param {Error|string} error
 * @param {object} opts
 * @param {string} [opts.endpoint] - API endpoint where error occurred
 * @param {string} [opts.userId]
 * @param {string} [opts.severity] - 'low', 'medium', 'high', 'critical'
 * @param {Request} [opts.request]
 */
export async function trackError(env, error, opts = {}) {
  const { endpoint, severity = 'medium', ...rest } = opts;
  return trackEvent(env, EVENTS.ERROR, {
    ...rest,
    properties: {
      message: error?.message || String(error),
      stack: error?.stack?.split('\n').slice(0, 3).join('\n'),
      endpoint,
      severity,
    },
  });
}

// ─── Batch Track (for cron / server-side batch operations) ───────────

/**
 * Track multiple events in a single DB round-trip.
 * Used by cron jobs and batch operations.
 *
 * @param {object} env
 * @param {Array<{eventName: string, userId?: string, sessionId?: string, properties?: object}>} events
 */
export async function trackBatch(env, events) {
  try {
    if (!env?.NEON_CONNECTION_STRING || !events?.length) return;

    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Build a multi-row INSERT for efficiency
    const values = [];
    const params = [];
    events.forEach((evt, i) => {
      const offset = i * 4;
      values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
      params.push(
        evt.eventName,
        evt.userId || null,
        evt.sessionId || null,
        JSON.stringify(evt.properties || {})
      );
    });

    await query(
      `INSERT INTO analytics_events (event_name, user_id, session_id, properties)
       VALUES ${values.join(', ')}`,
      params
    );
  } catch (err) {
    console.error('[Analytics] Batch tracking failed:', err.message);
  }
}

// ─── Aggregation (for cron/dashboard) ────────────────────────────────

/**
 * Aggregate yesterday's events into analytics_daily.
 * Designed to be called from the daily cron job.
 *
 * @param {object} env
 * @param {string} [dateStr] - ISO date string (defaults to yesterday)
 */
export async function aggregateDaily(env, dateStr) {
  try {
    if (!env?.NEON_CONNECTION_STRING) return;

    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const targetDate = dateStr || new Date(Date.now() - 86400000).toISOString().split('T')[0];

    await query(
      `INSERT INTO analytics_daily (event_date, event_name, event_count, unique_users, unique_sessions)
       SELECT
         DATE(created_at) AS event_date,
         event_name,
         COUNT(*) AS event_count,
         COUNT(DISTINCT user_id) AS unique_users,
         COUNT(DISTINCT session_id) AS unique_sessions
       FROM analytics_events
       WHERE DATE(created_at) = $1
       GROUP BY DATE(created_at), event_name
       ON CONFLICT (event_date, event_name)
       DO UPDATE SET
         event_count = EXCLUDED.event_count,
         unique_users = EXCLUDED.unique_users,
         unique_sessions = EXCLUDED.unique_sessions,
         created_at = now()`,
      [targetDate]
    );

    console.log(`[Analytics] Daily aggregation complete for ${targetDate}`);
  } catch (err) {
    console.error('[Analytics] Daily aggregation failed:', err.message);
  }
}

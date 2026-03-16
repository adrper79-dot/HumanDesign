/**
 * Rate Limiter Middleware — hybrid KV + DB backend (SYS-013)
 *
 * Auth endpoints (login, register, 2fa, forgot-password, etc.) use the
 * DB-backed fixed-window counter for audit trails and cross-edge consistency.
 *
 * All other endpoints use Cloudflare KV (RATE_LIMIT_KV binding) for
 * performance — KV reads/writes are O(1) at the edge and do not add DB load.
 *
 * KV key format:  rl:{ip_or_userId}:{endpoint_key}
 * KV TTL:         windowSec (auto-expires the window)
 */

import { createQueryFn, QUERIES } from '../db/queries.js';
import { trackEvent, EVENTS } from '../lib/analytics.js';

const RATE_LIMITS = {
  '/api/auth/register':     { max: 10,  windowSec: 60  },  // 10/min (spec: auth endpoints)
  '/api/auth/login':        { max: 10,  windowSec: 60  },  // 10/min
  '/api/auth/refresh':      { max: 10,  windowSec: 60  },  // 10/min
  '/api/auth/me':           { max: 10,  windowSec: 60  },  // 10/min
  '/api/auth/forgot-password':       { max: 3, windowSec: 60 },  // 3/min (prevent abuse)
  '/api/auth/resend-verification':   { max: 3, windowSec: 60 },  // 3/min (CISO-004: email enumeration)
  '/api/auth/2fa/setup':             { max: 3, windowSec: 60 },  // SYS-012: prevent TOTP seed enumeration
  '/api/invitations/practitioner':   { max: 10, windowSec: 60 }, // SYS-032: prevent invite token brute-force
  '/api/chart/calculate':   { max: 60,  windowSec: 60  },  // 60/min
  '/api/profile/generate':  { max: 3,   windowSec: 60  },  // 3/min (LLM calls — cost control)
  '/api/profile/generate/stream': { max: 3, windowSec: 60 }, // 3/min (streaming LLM calls)
  '/api/promo/validate':     { max: 10,  windowSec: 60  },  // MED-PROMO-RATE: prevent code enumeration
  '/api/geocode':           { max: 30,  windowSec: 60  },  // 30/min
  '/api/transits/today':    { max: 60,  windowSec: 60  },  // 60/min
  '/api/transits/forecast': { max: 60,  windowSec: 60  },  // 60/min
  '/api/rectify':           { max: 5,   windowSec: 60  },  // 5/min (CPU-expensive: up to 241 chart calcs)
  '/api/sms/send-digest':   { max: 5,   windowSec: 60  },  // 5/min (SMS cost control)
  '/api/sms/subscribe':     { max: 5,   windowSec: 60  },  // 5/min
  '/api/sms/unsubscribe':   { max: 5,   windowSec: 60  },  // 5/min
  '/api/email/unsubscribe': { max: 5,   windowSec: 60  },  // AUDIT-SEC-005: CAN-SPAM
  '/api/composite':         { max: 10,  windowSec: 60  },  // 10/min (LLM-powered)
  '/api/diary':             { max: 20,  windowSec: 60  },  // P2-BIZ-017: 20/min diary creation
  '/api/timing/find-dates': { max: 10,  windowSec: 60  },  // P2-BIZ-015: 10/min (CPU-intensive)
  '/api/auth/delete-account': { max: 3, windowSec: 60  },  // 3/min (destructive, irreversible)
  default:                  { max: 60,  windowSec: 60  }
};

// P2-BIZ-014/015: Pattern-based rate limits for parameterized routes
const PATTERN_RATE_LIMITS = [
  { pattern: /^\/api\/cluster\/[^/]+\/synthesize$/, config: { max: 3, windowSec: 60 }, key: '/api/cluster/*/synthesize' },
  { pattern: /^\/api\/share\//, config: { max: 10, windowSec: 60 }, key: '/api/share/*' },
];

/**
 * Auth endpoints that must use the DB-backed rate limiter for audit trails.
 * All other endpoints use KV-based rate limiting (SYS-013).
 */
const AUTH_RATE_LIMIT_PATHS = new Set([
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/resend-verification',
  '/api/auth/2fa/setup',
  '/api/auth/2fa/verify',
  '/api/auth/delete-account',
]);

/**
 * Resolve rate limit config for a given path.
 * Checks exact match first, then pattern-based rules, then default.
 */
function resolveRateLimit(path) {
  if (RATE_LIMITS[path]) return { config: RATE_LIMITS[path], key: path };
  for (const rule of PATTERN_RATE_LIMITS) {
    if (rule.pattern.test(path)) return { config: rule.config, key: rule.key };
  }
  return { config: RATE_LIMITS.default, key: path };
}

/**
 * Build a standard 429 Rate Limit Exceeded response.
 */
function rateLimitExceededResponse(config, windowStart, now) {
  const retryAfter = (windowStart + config.windowSec) - now;
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      retryAfter
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(config.max),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(windowStart + config.windowSec)
      }
    }
  );
}

/**
 * KV-based rate limiter (SYS-013 — KV rate limiting for non-auth endpoints).
 *
 * Uses a fixed-window counter stored in Cloudflare KV with TTL-based expiry.
 * No DB round-trip needed — fast edge reads/writes only.
 *
 * Key format: rl:{clientId}:{endpointKey}
 * Value:      JSON { count, windowStart }
 * TTL:        windowSec (KV auto-expires the key after one window)
 */
async function kvRateLimit(request, env, clientId, resolved) {
  const kv = env.RATE_LIMIT_KV;
  if (!kv) {
    // KV not bound — fail open with a warning (non-auth endpoints are best-effort)
    console.warn('[rateLimit] RATE_LIMIT_KV not bound — skipping KV rate limit check');
    return null;
  }

  const config = resolved.config;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % config.windowSec); // fixed-window boundary
  const resetEpoch = windowStart + config.windowSec;
  const kvKey = `rl:${clientId}:${resolved.key}`;

  let count;
  try {
    const raw = await kv.get(kvKey, { type: 'json' });

    if (raw && raw.windowStart === windowStart) {
      // Same window — increment the existing counter
      count = raw.count + 1;
    } else {
      // New window (or first request) — reset to 1
      count = 1;
    }

    // Write back with TTL so KV auto-expires after the window closes
    await kv.put(kvKey, JSON.stringify({ count, windowStart }), {
      expirationTtl: config.windowSec,
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'kv_rate_limit_error',
      key: kvKey,
      error: error.message,
    }));
    // Fail open — KV errors should not block legitimate requests
    return null;
  }

  if (count > config.max) {
    console.warn(JSON.stringify({
      event: 'rate_limited', clientId, path: resolved.key, count, max: config.max, backend: 'kv'
    }));
    trackEvent(env, EVENTS.RATE_LIMITED, {
      properties: { path: resolved.key, clientId, count, max: config.max, backend: 'kv' },
    }).catch(() => {}); // best-effort
    return rateLimitExceededResponse(config, windowStart, now);
  }

  return { count, resetEpoch, config };
}

/**
 * DB-backed rate limiter — used for auth endpoints only (audit trail).
 *
 * Uses Neon/Postgres atomic upsert for cross-edge consistency on sensitive
 * auth paths where we want persistent records of rate limit events.
 */
async function dbRateLimit(request, env, clientId, resolved) {
  if (!env.NEON_CONNECTION_STRING) {
    console.error('[rateLimit] NEON_CONNECTION_STRING not configured — blocking request.');
    return new Response(
      JSON.stringify({ error: 'Service temporarily unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json', 'Retry-After': '30' } }
    );
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const config = resolved.config;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % config.windowSec);
  const windowStartIso = new Date(windowStart * 1000).toISOString();
  const windowEndIso = new Date((windowStart + config.windowSec) * 1000).toISOString();
  const resetEpoch = windowStart + config.windowSec;

  let count;
  try {
    const result = await query(QUERIES.atomicWindowCounterIncrement, [
      `rl:${clientId}:${resolved.key}`,
      windowStartIso,
      windowEndIso,
    ]);
    count = parseInt(result.rows[0]?.count || '0', 10);
  } catch (error) {
    console.error(JSON.stringify({ event: 'rate_limit_query_failed', path: resolved.key, clientId, error: error.message }));
    return new Response(
      JSON.stringify({ error: 'Service temporarily unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json', 'Retry-After': '30' } }
    );
  }

  if (count > config.max) {
    console.warn(JSON.stringify({
      event: 'rate_limited', clientId, path: resolved.key, count, max: config.max, backend: 'db'
    }));
    trackEvent(env, EVENTS.RATE_LIMITED, {
      properties: { path: resolved.key, clientId, count, max: config.max, backend: 'db' },
    }).catch(() => {}); // best-effort
    return rateLimitExceededResponse(config, windowStart, now);
  }

  return { count, resetEpoch, config };
}

/**
 * Check rate limit. Returns null if within limits,
 * or a Response (429 or 503) if the limit is exceeded or the backend fails.
 *
 * Auth endpoints use DB-backed limiting (audit trail).
 * All other endpoints use KV-backed limiting (SYS-013 — performance).
 *
 * @param {Request} request
 * @param {object} env — must have RATE_LIMIT_KV binding; auth paths also need NEON_CONNECTION_STRING
 */
export async function rateLimit(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Identify client by user ID (if authenticated) or IP
  const clientId = request._user?.sub
    || request.headers.get('CF-Connecting-IP')
    || 'unknown';

  const resolved = resolveRateLimit(path);

  // Route to the appropriate backend
  const useDb = AUTH_RATE_LIMIT_PATHS.has(path);
  const result = useDb
    ? await dbRateLimit(request, env, clientId, resolved)
    : await kvRateLimit(request, env, clientId, resolved);

  // If result is a Response (429 or 503), return it immediately
  if (result instanceof Response) return result;

  // null means KV failed open — allow the request
  if (result === null) return null;

  // Attach rate limit metadata for downstream header injection
  request._rateLimit = {
    limit: result.config.max,
    remaining: Math.max(0, result.config.max - result.count),
    reset: result.resetEpoch
  };

  return null; // Within limits
}

/**
 * Attach rate limit headers to the response.
 */
export function addRateLimitHeaders(response, request) {
  if (!request._rateLimit) return response;

  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', String(request._rateLimit.limit));
  headers.set('X-RateLimit-Remaining', String(request._rateLimit.remaining));
  headers.set('X-RateLimit-Reset', String(request._rateLimit.reset));

  return new Response(response.body, {
    status: response.status,
    headers
  });
}

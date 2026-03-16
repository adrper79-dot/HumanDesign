/**
 * Rate Limiter Middleware (DB-backed, fixed-window counter)
 *
 * Uses Neon/Postgres for atomic fixed-window rate limiting.
 * Configured per-route with different limits.
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
 * Check rate limit. Returns null if within limits,
 * or a 429 Response if exceeded.
 *
 * @param {Request} request
 * @param {object} env — must have NEON_CONNECTION_STRING binding
 */
export async function rateLimit(request, env) {
  if (!env.NEON_CONNECTION_STRING) {
    console.error('[rateLimit] NEON_CONNECTION_STRING not configured — blocking request.');
    return new Response(
      JSON.stringify({ error: 'Service temporarily unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json', 'Retry-After': '30' } }
    );
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  const url = new URL(request.url);
  const path = url.pathname;

  // Identify client by IP (or user ID if authenticated)
  const clientId = request._user?.sub
    || request.headers.get('CF-Connecting-IP')
    || 'unknown';

  const resolved = resolveRateLimit(path);
  const config = resolved.config;
  const key = `rl:${clientId}:${resolved.key}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % config.windowSec); // Fixed window boundary
  const windowStartIso = new Date(windowStart * 1000).toISOString();
  const resetEpoch = windowStart + config.windowSec;
  const windowEndIso = new Date(resetEpoch * 1000).toISOString();

  let count;
  try {
    const result = await query(QUERIES.atomicWindowCounterIncrement, [
      key,
      windowStartIso,
      windowEndIso,
    ]);
    count = parseInt(result.rows[0]?.count || '0', 10);
  } catch (error) {
    console.error(JSON.stringify({ event: 'rate_limit_query_failed', path, clientId, error: error.message }));
    return new Response(
      JSON.stringify({ error: 'Service temporarily unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json', 'Retry-After': '30' } }
    );
  }

  if (count > config.max) {
    const retryAfter = (windowStart + config.windowSec) - now;
    console.warn(JSON.stringify({
      event: 'rate_limited', clientId, path, count, max: config.max
    }));
    trackEvent(env, EVENTS.RATE_LIMITED, {
      properties: { path, clientId, count, max: config.max },
    }).catch(() => {}); // best-effort
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

  // Attach rate limit headers for downstream
  request._rateLimit = {
    limit: config.max,
    remaining: Math.max(0, config.max - count),
    reset: resetEpoch
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

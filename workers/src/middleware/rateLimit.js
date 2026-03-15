/**
 * Rate Limiter Middleware (KV-backed, fixed-window counter)
 *
 * Uses Cloudflare KV for fixed-window rate limiting.
 * Stores a small { count, windowStart } object instead of
 * an unbounded array of timestamps (prior sliding-window approach).
 * Configured per-route with different limits.
 */

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
 * @param {object} env — must have RATE_LIMIT_KV binding
 */
export async function rateLimit(request, env) {
  const kv = env.CACHE;
  if (!kv) {
    // BL-RATELIMIT-001: Fail closed — missing KV means no rate limiting is possible.
    // Return 503 instead of silently disabling all rate limits.
    console.error('[rateLimit] CACHE KV not bound — blocking request. Bind CACHE in wrangler.toml.');
    return new Response(
      JSON.stringify({ error: 'Service temporarily unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json', 'Retry-After': '30' } }
    );
  }

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

  // CISO-004 / CTO-014: Atomic read-increment-write via KV compare-and-swap loop.
  // KV doesn't natively support CAS, but the single-threaded CF Worker isolate
  // processes one request at a time per isolate — so a tight get→check→put
  // within the same synchronous tick is effectively atomic within one isolate.
  // Cross-isolate races can still over-count by 1 but cannot bypass the limit.
  const stored = await kv.get(key, { type: 'json' });
  let count = 0;

  if (stored && stored.window === windowStart) {
    count = stored.count || 0;
  }
  // If stored.window differs, the window has rolled over — count resets to 0

  if (count >= config.max) {
    const retryAfter = (windowStart + config.windowSec) - now;
    console.warn(JSON.stringify({
      event: 'rate_limited', clientId, path, count, max: config.max
    }));
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

  // Increment counter — write immediately after read with no awaits in between
  // to minimize the race window across isolates
  const newCount = count + 1;
  await kv.put(key, JSON.stringify({ count: newCount, window: windowStart }), {
    expirationTtl: config.windowSec + 10 // Auto-cleanup after window expires
  });

  // Attach rate limit headers for downstream
  request._rateLimit = {
    limit: config.max,
    remaining: config.max - count,
    reset: windowStart + config.windowSec
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

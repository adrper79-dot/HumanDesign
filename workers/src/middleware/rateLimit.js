/**
 * Rate Limiter Middleware (KV-backed)
 *
 * Uses Cloudflare KV for sliding-window rate limiting.
 * Configured per-route with different limits.
 */

const RATE_LIMITS = {
  '/api/auth/register':     { max: 10,  windowSec: 60  },  // 10/min (spec: auth endpoints)
  '/api/auth/login':        { max: 10,  windowSec: 60  },  // 10/min
  '/api/auth/refresh':      { max: 10,  windowSec: 60  },  // 10/min
  '/api/auth/me':           { max: 10,  windowSec: 60  },  // 10/min
  '/api/chart/calculate':   { max: 60,  windowSec: 60  },  // 60/min
  '/api/profile/generate':  { max: 5,   windowSec: 60  },  // 5/min (LLM calls)
  '/api/geocode':           { max: 30,  windowSec: 60  },  // 30/min
  '/api/transits/today':    { max: 60,  windowSec: 60  },  // 60/min
  '/api/transits/forecast': { max: 60,  windowSec: 60  },  // 60/min
  default:                  { max: 60,  windowSec: 60  }
};

/**
 * Check rate limit. Returns null if within limits,
 * or a 429 Response if exceeded.
 *
 * @param {Request} request
 * @param {object} env — must have RATE_LIMIT_KV binding
 */
export async function rateLimit(request, env) {
  const kv = env.CACHE;
  if (!kv) return null; // KV not bound — skip rate limiting

  const url = new URL(request.url);
  const path = url.pathname;

  // Identify client by IP (or user ID if authenticated)
  const clientId = request._user?.sub
    || request.headers.get('CF-Connecting-IP')
    || 'unknown';

  const config = RATE_LIMITS[path] || RATE_LIMITS.default;
  const key = `rl:${clientId}:${path}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.windowSec;

  // Read current window
  const stored = await kv.get(key, { type: 'json' });
  let hits = [];

  if (stored && Array.isArray(stored)) {
    // Filter to current window
    hits = stored.filter(ts => ts > windowStart);
  }

  if (hits.length >= config.max) {
    const retryAfter = Math.ceil(config.windowSec - (now - hits[0]));
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
          'X-RateLimit-Reset': String(now + retryAfter)
        }
      }
    );
  }

  // Record this hit
  hits.push(now);
  await kv.put(key, JSON.stringify(hits), {
    expirationTtl: config.windowSec + 10 // Cleanup buffer
  });

  // Attach rate limit headers for downstream
  request._rateLimit = {
    limit: config.max,
    remaining: config.max - hits.length,
    reset: now + config.windowSec
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

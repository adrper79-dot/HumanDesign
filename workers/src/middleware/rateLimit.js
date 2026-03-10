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
  '/api/auth/forgot-password': { max: 3, windowSec: 60 },  // 3/min (prevent abuse)
  '/api/chart/calculate':   { max: 60,  windowSec: 60  },  // 60/min
  '/api/profile/generate':  { max: 5,   windowSec: 60  },  // 5/min (LLM calls)
  '/api/geocode':           { max: 30,  windowSec: 60  },  // 30/min
  '/api/transits/today':    { max: 60,  windowSec: 60  },  // 60/min
  '/api/transits/forecast': { max: 60,  windowSec: 60  },  // 60/min
  '/api/rectify':           { max: 5,   windowSec: 60  },  // 5/min (CPU-expensive: up to 241 chart calcs)
  '/api/sms/send-digest':   { max: 5,   windowSec: 60  },  // 5/min (SMS cost control)
  '/api/sms/subscribe':     { max: 5,   windowSec: 60  },  // 5/min
  '/api/sms/unsubscribe':   { max: 5,   windowSec: 60  },  // 5/min
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
  if (!kv) {
    // BL-S-MW1: Log warning so operators notice missing KV binding in production
    console.warn('[rateLimit] CACHE KV not bound — rate limiting disabled. Bind CACHE in wrangler.toml for production.');
    return null; // KV not bound — skip rate limiting
  }

  const url = new URL(request.url);
  const path = url.pathname;

  // Identify client by IP (or user ID if authenticated)
  const clientId = request._user?.sub
    || request.headers.get('CF-Connecting-IP')
    || 'unknown';

  const config = RATE_LIMITS[path] || RATE_LIMITS.default;
  const key = `rl:${clientId}:${path}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % config.windowSec); // Fixed window boundary

  // Read current window counter (small fixed-size object)
  const stored = await kv.get(key, { type: 'json' });
  let count = 0;

  if (stored && stored.window === windowStart) {
    count = stored.count || 0;
  }
  // If stored.window differs, the window has rolled over — count resets to 0

  if (count >= config.max) {
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

  // Increment counter
  count++;
  await kv.put(key, JSON.stringify({ count, window: windowStart }), {
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

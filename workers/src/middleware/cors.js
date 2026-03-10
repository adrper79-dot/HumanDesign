/**
 * CORS Middleware
 *
 * CSRF Protection Model (BL-R-H14):
 *   1. Access tokens are sent in the Authorization header (Bearer).
 *      Browsers never auto-attach this header, so cross-origin forms/links
 *      cannot forge authenticated requests even though cookies are present.
 *   2. Access tokens are stored in memory only (not localStorage).
 *   3. Refresh tokens are stored in HttpOnly cookies (ps_refresh).
 *      SameSite=None is required for cross-origin API domains; CSRF is
 *      mitigated because the refresh endpoint issues an access token that
 *      must be echoed in the Authorization header for any state change.
 *   4. Access-Control-Allow-Credentials: true is set so that the browser
 *      sends the HttpOnly refresh cookie on cross-origin requests.
 *   5. OAuth uses a server-generated `state` parameter (stored in
 *      DB with 10-minute expiry) to prevent OAuth CSRF.
 *   6. Stripe webhooks are verified via HMAC signature, not cookies.
 *
 * No additional CSRF token layer is needed given this architecture.
 */

// Production-only origins — always allowed
const PRODUCTION_ORIGINS = [
  'https://selfprime.net',             // Production custom domain
  'https://www.selfprime.net',         // Production www alias
  'https://prime-self-ui.pages.dev',  // Production frontend (Cloudflare Pages)
];

// Development origins — only allowed when ENVIRONMENT !== 'production'
// BL-S15-H1: Gate localhost behind environment check to prevent
// cross-origin requests from dev tools in production.
const DEV_ORIGINS = [
  'http://localhost:5173',             // Vite dev server
  'http://localhost:3000',             // Alternative dev port
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

/**
 * Build allowed origins list based on environment.
 * @param {string} [environment] — from env.ENVIRONMENT (wrangler.toml vars)
 * @returns {string[]}
 */
function getAllowedOrigins(environment) {
  if (environment === 'production') {
    return PRODUCTION_ORIGINS;
  }
  return [...PRODUCTION_ORIGINS, ...DEV_ORIGINS];
}

/**
 * Get CORS headers based on the request's Origin header.
 * Only allows specific origins to prevent unauthorized authenticated requests.
 * @param {Request} request
 * @param {string} [environment] — from env.ENVIRONMENT
 */
export function getCorsHeaders(request, environment) {
  const origin = request.headers.get('Origin');
  const allowed = getAllowedOrigins(environment);
  const allowedOrigin = allowed.includes(origin)
    ? origin
    : PRODUCTION_ORIGINS[0]; // Default to production

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    // BL-S-MW3: Expose rate limit headers to client JS
    'Access-Control-Expose-Headers': 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin' // Important: tells caches that response varies by Origin
  };
}

// Legacy export for backward compatibility (uses production origin)
export const corsHeaders = {
  'Access-Control-Allow-Origin': PRODUCTION_ORIGINS[0],
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400'
};

export function handleOptions(request, environment) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request, environment)
  });
}

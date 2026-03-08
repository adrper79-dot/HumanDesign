/**
 * CORS Middleware
 *
 * CSRF Protection Model (BL-R-H14):
 *   1. Auth uses Bearer tokens in Authorization header (not cookies).
 *      Browsers never auto-attach this header, so cross-origin forms/links
 *      cannot forge authenticated requests.
 *   2. Tokens are stored in localStorage, which is same-origin only.
 *   3. Access-Control-Allow-Credentials is intentionally OMITTED, so
 *      even if cookies were added in the future they would not be sent
 *      cross-origin.
 *   4. Notion OAuth uses a server-generated `state` parameter (stored in
 *      DB with 10-minute expiry) to prevent OAuth CSRF.
 *   5. Stripe webhooks are verified via HMAC signature, not cookies.
 *
 * No additional CSRF token layer is needed given this architecture.
 */

// Production-only origins — always allowed
const PRODUCTION_ORIGINS = [
  'https://selfprime.net',             // Production custom domain
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
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin' // Important: tells caches that response varies by Origin
  };
}

// Legacy export for backward compatibility (uses production origin)
export const corsHeaders = {
  'Access-Control-Allow-Origin': PRODUCTION_ORIGINS[0],
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

export function handleOptions(request, environment) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request, environment)
  });
}

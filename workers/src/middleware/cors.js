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

// Allowed origins for CORS requests
const ALLOWED_ORIGINS = [
  'https://selfprime.net',             // Production custom domain
  'https://prime-self-ui.pages.dev',  // Production frontend (Cloudflare Pages)
  'http://localhost:5173',             // Vite dev server
  'http://localhost:3000',             // Alternative dev port
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

/**
 * Get CORS headers based on the request's Origin header.
 * Only allows specific origins to prevent unauthorized authenticated requests.
 */
export function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0]; // Default to production

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
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

export function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request)
  });
}

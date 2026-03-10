/**
 * Security Headers Middleware
 *
 * Adds standard security headers to all responses:
 *   - Strict-Transport-Security (HSTS)
 *   - X-Content-Type-Options
 *   - X-Frame-Options
 *   - Referrer-Policy
 *   - X-XSS-Protection (legacy, disabled per modern guidance)
 *   - Permissions-Policy
 */

const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '0',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

/**
 * Apply security headers to a Response object.
 * Returns a new Response with headers appended.
 * @param {Response} response
 * @returns {Response}
 */
export function applySecurityHeaders(response) {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    newHeaders.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

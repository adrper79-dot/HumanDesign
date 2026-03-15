/**
 * Cache Control Middleware (BL-OPT-001)
 *
 * Applies proper Cache-Control headers to responses based on content type.
 * Designed for Cloudflare Workers edge deployment.
 *
 * Cache strategy:
 *   - HTML pages:        no-cache (always revalidate)
 *   - Hashed assets:     1 year, immutable (cache-bust via filename)
 *   - CSS/JS (unhashed): 1 hour ETag-based
 *   - API responses:     no-store (default), configurable per-route
 *   - Images/icons:      30 days
 *   - SW/manifest:       no-cache (always fresh)
 *
 * Usage:
 *   import { applyCacheHeaders, cacheControl } from '../middleware/cache.js';
 *
 *   // Auto-detect from path:
 *   return applyCacheHeaders(response, request);
 *
 *   // Explicit cache directive:
 *   return cacheControl(response, { maxAge: 3600, public: true });
 */

// ─── Cache Presets ───────────────────────────────────────────────────

export const CACHE_PRESETS = Object.freeze({
  // HTML pages — always revalidate, serve stale while revalidating
  HTML: 'public, no-cache',

  // Immutable assets (filename contains hash) — cache forever
  IMMUTABLE: 'public, max-age=31536000, immutable',

  // Unhashed static assets (CSS/JS) — short cache with revalidation
  STATIC: 'public, max-age=3600, stale-while-revalidate=86400',

  // Images and icons — 30 day cache
  IMAGES: 'public, max-age=2592000, stale-while-revalidate=86400',

  // API responses — private, no store by default
  API_NO_STORE: 'private, no-store',

  // Cacheable API (public data like /api/stats/activity) — 5 min
  API_SHORT: 'public, max-age=300, stale-while-revalidate=60',

  // Cacheable API (transit data, chart data) — 1 hour
  API_MEDIUM: 'public, max-age=3600, stale-while-revalidate=300',

  // Service worker & manifest — always check for updates
  SW: 'no-cache, no-store, must-revalidate',
});

// ─── Content-Type Detection ──────────────────────────────────────────

const EXT_TO_PRESET = {
  '.html': CACHE_PRESETS.HTML,
  '.css': CACHE_PRESETS.STATIC,
  '.js': CACHE_PRESETS.STATIC,
  '.json': CACHE_PRESETS.STATIC,
  '.png': CACHE_PRESETS.IMAGES,
  '.jpg': CACHE_PRESETS.IMAGES,
  '.jpeg': CACHE_PRESETS.IMAGES,
  '.gif': CACHE_PRESETS.IMAGES,
  '.webp': CACHE_PRESETS.IMAGES,
  '.avif': CACHE_PRESETS.IMAGES,
  '.svg': CACHE_PRESETS.IMAGES,
  '.ico': CACHE_PRESETS.IMAGES,
  '.woff2': CACHE_PRESETS.IMMUTABLE,
  '.woff': CACHE_PRESETS.IMMUTABLE,
  '.ttf': CACHE_PRESETS.IMMUTABLE,
};

const SW_FILES = new Set(['/service-worker.js', '/sw.js', '/manifest.json']);

/**
 * Detect whether a filename contains a content hash.
 * Matches patterns like: app.a1b2c3d4.js, style.abc123.css
 *
 * @param {string} path
 * @returns {boolean}
 */
function isHashedAsset(path) {
  return /\.[a-f0-9]{6,16}\.\w+$/.test(path);
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Auto-apply cache headers based on request path.
 * For API paths, defaults to no-store unless overridden.
 *
 * @param {Response} response - Original response
 * @param {Request} request - Original request (for path detection)
 * @returns {Response} Response with Cache-Control header
 */
function applyCacheHeaders(response, request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // API routes — no caching by default
  if (path.startsWith('/api/')) {
    return setCacheHeader(response, CACHE_PRESETS.API_NO_STORE);
  }

  // Service worker and manifest — always fresh
  if (SW_FILES.has(path)) {
    return setCacheHeader(response, CACHE_PRESETS.SW);
  }

  // Hashed assets — immutable
  if (isHashedAsset(path)) {
    return setCacheHeader(response, CACHE_PRESETS.IMMUTABLE);
  }

  // Extension-based detection
  const ext = path.match(/\.\w+$/)?.[0]?.toLowerCase();
  if (ext && EXT_TO_PRESET[ext]) {
    return setCacheHeader(response, EXT_TO_PRESET[ext]);
  }

  // Default for HTML-like paths (no extension = SPA route)
  return setCacheHeader(response, CACHE_PRESETS.HTML);
}

/**
 * Apply cache headers for specific public API endpoints
 * that benefit from short caching (reduces DB load).
 *
 * @param {Response} response
 * @param {string} path - API path
 * @returns {Response}
 */
export function applyCacheForPublicAPI(response, path) {
  // High-traffic public endpoints with cacheable data
  const shortCachePaths = [
    '/api/stats/activity',
    '/api/stats/leaderboard',
    '/api/compare/list',
    '/api/compare/search',
    '/api/health',
  ];

  const mediumCachePaths = [
    '/api/transits/today',
    '/api/transits/forecast',
  ];

  if (shortCachePaths.some((p) => path.startsWith(p))) {
    return setCacheHeader(response, CACHE_PRESETS.API_SHORT);
  }

  if (mediumCachePaths.some((p) => path.startsWith(p))) {
    return setCacheHeader(response, CACHE_PRESETS.API_MEDIUM);
  }

  return response;
}

/**
 * Apply explicit cache-control directive to a response.
 *
 * @param {Response} response
 * @param {object} opts
 * @param {number} [opts.maxAge] - Max cache age in seconds
 * @param {boolean} [opts.public] - Public cache (CDN-cacheable)
 * @param {boolean} [opts.immutable] - Mark as immutable
 * @param {boolean} [opts.noStore] - Prevent any caching
 * @param {number} [opts.staleWhileRevalidate] - Serve stale while refreshing
 * @returns {Response}
 */
function cacheControl(response, opts = {}) {
  const parts = [];

  if (opts.noStore) {
    return setCacheHeader(response, 'private, no-store');
  }

  parts.push(opts.public !== false ? 'public' : 'private');

  if (opts.maxAge !== undefined) {
    parts.push(`max-age=${opts.maxAge}`);
  }
  if (opts.immutable) {
    parts.push('immutable');
  }
  if (opts.staleWhileRevalidate) {
    parts.push(`stale-while-revalidate=${opts.staleWhileRevalidate}`);
  }

  return setCacheHeader(response, parts.join(', '));
}

// ─── Internal Helpers ────────────────────────────────────────────────

/**
 * Set Cache-Control header on a response (creates new response if immutable).
 *
 * @param {Response} response
 * @param {string} directive
 * @returns {Response}
 */
function setCacheHeader(response, directive) {
  // Create new response with modified headers (Response headers may be immutable)
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', directive);

  // Also set Vary for API responses to prevent CDN cross-origin cache poisoning
  if (directive.includes('public') && !headers.has('Vary')) {
    headers.set('Vary', 'Accept-Encoding, Origin');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

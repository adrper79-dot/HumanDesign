/**
 * Practitioner OG Image Handler
 * Item 4.3 — Per-Practitioner OG Images
 *
 * GET /api/og/practitioner/:slug
 * Public route — returns a 1200×630 SVG branded with the practitioner's
 * display name, specialty, and bio. KV-cached for 24h via env.CACHE.
 *
 * Analytics: practitioner_og_generated
 */
import { createQueryFn, QUERIES } from '../db/queries.js';
import { generatePractitionerOGImage } from '../lib/shareImage.js';
import { trackEvent } from '../lib/analytics.js';

const OG_CACHE_TTL = 86400; // 24 hours in seconds

// Validate slug: lowercase letters, digits, and hyphens only
function isValidSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9-]{1,80}$/.test(slug);
}

/**
 * Serve a practitioner's branded OG image.
 * @param {Request} request
 * @param {Object} env
 * @param {string} slug
 */
export async function handlePractitionerOGImage(request, env, slug) {
  if (!isValidSlug(slug)) {
    return new Response('Not Found', { status: 404 });
  }

  const cacheKey = `og:practitioner:v1:${slug}`;

  // 1. KV cache hit
  if (env.CACHE) {
    const cached = await env.CACHE.get(cacheKey, 'text').catch(() => null);
    if (cached) {
      return new Response(cached, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400',
          'X-Cache': 'HIT',
        },
      });
    }
  }

  // 2. Fetch from DB
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  let practitioner;
  try {
    const result = await query(QUERIES.getPractitionerBySlug, [slug]);
    practitioner = result.rows[0];
  } catch (_err) {
    return new Response('Internal Server Error', { status: 500 });
  }

  if (!practitioner) {
    return new Response('Not Found', { status: 404 });
  }

  // 3. Generate SVG
  const svg = generatePractitionerOGImage(practitioner);

  // 4. Store in KV cache
  if (env.CACHE) {
    await env.CACHE.put(cacheKey, svg, { expirationTtl: OG_CACHE_TTL }).catch(() => {});
  }

  // 5. Analytics (non-blocking)
  trackEvent(env, 'practitioner_og_generated', { slug, display_name: practitioner.display_name }).catch(() => {});

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
      'X-Cache': 'MISS',
    },
  });
}

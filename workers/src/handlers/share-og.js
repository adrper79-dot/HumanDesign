/**
 * Share OG Image Handlers — HTTP-served personalized social share images
 *
 * These endpoints serve SVG images with correct HTTP headers so that social
 * platform crawlers (Facebook, Twitter, LinkedIn) can fetch them when a user
 * shares a URL that references one of these images in an og:image meta tag.
 *
 * Why not data: URLs? Social crawlers cannot fetch data: URLs — they must be
 * absolute HTTP/HTTPS URLs on a public domain.
 *
 * Endpoints (all public, no auth required):
 *   GET /api/og/chart?type=Builder&profile=2%2F4&authority=Emotional
 *   GET /api/og/celebrity?name=Steve+Jobs&pct=78
 *   GET /api/og/achievement?name=First+Chart&icon=%F0%9F%8C%9F&tier=gold&points=100
 *   GET /api/og/referral?code=ABC123
 *
 * KV-cached for 24 h to avoid regenerating identical images on every crawl.
 */

import {
  generateChartOGSVG,
  generateCelebrityOGSVG,
  generateAchievementOGSVG,
  generateReferralOGSVG,
} from '../lib/shareImage.js';

const OG_CACHE_TTL = 86400; // 24 h

/**
 * Build a stable KV cache key from URL search params.
 * Only whitelisted params are included so cache keys are predictable.
 */
function buildCacheKey(prefix, params, keys) {
  const parts = keys.map(k => `${k}=${encodeURIComponent(params.get(k) || '')}`).join('&');
  return `og:${prefix}:v1:${parts}`;
}

/**
 * Serve an SVG string as an OG image response with KV caching.
 */
async function serveOGImage(env, cacheKey, generateFn) {
  // KV cache hit
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

  let svg;
  try {
    svg = generateFn();
  } catch {
    return new Response('SVG generation failed', { status: 500 });
  }

  if (env.CACHE) {
    env.CACHE.put(cacheKey, svg, { expirationTtl: OG_CACHE_TTL }).catch(() => {});
  }

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
      'X-Cache': 'MISS',
    },
  });
}

// Maximum lengths for user-controlled params injected into SVG
const PARAM_LIMITS = { name: 60, type: 50, profile: 20, authority: 40, icon: 8, tier: 20, code: 40, pct: 5 };

function limitParam(p, key) {
  const v = p.get(key) || '';
  const max = PARAM_LIMITS[key] ?? 60;
  return v.slice(0, max);
}

/**
 * GET /api/og/chart?type=Builder&profile=2%2F4&authority=Emotional
 */
export async function handleOGChart(request, env) {
  const url = new URL(request.url);
  const p = url.searchParams;
  const cacheKey = buildCacheKey('chart', p, ['type', 'profile', 'authority']);
  return serveOGImage(env, cacheKey, () =>
    generateChartOGSVG(limitParam(p, 'type'), limitParam(p, 'profile'), limitParam(p, 'authority'))
  );
}

/**
 * GET /api/og/celebrity?name=Steve+Jobs&pct=78
 */
export async function handleOGCelebrity(request, env) {
  const url = new URL(request.url);
  const p = url.searchParams;
  const cacheKey = buildCacheKey('celebrity', p, ['name', 'pct']);
  return serveOGImage(env, cacheKey, () =>
    generateCelebrityOGSVG(limitParam(p, 'name'), limitParam(p, 'pct'))
  );
}

/**
 * GET /api/og/achievement?name=First+Chart&icon=🌟&tier=gold&points=100
 */
export async function handleOGAchievement(request, env) {
  const url = new URL(request.url);
  const p = url.searchParams;
  const cacheKey = buildCacheKey('achievement', p, ['name', 'icon', 'tier', 'points']);
  return serveOGImage(env, cacheKey, () =>
    generateAchievementOGSVG(limitParam(p, 'name'), limitParam(p, 'icon'), limitParam(p, 'tier'), limitParam(p, 'points'))
  );
}

/**
 * GET /api/og/referral?code=ABC123
 */
export async function handleOGReferral(request, env) {
  const url = new URL(request.url);
  const p = url.searchParams;
  const cacheKey = buildCacheKey('referral', p, ['code']);
  return serveOGImage(env, cacheKey, () =>
    generateReferralOGSVG(limitParam(p, 'code'))
  );
}

/**
 * GET /api/transits/today?lat=27.9506&lng=-82.4572
 *
 * Returns current transit positions, gate activations,
 * and transit-to-natal aspects for a stored chart.
 * If no stored chart, returns raw transit positions only.
 *
 * Query params:
 *   lat, lng — observer location (optional, for house calc)
 *   chartId  — ID of stored natal chart (optional)
 *   birthDate, birthTime, birthTimezone — inline natal data (alternative to chartId)
 */

import { calculateFullChart } from '../../../src/engine/index.js';
import { getCurrentTransits } from '../../../src/engine/transits.js';
import { parseToUTC } from '../utils/parseToUTC.js';
import { trackEvent } from './achievements.js';
import { kvCache, keys, TTL, recordCacheAccess } from '../lib/cache.js';

export async function handleTransits(request, env) {
  const url = new URL(request.url);
  const lat = parseFloat(url.searchParams.get('lat')) || 0;
  const lng = parseFloat(url.searchParams.get('lng')) || 0;

  // Inline birth data for natal comparison
  const birthDate = url.searchParams.get('birthDate');
  const birthTime = url.searchParams.get('birthTime');
  const birthTimezone = url.searchParams.get('birthTimezone');

  try {
    let natalChart = null;
    let natalAstro = null;

    if (birthDate && birthTime) {
      // Cache natal chart computation
      const cacheKey = keys.chart(birthDate, birthTime, lat, lng);
      const { data: chart } = await kvCache.getOrSet(
        env, cacheKey, TTL.CHART,
        () => {
          const utc = parseToUTC(birthDate, birthTime, birthTimezone || undefined);
          return calculateFullChart({ ...utc, lat, lng });
        }
      );

      natalChart = chart.chart;
      natalAstro = chart.astrology;
    }

    // Cache today's transit positions
    // BL-FIX-C1: Transit cache must include natal data hash to prevent cross-user contamination.
    // Without natal data the result is the same for everyone (raw transit positions only),
    // so we use the date-only key.  When natal data is present the natal-to-transit aspects
    // are user-specific, so we append a hash of the birth params to the key.
    const today = new Date().toISOString().slice(0, 10);
    const natalSuffix = (birthDate && birthTime)
      ? `:${birthDate}:${birthTime}:${lat}:${lng}`
      : '';
    const transitCacheKey = keys.transit(today) + natalSuffix;

    const { data: transits, cached: transitCacheHit } = await kvCache.getOrSet(
      env, transitCacheKey, TTL.TRANSIT_DAY,
      () => getCurrentTransits(natalChart, natalAstro),
      // Only use in-memory cache for the universal (no-natal) key
      natalSuffix ? {} : { memCache: true, memTtlMs: 60_000 }
    );

    recordCacheAccess(transitCacheHit);

    // Track achievement event (only if authenticated)
    if (request._user) {
      await trackEvent(env, request._user.sub, 'transit_checked', null, request._tier || 'free');
    }

    return Response.json({
      ok: true,
      date: transits.date || new Date().toISOString().slice(0, 10),
      transits: {
        transitPositions: transits.transitPositions || {},
        gateActivations: transits.gateActivations || [],
        aspects: transits.transitToNatalAspects || [],
        natalMatches: []
      }
    });
  } catch (err) {
    console.error('[Transits] Unhandled error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

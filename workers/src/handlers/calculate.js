/**
 * POST /api/chart/calculate
 *
 * Full chart calculation — Layers 1-7.
 *
 * Request body:
 * {
 *   birthDate: "1979-08-05",
 *   birthTime: "18:51",
 *   birthTimezone: "America/New_York",
 *   lat: 27.9506,
 *   lng: -82.4572
 * }
 *
 * Response: Full chart JSON
 */

import { calculateFullChart } from '../../../src/engine/index.js';
import { parseToUTC } from '../utils/parseToUTC.js';
import { createQueryFn, QUERIES } from '../db/queries.js';
import { enforceUsageQuota, recordUsage } from '../middleware/tierEnforcement.js';
import { trackEvent } from './achievements.js';
import { kvCache, keys, TTL, recordCacheAccess } from '../lib/cache.js';
import { reportHandledRouteError } from '../lib/routeErrors.js';
import { sendPractitionerClientChartReady } from '../lib/email.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('calculate');

export async function handleCalculate(request, env) {
  // Enforce usage quota for chart calculation (only if authenticated)
  if (request._user) {
    const quotaCheck = await enforceUsageQuota(request, env, 'chart_calculation', 'chartCalculations');
    if (quotaCheck) return quotaCheck;
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // Validate required fields
  const required = ['birthDate', 'birthTime', 'lat', 'lng'];
  for (const field of required) {
    if (body[field] === undefined || body[field] === null) {
      return Response.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }

  const { birthDate, birthTime, birthTimezone, lat, lng } = body;

  // Convert to UTC
  let utc;
  if (birthTimezone) {
    try {
      utc = parseToUTC(birthDate, birthTime, birthTimezone);
    } catch (error) {
      return Response.json(
        { error: 'Invalid birth data format' }, // BL-R-H2
        { status: 400 }
      );
    }
  } else {
    // Assume UTC if no timezone provided
    const [year, month, day] = birthDate.split('-').map(Number);
    const [hour, minute] = birthTime.split(':').map(Number);
    utc = { year, month, day, hour, minute, second: 0 };
  }

  // Run full chart calculation (cached by birth params)
  const cacheKey = keys.chart(birthDate, birthTime, lat, lng);

  const { data: result, cached: cacheHit } = await kvCache.getOrSet(
    env, cacheKey, TTL.CHART,
    () => calculateFullChart({ ...utc, lat: parseFloat(lat), lng: parseFloat(lng) })
  );

  recordCacheAccess(cacheHit);

  // Non-blocking DB persistence — save chart if user is authenticated
  let chartId = null;
  const userId = request._user?.sub;
  if (userId && env.NEON_CONNECTION_STRING) {
    try {
      const query = createQueryFn(env.NEON_CONNECTION_STRING);

      // Ensure user row exists (upsert by JWT sub)
      await query(QUERIES.ensureUser, [
        userId, null, null, birthDate, birthTime, birthTimezone || null,
        parseFloat(lat), parseFloat(lng)
      ]);

      const hdJson = JSON.stringify(result.chart || result);
      const astroJson = JSON.stringify(result.astrology || null);
      const saved = await query(QUERIES.saveChart, [userId, hdJson, astroJson]);
      chartId = saved?.rows?.[0]?.id || null;

      // Invalidate cache on successful save (PER-P2-1: query caching)
      if (chartId) {
        await kvCache.del(env, keys.userChart(userId));
        await kvCache.del(env, keys.chartById(chartId));
      }

      // CMO-012: Fire-and-forget chart-ready notification to any practitioners for this client
      if (chartId && env.RESEND_API_KEY) {
        request._ctx?.waitUntil((async () => {
          try {
            const prows = await query(QUERIES.getPractitionersForClient, [userId]);
            const hdChart = result.chart || result;
            for (const prac of (prows.rows || [])) {
              const prefs = prac.notification_preferences || {};
              if (prefs.clientChartReady === false) continue;
              await sendPractitionerClientChartReady(
                prac.practitioner_email,
                prac.practitioner_name || 'Your practitioner',
                prac.client_name || prac.client_email || 'A client',
                hdChart.type || 'Unknown',
                hdChart.authority || 'Unknown',
                env.RESEND_API_KEY,
                env.FROM_EMAIL
              );
            }
          } catch { /* non-fatal */ }
        })());
      }
    } catch (e) {
      // DB failure is non-fatal — chart still returned; demoted to warn
      log.warn('chart_db_save_failed', { error: e.message });
    }
  }

  // Record usage after successful chart calculation (only if authenticated)
  if (userId) {
    await recordUsage(env, userId, 'chart_calculation', '/api/chart/calculate');
    
    // Track achievement event
    await trackEvent(env, userId, 'chart_calculated', { chartId }, request._tier || 'free', request._ctx);
  }

  return Response.json({
    ok: true,
    data: result,
    tier: request._tier,
    usage: request._user ? {
      current: request._usage || 0,
      action: 'chart_calculation'
    } : null,
    meta: {
      chartId,
      utcInput: utc,
      calculatedAt: new Date().toISOString()
    }
  });
}

/**
 * GET /api/chart/:id
 *
 * Retrieve a previously calculated chart by ID.
 * Requires authentication — only the chart owner can retrieve their chart.
 */
export async function handleGetChart(request, env, chartId) {
  const userId = request._user?.sub || null;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (!env.NEON_CONNECTION_STRING) {
    return Response.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // PER-P2-1: Check cache before querying database
    const cacheKey = keys.chartById(chartId);
    let chart = await kvCache.get(env, cacheKey);

    if (!chart) {
      const result = await query(QUERIES.getChartById, [chartId]);
      chart = result?.rows?.[0];

      if (!chart) {
        return Response.json({ error: 'Chart not found' }, { status: 404 });
      }

      // Cache the chart record (24 hours)
      await kvCache.put(env, cacheKey, chart, TTL.CHART);
    }

    // Verify ownership
    if (chart.user_id !== userId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const hdChart = typeof chart.hd_json === 'string' ? JSON.parse(chart.hd_json) : chart.hd_json;
    const astroChart = typeof chart.astro_json === 'string' ? JSON.parse(chart.astro_json) : chart.astro_json;

    // Ensure JSONB data is serializable (guards against BigInt / circular refs)
    let hdChartSafe, astroChartSafe;
    try {
      const serialized = JSON.stringify({ hdChart, astroChart });
      const parsed = JSON.parse(serialized);
      hdChartSafe = parsed.hdChart;
      astroChartSafe = parsed.astroChart;
    } catch {
      hdChartSafe = null;
      astroChartSafe = null;
    }

    return Response.json({
      ok: true,
      data: {
        id: chart.id,
        hdChart: hdChartSafe,
        astroChart: astroChartSafe,
        calculatedAt: chart.calculated_at
      }
    });
  } catch (err) {
    return reportHandledRouteError({ request, env, error: err, source: 'get-chart', extra: { chartId } });
  }
}

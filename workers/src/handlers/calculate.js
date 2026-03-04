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

export async function handleCalculate(request, env) {
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
        { error: error.message },
        { status: 400 }
      );
    }
  } else {
    // Assume UTC if no timezone provided
    const [year, month, day] = birthDate.split('-').map(Number);
    const [hour, minute] = birthTime.split(':').map(Number);
    utc = { year, month, day, hour, minute, second: 0 };
  }

  // Run full chart calculation
  const result = calculateFullChart({
    ...utc,
    lat: parseFloat(lat),
    lng: parseFloat(lng)
  });

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
      const astroJson = JSON.stringify(result.westernAstrology || null);
      const saved = await query(QUERIES.saveChart, [userId, hdJson, astroJson]);
      chartId = saved?.rows?.[0]?.id || null;
    } catch (e) {
      // DB failure is non-fatal — chart still returned
      console.error('Chart DB save failed:', e.message);
    }
  }

  return Response.json({
    success: true,
    data: result,
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
    const result = await query(QUERIES.getChartById, [chartId]);
    const chart = result?.rows?.[0];

    if (!chart) {
      return Response.json({ error: 'Chart not found' }, { status: 404 });
    }

    // Verify ownership
    if (chart.user_id !== userId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    return Response.json({
      ok: true,
      data: {
        id: chart.id,
        hdChart: typeof chart.hd_json === 'string' ? JSON.parse(chart.hd_json) : chart.hd_json,
        astroChart: typeof chart.astro_json === 'string' ? JSON.parse(chart.astro_json) : chart.astro_json,
        calculatedAt: chart.calculated_at
      }
    });
  } catch (err) {
    return Response.json({ error: 'Database error', detail: err.message }, { status: 500 });
  }
}

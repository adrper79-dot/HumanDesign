/**
 * POST /api/chart/save
 *
 * Save a previously calculated chart to the authenticated user's account.
 * Requires authentication.
 *
 * Request body:
 * {
 *   birthDate: "1979-08-05",
 *   birthTime: "18:51",
 *   birthTimezone: "America/New_York",
 *   lat: 27.9506,
 *   lng: -82.4572,
 *   hdChart: { ...full HD chart object... },
 *   astroChart: { ...full astrology chart object... }
 * }
 *
 * Response: { ok: true, chartId: "..." }
 */

import { createQueryFn, QUERIES } from '../db/queries.js';

export async function handleSaveChart(request, env) {
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (!env.NEON_CONNECTION_STRING) {
    return Response.json({ error: 'Database unavailable' }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate required fields
  const required = ['birthDate', 'birthTime', 'lat', 'lng', 'hdChart'];
  for (const field of required) {
    if (!body[field]) {
      return Response.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }

  const { birthDate, birthTime, birthTimezone, lat, lng, hdChart, astroChart } = body;

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Ensure user row exists (upsert by JWT sub)
    await query(QUERIES.ensureUser, [
      userId, null, null, birthDate, birthTime, birthTimezone || null,
      parseFloat(lat), parseFloat(lng)
    ]);

    // Save chart
    const hdJson = JSON.stringify(hdChart);
    const astroJson = astroChart ? JSON.stringify(astroChart) : null;
    const result = await query(QUERIES.saveChart, [userId, hdJson, astroJson]);
    const chartId = result?.rows?.[0]?.id;

    if (!chartId) {
      throw new Error('Failed to save chart - no ID returned');
    }

    return Response.json({
      ok: true,
      chartId,
      savedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Chart save failed:', err);
    return Response.json(
      { error: 'Failed to save chart' }, // BL-R-H2
      { status: 500 }
    );
  }
}

/**
 * GET /api/chart/history
 *
 * Retrieve all charts for the authenticated user.
 * Returns charts ordered by most recent first.
 */
export async function handleChartHistory(request, env) {
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (!env.NEON_CONNECTION_STRING) {
    return Response.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    
    // Query for user's charts
    const result = await query(
      QUERIES.getChartHistory,
      [userId]
    );

    const charts = (result?.rows || []).map(row => ({
      id: row.id,
      type: row.type,
      calculatedAt: row.calculated_at
    }));

    return Response.json({
      ok: true,
      charts,
      count: charts.length
    });
  } catch (err) {
    console.error('Chart history fetch failed:', err);
    return Response.json(
      { error: 'Failed to fetch chart history' },
      { status: 500 }
    );
  }
}

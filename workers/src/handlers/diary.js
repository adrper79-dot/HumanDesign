/**
 * POST   /api/diary
 * GET    /api/diary
 * GET    /api/diary/:id
 * PUT    /api/diary/:id
 * DELETE /api/diary/:id
 *
 * Life events diary/journal.
 * Tracks major life events with automatic transit correlation
 * for validation and pattern recognition.
 */

import { createQueryFn, QUERIES } from '../db/queries.js';
import { getCurrentTransits } from '../../../src/engine/transits.js';
import { createLogger } from '../lib/logger.js';
import { reportHandledRouteError } from '../lib/routeErrors.js';
import { callLLM } from '../lib/llm.js';
import { trackEvent } from '../lib/analytics.js';

/**
 * Convert a date string (YYYY-MM-DD) to Julian Day Number for transit calculation.
 */
function dateToJDN(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y
    + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

/**
 * Calculate transits for a specific date (for diary event correlation).
 * Queries the user's natal chart and computes transit-to-natal aspects.
 */
async function getTransitsForEventDate(eventDate, userBirthData, env, userId) {
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    
    // Get user's natal chart and astro data
    const { rows: chartRows } = await query(QUERIES.getLatestChartWithAstro, [userId]);
    
    if (!chartRows[0]) {
      return { date: eventDate, transitData: null, calculated: new Date().toISOString() };
    }
    
    const natalChart = typeof chartRows[0].hd_json === 'string'
      ? JSON.parse(chartRows[0].hd_json) : chartRows[0].hd_json;
    const natalAstro = typeof chartRows[0].astro_json === 'string'
      ? JSON.parse(chartRows[0].astro_json) : chartRows[0].astro_json;
    
    const jdn = dateToJDN(eventDate);
    const transits = getCurrentTransits(natalChart, natalAstro, jdn);
    
    return {
      date: eventDate,
      transitData: transits,
      calculated: new Date().toISOString()
    };
  } catch (error) {
    const log = createLogger(env, { action: 'diary_transit_calculation' });
    log.warn({ action: 'diary_transit_calculation_error', eventDate, userId, error: error?.message });
    return { date: eventDate, transitData: null, calculated: new Date().toISOString() };
  }
}

/**
 * Create a new diary entry.
 */
export async function handleDiaryCreate(request, env) {
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { eventDate, eventTitle, eventDescription, eventType, significance } = body;

  // Validate required fields
  if (!eventDate || !eventTitle) {
    return Response.json(
      { error: 'eventDate and eventTitle are required' },
      { status: 400 }
    );
  }

  // P2-BIZ-016: Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || isNaN(Date.parse(eventDate))) {
    return Response.json(
      { error: 'eventDate must be a valid date in YYYY-MM-DD format' },
      { status: 400 }
    );
  }

  // Validate field lengths
  if (eventTitle.length > 500 || (eventDescription && eventDescription.length > 10000)) {
    return Response.json({ error: 'Field too long' }, { status: 422 });
  }

  // Validate event type
  const validEventTypes = ['career', 'relationship', 'health', 'spiritual', 'financial', 'family', 'other'];
  if (eventType && !validEventTypes.includes(eventType)) {
    return Response.json(
      { error: 'Invalid event type', validOptions: validEventTypes },
      { status: 400 }
    );
  }

  // Validate significance
  const validSignificance = ['major', 'moderate', 'minor'];
  if (significance && !validSignificance.includes(significance)) {
    return Response.json(
      { error: 'Invalid significance', validOptions: validSignificance },
      { status: 400 }
    );
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  // Get user's birth data for transit calculation
  let transitSnapshot = null;
  try {
    const userResult = await query(QUERIES.getUserByIdSafe, [userId]);
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      const userTier = user.tier || 'free';
      // Transit snapshots on diary entries are an Explorer+ feature (free diary is ungated)
      if (userTier !== 'free' && user.birth_date && user.birth_lat && user.birth_lng) {
        transitSnapshot = await getTransitsForEventDate(eventDate, {
          birthDate: user.birth_date,
          birthLat: user.birth_lat,
          birthLng: user.birth_lng
        }, env, userId);
      }
    }
  } catch (error) {
    const log = createLogger(env, { action: 'diary_create_snapshot' });
    log.warn({ action: 'diary_transit_snapshot_failed', error: error?.message });
    // Non-fatal - continue without transit data
  }

  try {
    const result = await query(QUERIES.createDiaryEntry, [
      userId,
      eventDate,
      eventTitle,
      eventDescription || null,
      eventType || 'other',
      significance || 'moderate',
      transitSnapshot ? JSON.stringify(transitSnapshot) : null
    ]);

    return Response.json({
      ok: true,
      data: result.rows[0]
    });
  } catch (error) {
    return reportHandledRouteError({ request, env, error, source: 'diary-create' });
  }
}

/**
 * Get all diary entries for user with optional filters.
 */
export async function handleDiaryList(request, env) {
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 200);
  const offset = Math.max(parseInt(url.searchParams.get('offset')) || 0, 0);
  const search = (url.searchParams.get('search') || '').trim();
  const eventType = (url.searchParams.get('type') || '').trim();
  const significance = (url.searchParams.get('significance') || '').trim();
  const dateFrom = (url.searchParams.get('date_from') || '').trim();
  const dateTo = (url.searchParams.get('date_to') || '').trim();

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  try {
    const { sql, params } = buildDiaryFilterQuery(userId, { search, eventType, significance, dateFrom, dateTo, limit, offset });
    const result = await query(sql, params);

    return Response.json({
      ok: true,
      data: result.rows,
      pagination: { limit, offset, count: result.rows?.length || 0 }
    });
  } catch (error) {
    return reportHandledRouteError({ request, env, error, source: 'diary-list' });
  }
}

const VALID_EVENT_TYPES = ['career', 'relationship', 'health', 'spiritual', 'financial', 'family', 'other'];
const VALID_SIGNIFICANCE = ['major', 'moderate', 'minor'];

export function buildDiaryFilterQuery(userId, { search, eventType, significance, dateFrom, dateTo, limit, offset }) {
  const conditions = ['user_id = $1'];
  const params = [userId];
  let idx = 2;

  if (search) {
    conditions.push(`(event_title ILIKE $${idx} OR event_description ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }
  if (eventType && VALID_EVENT_TYPES.includes(eventType)) {
    conditions.push(`event_type = $${idx}`);
    params.push(eventType);
    idx++;
  }
  if (significance && VALID_SIGNIFICANCE.includes(significance)) {
    conditions.push(`significance = $${idx}`);
    params.push(significance);
    idx++;
  }
  if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
    conditions.push(`event_date >= $${idx}::date`);
    params.push(dateFrom);
    idx++;
  }
  if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    conditions.push(`event_date <= $${idx}::date`);
    params.push(dateTo);
    idx++;
  }

  params.push(limit, offset);
  const sql = `SELECT id, user_id, event_date, event_title, event_description, event_type, significance, transit_snapshot, created_at, updated_at
    FROM diary_entries
    WHERE ${conditions.join(' AND ')}
    ORDER BY event_date DESC, created_at DESC
    LIMIT $${idx} OFFSET $${idx + 1}`;

  return { sql, params };
}

/**
 * Export diary entries as CSV.
 */
export async function handleDiaryExport(request, env) {
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  try {
    const result = await query(QUERIES.exportUserDiary, [userId]);
    const rows = result.rows || [];

    const columns = [
      { key: 'event_date', label: 'Date' },
      { key: 'event_title', label: 'Title' },
      { key: 'event_description', label: 'Description' },
      { key: 'event_type', label: 'Type' },
      { key: 'significance', label: 'Significance' },
      { key: 'created_at', label: 'Created At' },
    ];

    const escapeCSV = (val) => {
      if (val == null) return '';
      const s = String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const header = columns.map(c => c.label).join(',');
    const lines = rows.map(r => columns.map(c => escapeCSV(r[c.key])).join(','));
    const csv = [header, ...lines].join('\n');

    trackEvent?.('diary', 'diary_exported', `${rows.length} entries`);

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="diary-entries.csv"',
      },
    });
  } catch (error) {
    return reportHandledRouteError({ request, env, error, source: 'diary-export' });
  }
}

/**
 * Get a single diary entry.
 */
export async function handleDiaryGet(request, env, entryId) {
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  try {
    const result = await query(QUERIES.getDiaryEntry, [entryId, userId]);

    if (result.rows.length === 0) {
      return Response.json({ error: 'Entry not found' }, { status: 404 });
    }

    return Response.json({
      ok: true,
      data: result.rows[0]
    });
  } catch (error) {
    return reportHandledRouteError({ request, env, error, source: 'diary-get' });
  }
}

/**
 * Update a diary entry.
 */
export async function handleDiaryUpdate(request, env, entryId) {
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { eventDate, eventTitle, eventDescription, eventType, significance } = body;

  // Validate required fields
  if (!eventDate || !eventTitle) {
    return Response.json(
      { error: 'eventDate and eventTitle are required' },
      { status: 400 }
    );
  }

  // P2-BIZ-016: Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || isNaN(Date.parse(eventDate))) {
    return Response.json(
      { error: 'eventDate must be a valid date in YYYY-MM-DD format' },
      { status: 400 }
    );
  }

  // Validate field lengths
  if (eventTitle.length > 500 || (eventDescription && eventDescription.length > 10000)) {
    return Response.json({ error: 'Field too long' }, { status: 422 });
  }

  // Validate event type
  const validEventTypes = ['career', 'relationship', 'health', 'spiritual', 'financial', 'family', 'other'];
  if (eventType && !validEventTypes.includes(eventType)) {
    return Response.json(
      { error: 'Invalid event type', validOptions: validEventTypes },
      { status: 400 }
    );
  }

  // Validate significance
  const validSignificance = ['major', 'moderate', 'minor'];
  if (significance && !validSignificance.includes(significance)) {
    return Response.json(
      { error: 'Invalid significance', validOptions: validSignificance },
      { status: 400 }
    );
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  try {
    const result = await query(QUERIES.updateDiaryEntry, [
      entryId,
      eventDate,
      eventTitle,
      eventDescription || null,
      eventType || 'other',
      significance || 'moderate',
      userId
    ]);

    if (result.rows.length === 0) {
      return Response.json({ error: 'Entry not found or access denied' }, { status: 404 });
    }

    return Response.json({
      ok: true,
      data: result.rows[0]
    });
  } catch (error) {
    return reportHandledRouteError({ request, env, error, source: 'diary-update' });
  }
}

/**
 * Delete a diary entry.
 */
export async function handleDiaryDelete(request, env, entryId) {
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  try {
    const result = await query(QUERIES.deleteDiaryEntry, [entryId, userId]);

    if (result.rows.length === 0) {
      return Response.json({ error: 'Entry not found or access denied' }, { status: 404 });
    }

    return Response.json({
      ok: true,
      deleted: result.rows[0].id
    });
  } catch (error) {
    return reportHandledRouteError({ request, env, error, source: 'diary-delete' });
  }
}

/**
 * Generate AI pattern insights from diary entries + transit correlations.
 * Requires 10+ entries.
 */
export async function handleDiaryInsights(request, env) {
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const { rows } = await query(QUERIES.getDiaryEntriesForInsights, [userId]);

    if (rows.length < 10) {
      return Response.json({
        error: `Need at least 10 diary entries for pattern analysis (you have ${rows.length})`,
      }, { status: 400 });
    }

    // Build entry summaries for the prompt
    const entrySummaries = rows.map(r => {
      const transit = r.transit_snapshot
        ? (typeof r.transit_snapshot === 'string' ? JSON.parse(r.transit_snapshot) : r.transit_snapshot)
        : null;
      const transitInfo = transit?.transitData?.aspects?.length
        ? `Transits: ${transit.transitData.aspects.slice(0, 5).map(a => `${a.transitPlanet} ${a.aspect} natal ${a.natalPlanet}`).join('; ')}`
        : '';
      return `[${r.event_date}] ${r.event_type}/${r.significance}: ${r.event_title}${r.event_description ? ' — ' + r.event_description.slice(0, 200) : ''}${transitInfo ? '\n  ' + transitInfo : ''}`;
    }).join('\n');

    const result = await callLLM({
      system: `You are an insightful pattern analyst for a personal energy blueprint platform.
Analyze the user's life diary entries and any transit correlations to find meaningful patterns.
Return a concise, structured analysis with:
1. Top 3-5 recurring themes or patterns across entries
2. Any correlations between event types, significance levels, and timing
3. Transit pattern correlations (if transit data is available)
4. One actionable insight or recommendation

Keep the response under 800 words. Use a warm but professional tone. Do not make medical or financial claims.`,
      messages: [{
        role: 'user',
        content: `Analyze these ${rows.length} diary entries for patterns and insights:\n\n${entrySummaries}`
      }],
      config: {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1200,
        temperature: 0.7,
      }
    }, env);

    trackEvent?.('diary', 'diary_insights_generated', userId);

    return Response.json({
      ok: true,
      insights: result,
      entryCount: rows.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return reportHandledRouteError({ request, env, error: err, source: 'diary-insights' });
  }
}

/**
 * Route handler for /api/diary/*
 */
export async function handleDiary(request, env, subpath) {
  const method = request.method;
  const normalized = (subpath === '/' ? '' : subpath);

  // POST /api/diary - create entry
  if (normalized === '' && method === 'POST') {
    return handleDiaryCreate(request, env);
  }

  // GET /api/diary - list entries
  if (normalized === '' && method === 'GET') {
    return handleDiaryList(request, env);
  }

  // POST /api/diary/insights - AI pattern analysis
  if (normalized === '/insights' && method === 'POST') {
    return handleDiaryInsights(request, env);
  }

  // GET /api/diary/export - CSV download
  if (normalized === '/export' && method === 'GET') {
    return handleDiaryExport(request, env);
  }

  // GET /api/diary/:id - get entry
  const getMatch = normalized.match(/^\/([a-f0-9\-]+)$/);
  if (getMatch && method === 'GET') {
    return handleDiaryGet(request, env, getMatch[1]);
  }

  // PUT /api/diary/:id - update entry
  const updateMatch = normalized.match(/^\/([a-f0-9\-]+)$/);
  if (updateMatch && method === 'PUT') {
    return handleDiaryUpdate(request, env, updateMatch[1]);
  }

  // DELETE /api/diary/:id - delete entry
  const deleteMatch = normalized.match(/^\/([a-f0-9\-]+)$/);
  if (deleteMatch && method === 'DELETE') {
    return handleDiaryDelete(request, env, deleteMatch[1]);
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

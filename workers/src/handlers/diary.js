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
    console.error('Transit calculation error:', error);
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
    const userResult = await query(QUERIES.getUserById, [userId]);
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
    console.warn('Transit snapshot calculation failed:', error);
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
    console.error('Diary create error:', error);
    return Response.json(
      { error: 'Failed to create diary entry' },
      { status: 500 }
    );
  }
}

/**
 * Get all diary entries for user.
 */
export async function handleDiaryList(request, env) {
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 200);
  const offset = Math.max(parseInt(url.searchParams.get('offset')) || 0, 0);

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  try {
    const result = await query(QUERIES.getDiaryEntries, [userId, limit, offset]);

    return Response.json({
      ok: true,
      data: result.rows,
      pagination: { limit, offset, count: result.rows?.length || 0 }
    });
  } catch (error) {
    console.error('Diary list error:', error);
    return Response.json(
      { error: 'Failed to retrieve diary entries' },
      { status: 500 }
    );
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
    console.error('Diary get error:', error);
    return Response.json(
      { error: 'Failed to retrieve diary entry' },
      { status: 500 }
    );
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
    console.error('Diary update error:', error);
    return Response.json(
      { error: 'Failed to update diary entry' },
      { status: 500 }
    );
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
    console.error('Diary delete error:', error);
    return Response.json(
      { error: 'Failed to delete diary entry' },
      { status: 500 }
    );
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

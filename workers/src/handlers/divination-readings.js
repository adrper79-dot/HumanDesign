/**
 * Divination Reading Log Handler
 * CRUD for practitioner divination readings (tarot, oracle, runes, iching, pendulum, other)
 *
 * Endpoints:
 * - GET  /api/practitioner/clients/:id/readings  — list readings for a client
 * - POST /api/practitioner/clients/:id/readings  — create a reading
 * - GET  /api/practitioner/readings/:id           — get a single reading
 * - PUT  /api/practitioner/readings/:id           — update a reading
 * - DELETE /api/practitioner/readings/:id         — delete a reading
 * - GET  /api/client/my-readings                  — client views own shared readings
 */

import { createQueryFn, QUERIES } from '../db/queries.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('divination-readings');

const VALID_READING_TYPES = ['tarot', 'oracle', 'runes', 'iching', 'pendulum', 'other'];
const MAX_INTERPRETATION_LENGTH = 10000;
const MAX_CARDS = 78;

async function getPractitionerByUserId(query, userId) {
  const { rows } = await query(QUERIES.getPractitionerByUserId, [userId]);
  return rows[0] || null;
}

async function checkPractitionerAccess(query, userId, clientId) {
  const prac = await getPractitionerByUserId(query, userId);
  if (!prac) return null;
  const { rows } = await query(QUERIES.getPractitionerClient, [prac.id, clientId]);
  if (!rows[0]) return null;
  return prac;
}

export async function handleListReadings(request, env, clientId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const prac = await checkPractitionerAccess(query, userId, clientId);
  if (!prac) return Response.json({ ok: false, error: 'Access denied' }, { status: 403 });

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit')) || 20, 100);
  const offset = Math.max(parseInt(url.searchParams.get('offset')) || 0, 0);
  const readingType = url.searchParams.get('type') || '';

  const { rows } = await query(QUERIES.listDivinationReadings, [prac.id, clientId, readingType, limit, offset]);
  const { rows: countRows } = await query(QUERIES.countDivinationReadings, [prac.id, clientId, readingType]);
  const total = countRows[0]?.total || 0;

  return Response.json({
    ok: true,
    readings: rows,
    total,
    hasMore: offset + rows.length < total
  });
}

export async function handleCreateReading(request, env, clientId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const prac = await checkPractitionerAccess(query, userId, clientId);
  if (!prac) return Response.json({ ok: false, error: 'Access denied' }, { status: 403 });

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { reading_type, spread_type, cards, interpretation, share_with_ai, reading_date } = body;

  if (reading_type && !VALID_READING_TYPES.includes(reading_type)) {
    return Response.json({ ok: false, error: `Invalid reading_type. Must be one of: ${VALID_READING_TYPES.join(', ')}` }, { status: 400 });
  }

  if (interpretation && interpretation.length > MAX_INTERPRETATION_LENGTH) {
    return Response.json({ ok: false, error: `Interpretation exceeds ${MAX_INTERPRETATION_LENGTH} characters` }, { status: 400 });
  }

  if (cards && Array.isArray(cards) && cards.length > MAX_CARDS) {
    return Response.json({ ok: false, error: `Too many cards (max ${MAX_CARDS})` }, { status: 400 });
  }

  const { rows } = await query(QUERIES.createDivinationReading, [
    prac.id,
    clientId,
    reading_type || 'tarot',
    spread_type || null,
    cards ? JSON.stringify(cards) : null,
    interpretation || '',
    share_with_ai === true,
    reading_date || new Date().toISOString().slice(0, 10)
  ]);

  log.info('reading_created', { practitionerId: prac.id, clientId, type: reading_type });
  return Response.json({ ok: true, reading: rows[0] }, { status: 201 });
}

export async function handleGetReading(request, env, readingId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const prac = await getPractitionerByUserId(query, userId);
  if (!prac) return Response.json({ ok: false, error: 'Access denied' }, { status: 403 });

  const { rows } = await query(QUERIES.getDivinationReading, [readingId, prac.id]);
  if (!rows[0]) return Response.json({ ok: false, error: 'Reading not found' }, { status: 404 });

  return Response.json({ ok: true, reading: rows[0] });
}

export async function handleUpdateReading(request, env, readingId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const prac = await getPractitionerByUserId(query, userId);
  if (!prac) return Response.json({ ok: false, error: 'Access denied' }, { status: 403 });

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { interpretation, share_with_ai, cards, spread_type } = body;

  if (interpretation && interpretation.length > MAX_INTERPRETATION_LENGTH) {
    return Response.json({ ok: false, error: `Interpretation exceeds ${MAX_INTERPRETATION_LENGTH} characters` }, { status: 400 });
  }

  const { rows } = await query(QUERIES.updateDivinationReading, [
    readingId,
    interpretation ?? null,
    share_with_ai ?? null,
    cards ? JSON.stringify(cards) : null,
    spread_type ?? null,
    prac.id
  ]);

  if (!rows[0]) return Response.json({ ok: false, error: 'Reading not found' }, { status: 404 });
  return Response.json({ ok: true, reading: rows[0] });
}

export async function handleDeleteReading(request, env, readingId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const prac = await getPractitionerByUserId(query, userId);
  if (!prac) return Response.json({ ok: false, error: 'Access denied' }, { status: 403 });

  await query(QUERIES.deleteDivinationReading, [readingId, prac.id]);
  return Response.json({ ok: true });
}

export async function handleClientReadings(request, env) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit')) || 20, 100);
  const offset = Math.max(parseInt(url.searchParams.get('offset')) || 0, 0);

  const { rows } = await query(QUERIES.getSharedDivinationReadings, [userId, limit, offset]);
  return Response.json({ ok: true, readings: rows });
}

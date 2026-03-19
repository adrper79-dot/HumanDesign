/**
 * Session Actions Handler
 * Practitioner assigns actions to clients (homework, exercises, follow-ups).
 * Clients can view and mark them complete.
 *
 * Endpoints:
 * - GET    /api/practitioner/clients/:id/actions      — list actions for a client
 * - POST   /api/practitioner/clients/:id/actions      — create an action
 * - PUT    /api/practitioner/actions/:id               — update an action
 * - DELETE /api/practitioner/actions/:id               — delete an action
 * - GET    /api/client/my-actions                      — client views own pending actions
 * - PUT    /api/client/actions/:id/complete             — client marks action complete
 */

import { createQueryFn, QUERIES } from '../db/queries.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('session-actions');

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;

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

export async function handleListActions(request, env, clientId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const prac = await checkPractitionerAccess(query, userId, clientId);
  if (!prac) return Response.json({ ok: false, error: 'Access denied' }, { status: 403 });

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || '';
  const limit = Math.min(parseInt(url.searchParams.get('limit')) || 20, 100);
  const offset = Math.max(parseInt(url.searchParams.get('offset')) || 0, 0);

  const { rows } = await query(QUERIES.listSessionActions, [prac.id, clientId, status, limit, offset]);
  const { rows: countRows } = await query(QUERIES.countSessionActions, [prac.id, clientId, status]);
  const total = countRows[0]?.total || 0;

  return Response.json({ ok: true, actions: rows, total, hasMore: offset + rows.length < total });
}

export async function handleCreateAction(request, env, clientId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const prac = await checkPractitionerAccess(query, userId, clientId);
  if (!prac) return Response.json({ ok: false, error: 'Access denied' }, { status: 403 });

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { title, description, due_date, session_note_id } = body;
  if (!title || !title.trim()) {
    return Response.json({ ok: false, error: 'Title is required' }, { status: 400 });
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return Response.json({ ok: false, error: `Title exceeds ${MAX_TITLE_LENGTH} characters` }, { status: 400 });
  }
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    return Response.json({ ok: false, error: `Description exceeds ${MAX_DESCRIPTION_LENGTH} characters` }, { status: 400 });
  }

  const { rows } = await query(QUERIES.createSessionAction, [
    prac.id,
    clientId,
    title.trim(),
    description?.trim() || null,
    due_date || null,
    session_note_id || null
  ]);

  log.info('action_created', { practitionerId: prac.id, clientId, title: title.trim() });
  return Response.json({ ok: true, action: rows[0] }, { status: 201 });
}

export async function handleUpdateAction(request, env, actionId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const prac = await getPractitionerByUserId(query, userId);
  if (!prac) return Response.json({ ok: false, error: 'Access denied' }, { status: 403 });

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { title, description, due_date, status } = body;
  if (title && title.length > MAX_TITLE_LENGTH) {
    return Response.json({ ok: false, error: `Title exceeds ${MAX_TITLE_LENGTH} characters` }, { status: 400 });
  }
  if (status && !['pending', 'completed', 'cancelled'].includes(status)) {
    return Response.json({ ok: false, error: 'Invalid status' }, { status: 400 });
  }

  const { rows } = await query(QUERIES.updateSessionAction, [
    actionId,
    title?.trim() ?? null,
    description?.trim() ?? null,
    due_date ?? null,
    status ?? null,
    prac.id
  ]);

  if (!rows[0]) return Response.json({ ok: false, error: 'Action not found' }, { status: 404 });
  return Response.json({ ok: true, action: rows[0] });
}

export async function handleDeleteAction(request, env, actionId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const prac = await getPractitionerByUserId(query, userId);
  if (!prac) return Response.json({ ok: false, error: 'Access denied' }, { status: 403 });

  await query(QUERIES.deleteSessionAction, [actionId, prac.id]);
  return Response.json({ ok: true });
}

export async function handleClientActions(request, env) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit')) || 20, 100);
  const offset = Math.max(parseInt(url.searchParams.get('offset')) || 0, 0);

  const { rows } = await query(QUERIES.getClientActions, [userId, limit, offset]);
  return Response.json({ ok: true, actions: rows });
}

export async function handleCompleteAction(request, env, actionId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const { rows } = await query(QUERIES.completeClientAction, [actionId, userId]);
  if (!rows[0]) return Response.json({ ok: false, error: 'Action not found' }, { status: 404 });

  log.info('action_completed', { actionId, userId });
  return Response.json({ ok: true, action: rows[0] });
}

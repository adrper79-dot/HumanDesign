/**
 * Practitioner Session Notes — CRUD + AI Context
 *
 * HD_UPDATES4 Vector 1: Session notes with share_with_ai flag
 * HD_UPDATES4 Vector 3: Per-client AI context field
 *
 * Routes (all require auth + practitioner tier):
 *   GET    /api/practitioner/clients/:id/notes          — List notes for client
 *   POST   /api/practitioner/clients/:id/notes          — Create note
 *   PUT    /api/practitioner/notes/:noteId               — Update note
 *   DELETE /api/practitioner/notes/:noteId               — Delete note
 *   GET    /api/practitioner/clients/:id/ai-context      — Get client AI context
 *   PUT    /api/practitioner/clients/:id/ai-context      — Update client AI context
 */

import { createQueryFn, QUERIES } from '../db/queries.js';

// ─── Session Notes CRUD ──────────────────────────────────────

/**
 * GET /api/practitioner/clients/:clientId/notes
 */
export async function handleListNotes(request, env, clientId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  // Verify practitioner owns this client
  const practitioner = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (practitioner.rows.length === 0) {
    return Response.json({ error: 'Not registered as practitioner' }, { status: 403 });
  }

  const notes = await query(QUERIES.listSessionNotes, [
    practitioner.rows[0].id,
    clientId,
  ]);

  return Response.json({ ok: true, notes: notes.rows });
}

/**
 * POST /api/practitioner/clients/:clientId/notes
 */
export async function handleCreateNote(request, env, clientId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  const practitioner = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (practitioner.rows.length === 0) {
    return Response.json({ error: 'Not registered as practitioner' }, { status: 403 });
  }

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const content = String(body.content || '').trim();
  if (!content) {
    return Response.json({ error: 'Note content is required' }, { status: 400 });
  }
  if (content.length > 5000) {
    return Response.json({ error: 'Note content exceeds 5000 character limit' }, { status: 400 });
  }

  const shareWithAi = body.share_with_ai === true;
  const transitSnapshot = body.transit_snapshot || null;
  const sessionDate = body.session_date || new Date().toISOString().split('T')[0];

  const result = await query(QUERIES.createSessionNote, [
    practitioner.rows[0].id,
    clientId,
    content,
    shareWithAi,
    transitSnapshot ? JSON.stringify(transitSnapshot) : null,
    sessionDate,
  ]);

  return Response.json({ ok: true, note: result.rows[0] }, { status: 201 });
}

/**
 * PUT /api/practitioner/notes/:noteId
 */
export async function handleUpdateNote(request, env, noteId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const content = String(body.content || '').trim();
  if (!content || content.length > 5000) {
    return Response.json({ error: 'Note content is required (max 5000 chars)' }, { status: 400 });
  }

  const shareWithAi = body.share_with_ai === true;

  const result = await query(QUERIES.updateSessionNote, [
    noteId,
    content,
    shareWithAi,
  ]);

  if (result.rows.length === 0) {
    return Response.json({ error: 'Note not found' }, { status: 404 });
  }

  return Response.json({ ok: true, note: result.rows[0] });
}

/**
 * DELETE /api/practitioner/notes/:noteId
 */
export async function handleDeleteNote(request, env, noteId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  const practitioner = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (practitioner.rows.length === 0) {
    return Response.json({ error: 'Not registered as practitioner' }, { status: 403 });
  }

  await query(QUERIES.deleteSessionNote, [noteId, practitioner.rows[0].id]);
  return Response.json({ ok: true });
}

// ─── Per-Client AI Context ───────────────────────────────────

/**
 * GET /api/practitioner/clients/:clientId/ai-context
 */
export async function handleGetAIContext(request, env, clientId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  const practitioner = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (practitioner.rows.length === 0) {
    return Response.json({ error: 'Not registered as practitioner' }, { status: 403 });
  }

  const result = await query(QUERIES.getClientAIContext, [
    practitioner.rows[0].id,
    clientId,
  ]);

  return Response.json({
    ok: true,
    ai_context: result.rows[0]?.ai_context || '',
  });
}

/**
 * PUT /api/practitioner/clients/:clientId/ai-context
 */
export async function handleUpdateAIContext(request, env, clientId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  const practitioner = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (practitioner.rows.length === 0) {
    return Response.json({ error: 'Not registered as practitioner' }, { status: 403 });
  }

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const aiContext = String(body.ai_context || '').trim().substring(0, 2000);

  await query(QUERIES.updateClientAIContext, [
    practitioner.rows[0].id,
    clientId,
    aiContext,
  ]);

  return Response.json({ ok: true, ai_context: aiContext });
}

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
import { createLogger } from '../lib/logger.js';
import { trackEvent } from '../lib/analytics.js';
import { sendSessionSummaryEmail } from '../lib/email.js';

async function getPractitionerClientAccess(query, userId, clientId) {
  const practitioner = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (practitioner.rows.length === 0) {
    return { error: Response.json({ error: 'Not registered as practitioner' }, { status: 403 }) };
  }

  const access = await query(QUERIES.checkPractitionerAccess, [userId, clientId]);
  if (access.rows.length === 0) {
    return { error: Response.json({ error: 'Forbidden - client not on your roster' }, { status: 403 }) };
  }

  return { practitionerId: practitioner.rows[0].id };
}

// ─── Session Notes CRUD ──────────────────────────────────────

/**
 * GET /api/practitioner/clients/:clientId/notes
 */
export async function handleListNotes(request, env, clientId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const log = request._log || createLogger(request._reqId || 'session-notes');

  const access = await getPractitionerClientAccess(query, userId, clientId);
  if (access.error) return access.error;

  // SYS-022: Search and date filter support
  const url = new URL(request.url);
  const search = url.searchParams.get('search') || '';
  const fromDate = url.searchParams.get('fromDate') || '';
  const toDate = url.searchParams.get('toDate') || '';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  try {
    const [notes, countResult] = await Promise.all([
      query(QUERIES.listSessionNotes, [
        access.practitionerId,
        clientId,
        search,
        fromDate,
        toDate,
        limit,
        offset,
      ]),
      query(QUERIES.countSessionNotes, [
        access.practitionerId,
        clientId,
        search,
        fromDate,
        toDate,
      ]),
    ]);

    const total = countResult.rows[0]?.total ?? 0;
    const hasMore = offset + notes.rows.length < total;

    log.info({ action: 'session_notes_listed', practitionerId: access.practitionerId, clientId, total });
    return Response.json({ ok: true, notes: notes.rows, total, hasMore });
  } catch (err) {
    log.error({ action: 'session_notes_list_failed', error: err.message });
    throw err;
  }
}

/**
 * POST /api/practitioner/clients/:clientId/notes
 */
export async function handleCreateNote(request, env, clientId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const log = request._log || createLogger(request._reqId || 'session-notes');

  const access = await getPractitionerClientAccess(query, userId, clientId);
  if (access.error) return access.error;

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
  const sendSummary  = body.send_summary  === true;
  const transitSnapshot = body.transit_snapshot || null;
  const sessionDate = body.session_date || new Date().toISOString().split('T')[0];

  try {
    const result = await query(QUERIES.createSessionNote, [
      access.practitionerId,
      clientId,
      content,
      shareWithAi,
      transitSnapshot ? JSON.stringify(transitSnapshot) : null,
      sessionDate,
    ]);

    log.info({ action: 'session_note_created', practitionerId: access.practitionerId, clientId });
    trackEvent(env, 'session_note_create', { userId, properties: { shareWithAi, clientId } }).catch(() => {});

    // 5.2: Optionally email session summary to client
    if (sendSummary && env.RESEND_API_KEY) {
      (async () => {
        try {
          // getPractitionerBranding returns display_name + booking_url from practitioners table
          const [clientRow, brandingRow] = await Promise.all([
            query(QUERIES.getUserByIdSafe, [clientId]),
            query(QUERIES.getPractitionerBranding, [userId]),
          ]);
          const clientEmail = clientRow.rows[0]?.email;
          if (!clientEmail) return;
          const branding = brandingRow.rows[0] || {};
          const practDisplayName = branding.display_name || 'Your Practitioner';
          // Extract action items: lines starting with – or - followed by space
          const actionItems = content
            .split('\n')
            .map(l => l.trim())
            .filter(l => /^[-–] /.test(l))
            .map(l => l.replace(/^[-–] /, ''));
          await sendSessionSummaryEmail(
            clientEmail, clientEmail, practDisplayName, content, actionItems,
            branding.booking_url || null, env.RESEND_API_KEY, env.FROM_EMAIL, env.COMPANY_ADDRESS || ''
          );
          trackEvent(env, 'session_email_sent', { userId, properties: { practitionerId: access.practitionerId, clientId } }).catch(() => {});
        } catch (e) {
          log.warn({ action: 'session_summary_email_failed', error: e.message });
        }
      })();
    }

    return Response.json({ ok: true, note: result.rows[0] }, { status: 201 });
  } catch (err) {
    log.error({ action: 'session_note_create_failed', error: err.message });
    throw err;
  }
}

/**
 * PUT /api/practitioner/notes/:noteId
 */
export async function handleUpdateNote(request, env, noteId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const log = request._log || createLogger(request._reqId || 'session-notes');

  const practitioner = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (practitioner.rows.length === 0) {
    return Response.json({ error: 'Not registered as practitioner' }, { status: 403 });
  }

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const content = String(body.content || '').trim();
  if (!content || content.length > 5000) {
    return Response.json({ error: 'Note content is required (max 5000 chars)' }, { status: 400 });
  }

  const shareWithAi = body.share_with_ai === true;
  const practitionerId = practitioner.rows[0].id;

  try {
    const result = await query(QUERIES.updateSessionNote, [
      noteId,
      content,
      shareWithAi,
      practitionerId,
    ]);

    if (result.rows.length === 0) {
      return Response.json({ error: 'Note not found' }, { status: 404 });
    }

    log.info({ action: 'session_note_updated', noteId, practitionerId });
    trackEvent(env, 'session_note_update', { userId, properties: { noteId } }).catch(() => {});
    return Response.json({ ok: true, note: result.rows[0] });
  } catch (err) {
    log.error({ action: 'session_note_update_failed', error: err.message });
    throw err;
  }
}

/**
 * DELETE /api/practitioner/notes/:noteId
 */
export async function handleDeleteNote(request, env, noteId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const log = request._log || createLogger(request._reqId || 'session-notes');

  const practitioner = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (practitioner.rows.length === 0) {
    return Response.json({ error: 'Not registered as practitioner' }, { status: 403 });
  }

  const practitionerId = practitioner.rows[0].id;

  try {
    const result = await query(QUERIES.deleteSessionNote, [noteId, practitionerId]);
    if (!result?.rowCount) {
      return Response.json({ error: 'Note not found' }, { status: 404 });
    }

    log.info({ action: 'session_note_deleted', noteId, practitionerId });
    return Response.json({ ok: true });
  } catch (err) {
    log.error({ action: 'session_note_delete_failed', error: err.message });
    throw err;
  }
}

// ─── Per-Client AI Context ───────────────────────────────────

/**
 * GET /api/practitioner/clients/:clientId/ai-context
 */
export async function handleGetAIContext(request, env, clientId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const log = request._log || createLogger(request._reqId || 'session-notes');

  const access = await getPractitionerClientAccess(query, userId, clientId);
  if (access.error) return access.error;

  try {
    const result = await query(QUERIES.getClientAIContext, [
      access.practitionerId,
      clientId,
    ]);

    log.info({ action: 'ai_context_fetched', practitionerId: access.practitionerId, clientId });
    return Response.json({
      ok: true,
      ai_context: result.rows[0]?.ai_context || '',
    });
  } catch (err) {
    log.error({ action: 'ai_context_fetch_failed', error: err.message });
    throw err;
  }
}

/**
 * PUT /api/practitioner/clients/:clientId/ai-context
 */
export async function handleUpdateAIContext(request, env, clientId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const log = request._log || createLogger(request._reqId || 'session-notes');

  const access = await getPractitionerClientAccess(query, userId, clientId);
  if (access.error) return access.error;

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const aiContext = String(body.ai_context || '').trim().substring(0, 2000);

  try {
    await query(QUERIES.updateClientAIContext, [
      access.practitionerId,
      clientId,
      aiContext,
    ]);

    log.info({ action: 'ai_context_updated', practitionerId: access.practitionerId, clientId });
    trackEvent(env, 'ai_context_update', { userId, properties: { clientId, length: aiContext.length } }).catch(() => {});
    return Response.json({ ok: true, ai_context: aiContext });
  } catch (err) {
    log.error({ action: 'ai_context_update_failed', error: err.message });
    throw err;
  }
}

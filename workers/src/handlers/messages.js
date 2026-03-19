/**
 * Practitioner-Client Messaging (item 5.1)
 *
 * Routes (all require auth):
 *   GET  /api/practitioner/clients/:id/messages  — list thread (practitioner)
 *   POST /api/practitioner/clients/:id/messages  — send to client (practitioner)
 *   GET  /api/client/messages                    — list all messages (client)
 *   POST /api/client/messages                    — send to practitioner (client)
 *   PUT  /api/messages/:id/read                  — mark a message read
 */

import { createQueryFn, QUERIES } from '../db/queries.js';
import { createLogger } from '../lib/logger.js';
import { trackEvent } from '../lib/analytics.js';
import { sendPushNotification } from './push.js';

const BODY_MAX = 2000;

// ── Helpers ─────────────────────────────────────────────────

async function getPractitionerAndAccess(query, userId, clientId) {
  const pResult = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (pResult.rows.length === 0) {
    return { error: Response.json({ error: 'Not registered as practitioner' }, { status: 403 }) };
  }
  const access = await query(QUERIES.checkPractitionerAccess, [userId, clientId]);
  if (access.rows.length === 0) {
    return { error: Response.json({ error: 'Forbidden – client not on your roster' }, { status: 403 }) };
  }
  return { practitionerId: pResult.rows[0].id };
}

/** Send a push notification to a user if they have active subscriptions. */
async function notifyUser(env, targetUserId, title, body) {
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const subs = await query(QUERIES.getActivePushSubscriptionsFull, [targetUserId]);
    for (const sub of subs.rows) {
      sendPushNotification(env, sub, { title, body, data: { type: 'new_message' } }).catch(() => {});
    }
  } catch { /* push is non-critical */ }
}

// ── Practitioner → Client Message Thread ────────────────────

/**
 * GET /api/practitioner/clients/:clientId/messages
 */
export async function handlePractitionerListMessages(request, env, clientId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  const access = await getPractitionerAndAccess(query, userId, clientId);
  if (access.error) return access.error;

  const url = new URL(request.url);
  const limit  = Math.min(parseInt(url.searchParams.get('limit')  || '50', 10), 200);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0',  10), 0);

  const result = await query(QUERIES.listMessages, [access.practitionerId, clientId, limit, offset]);

  // Mark received messages as read
  await query(QUERIES.markThreadRead, [access.practitionerId, clientId, userId]).catch(() => {});

  trackEvent(env, 'message_read', { userId, practitionerId: access.practitionerId }).catch(() => {});

  return Response.json({ messages: result.rows });
}

/**
 * POST /api/practitioner/clients/:clientId/messages
 */
export async function handlePractitionerSendMessage(request, env, clientId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const log = request._log || createLogger(request._reqId || 'messages');

  const access = await getPractitionerAndAccess(query, userId, clientId);
  if (access.error) return access.error;

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const text = String(body.body || '').trim();
  if (!text)              return Response.json({ error: 'Message body is required' }, { status: 400 });
  if (text.length > BODY_MAX) return Response.json({ error: `Message exceeds ${BODY_MAX} character limit` }, { status: 400 });

  const result = await query(QUERIES.createMessage, [access.practitionerId, clientId, userId, text]);
  const message = result.rows[0];

  log.info({ action: 'message_sent', from: 'practitioner', practitionerId: access.practitionerId, clientId });
  trackEvent(env, 'message_sent', { userId, role: 'practitioner' }).catch(() => {});

  // Push notify the client
  notifyUser(env, clientId, 'New message from your practitioner', text.slice(0, 80) + (text.length > 80 ? '…' : ''));

  return Response.json({ ok: true, message }, { status: 201 });
}

// ── Client → Practitioner Messages ──────────────────────────

/**
 * GET /api/client/messages
 */
export async function handleClientListMessages(request, env) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  const result = await query(QUERIES.listClientMessages, [userId]);

  trackEvent(env, 'message_read', { userId, role: 'client' }).catch(() => {});

  return Response.json({ messages: result.rows });
}

/**
 * POST /api/client/messages
 * Body: { practitionerId: "uuid", body: "text" }
 */
export async function handleClientSendMessage(request, env) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const log = request._log || createLogger(request._reqId || 'messages');

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const practitionerId = String(body.practitionerId || '').trim();
  const text           = String(body.body || '').trim();

  if (!practitionerId) return Response.json({ error: 'practitionerId is required' }, { status: 400 });
  if (!text)           return Response.json({ error: 'Message body is required' }, { status: 400 });
  if (text.length > BODY_MAX) return Response.json({ error: `Message exceeds ${BODY_MAX} character limit` }, { status: 400 });

  // Verify this client is on the practitioner's roster
  const pUserResult = await query(QUERIES.getPractitionerUserIdByPractitionerId, [practitionerId]);
  if (pUserResult.rows.length === 0) {
    return Response.json({ error: 'Practitioner not found' }, { status: 404 });
  }
  const practitionerUserId = pUserResult.rows[0].user_id;

  const access = await query(QUERIES.checkPractitionerAccess, [practitionerUserId, userId]);
  if (access.rows.length === 0) {
    return Response.json({ error: 'Forbidden – you are not this practitioner\'s client' }, { status: 403 });
  }

  const result = await query(QUERIES.createMessage, [practitionerId, userId, userId, text]);
  const message = result.rows[0];

  log.info({ action: 'message_sent', from: 'client', practitionerId, clientId: userId });
  trackEvent(env, 'message_sent', { userId, role: 'client' }).catch(() => {});

  // Push notify the practitioner
  notifyUser(env, practitionerUserId, 'New message from a client', text.slice(0, 80) + (text.length > 80 ? '…' : ''));

  return Response.json({ ok: true, message }, { status: 201 });
}

// ── Mark Single Message Read ─────────────────────────────────

/**
 * PUT /api/messages/:id/read
 */
export async function handleMarkMessageRead(request, env, messageId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  const result = await query(QUERIES.markMessageRead, [messageId, userId]);
  if (result.rows.length === 0) {
    return Response.json({ error: 'Message not found or already read' }, { status: 404 });
  }

  return Response.json({ ok: true, message: result.rows[0] });
}

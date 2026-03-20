/**
 * Live Session handlers — GAP-008 Phase 1 MVP
 *
 * Routes:
 *   POST /api/live-session/invite/:clientId  – Practitioner creates session + invite link
 *   GET  /api/live-session/join/:token       – Client validates invite token
 *   GET  /api/live-session/connect/:sessionId – WebSocket upgrade → Durable Object
 *   POST /api/live-session/:sessionId/end   – End session + save transcript note to DB
 *
 * Auth model:
 *   - invite / join / connect / end all require a valid ps_access JWT (set by authenticate middleware)
 *   - connect also does inline JWT verification as a defence-in-depth check before WS upgrade
 *   - Practitioner identity is verified against the practitioners table for invite + end
 *   - Client identity is verified against practitioner_clients roster for invite
 */

import { createQueryFn, QUERIES } from '../db/queries.js';
import { verifyHS256, jwtClaims } from '../lib/jwt.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('live-session');

// ── Helper: read JWT payload from Cookie or Authorization header ──────────────
async function resolveUser(request, env) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookieMatch  = cookieHeader.match(/(?:^|;\s*)ps_access=([^;]+)/);
  let token;
  if (cookieMatch) {
    token = decodeURIComponent(cookieMatch[1]);
  } else {
    const auth = request.headers.get('Authorization') || '';
    if (auth.startsWith('Bearer ')) token = auth.slice(7);
  }
  if (!token) return null;
  try {
    const payload = await verifyHS256(token, env.JWT_SECRET, jwtClaims(env));
    return payload?.type === 'access' ? payload : null;
  } catch (_) {
    return null;
  }
}

// ── POST /api/live-session/invite/:clientId ───────────────────────────────────
/**
 * Practitioner creates a live session and generates a single-use client invite link.
 * Stores session metadata and invite token in KV with 8-hour TTL.
 * Returns { sessionId, clientJoinUrl }.
 */
export async function handleCreateInvite(request, env, clientId) {
  const user = request._user;
  if (!user?.sub) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  // Resolve practitioner record
  const practResult = await query(QUERIES.getPractitionerByUserId, [user.sub]);
  if (!practResult.rows[0]) {
    return Response.json({ error: 'Practitioner account required' }, { status: 403 });
  }
  const practitionerId = practResult.rows[0].id; // internal DB id

  // Verify the client is on this practitioner's roster
  const accessResult = await query(QUERIES.checkPractitionerAccess, [user.sub, clientId]);
  if (!accessResult.rows[0]) {
    return Response.json({ error: 'Client not found on your roster' }, { status: 403 });
  }

  const sessionId   = crypto.randomUUID();
  const clientToken = crypto.randomUUID();

  // KV: session metadata (practitioner + client IDs, status)
  const sessionData = JSON.stringify({
    practitionerUserId: user.sub,
    practitionerId,
    clientId,
    sessionId,
    createdAt: Date.now(),
  });

  // KV: single-use invite token for the client join link
  const tokenData = JSON.stringify({
    sessionId,
    practitionerUserId: user.sub,
    clientId,
  });

  const TTL = 28800; // 8 hours in seconds
  await env.CACHE.put(`live_session:${sessionId}`, sessionData, { expirationTtl: TTL });
  await env.CACHE.put(`live_invite:${clientToken}`,  tokenData,   { expirationTtl: TTL });

  const frontendUrl = env.FRONTEND_URL || 'https://selfprime.net';

  log.info({ action: 'live_session_created', sessionId, practitionerUserId: user.sub, clientId });

  return Response.json({
    sessionId,
    clientJoinUrl: `${frontendUrl}/live/${clientToken}`,
  });
}

// ── GET /api/live-session/join/:token ─────────────────────────────────────────
/**
 * Client validates their invite link token.
 * Verifies the requesting user matches the clientId stored in the token.
 * Returns { sessionId } so the frontend can open the WebSocket.
 */
export async function handleJoinSession(request, env, token) {
  const user = request._user;
  if (!user?.sub) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = await env.CACHE.get(`live_invite:${token}`);
  if (!raw) {
    return Response.json({ error: 'Invalid or expired invite link' }, { status: 404 });
  }

  const invite = JSON.parse(raw);

  if (invite.clientId !== user.sub) {
    log.warn({ action: 'live_invite_wrong_user', token: '[redacted]', userId: user.sub });
    return Response.json({ error: 'This invite link is not for your account' }, { status: 403 });
  }

  // Single-use: delete the invite token now that it has been consumed
  await env.CACHE.delete(`live_invite:${token}`);

  return Response.json({ sessionId: invite.sessionId });
}

// ── GET /api/live-session/connect/:sessionId (WebSocket upgrade) ──────────────
/**
 * Validates session + role, then proxies the WebSocket upgrade to the Durable Object.
 * Passes X-User-Id and X-User-Role headers so the DO knows who joined.
 *
 * Must be in PUBLIC_ROUTES (or excluded from AUTH_PREFIXES) because WS upgrade
 * requests must not be intercepted by the authentication middleware response path.
 * This handler performs its own JWT verification as defence-in-depth.
 */
export async function handleLiveSessionConnect(request, env, sessionId) {
  if (request.headers.get('Upgrade') !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 426 });
  }

  // Inline auth — defence-in-depth for WebSocket upgrade path
  const user = request._user ?? await resolveUser(request, env);
  if (!user?.sub) return new Response('Unauthorized', { status: 401 });

  const raw = await env.CACHE.get(`live_session:${sessionId}`);
  if (!raw) return new Response('Session not found or expired', { status: 404 });

  const session = JSON.parse(raw);

  let role;
  if (user.sub === session.practitionerUserId) {
    role = 'practitioner';
  } else if (user.sub === session.clientId) {
    role = 'client';
  } else {
    log.warn({ action: 'live_ws_unauthorized', userId: user.sub, sessionId });
    return new Response('Not authorized for this session', { status: 403 });
  }

  // Forward the upgrade request to the Durable Object with role metadata
  const doId  = env.LIVE_SESSION.idFromName(sessionId);
  const stub  = env.LIVE_SESSION.get(doId);

  // Build a new request with added headers — original headers are preserved
  const headers = new Headers(request.headers);
  headers.set('X-User-Id',   user.sub);
  headers.set('X-User-Role', role);

  const doRequest = new Request(request.url, {
    method:  request.method,
    headers,
    // No body for WS upgrade, but must not be set to avoid stream lock issues
  });

  log.info({ action: 'live_ws_connect', sessionId, userId: user.sub, role });
  return stub.fetch(doRequest);
}

// ── POST /api/live-session/:sessionId/end ────────────────────────────────────
/**
 * Practitioner ends the live session.
 * 1. Reads final note content from DO state.
 * 2. Broadcasts session_ended to all participants (DO closes all WebSockets).
 * 3. Saves non-empty note to practitioner_session_notes via existing createSessionNote query.
 * 4. Deletes session key from KV.
 *
 * Returns { ok: true, noteSaved: boolean }.
 */
export async function handleEndSession(request, env, sessionId) {
  const user = request._user;
  if (!user?.sub) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = await env.CACHE.get(`live_session:${sessionId}`);
  if (!raw) return Response.json({ error: 'Session not found' }, { status: 404 });

  const session = JSON.parse(raw);
  if (session.practitionerUserId !== user.sub) {
    return Response.json({ error: 'Only the practitioner can end the session' }, { status: 403 });
  }

  const doId = env.LIVE_SESSION.idFromName(sessionId);
  const stub = env.LIVE_SESSION.get(doId);

  // Read final state from DO (note content accumulated via note_update messages)
  const stateRes = await stub.fetch(new Request('https://do-internal/state'));
  const { noteContent } = await stateRes.json();

  // Tell DO to broadcast session_ended and close all WebSockets
  await stub.fetch(new Request('https://do-internal/broadcast', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ type: 'session_ended', noteSaved: !!noteContent?.trim() }),
  }));

  // Persist note to DB
  let noteSaved = false;
  if (noteContent && noteContent.trim()) {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const practResult = await query(QUERIES.getPractitionerByUserId, [user.sub]);
    if (practResult.rows[0]) {
      const today = new Date().toISOString().split('T')[0];
      await query(QUERIES.createSessionNote, [
        practResult.rows[0].id,   // practitioner_id
        session.clientId,          // client_user_id
        noteContent,               // content
        true,                      // share_with_ai
        null,                      // transit_snapshot
        today,                     // session_date
      ]);
      noteSaved = true;
    }
  }

  // Clean up KV
  await env.CACHE.delete(`live_session:${sessionId}`);

  log.info({ action: 'live_session_ended', sessionId, practitionerUserId: user.sub, noteSaved });
  return Response.json({ ok: true, noteSaved });
}

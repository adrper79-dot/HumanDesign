/**
 * Admin Handler — Internal Operations Dashboard
 *
 * All routes gated by X-Admin-Token header matching ADMIN_TOKEN env var.
 * Uses constant-time comparison to prevent timing side-channel attacks.
 *
 * Routes:
 *   GET  /api/admin/stats              — Overview stats (users, charts, subscriptions)
 *   GET  /api/admin/users?email=&limit=&offset= — List/search users
 *   GET  /api/admin/users/:id          — Get a specific user
 *   PATCH /api/admin/users/:id/tier    — Set user tier
 *   PATCH /api/admin/users/:id/verify  — Set email_verified
 *   GET  /api/admin/promo              — List all promo codes (re-exported from promo.js)
 *   POST /api/admin/promo              — Create promo code (re-exported from promo.js)
 *   PATCH /api/admin/promo/:id/deactivate — Deactivate a promo code
 */

import { createQueryFn, QUERIES } from '../db/queries.js';

// ─── Admin Auth Guard ─────────────────────────────────────────

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function requireAdmin(request, env) {
  const token = env.ADMIN_TOKEN;
  if (!token) return Response.json({ error: 'Admin not configured' }, { status: 503 });
  const provided = request.headers.get('X-Admin-Token') || '';
  if (!provided || !constantTimeEqual(provided, token)) {
    console.warn(JSON.stringify({
      event: 'admin_auth_fail',
      ip: request.headers.get('CF-Connecting-IP') || 'unknown',
      path: new URL(request.url).pathname,
    }));
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null; // Authorized
}

const VALID_TIERS = ['free', 'individual', 'practitioner', 'agency'];

// ─── Route Dispatcher ─────────────────────────────────────────

export async function handleAdmin(request, env, subpath) {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const method = request.method;

  // GET /api/admin/stats
  if (method === 'GET' && subpath === '/stats') {
    return getStats(env);
  }

  // GET /api/admin/users
  if (method === 'GET' && (subpath === '/users' || subpath === '/users/')) {
    return listUsers(request, env);
  }

  // GET /api/admin/users/:id
  const userMatch = subpath.match(/^\/users\/([^/]+)$/);
  if (method === 'GET' && userMatch) {
    return getUser(env, userMatch[1]);
  }

  // PATCH /api/admin/users/:id/tier
  const tierMatch = subpath.match(/^\/users\/([^/]+)\/tier$/);
  if (method === 'PATCH' && tierMatch) {
    return setUserTier(request, env, tierMatch[1]);
  }

  // PATCH /api/admin/users/:id/verify
  const verifyMatch = subpath.match(/^\/users\/([^/]+)\/verify$/);
  if (method === 'PATCH' && verifyMatch) {
    return setEmailVerified(request, env, verifyMatch[1]);
  }

  // PATCH /api/admin/promo/:id/deactivate
  const promoMatch = subpath.match(/^\/promo\/([^/]+)\/deactivate$/);
  if (method === 'PATCH' && promoMatch) {
    return deactivatePromo(env, promoMatch[1]);
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

// ─── Handlers ────────────────────────────────────────────────

async function getStats(env) {
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const { rows } = await query(QUERIES.adminGetOverviewStats);
  return Response.json({ ok: true, stats: rows[0] });
}

async function listUsers(request, env) {
  const url = new URL(request.url);
  const email = url.searchParams.get('email') || null;
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  if (isNaN(limit) || limit < 1 || isNaN(offset) || offset < 0) {
    return Response.json({ error: 'Invalid pagination params' }, { status: 400 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const [{ rows: users }, { rows: countRows }] = await Promise.all([
    query(QUERIES.adminListUsers, [email, limit, offset]),
    query(QUERIES.adminCountUsers, [email]),
  ]);

  return Response.json({
    ok: true,
    users,
    total: parseInt(countRows[0]?.total || '0', 10),
    limit,
    offset,
  });
}

async function getUser(env, userId) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return Response.json({ error: 'Invalid user ID format' }, { status: 400 });
  }
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const { rows } = await query(QUERIES.adminGetUser, [userId]);
  if (!rows.length) return Response.json({ error: 'User not found' }, { status: 404 });
  return Response.json({ ok: true, user: rows[0] });
}

async function setUserTier(request, env, userId) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return Response.json({ error: 'Invalid user ID format' }, { status: 400 });
  }

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { tier } = body;
  if (!tier || !VALID_TIERS.includes(tier)) {
    return Response.json({ error: `tier must be one of: ${VALID_TIERS.join(', ')}` }, { status: 400 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const { rows } = await query(QUERIES.adminSetTier, [tier, userId]);
  if (!rows.length) return Response.json({ error: 'User not found' }, { status: 404 });
  return Response.json({ ok: true, user: rows[0] });
}

async function setEmailVerified(request, env, userId) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return Response.json({ error: 'Invalid user ID format' }, { status: 400 });
  }

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const verified = body?.verified !== false; // default true
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const { rows } = await query(QUERIES.adminSetEmailVerified, [verified, userId]);
  if (!rows.length) return Response.json({ error: 'User not found' }, { status: 404 });
  return Response.json({ ok: true, user: rows[0] });
}

async function deactivatePromo(env, promoId) {
  if (!/^[0-9a-f-]{36}$/i.test(promoId)) {
    return Response.json({ error: 'Invalid promo ID format' }, { status: 400 });
  }
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const { rows } = await query(QUERIES.adminDeactivatePromo, [promoId]);
  if (!rows.length) return Response.json({ error: 'Promo code not found' }, { status: 404 });
  return Response.json({ ok: true, promo: rows[0] });
}

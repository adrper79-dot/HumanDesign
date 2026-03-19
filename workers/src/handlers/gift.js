/**
 * Gift-a-Reading Endpoints (item 4.6)
 *
 * Routes:
 *   POST /api/practitioner/gifts          — Practitioner creates a gift token
 *   GET  /api/gift/:token                 — Public: view gift details
 *   POST /api/gift/:token/redeem          — Authenticated recipient redeems gift
 */

import { createQueryFn, QUERIES } from '../db/queries.js';
import { trackEvent } from '../lib/analytics.js';
import { reportHandledRouteError } from '../lib/routeErrors.js';

/** Generate a URL-safe random token (32 bytes → ~43 base64url chars) */
function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let b64 = '';
  for (let i = 0; i < bytes.length; i++) b64 += String.fromCharCode(bytes[i]);
  return btoa(b64).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const TOKEN_RE = /^[A-Za-z0-9_-]{20,60}$/;

/**
 * POST /api/practitioner/gifts
 * Body: { message?: string }
 */
export async function handleCreateGift(request, env) {
  const userId = request._user?.sub;
  if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  let message = null;
  try {
    const body = await request.json().catch(() => ({}));
    message = typeof body?.message === 'string' ? body.message.slice(0, 500) : null;
  } catch { /* ignore */ }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Resolve practitioner record
    const practResult = await query(QUERIES.getPractitionerByUserId, [userId]);
    const pract = practResult.rows?.[0];
    if (!pract) {
      return new Response(JSON.stringify({ error: 'Practitioner profile not found' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    const token = generateToken();
    const result = await query(QUERIES.createGiftToken, [token, pract.id, message]);
    const gift = result.rows?.[0];

    trackEvent(env, 'gift_created', { practitioner_id: pract.id });

    const giftUrl = new URL(request.url);
    giftUrl.pathname = '/';
    giftUrl.search = `?gift=${token}`;

    return new Response(JSON.stringify({
      token: gift.token,
      giftUrl: giftUrl.toString(),
      expiresAt: gift.expires_at,
      createdAt: gift.created_at,
    }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    reportHandledRouteError(err, 'handleCreateGift');
    return new Response(JSON.stringify({ error: 'Failed to create gift' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

/**
 * GET /api/gift/:token
 * Public — returns gift details so recipient can preview before redeeming.
 */
export async function handleGetGift(request, env, token) {
  if (!TOKEN_RE.test(token)) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const result = await query(QUERIES.getGiftToken, [token]);
    const gift = result.rows?.[0];
    if (!gift) {
      return new Response(JSON.stringify({ error: 'Gift not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    const expired = gift.expires_at && new Date(gift.expires_at) < new Date();
    return new Response(JSON.stringify({
      token: gift.token,
      message: gift.message,
      practitionerName: gift.practitioner_name,
      practitionerSlug: gift.practitioner_slug,
      practitionerPhoto: gift.practitioner_photo,
      practitionerBio: gift.practitioner_bio,
      redeemedAt: gift.redeemed_at,
      expiresAt: gift.expires_at,
      expired,
    }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch (err) {
    reportHandledRouteError(err, 'handleGetGift');
    return new Response(JSON.stringify({ error: 'Failed to load gift' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

/**
 * POST /api/gift/:token/redeem
 * Auth required — recipient must be logged in.
 */
export async function handleRedeemGift(request, env, token) {
  const userId = request._user?.sub;
  if (!userId) {
    return new Response(JSON.stringify({ error: 'You must be logged in to redeem a gift' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  if (!TOKEN_RE.test(token)) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const result = await query(QUERIES.redeemGiftToken, [token, userId]);
    const redeemed = result.rows?.[0];
    if (!redeemed) {
      return new Response(JSON.stringify({ error: 'Gift already redeemed, expired, or not found' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }
    trackEvent(env, 'gift_redeemed', { token });
    return new Response(JSON.stringify({ ok: true, redeemedAt: redeemed.redeemed_at }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    reportHandledRouteError(err, 'handleRedeemGift');
    return new Response(JSON.stringify({ error: 'Failed to redeem gift' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

/**
 * GET /api/practitioner/gifts
 * Lists all gifts created by the authenticated practitioner.
 */
export async function handleListGifts(request, env) {
  const userId = request._user?.sub;
  if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const practResult = await query(QUERIES.getPractitionerByUserId, [userId]);
    const pract = practResult.rows?.[0];
    if (!pract) {
      return new Response(JSON.stringify({ gifts: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const result = await query(QUERIES.listPractitionerGifts, [pract.id]);
    return new Response(JSON.stringify({ gifts: result.rows ?? [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    reportHandledRouteError(err, 'handleListGifts');
    return new Response(JSON.stringify({ error: 'Failed to load gifts' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

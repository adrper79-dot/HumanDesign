/**
 * Agency Seat Management Handler
 *
 * Allows Agency-tier users to invite up to 5 practitioner sub-accounts (seats).
 * Seat members inherit practitioner-level tier capabilities while they belong
 * to the agency (tier propagation is handled in tierEnforcement.js).
 *
 * Endpoints (all require auth; Agency tier required for mutation endpoints):
 *   GET    /api/agency/seats              – List current seats
 *   POST   /api/agency/seats/invite       – Invite a user by email (max 5)
 *   DELETE /api/agency/seats/:memberId    – Remove a seat member
 *
 * HD_UPDATES3: "Up to 5 practitioner seats (sub-accounts)" for Agency tier ($349/mo)
 */

import { createQueryFn, QUERIES } from '../db/queries.js';
import { enforceFeatureAccess } from '../middleware/tierEnforcement.js';

const MAX_SEATS = 5;

export async function handleAgency(request, env, subpath) {
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const method = request.method;
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  try {
    // GET /api/agency/seats — list seats (read-only, any authenticated user can check their seats)
    if (subpath === '/seats' && method === 'GET') {
      return handleListSeats(userId, query);
    }

    // Mutation endpoints require Agency tier
    if (subpath === '/seats/invite' && method === 'POST') {
      const accessCheck = await enforceFeatureAccess(request, env, 'agencySeats');
      if (accessCheck) return accessCheck;
      return handleInviteSeat(request, userId, query);
    }

    // DELETE /api/agency/seats/:memberId
    const removeMatch = subpath.match(/^\/seats\/([a-f0-9-]+)$/i);
    if (removeMatch && method === 'DELETE') {
      const accessCheck = await enforceFeatureAccess(request, env, 'agencySeats');
      if (accessCheck) return accessCheck;
      return handleRemoveSeat(userId, removeMatch[1], query);
    }

    return Response.json({ error: 'Not Found' }, { status: 404 });
  } catch (err) {
    console.error('[agency] Unhandled error:', err.message);
    return Response.json({ error: 'Service temporarily unavailable' }, { status: 500 });
  }
}

async function handleListSeats(userId, query) {
  const result = await query(QUERIES.getAgencySeats, [userId]);
  return Response.json({
    ok: true,
    seats: result.rows || [],
    count: result.rows?.length || 0,
    limit: MAX_SEATS
  });
}

async function handleInviteSeat(request, userId, query) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = (body.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Valid email address is required' }, { status: 400 });
  }

  // Enforce seat count limit
  const countResult = await query(QUERIES.countAgencySeats, [userId]);
  const currentCount = parseInt(countResult.rows?.[0]?.count || '0');
  if (currentCount >= MAX_SEATS) {
    return Response.json({
      error: `Agency plan allows up to ${MAX_SEATS} seats. Remove a seat member first.`,
      seat_limit: MAX_SEATS,
      current_count: currentCount
    }, { status: 409 });
  }

  // Prevent owner from adding themselves
  const ownerLookup = await query(QUERIES.getUserByEmailSafe, [email]);
  if (!ownerLookup.rows?.length) {
    return Response.json({
      error: 'No account found with that email address. The user must sign up first.'
    }, { status: 404 });
  }

  const member = ownerLookup.rows[0];
  if (member.id === userId) {
    return Response.json({ error: 'You cannot add yourself as a seat member' }, { status: 400 });
  }

  const result = await query(QUERIES.addAgencySeat, [userId, member.id, email]);
  if (!result.rows?.length) {
    // ON CONFLICT — this user is already a seat of another agency
    return Response.json({
      error: 'This user already belongs to an agency. They must leave their current agency first.'
    }, { status: 409 });
  }

  return Response.json({
    ok: true,
    seat: result.rows[0],
    message: `${email} has been added as an agency seat member.`
  }, { status: 201 });
}

async function handleRemoveSeat(userId, memberId, query) {
  const result = await query(QUERIES.removeAgencySeat, [userId, memberId]);
  if (!result.rows?.length) {
    return Response.json({ error: 'Seat not found or already removed' }, { status: 404 });
  }
  return Response.json({ ok: true, message: 'Seat member removed.' });
}

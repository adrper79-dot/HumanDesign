/**
 * Client Portal — Reverse view of practitioner–client relationship
 *
 * Lets authenticated clients see:
 *   - Which practitioners have them on their roster
 *   - Their own chart/profile data as shared by a specific practitioner
 *   - Session notes that practitioners have marked as visible to client
 *
 * Routes (all require auth):
 *   GET /api/client/my-practitioners        — List practitioners who have this user as a client
 *   GET /api/client/portal/:practitionerId  — Portal view for a specific practitioner relationship
 *   GET /api/client/shared-notes            — Notes shared with this client (share_with_client=true)
 */

import { createQueryFn, QUERIES } from '../db/queries.js';
import { createLogger } from '../lib/logger.js';
import { trackEvent } from '../lib/analytics.js';

// ─── My Practitioners ─────────────────────────────────────────

/**
 * GET /api/client/my-practitioners
 * Returns all practitioners who have this user as a client.
 */
export async function handleGetClientPractitioners(request, env) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const log = request._log || createLogger(request._reqId || 'client-portal');

  try {
    const result = await query(QUERIES.getClientPractitioners, [userId]);

    log.info({ action: 'client_practitioners_listed', userId, count: result.rows.length });
    trackEvent(env, 'client_portal_practitioners_viewed', { userId }).catch(() => {});

    return Response.json({ ok: true, practitioners: result.rows });
  } catch (err) {
    log.error({ action: 'client_practitioners_list_failed', error: err.message });
    throw err;
  }
}

// ─── Practitioner Portal View ─────────────────────────────────

/**
 * GET /api/client/portal/:practitionerId
 * Returns the client's own data in context of a specific practitioner relationship:
 *   - Practitioner info (name, specializations)
 *   - Client's latest chart & profile
 *   - Shared session notes (where share_with_client = true)
 *   - AI context the practitioner has set for them
 */
export async function handleGetClientPortal(request, env, practitionerId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const log = request._log || createLogger(request._reqId || 'client-portal');

  // Verify this client is on the practitioner's roster
  const access = await query(QUERIES.checkClientPractitionerAccess, [userId, practitionerId]);
  if (access.rows.length === 0) {
    return Response.json({ error: 'You are not a client of this practitioner' }, { status: 403 });
  }

  try {
    // Parallel fetch: practitioner info, client's chart, profile, shared notes
    const [practInfo, chartResult, profileResult, sharedNotes] = await Promise.all([
      query(QUERIES.getClientPractitionerInfo, [practitionerId]),
      query(QUERIES.getLatestChart, [userId]),
      query(QUERIES.getLatestProfile, [userId]),
      query(QUERIES.getClientSharedNotes, [practitionerId, userId]),
    ]);

    const prac = practInfo.rows[0] || null;
    const chart = chartResult.rows[0] || null;
    const profile = profileResult.rows[0] || null;

    log.info({ action: 'client_portal_viewed', userId, practitionerId });
    trackEvent(env, 'client_portal_viewed', { userId, properties: { practitionerId } }).catch(() => {});

    return Response.json({
      ok: true,
      practitioner: prac ? {
        id: prac.id,
        display_name: prac.display_name,
        photo_url: prac.photo_url,
        specializations: prac.specializations,
        bio: prac.bio,
        session_format: prac.session_format,
        booking_url: prac.booking_url,
      } : null,
      chart: chart ? {
        id: chart.id,
        calculatedAt: chart.calculated_at,
      } : null,
      profile: profile ? {
        id: profile.id,
        createdAt: profile.created_at,
      } : null,
      sharedNotes: sharedNotes.rows.map(n => ({
        id: n.id,
        content: n.content,
        session_date: n.session_date,
        created_at: n.created_at,
      })),
    });
  } catch (err) {
    log.error({ action: 'client_portal_view_failed', error: err.message });
    throw err;
  }
}

// ─── Shared Notes ─────────────────────────────────────────────

/**
 * GET /api/client/shared-notes
 * Returns all session notes shared with this client across all practitioners.
 * Supports pagination via limit/offset query params.
 */
export async function handleGetClientSharedNotes(request, env) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const log = request._log || createLogger(request._reqId || 'client-portal');

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  try {
    const [notes, countResult] = await Promise.all([
      query(QUERIES.getAllClientSharedNotes, [userId, limit, offset]),
      query(QUERIES.countAllClientSharedNotes, [userId]),
    ]);

    const total = countResult.rows[0]?.total ?? 0;
    const hasMore = offset + notes.rows.length < total;

    log.info({ action: 'client_shared_notes_listed', userId, total });
    trackEvent(env, 'client_shared_notes_viewed', { userId }).catch(() => {});

    return Response.json({
      ok: true,
      notes: notes.rows.map(n => ({
        id: n.id,
        practitioner_name: n.display_name,
        content: n.content,
        session_date: n.session_date,
        created_at: n.created_at,
      })),
      total,
      hasMore,
    });
  } catch (err) {
    log.error({ action: 'client_shared_notes_list_failed', error: err.message });
    throw err;
  }
}

// ─── Diary Sharing Preferences ─────────────────────────────────

/**
 * GET /api/client/diary-sharing
 * Returns diary sharing status for each practitioner relationship.
 */
export async function handleGetDiarySharingPrefs(request, env) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const result = await query(QUERIES.getMyDiarySharingPreferences, [userId]);

  return Response.json({
    ok: true,
    data: result.rows.map(r => ({
      practitioner_user_id: r.practitioner_user_id,
      practitioner_name: r.practitioner_name,
      share_diary: r.share_diary,
    })),
  });
}

/**
 * PUT /api/client/diary-sharing
 * Toggle diary sharing for a specific practitioner.
 * Body: { practitioner_user_id, share_diary: boolean }
 */
export async function handleSetDiarySharing(request, env) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.share_diary !== 'boolean' || !body.practitioner_user_id) {
    return Response.json({ error: 'practitioner_user_id and share_diary (boolean) required' }, { status: 400 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  await query(QUERIES.setMyDiarySharing, [userId, body.share_diary, body.practitioner_user_id]);

  trackEvent(env, 'diary_sharing_toggled', { userId, share: body.share_diary }).catch(() => {});

  return Response.json({ ok: true, share_diary: body.share_diary });
}

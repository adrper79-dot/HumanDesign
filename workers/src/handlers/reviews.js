/**
 * Practitioner Reviews Handler
 * Client-submitted, practitioner-approved testimonials for directory profiles.
 *
 * Endpoints:
 * - POST /api/client/reviews                         — client submits a review
 * - GET  /api/directory/:slug/reviews                — public: approved reviews for profile
 * - GET  /api/practitioner/reviews                   — practitioner views all their reviews
 * - PUT  /api/practitioner/reviews/:id/approve       — approve a review
 * - PUT  /api/practitioner/reviews/:id/hide          — hide a review
 */

import { createQueryFn, QUERIES } from '../db/queries.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('reviews');

const MAX_CONTENT_LENGTH = 2000;
const MIN_CONTENT_LENGTH = 10;

export async function handleSubmitReview(request, env) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { practitioner_id, rating, content } = body;
  if (!practitioner_id) return Response.json({ ok: false, error: 'practitioner_id is required' }, { status: 400 });
  if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return Response.json({ ok: false, error: 'Rating must be an integer between 1 and 5' }, { status: 400 });
  }
  if (!content || content.trim().length < MIN_CONTENT_LENGTH) {
    return Response.json({ ok: false, error: `Review must be at least ${MIN_CONTENT_LENGTH} characters` }, { status: 400 });
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return Response.json({ ok: false, error: `Review exceeds ${MAX_CONTENT_LENGTH} characters` }, { status: 400 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  // Verify client is on the practitioner's roster
  const { rows: accessRows } = await query(QUERIES.checkClientPractitionerAccess, [userId, practitioner_id]);
  if (!accessRows[0]) {
    return Response.json({ ok: false, error: 'You are not a client of this practitioner' }, { status: 403 });
  }

  try {
    const { rows } = await query(QUERIES.createReview, [practitioner_id, userId, rating, content.trim()]);
    log.info('review_submitted', { practitionerId: practitioner_id, clientUserId: userId });
    return Response.json({ ok: true, review: rows[0] }, { status: 201 });
  } catch (e) {
    if (e.message?.includes('unique') || e.code === '23505') {
      return Response.json({ ok: false, error: 'You have already reviewed this practitioner' }, { status: 409 });
    }
    throw e;
  }
}

export async function handleGetPublicReviews(request, env, slug) {
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return Response.json({ ok: false, error: 'Invalid slug' }, { status: 400 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const { rows } = await query(QUERIES.listApprovedReviews, [slug]);

  return Response.json({ ok: true, reviews: rows });
}

export async function handleListPractitionerReviews(request, env) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const { rows: pracRows } = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (!pracRows[0]) return Response.json({ ok: false, error: 'Not a practitioner' }, { status: 403 });

  const { rows } = await query(QUERIES.listPractitionerReviews, [pracRows[0].id]);
  return Response.json({ ok: true, reviews: rows });
}

export async function handleApproveReview(request, env, reviewId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const { rows: pracRows } = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (!pracRows[0]) return Response.json({ ok: false, error: 'Access denied' }, { status: 403 });

  const { rows } = await query(QUERIES.approveReview, [reviewId, pracRows[0].id]);
  if (!rows[0]) return Response.json({ ok: false, error: 'Review not found' }, { status: 404 });

  log.info('review_approved', { reviewId, practitionerId: pracRows[0].id });
  return Response.json({ ok: true, review: rows[0] });
}

export async function handleHideReview(request, env, reviewId) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const { rows: pracRows } = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (!pracRows[0]) return Response.json({ ok: false, error: 'Access denied' }, { status: 403 });

  const { rows } = await query(QUERIES.hideReview, [reviewId, pracRows[0].id]);
  if (!rows[0]) return Response.json({ ok: false, error: 'Review not found' }, { status: 404 });

  log.info('review_hidden', { reviewId, practitionerId: pracRows[0].id });
  return Response.json({ ok: true, review: rows[0] });
}

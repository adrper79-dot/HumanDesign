/**
 * Practitioner Directory — Public Profiles & Search
 *
 * HD_UPDATES4: The directory closes the practitioner flywheel.
 * Public routes (no auth):
 *   GET /api/directory                — List public practitioners (filterable)
 *   GET /api/directory/:slug          — Get single public profile
 *
 * Authenticated routes:
 *   GET  /api/practitioner/directory-profile — Get own directory settings
 *   PUT  /api/practitioner/directory-profile — Update own directory settings
 */

import { createQueryFn, QUERIES } from '../db/queries.js';

// ─── Slug generation ─────────────────────────────────────────

function generateSlug(displayName) {
  return displayName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
}

const VALID_SPECIALIZATIONS = new Set([
  'Generators', 'Manifesting Generators', 'Projectors', 'Manifestors', 'Reflectors',
  'Relationships', 'Business', 'Parenting', 'Career', 'Health',
  'Trauma-Informed', 'Gene Keys', 'Children', 'Leadership',
]);

const VALID_CERTIFICATIONS = new Set([
  'IHDS', 'Jovian Archive', 'Self-Certified', 'Other', '',
]);

const VALID_SESSION_FORMATS = new Set([
  'Remote', 'In-person', 'Both',
]);

// ─── Public endpoints ────────────────────────────────────────

/**
 * GET /api/directory?specialty=&certification=&language=&format=&limit=&offset=
 */
export async function handleListDirectory(request, env) {
  const url = new URL(request.url);
  const specialty     = url.searchParams.get('specialty') || null;
  const certification = url.searchParams.get('certification') || null;
  const language      = url.searchParams.get('language') || null;
  const format        = url.searchParams.get('format') || null;
  const limit  = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  const hasFilters = specialty || certification || language || format;

  const result = hasFilters
    ? await query(QUERIES.searchPublicPractitioners, [
        specialty, certification, language, format, limit, offset
      ])
    : await query(QUERIES.listPublicPractitioners, [limit, offset]);

  return Response.json({
    ok: true,
    practitioners: result.rows.map(sanitizePublicProfile),
    pagination: { limit, offset, count: result.rows.length }
  });
}

/**
 * GET /api/directory/:slug
 */
export async function handleGetPublicProfile(request, env, slug) {
  if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
    return Response.json({ error: 'Invalid practitioner slug' }, { status: 400 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const result = await query(QUERIES.getPractitionerBySlug, [slug]);

  if (result.rows.length === 0) {
    return Response.json({ error: 'Practitioner not found' }, { status: 404 });
  }

  return Response.json({ ok: true, practitioner: sanitizePublicProfile(result.rows[0]) });
}

// ─── Authenticated endpoints ─────────────────────────────────

/**
 * GET /api/practitioner/directory-profile — own settings
 */
export async function handleGetDirectoryProfile(request, env) {
  const userId = request._user.sub;
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const result = await query(QUERIES.getPractitionerDirectoryProfile, [userId]);

  if (result.rows.length === 0) {
    return Response.json({ error: 'Not registered as practitioner' }, { status: 404 });
  }

  return Response.json({ ok: true, profile: result.rows[0] });
}

/**
 * PUT /api/practitioner/directory-profile — update own directory settings
 */
export async function handleUpdateDirectoryProfile(request, env) {
  const userId = request._user.sub;
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  // Get practitioner record
  const practResult = await query(QUERIES.getPractitionerDirectoryProfile, [userId]);
  if (practResult.rows.length === 0) {
    return Response.json({ error: 'Not registered as practitioner' }, { status: 404 });
  }
  const practitioner = practResult.rows[0];

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Validate and sanitize inputs
  const isPublic = body.is_public === true;
  const displayName = String(body.display_name || '').trim().substring(0, 150);
  const slug = body.slug
    ? generateSlug(String(body.slug))
    : generateSlug(displayName || 'practitioner');
  const photoUrl = String(body.photo_url || '').trim().substring(0, 500);
  const bio = String(body.bio || '').trim().substring(0, 250);

  // Sanitize specializations — only allow known values
  const specializations = Array.isArray(body.specializations)
    ? body.specializations.filter(s => VALID_SPECIALIZATIONS.has(s)).slice(0, 10)
    : [];

  const certification = VALID_CERTIFICATIONS.has(body.certification)
    ? body.certification
    : '';

  const languages = Array.isArray(body.languages)
    ? body.languages.map(l => String(l).trim().substring(0, 50)).filter(Boolean).slice(0, 10)
    : ['English'];

  const sessionFormat = VALID_SESSION_FORMATS.has(body.session_format)
    ? body.session_format
    : 'Remote';

  const sessionInfo = String(body.session_info || '').trim().substring(0, 200);

  // Validate booking URL
  let bookingUrl = '';
  if (body.booking_url) {
    try {
      const parsed = new URL(String(body.booking_url));
      if (parsed.protocol === 'https:') bookingUrl = parsed.href;
    } catch { /* invalid URL — leave blank */ }
  }

  // Payment links — display-only fields (HD_UPDATES4: do NOT process payments)
  const paymentLinks = {};
  const allowedLinkKeys = ['venmo', 'cashapp', 'paypal', 'stripe', 'website'];
  if (body.payment_links && typeof body.payment_links === 'object') {
    for (const key of allowedLinkKeys) {
      if (body.payment_links[key]) {
        paymentLinks[key] = String(body.payment_links[key]).trim().substring(0, 200);
      }
    }
  }

  // Synthesis style — constrained text, not raw prompt (HD_UPDATES4 Vector 2)
  const synthesisStyle = String(body.synthesis_style || '').trim().substring(0, 250);

  const updated = await query(QUERIES.updatePractitionerProfile, [
    practitioner.id,
    isPublic,
    slug,
    displayName,
    photoUrl,
    bio,
    specializations,
    certification,
    languages,
    sessionFormat,
    sessionInfo,
    bookingUrl,
    JSON.stringify(paymentLinks),
    synthesisStyle,
  ]);

  return Response.json({ ok: true, profile: updated.rows[0] });
}

// ─── Helpers ─────────────────────────────────────────────────

function sanitizePublicProfile(row) {
  return {
    slug: row.slug,
    display_name: row.display_name,
    photo_url: row.photo_url,
    bio: row.bio,
    specializations: row.specializations,
    certification: row.certification,
    languages: row.languages,
    session_format: row.session_format,
    session_info: row.session_info,
    booking_url: row.booking_url,
    payment_links: row.payment_links,
    client_count: parseInt(row.client_count || '0', 10),
  };
}

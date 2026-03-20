/**
 * Practitioner Dashboard Endpoints
 *
 * Routes (all require authentication):
 *   POST /api/practitioner/register        — Register as practitioner
 *   GET  /api/practitioner/profile         — Get own practitioner profile
 *   GET  /api/practitioner/session-templates — List all session note templates
 *   GET  /api/practitioner/session-templates/:templateId — Get template by ID
 *   POST /api/practitioner/session-templates/:templateId/hydrate — Hydrate template with client data
 *   GET  /api/practitioner/clients         — List all clients
 *   POST /api/practitioner/clients/add     — Add a client by email
 *   POST /api/practitioner/clients/invite  — Invite or add client by email
 *   GET  /api/practitioner/clients/invitations — List pending invitations
 *   POST /api/practitioner/clients/invitations/:id/resend — Resend invitation
 *   DELETE /api/practitioner/clients/invitations/:id — Revoke invitation
 *   GET  /api/practitioner/clients/:id     — Get a specific client's chart + profiles
 *   DELETE /api/practitioner/clients/:id  — Remove client from roster
 *   POST /api/practitioner/clients/:id/session-brief — Generate AI session brief
 *
 * Tier definitions:
 *   free          — Basic access, no client management (0 clients)
 *   regular       — Up to 5 clients
 *   practitioner  — Up to 50 clients
 *   white_label   — Unlimited clients
 */

import { createQueryFn, QUERIES } from '../db/queries.js';
import { enforceFeatureAccess } from '../middleware/tierEnforcement.js';
import { sendPractitionerInvitationEmail, sendClientReminder as sendClientReminderEmail } from '../lib/email.js';
import { reportHandledRouteError } from '../lib/routeErrors.js';
import { callLLM } from '../lib/llm.js';
import { trackEvent, trackFunnel, EVENTS, FUNNELS } from '../lib/analytics.js';
import { handleListSessionTemplates, handleGetSessionTemplate, handleHydrateTemplate } from './session-templates.js';
import { handleGetPractitionerProfileSSR, handleGetPractitionerProfileJSON } from './practitioner-profile.js';

// Tier limits aligned with billing tier names (individual/practitioner/agency)
const TIER_LIMITS = {
  free: 0,
  individual: 0,          // Individual tier has no client management
  practitioner: Infinity,  // HD_UPDATES3: unlimited invites
  agency: Infinity,
  // Legacy aliases — kept for users whose tier was set before rename
  regular: 0,
  seeker: 0,
  white_label: Infinity,
  guide: Infinity,
};

function parseJsonSafe(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function makeInviteToken(bytes = 32) {
  const randomBytes = new Uint8Array(bytes);
  crypto.getRandomValues(randomBytes);
  let binary = '';
  for (let i = 0; i < randomBytes.length; i += 1) {
    binary += String.fromCharCode(randomBytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Hex(input) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function getInvitationByToken(query, rawToken) {
  const token = String(rawToken || '').trim();
  if (!token || token.length < 16 || token.length > 256) {
    return null;
  }

  const tokenHash = await sha256Hex(token);
  const result = await query(QUERIES.getPractitionerInvitationByTokenHash, [tokenHash]);
  return result.rows?.[0] || null;
}

export async function handlePractitioner(request, env, subpath) {
  const method = request.method;

  // ─── PUBLIC ROUTES (no authentication required) ───
  // GET /api/practitioner/:username/profile (SSR with OG tags)
  const srrProfileMatch = subpath.match(/^\/([a-zA-Z0-9_]+)\/profile$/i);
  if (srrProfileMatch && method === 'GET') {
    return await handleGetPractitionerProfileSSR(request, env, srrProfileMatch[1]);
  }

  // GET /api/practitioner/:username/profile.json
  const jsonProfileMatch = subpath.match(/^\/([a-zA-Z0-9_]+)\/profile\.json$/i);
  if (jsonProfileMatch && method === 'GET') {
    return await handleGetPractitionerProfileJSON(request, env, jsonProfileMatch[1]);
  }

  // ─── ALL OTHER ROUTES REQUIRE AUTHENTICATION ───
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    // Enforce practitioner tools feature access (except for /register endpoint)
    if (subpath !== '/register') {
      const featureCheck = await enforceFeatureAccess(request, env, 'practitionerTools');
      if (featureCheck) return featureCheck;
    }

    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // POST /api/practitioner/register
    if (subpath === '/register' && method === 'POST') {
      return await handleRegister(request, env, userId, query);
    }

    // GET /api/practitioner/profile
    if (subpath === '/profile' && method === 'GET') {
      return await handleGetProfile(userId, query);
    }

    // GET /api/practitioner/session-templates
    if (subpath === '/session-templates' && method === 'GET') {
      return await handleListSessionTemplates(request);
    }

    // POST /api/practitioner/session-templates/:templateId/hydrate
    const hydrateMatch = subpath.match(/^\/session-templates\/([a-z_]+)\/hydrate$/i);
    if (hydrateMatch && method === 'POST') {
      return await handleHydrateTemplate(request, env, hydrateMatch[1]);
    }

    // GET /api/practitioner/session-templates/:templateId
    const templateMatch = subpath.match(/^\/session-templates\/([a-z_]+)$/i);
    if (templateMatch && method === 'GET') {
      return await handleGetSessionTemplate(request, templateMatch[1]);
    }

    // GET /api/practitioner/clients
    if (subpath === '/clients' && method === 'GET') {
      return await handleListClients(request, query);
    }

    // POST /api/practitioner/clients/add
    if (subpath === '/clients/add' && method === 'POST') {
      return await handleAddClient(request, env, userId, query);
    }

    // POST /api/practitioner/clients/invite
    if (subpath === '/clients/invite' && method === 'POST') {
      return await handleInviteClient(request, env, userId, query);
    }

    // GET /api/practitioner/clients/invitations
    if (subpath === '/clients/invitations' && method === 'GET') {
      return await handleListInvitations(userId, query);
    }

    // POST /api/practitioner/clients/invitations/:id/resend
    const invitationResendMatch = subpath.match(/^\/clients\/invitations\/([a-f0-9-]+)\/resend$/i);
    if (invitationResendMatch && method === 'POST') {
      return await handleResendInvitation(request, env, userId, invitationResendMatch[1], query);
    }

    // DELETE /api/practitioner/clients/invitations/:id
    const invitationDeleteMatch = subpath.match(/^\/clients\/invitations\/([a-f0-9-]+)$/i);
    if (invitationDeleteMatch && method === 'DELETE') {
      return await handleDeleteInvitation(userId, invitationDeleteMatch[1], query);
    }

    // GET /api/practitioner/clients/:id/diary
    const clientDiaryMatch = subpath.match(/^\/clients\/([a-f0-9-]+)\/diary$/i);
    if (clientDiaryMatch && method === 'GET') {
      return await handleGetClientDiary(userId, clientDiaryMatch[1], query, request);
    }

    // POST /api/practitioner/clients/:id/session-brief
    const sessionBriefMatch = subpath.match(/^\/clients\/([a-f0-9-]+)\/session-brief$/i);
    if (sessionBriefMatch && method === 'POST') {
      return await handleGenerateSessionBrief(userId, sessionBriefMatch[1], query, env);
    }

    // POST /api/practitioner/clients/:id/remind
    const remindMatch = subpath.match(/^\/clients\/([a-f0-9-]+)\/remind$/i);
    if (remindMatch && method === 'POST') {
      return await handleClientRemind(userId, remindMatch[1], query, env);
    }

    // GET /api/practitioner/clients/:id
    const clientDetailMatch = subpath.match(/^\/clients\/([a-f0-9-]+)$/i);
    if (clientDetailMatch && method === 'GET') {
      return await handleGetClientDetail(userId, clientDetailMatch[1], query);
    }

    // DELETE /api/practitioner/clients/:id
    const clientDeleteMatch = subpath.match(/^\/clients\/([a-f0-9-]+)$/i);
    if (clientDeleteMatch && method === 'DELETE') {
      return await handleRemoveClient(userId, clientDeleteMatch[1], query, env);
    }

    // GET /api/practitioner/stats
    if (subpath === '/stats' && method === 'GET') {
      return await handlePractitionerStats(userId, query);
    }

    // CSV Exports
    if (subpath === '/export/roster' && method === 'GET') {
      return await handleExportRoster(userId, query);
    }
    if (subpath === '/export/notes' && method === 'GET') {
      return await handleExportNotes(userId, query);
    }
    if (subpath === '/export/readings' && method === 'GET') {
      return await handleExportReadings(userId, query);
    }

    // Practitioner Promo Codes (ITEM-1.9)
    if (subpath === '/promo' && method === 'GET') {
      return await handleGetPractitionerPromo(userId, query);
    }
    if (subpath === '/promo' && method === 'POST') {
      return await handleCreatePractitionerPromo(request, userId, query, env);
    }
    if (subpath.startsWith('/promo/') && method === 'DELETE') {
      const promoId = subpath.replace('/promo/', '');
      return await handleDeletePractitionerPromo(promoId, userId, query);
    }

    return Response.json({ error: 'Not Found' }, { status: 404 });
  } catch (err) {
    return reportHandledRouteError({
      request,
      env,
      error: err,
      source: 'practitioner',
      fallbackMessage: 'Service temporarily unavailable',
      extra: { subpath },
    });
  }
}

async function handleRegister(request, env, userId, query) {
  // Check if already a practitioner
  const existing = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (existing.rows?.length) {
    return Response.json({
      ok: true,
      practitioner: existing.rows[0],
      message: 'Already registered as practitioner'
    });
  }

  // Create practitioner record — starts on free tier
  const result = await query(QUERIES.createPractitioner, [userId, false, 'free']);
  const practitioner = result.rows?.[0];

  trackFunnel(env, userId, FUNNELS.PRACTITIONER.name, 'register').catch(() => {});

  return Response.json({
    ok: true,
    practitioner,
    message: 'Registered as practitioner. Upgrade tier to manage clients.'
  }, { status: 201 });
}

async function handleGetProfile(userId, query) {
  const result = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (!result.rows?.length) {
    return Response.json({ error: 'Not a registered practitioner' }, { status: 404 });
  }

  const p = result.rows[0];

  // Count current clients
  const clientCount = await query(QUERIES.countPractitionerClients, [p.id]);
  const count = parseInt(clientCount.rows?.[0]?.count || '0');
  const limit = TIER_LIMITS[p.tier] || 0;

  return Response.json({
    ok: true,
    practitioner: {
      ...p,
      clientCount: count,
      clientLimit: limit === Infinity ? null : limit,
      canAddClients: count < limit
    }
  });
}

async function handleListClients(request, query) {
  const userId = request._user?.sub;
  // Verify practitioner
  const practResult = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (!practResult.rows?.length) {
    return Response.json({ error: 'Not a registered practitioner' }, { status: 403 });
  }

  const practitionerId = practResult.rows[0].id;

  // SYS-018: Pagination support
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1);
  const offset = (page - 1) * limit;

  const clients = await query(QUERIES.getPractitionerClientsWithCharts, [practitionerId, limit, offset]);
  const rows = clients.rows || [];

  return Response.json({
    ok: true,
    clients: rows,
    pagination: { page, limit, total: rows.length, hasMore: rows.length === limit },
  });
}

async function handleAddClient(request, env, userId, query) {
  // SYS-019: Direct client add is disabled — use the invite flow for consent compliance
  return Response.json({
    error: 'Direct client add is disabled. Use the invite flow instead.',
    action: 'Use POST /api/practitioner/clients/invite to send an invitation email.',
    code: 'USE_INVITE_FLOW',
  }, { status: 410 });
}

async function handleInviteClient(request, env, userId, query) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const clientEmail = String(body?.clientEmail || '').trim().toLowerCase();
  const clientName = body?.clientName ? String(body.clientName).trim() : null;
  const message = body?.message ? String(body.message).trim() : null;

  if (!clientEmail) {
    return Response.json({ error: 'clientEmail is required' }, { status: 400 });
  }
  if (!isValidEmail(clientEmail)) {
    return Response.json({ error: 'clientEmail must be a valid email address' }, { status: 400 });
  }
  if (clientName && clientName.length > 120) {
    return Response.json({ error: 'clientName must be 120 characters or fewer' }, { status: 400 });
  }
  if (message && message.length > 600) {
    return Response.json({ error: 'message must be 600 characters or fewer' }, { status: 400 });
  }

  const practResult = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (!practResult.rows?.length) {
    return Response.json({ error: 'Not a registered practitioner' }, { status: 403 });
  }

  const pract = practResult.rows[0];
  const limit = TIER_LIMITS[pract.tier] || 0;
  if (limit === 0) {
    return Response.json({
      error: 'Upgrade required',
      message: 'Free tier cannot manage clients. Upgrade to standard or higher.'
    }, { status: 403 });
  }

  const countResult = await query(QUERIES.countPractitionerClients, [pract.id]);
  const currentCount = parseInt(countResult.rows?.[0]?.count || '0', 10);
  if (currentCount >= limit) {
    return Response.json({
      error: 'Client limit reached',
      message: `${pract.tier} tier allows up to ${limit} clients. Upgrade to add more.`,
      currentCount,
      limit
    }, { status: 403 });
  }

  const clientResult = await query(QUERIES.getUserByEmailSafe, [clientEmail]);
  if (clientResult.rows?.length) {
    const existingClient = clientResult.rows[0];
    if (existingClient.id === userId) {
      return Response.json({ error: 'Cannot add yourself as a client' }, { status: 400 });
    }

    await query(QUERIES.addClient, [pract.id, existingClient.id]);
    trackEvent(env, EVENTS.CLIENT_ADD, { userId, properties: { mode: 'added', tier: pract.tier } }).catch(() => {});
    trackFunnel(env, userId, FUNNELS.PRACTITIONER.name, 'first_client').catch(() => {});
    return Response.json({
      ok: true,
      mode: 'added',
      message: `${clientEmail} added to your roster`,
      client: { id: existingClient.id, email: existingClient.email }
    }, { status: 201 });
  }

  await query(QUERIES.expirePendingPractitionerInvitationsByEmail, [pract.id, clientEmail]);

  const rawToken = makeInviteToken(32);
  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + (14 * 24 * 60 * 60 * 1000)).toISOString();
  const inviteInsert = await query(QUERIES.createPractitionerInvitation, [
    pract.id,
    clientEmail,
    clientName,
    tokenHash,
    message,
    expiresAt
  ]);
  const invitation = inviteInsert.rows?.[0];

  const frontendUrl = env.FRONTEND_URL || 'https://selfprime.net';
  const inviteUrl = `${frontendUrl.replace(/\/$/, '')}/?invite=${encodeURIComponent(rawToken)}`;
  const practitionerName = pract.display_name || pract.business_name || request._user?.email || 'Your practitioner';

  let emailResult = { success: false, error: 'Email service not configured' };
  if (env.RESEND_API_KEY) {
    emailResult = await sendPractitionerInvitationEmail(
      clientEmail,
      practitionerName,
      inviteUrl,
      env.RESEND_API_KEY,
      env.FROM_EMAIL
    );
  }

  trackEvent(env, EVENTS.CLIENT_ADD, { userId, properties: { mode: 'invited', tier: pract.tier } }).catch(() => {});
  trackFunnel(env, userId, FUNNELS.PRACTITIONER.name, 'first_client').catch(() => {});
  return Response.json({
    ok: true,
    mode: 'invited',
    message: emailResult.success
      ? `Invitation sent to ${clientEmail}`
      : `Invitation created for ${clientEmail}. Email delivery unavailable; share invite link manually.`,
    invitation,
    inviteUrl,
    emailSent: !!emailResult.success,
    emailError: emailResult.success ? null : emailResult.error
  }, { status: 201 });
}

async function handleListInvitations(userId, query) {
  const practResult = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (!practResult.rows?.length) {
    return Response.json({ error: 'Not a registered practitioner' }, { status: 403 });
  }

  const invitations = await query(QUERIES.listPractitionerInvitations, [practResult.rows[0].id]);
  return Response.json({
    ok: true,
    invitations: invitations.rows || [],
    count: invitations.rows?.length || 0
  });
}

async function handleDeleteInvitation(userId, invitationId, query) {
  const practResult = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (!practResult.rows?.length) {
    return Response.json({ error: 'Not a registered practitioner' }, { status: 403 });
  }

  const result = await query(QUERIES.deletePractitionerInvitation, [invitationId, practResult.rows[0].id]);
  if (!result.rowCount) {
    return Response.json({ error: 'Invitation not found' }, { status: 404 });
  }

  return Response.json({ ok: true, message: 'Invitation revoked' });
}

async function handleResendInvitation(request, env, userId, invitationId, query) {
  const practResult = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (!practResult.rows?.length) {
    return Response.json({ error: 'Not a registered practitioner' }, { status: 403 });
  }

  const practitioner = practResult.rows[0];
  const invitationResult = await query(QUERIES.getPractitionerInvitationById, [invitationId, practitioner.id]);
  const invitation = invitationResult.rows?.[0];

  if (!invitation || invitation.status !== 'pending') {
    return Response.json({ error: 'Invitation not found' }, { status: 404 });
  }

  await query(QUERIES.expirePendingPractitionerInvitationsByEmail, [practitioner.id, invitation.client_email]);

  const rawToken = makeInviteToken(32);
  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + (14 * 24 * 60 * 60 * 1000)).toISOString();
  const inviteInsert = await query(QUERIES.createPractitionerInvitation, [
    practitioner.id,
    invitation.client_email,
    invitation.client_name,
    tokenHash,
    invitation.message,
    expiresAt
  ]);
  const resentInvitation = inviteInsert.rows?.[0];

  const frontendUrl = env.FRONTEND_URL || 'https://selfprime.net';
  const inviteUrl = `${frontendUrl.replace(/\/$/, '')}/?invite=${encodeURIComponent(rawToken)}`;
  const practitionerName = practitioner.display_name || practitioner.business_name || request._user?.email || 'Your practitioner';

  let emailResult = { success: false, error: 'Email service not configured' };
  if (env.RESEND_API_KEY) {
    emailResult = await sendPractitionerInvitationEmail(
      invitation.client_email,
      practitionerName,
      inviteUrl,
      env.RESEND_API_KEY,
      env.FROM_EMAIL
    );
  }

  return Response.json({
    ok: true,
    mode: 'resent',
    message: emailResult.success
      ? `Invitation resent to ${invitation.client_email}`
      : `Fresh invitation created for ${invitation.client_email}. Email delivery unavailable; share invite link manually.`,
    invitation: resentInvitation,
    inviteUrl,
    emailSent: !!emailResult.success,
    emailError: emailResult.success ? null : emailResult.error
  });
}

async function handleGetClientDetail(userId, clientId, query) {
  // Verify practitioner access to this client
  const practResult = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (!practResult.rows?.length) {
    return Response.json({ error: 'Not a registered practitioner' }, { status: 403 });
  }

  const accessCheck = await query(QUERIES.checkPractitionerAccess, [userId, clientId]);
  if (!accessCheck.rows?.length) {
    return Response.json({ error: 'Forbidden — client not on your roster' }, { status: 403 });
  }

  // Get client user info
  const clientResult = await query(QUERIES.getUserByIdSafe, [clientId]);
  if (!clientResult.rows?.length) {
    return Response.json({ error: 'Client not found' }, { status: 404 });
  }

  // P2-SEC-008: Whitelist safe fields — exclude password_hash, stripe IDs, phone, etc.
  const rawClient = clientResult.rows[0];
  const safeClient = {
    id: rawClient.id,
    email: rawClient.email,
    display_name: rawClient.display_name,
    birth_date: rawClient.birth_date,
    birth_time: rawClient.birth_time,
    birth_tz: rawClient.birth_tz,
    birth_lat: rawClient.birth_lat,
    birth_lng: rawClient.birth_lng,
    tier: rawClient.tier,
    created_at: rawClient.created_at,
  };

  // Get client's most recent chart
  const chartResult = await query(QUERIES.getLatestChart, [clientId]);
  const chart = chartResult.rows?.[0] || null;

  // Get client's most recent profile
  const profileResult = await query(QUERIES.getLatestProfile, [clientId]);
  const profile = profileResult.rows?.[0] || null;

  return Response.json({
    ok: true,
    client: safeClient,
    chart: chart ? {
      id: chart.id,
      hdData: parseJsonSafe(chart.hd_json),
      calculatedAt: chart.calculated_at
    } : null,
    profile: profile ? {
      id: profile.id,
      profileData: parseJsonSafe(profile.profile_json),
      groundingAudit: parseJsonSafe(profile.grounding_audit),
      createdAt: profile.created_at
    } : null
  });
}

/**
 * GET /api/practitioner/clients/:id/diary
 * Read-only view of client diary entries (requires client opt-in).
 */
async function handleGetClientDiary(userId, clientId, query, request) {
  // Verify practitioner-client relationship
  const accessResult = await query(QUERIES.checkPractitionerAccess, [userId, clientId]);
  if (!accessResult.rows?.length) {
    return Response.json({ error: 'Client not found on your roster' }, { status: 404 });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 200);
  const offset = Math.max(parseInt(url.searchParams.get('offset')) || 0, 0);

  const result = await query(QUERIES.getDiaryEntriesForClient, [userId, clientId, limit, offset]);

  trackEvent('practitioner', 'practitioner_diary_viewed', `${result.rows?.length || 0} entries`);

  return Response.json({
    ok: true,
    data: result.rows || [],
    pagination: { limit, offset, count: result.rows?.length || 0 }
  });
}

async function handleRemoveClient(userId, clientId, query, env) {
  const practResult = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (!practResult.rows?.length) {
    return Response.json({ error: 'Not a registered practitioner' }, { status: 403 });
  }

  const result = await query(QUERIES.removeClient, [practResult.rows[0].id, clientId]);
  if (!result.rowCount) {
    return Response.json({ error: 'Client not found on your roster' }, { status: 404 });
  }
  trackEvent(env, EVENTS.CLIENT_REMOVE, { userId, properties: { clientId } }).catch(() => {});
  return Response.json({ ok: true, message: 'Client removed from roster' });
}

/**
 * GET /api/practitioner/referral-link
 * Returns the practitioner's unique referral URL.
 * Requires practitioner tier.
 */
export async function handleGetReferralLink(request, env) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });

  const access = await enforceFeatureAccess(request, env, 'practitionerTools');
  if (access) return access;

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  // Get practitioner's directory slug
  let result;
  try {
    result = await query(QUERIES.getPractitionerDirectoryProfile, [userId]);
  } catch (error) {
    if (error?.code !== '42703') throw error;
    result = await query(QUERIES.getPractitionerDirectoryProfileLegacy, [userId]);
  }
  const profile = result?.rows?.[0];

  if (!profile) {
    return Response.json({ error: 'Practitioner profile not found. Complete your directory profile first.' }, { status: 404 });
  }

  const slug = profile.slug;
  if (!slug) {
    return Response.json({ error: 'Set up your directory profile to get a referral link.' }, { status: 400 });
  }

  const frontendUrl = env.FRONTEND_URL || 'https://selfprime.net';
  const referralUrl = `${frontendUrl}/?ref=${encodeURIComponent(slug)}`;

  // Get referral stats (best effort)
  let referralCount = 0;
  let referralEarnings = 0;
  try {
    const statsResult = await query(QUERIES.getPractitionerReferralStats, [userId]);
    if (statsResult?.rows?.[0]) {
      referralCount = parseInt(statsResult.rows[0].referral_count || 0);
      referralEarnings = parseFloat(statsResult.rows[0].earnings_this_month || 0);
    }
  } catch { /* non-fatal */ }

  return Response.json({
    ok: true,
    referralUrl,
    slug,
    stats: {
      referralCount,
      earningsThisMonth: referralEarnings
    }
  });
}

export async function handleGetInvitationDetails(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  const invitation = await getInvitationByToken(query, token);
  if (!invitation) {
    return Response.json({ error: 'Invitation not found' }, { status: 404 });
  }

  if (invitation.status !== 'pending') {
    return Response.json({ error: 'Invitation is no longer active' }, { status: 410 });
  }

  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    await query(QUERIES.expirePractitionerInvitationById, [invitation.id]);
    return Response.json({ error: 'Invitation has expired' }, { status: 410 });
  }

  return Response.json({
    ok: true,
    invitation: {
      client_email: invitation.client_email,
      client_name: invitation.client_name,
      message: invitation.message,
      expires_at: invitation.expires_at,
      practitioner_name: invitation.practitioner_display_name || 'Your practitioner',
    }
  });
}

export async function handleAcceptInvitation(request, env) {
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const userResult = await query(QUERIES.getUserByIdSafe, [userId]);
  const user = userResult.rows?.[0];
  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  const invitation = await getInvitationByToken(query, body?.token);
  if (!invitation) {
    return Response.json({ error: 'Invitation not found' }, { status: 404 });
  }

  if (invitation.status !== 'pending') {
    return Response.json({ error: 'Invitation is no longer active' }, { status: 410 });
  }

  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    await query(QUERIES.expirePractitionerInvitationById, [invitation.id]);
    return Response.json({ error: 'Invitation has expired' }, { status: 410 });
  }

  if (!user.email || user.email.toLowerCase() !== String(invitation.client_email || '').toLowerCase()) {
    return Response.json({
      error: 'Sign in with the invited email address to accept this invitation'
    }, { status: 403 });
  }

  if (invitation.practitioner_user_id === userId) {
    return Response.json({ error: 'You cannot accept your own invitation' }, { status: 400 });
  }

  const accepted = await query.transaction(async (txQuery) => {
    await txQuery(QUERIES.addClient, [invitation.practitioner_id, userId]);
    return txQuery(QUERIES.markPractitionerInvitationAccepted, [invitation.id]);
  });

  if (!accepted.rows?.length) {
    return Response.json({ error: 'Invitation could not be accepted' }, { status: 409 });
  }

  return Response.json({
    ok: true,
    message: 'Invitation accepted',
    practitioner: {
      name: invitation.practitioner_display_name || 'Your practitioner',
    }
  });
}

/**
 * POST /api/practitioner/clients/:id/session-brief
 * Generate an AI session prep brief for a client using Claude Haiku.
 * Returns: { themes, resistanceAreas, suggestedQuestion, transitImpact }
 */
async function handleGenerateSessionBrief(userId, clientId, query, env) {
  // Verify practitioner access
  const practResult = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (!practResult.rows?.length) {
    return Response.json({ error: 'Not a registered practitioner' }, { status: 403 });
  }
  const practitionerId = practResult.rows[0].id;

  const accessCheck = await query(QUERIES.checkPractitionerAccess, [userId, clientId]);
  if (!accessCheck.rows?.length) {
    return Response.json({ error: 'Forbidden — client not on your roster' }, { status: 403 });
  }

  // Gather data: chart, AI-shared notes, AI context
  const [chartResult, notesResult, contextResult] = await Promise.all([
    query(QUERIES.getLatestChart, [clientId]),
    query(QUERIES.getAISharedNotes, [clientId]),
    query(QUERIES.getClientAIContext, [practitionerId, clientId]),
  ]);

  const chart = chartResult.rows?.[0] ? parseJsonSafe(chartResult.rows[0].hd_json) : null;
  const notes = notesResult.rows || [];
  const aiContext = contextResult.rows?.[0]?.ai_context || '';

  if (!chart) {
    return Response.json({
      error: 'Client has not generated a chart yet. Ask them to complete their chart before running a session brief.'
    }, { status: 422 });
  }

  // Build prompt
  const chartSummary = [
    `Type: ${chart.type || 'Unknown'}`,
    `Authority: ${chart.authority || 'Unknown'}`,
    `Profile: ${chart.profile || 'Unknown'}`,
    `Definition: ${chart.definition || 'Unknown'}`,
    chart.incarnationCross ? `Life Purpose Vector: ${chart.incarnationCross}` : null,
    chart.definedCenters?.length ? `Defined centers: ${chart.definedCenters.join(', ')}` : null,
  ].filter(Boolean).join('\n');

  const notesSummary = notes.length
    ? notes.map((n, i) => `Note ${i + 1} (${n.session_date || 'undated'}): ${n.content.trim().slice(0, 400)}`).join('\n\n')
    : 'No session notes yet.';

  const contextSummary = aiContext.trim() || 'No custom AI context set.';

  const promptPayload = {
    system: `You are an Energy Blueprint session preparation assistant for a certified practitioner. 
You analyze a client's Energy Blueprint chart, session notes, and practitioner context to generate a focused pre-session brief.
Be specific, grounded in the chart data, and actionable. Never invent chart data.
Output ONLY valid JSON matching the exact schema requested — no markdown, no explanation outside the JSON.`,

    messages: [{
      role: 'user',
      content: `Generate a pre-session brief for my upcoming client session.

CLIENT CHART:
${chartSummary}

SESSION NOTES (AI-shared):
${notesSummary}

PRACTITIONER CONTEXT:
${contextSummary}

Respond with this exact JSON schema:
{
  "themes": ["theme 1 (1-2 sentences grounded in chart)", "theme 2", "theme 3"],
  "resistanceAreas": ["resistance area 1 (1-2 sentences)", "resistance area 2"],
  "suggestedQuestion": "One open question to open the session with, specific to this client's design",
  "transitImpact": "One paragraph on how current transit energy may be affecting this client type and authority"
}`
    }],

    config: {
      model: 'claude-3-haiku-20240307',
      max_tokens: 800,
      temperature: 0.3
    }
  };

  try {
    const text = await callLLM(promptPayload, env);
    trackEvent(env, 'session_brief_generate', { userId, properties: { clientId } }).catch(() => {});
    trackFunnel(env, userId, FUNNELS.PRACTITIONER.name, 'first_synthesis').catch(() => {});
    let brief;
    try {
      brief = JSON.parse(text);
    } catch {
      // LLM returned non-JSON — wrap it
      return Response.json({ ok: true, raw: text });
    }
    return Response.json({ ok: true, brief });
  } catch (error) {
    return reportHandledRouteError({
      request: { url: `/api/practitioner/clients/${clientId}/session-brief`, method: 'POST' },
      env,
      error,
      source: 'practitioner-session-brief',
      fallbackMessage: 'AI session brief temporarily unavailable'
    });
  }
}

// ─── PRAC-012: Practitioner Metrics Stats ────────────────────
async function handlePractitionerStats(userId, query) {
  const result = await query(QUERIES.getPractitionerStats, [userId]);
  const row = result.rows?.[0] || {};
  return Response.json({
    ok: true,
    stats: {
      activeClients: parseInt(row.active_clients ?? 0),
      totalNotes: parseInt(row.total_notes ?? 0),
      notesThisMonth: parseInt(row.notes_this_month ?? 0),
      aiSharedNotes: parseInt(row.ai_shared_notes ?? 0),
    },
  });
}

// ─── CSV Export helpers ──────────────────────────────────────
function escapeCSV(value) {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCSV(columns, rows) {
  const header = columns.map(c => escapeCSV(c.label)).join(',');
  const lines = rows.map(row =>
    columns.map(c => escapeCSV(row[c.key])).join(',')
  );
  return header + '\n' + lines.join('\n');
}

function csvResponse(csv, filename) {
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

async function handleExportRoster(userId, query) {
  const result = await query(QUERIES.exportRoster, [userId]);
  const csv = toCSV([
    { key: 'id', label: 'ID' },
    { key: 'email', label: 'Email' },
    { key: 'display_name', label: 'Name' },
    { key: 'birth_date', label: 'Birth Date' },
    { key: 'user_joined', label: 'User Joined' },
    { key: 'added_at', label: 'Added At' },
  ], result.rows || []);
  trackEvent?.('practitioner', 'csv_exported', 'roster');
  return csvResponse(csv, 'client-roster.csv');
}

async function handleExportNotes(userId, query) {
  const result = await query(QUERIES.exportNotes, [userId]);
  const csv = toCSV([
    { key: 'id', label: 'Note ID' },
    { key: 'client_email', label: 'Client Email' },
    { key: 'client_name', label: 'Client Name' },
    { key: 'session_date', label: 'Session Date' },
    { key: 'content', label: 'Content' },
    { key: 'share_with_ai', label: 'Shared with AI' },
    { key: 'created_at', label: 'Created At' },
  ], result.rows || []);
  trackEvent?.('practitioner', 'csv_exported', 'notes');
  return csvResponse(csv, 'session-notes.csv');
}

async function handleExportReadings(userId, query) {
  const result = await query(QUERIES.exportReadings, [userId]);
  const csv = toCSV([
    { key: 'id', label: 'Reading ID' },
    { key: 'client_email', label: 'Client Email' },
    { key: 'client_name', label: 'Client Name' },
    { key: 'reading_type', label: 'Reading Type' },
    { key: 'spread_type', label: 'Spread Type' },
    { key: 'reading_date', label: 'Reading Date' },
    { key: 'interpretation', label: 'Interpretation' },
    { key: 'created_at', label: 'Created At' },
  ], result.rows || []);
  trackEvent?.('practitioner', 'csv_exported', 'readings');
  return csvResponse(csv, 'divination-readings.csv');
}

// ─── ITEM-1.9: Practitioner Promo Codes ──────────────────────

async function handleGetPractitionerPromo(userId, query) {
  const result = await query(QUERIES.getPractitionerActivePromo, [userId]);
  const promo = result.rows?.[0] || null;
  return Response.json({ ok: true, promo });
}

async function handleCreatePractitionerPromo(request, userId, query, env) {
  const body = await request.json();
  const { code, discount_value, max_redemptions, valid_until } = body;

  // Validate code format
  const trimmedCode = String(code || '').trim().toUpperCase();
  if (!trimmedCode || !/^[A-Z0-9_-]{3,32}$/.test(trimmedCode)) {
    return Response.json({ error: 'Code must be 3-32 characters (letters, numbers, hyphens, underscores)' }, { status: 400 });
  }

  // Validate discount: 10-50% only
  const discount = parseInt(discount_value);
  if (!discount || discount < 10 || discount > 50) {
    return Response.json({ error: 'Discount must be between 10% and 50%' }, { status: 400 });
  }

  // Check practitioner doesn't already have an active promo
  const existing = await query(QUERIES.getPractitionerActivePromo, [userId]);
  if (existing.rows?.length > 0) {
    return Response.json({ error: 'You already have an active promo code. Deactivate it first.' }, { status: 409 });
  }

  // Max redemptions: optional, 1-1000
  const maxRedemptions = max_redemptions ? Math.min(Math.max(parseInt(max_redemptions) || 100, 1), 1000) : null;

  // Valid until: optional, must be in the future
  let validUntil = null;
  if (valid_until) {
    const d = new Date(valid_until);
    if (isNaN(d.getTime()) || d <= new Date()) {
      return Response.json({ error: 'Expiry date must be in the future' }, { status: 400 });
    }
    validUntil = d.toISOString();
  }

  const result = await query(QUERIES.createPractitionerPromo, [
    trimmedCode, discount, maxRedemptions, validUntil, userId
  ]);

  trackEvent?.('practitioner', 'practitioner_promo_created', trimmedCode);

  return Response.json({ ok: true, promo: result.rows[0] }, { status: 201 });
}

async function handleDeletePractitionerPromo(promoId, userId, query) {
  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(promoId)) {
    return Response.json({ error: 'Invalid promo ID' }, { status: 400 });
  }

  const result = await query(QUERIES.deactivatePractitionerPromo, [promoId, userId]);
  if (!result.rows?.length) {
    return Response.json({ error: 'Promo not found or already deactivated' }, { status: 404 });
  }

  return Response.json({ ok: true, deactivated: result.rows[0] });
}

// ─── PRAC-014: Send client reminder ──────────────────────────
async function handleClientRemind(userId, clientId, query, env) {
  const result = await query(QUERIES.getPractitionerClientForReminder, [clientId, userId]);
  if (!result.rows?.length) {
    return Response.json({ error: 'Client not found or not in your roster' }, { status: 404 });
  }

  const client = result.rows[0];

  // KV rate-limit: 1 reminder per client per 24 hours
  const rateLimitKey = `reminder:${client.practitioner_id}:${clientId}`;
  if (env.KV) {
    const existing = await env.KV.get(rateLimitKey);
    if (existing) {
      return Response.json({ error: 'A reminder was already sent to this client in the last 24 hours' }, { status: 429 });
    }
  }

  // Determine reminder type based on client lifecycle state
  const reminderType = !client.chart_id ? 'complete_birth_data' : 'generate_profile';

  if (env.RESEND_API_KEY && client.email) {
    await sendClientReminderEmail(
      client.email,
      client.practitioner_name || 'Your practitioner',
      reminderType,
      env.RESEND_API_KEY,
      env.FROM_EMAIL
    );
  }

  // Store rate-limit flag (24 hours)
  if (env.KV) {
    await env.KV.put(rateLimitKey, '1', { expirationTtl: 86400 });
  }

  return Response.json({ ok: true, message: 'Reminder sent' });
}

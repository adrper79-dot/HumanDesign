/**
 * Practitioner Dashboard Endpoints
 *
 * Routes (all require authentication):
 *   POST /api/practitioner/register        — Register as practitioner
 *   GET  /api/practitioner/profile         — Get own practitioner profile
 *   GET  /api/practitioner/clients         — List all clients
 *   POST /api/practitioner/clients/add     — Add a client by email
 *   POST /api/practitioner/clients/invite  — Invite or add client by email
 *   GET  /api/practitioner/clients/invitations — List pending invitations
 *   POST /api/practitioner/clients/invitations/:id/resend — Resend invitation
 *   DELETE /api/practitioner/clients/invitations/:id — Revoke invitation
 *   GET  /api/practitioner/clients/:id     — Get a specific client's chart + profiles
 *   DELETE /api/practitioner/clients/:id  — Remove client from roster
 *
 * Tier definitions:
 *   free          — Basic access, no client management (0 clients)
 *   regular       — Up to 5 clients
 *   practitioner  — Up to 50 clients
 *   white_label   — Unlimited clients
 */

import { createQueryFn, QUERIES } from '../db/queries.js';
import { enforceFeatureAccess } from '../middleware/tierEnforcement.js';
import { sendPractitionerInvitationEmail } from '../lib/email.js';
import { reportHandledRouteError } from '../lib/routeErrors.js';

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

    const method = request.method;
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // POST /api/practitioner/register
    if (subpath === '/register' && method === 'POST') {
      return await handleRegister(request, env, userId, query);
    }

    // GET /api/practitioner/profile
    if (subpath === '/profile' && method === 'GET') {
      return await handleGetProfile(userId, query);
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

    // GET /api/practitioner/clients/:id
    const clientDetailMatch = subpath.match(/^\/clients\/([a-f0-9-]+)$/i);
    if (clientDetailMatch && method === 'GET') {
      return await handleGetClientDetail(userId, clientDetailMatch[1], query);
    }

    // DELETE /api/practitioner/clients/:id
    const clientDeleteMatch = subpath.match(/^\/clients\/([a-f0-9-]+)$/i);
    if (clientDeleteMatch && method === 'DELETE') {
      return await handleRemoveClient(userId, clientDeleteMatch[1], query);
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

async function handleRemoveClient(userId, clientId, query) {
  const practResult = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (!practResult.rows?.length) {
    return Response.json({ error: 'Not a registered practitioner' }, { status: 403 });
  }

  const result = await query(QUERIES.removeClient, [practResult.rows[0].id, clientId]);
  if (!result.rowCount) {
    return Response.json({ error: 'Client not found on your roster' }, { status: 404 });
  }
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

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  // Get practitioner's directory slug
  const result = await query(QUERIES.getPractitionerDirectoryProfile, [userId]);
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

/**
 * Practitioner Dashboard Endpoints
 *
 * Routes (all require authentication):
 *   POST /api/practitioner/register        — Register as practitioner
 *   GET  /api/practitioner/profile         — Get own practitioner profile
 *   GET  /api/practitioner/clients         — List all clients
 *   POST /api/practitioner/clients/add     — Add a client by email
 *   GET  /api/practitioner/clients/:id     — Get a specific client's chart + profiles
 *   DELETE /api/practitioner/clients/:id  — Remove client from roster
 *
 * Tier definitions:
 *   free        — Basic access, no client management
 *   standard    — Up to 10 clients
 *   professional — Up to 50 clients
 *   enterprise  — Unlimited clients
 */

import { createQueryFn, QUERIES } from '../db/queries.js';
import { enforceFeatureAccess } from '../middleware/tierEnforcement.js';

// Tier limits aligned with billing tier names (regular/practitioner/white_label)
const TIER_LIMITS = {
  free: 0,
  regular: 5,
  practitioner: 50,
  white_label: Infinity,
  // Legacy aliases — kept for users whose tier was set before rename
  seeker: 5,
  guide: 50,
};

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
      return handleRegister(request, env, userId, query);
    }

    // GET /api/practitioner/profile
    if (subpath === '/profile' && method === 'GET') {
      return handleGetProfile(userId, query);
    }

    // GET /api/practitioner/clients
    if (subpath === '/clients' && method === 'GET') {
      return handleListClients(userId, query);
    }

    // POST /api/practitioner/clients/add
    if (subpath === '/clients/add' && method === 'POST') {
      return handleAddClient(request, env, userId, query);
    }

    // GET /api/practitioner/clients/:id
    const clientDetailMatch = subpath.match(/^\/clients\/([a-f0-9-]+)$/i);
    if (clientDetailMatch && method === 'GET') {
      return handleGetClientDetail(userId, clientDetailMatch[1], query);
    }

    // DELETE /api/practitioner/clients/:id
    const clientDeleteMatch = subpath.match(/^\/clients\/([a-f0-9-]+)$/i);
    if (clientDeleteMatch && method === 'DELETE') {
      return handleRemoveClient(userId, clientDeleteMatch[1], query);
    }

    return Response.json({ error: 'Not Found' }, { status: 404 });
  } catch (err) {
    console.error('[practitioner] Unhandled error:', err.message);
    return Response.json({ error: 'Service temporarily unavailable' }, { status: 500 });
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

async function handleListClients(userId, query) {
  // Verify practitioner
  const practResult = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (!practResult.rows?.length) {
    return Response.json({ error: 'Not a registered practitioner' }, { status: 403 });
  }

  const practitionerId = practResult.rows[0].id;
  const clients = await query(QUERIES.getPractitionerClientsWithCharts, [practitionerId]);

  return Response.json({
    ok: true,
    clients: clients.rows || [],
    count: clients.rows?.length || 0
  });
}

async function handleAddClient(request, env, userId, query) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }
  
  const { clientEmail } = body;

  if (!clientEmail) {
    return Response.json({ error: 'clientEmail is required' }, { status: 400 });
  }

  // Verify practitioner and check tier limit
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

  // Count current clients
  const countResult = await query(QUERIES.countPractitionerClients, [pract.id]);
  const currentCount = parseInt(countResult.rows?.[0]?.count || '0');

  if (currentCount >= limit) {
    return Response.json({
      error: 'Client limit reached',
      message: `${pract.tier} tier allows up to ${limit} clients. Upgrade to add more.`,
      currentCount,
      limit
    }, { status: 403 });
  }

  // Find client user by email
  const clientResult = await query(QUERIES.getUserByEmail, [clientEmail.toLowerCase()]);
  if (!clientResult.rows?.length) {
    return Response.json({
      error: 'Client not found',
      message: 'No account found with that email. Client must register first.'
    }, { status: 404 });
  }

  const client = clientResult.rows[0];

  // Can't add yourself
  if (client.id === userId) {
    return Response.json({ error: 'Cannot add yourself as a client' }, { status: 400 });
  }

  // Add to roster
  await query(QUERIES.addClient, [pract.id, client.id]);

  return Response.json({
    ok: true,
    message: `${clientEmail} added to your roster`,
    client: { id: client.id, email: client.email }
  }, { status: 201 });
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
  const clientResult = await query(QUERIES.getUserById, [clientId]);
  if (!clientResult.rows?.length) {
    return Response.json({ error: 'Client not found' }, { status: 404 });
  }

  // Get client's most recent chart
  const chartResult = await query(QUERIES.getLatestChart, [clientId]);
  const chart = chartResult.rows?.[0] || null;

  // Get client's most recent profile
  const profileResult = await query(QUERIES.getLatestProfile, [clientId]);
  const profile = profileResult.rows?.[0] || null;

  return Response.json({
    ok: true,
    client: clientResult.rows[0],
    chart: chart ? {
      id: chart.id,
      hdData: typeof chart.hd_json === 'string' ? JSON.parse(chart.hd_json) : chart.hd_json,
      calculatedAt: chart.calculated_at
    } : null,
    profile: profile ? {
      id: profile.id,
      profileData: typeof profile.profile_json === 'string' ? JSON.parse(profile.profile_json) : profile.profile_json,
      groundingAudit: typeof profile.grounding_audit === 'string' ? JSON.parse(profile.grounding_audit) : profile.grounding_audit,
      createdAt: profile.created_at
    } : null
  });
}

async function handleRemoveClient(userId, clientId, query) {
  const practResult = await query(QUERIES.getPractitionerByUserId, [userId]);
  if (!practResult.rows?.length) {
    return Response.json({ error: 'Not a registered practitioner' }, { status: 403 });
  }

  await query(QUERIES.removeClient, [practResult.rows[0].id, clientId]);
  return Response.json({ ok: true, message: 'Client removed from roster' });
}

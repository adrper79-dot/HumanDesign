/**
 * Cluster Endpoints
 *
 *   POST /api/cluster/create       – Create a new cluster
 *   POST /api/cluster/:id/join     – Add a member to a cluster
 *   GET  /api/cluster/:id          – Get cluster details + members
 *   POST /api/cluster/:id/synthesize – Run cluster intelligence synthesis
 *
 * A Cluster is a small group (2-12) working on a shared challenge.
 * Each member is assigned a Forge Role based on their HD type,
 * and the group dynamics are synthesized via LLM.
 */

import { calculateFullChart } from '../../../src/engine/index.js';
import { createQueryFn, QUERIES } from '../db/queries.js';
import { parseToUTC } from '../utils/parseToUTC.js';
import { callLLM } from '../lib/llm.js';
import { trackEvent } from './achievements.js';
import { enforceFeatureAccess, enforceUsageQuota } from '../middleware/tierEnforcement.js';
import { reportHandledRouteError } from '../lib/routeErrors.js';

// ─── Forge Role Mapping ─────────────────────────────────────────
const FORGE_ROLES = {
  'Manifestor':            { forge: 'Forge of Power',   role: 'Initiator',  brings: 'Impact, catalytic energy to begin' },
  'Generator':             { forge: 'Forge of Craft',   role: 'Builder',    brings: 'Sustained life force, mastery through response' },
  'Manifesting Generator': { forge: 'Forge of Craft',   role: 'Alchemist',  brings: 'Multi-track energy, speed + response' },
  'Projector':             { forge: 'Forge of Vision',  role: 'Guide',      brings: 'Seeing the other, direction, efficiency' },
  'Reflector':             { forge: 'Forge of Mirrors', role: 'Barometer',  brings: 'Environmental wisdom, community health' }
};

/**
 * Map an HD type to a cluster Forge role.
 */
function getForgeRole(type) {
  return FORGE_ROLES[type] || { forge: 'Unknown', role: 'Participant', brings: '' };
}

/**
 * Determine what the cluster is missing based on Forge coverage.
 */
function analyzeClusterComposition(members) {
  const forges = new Set(members.map(m => m.forgeRole?.forge).filter(Boolean));
  const allForges = ['Forge of Power', 'Forge of Craft', 'Forge of Vision', 'Forge of Mirrors'];
  const missing = allForges.filter(f => !forges.has(f));

  const typeCount = {};
  for (const m of members) {
    const type = m.forgeRole?.role || 'Unknown';
    typeCount[type] = (typeCount[type] || 0) + 1;
  }

  // Check balance
  const total = members.length;
  const insights = [];

  if (!forges.has('Forge of Power')) {
    insights.push('No Manifestor — the cluster may struggle to initiate action. Consider inviting someone who can catalyze movement.');
  }
  if (!forges.has('Forge of Craft') && total > 2) {
    insights.push('No Generator/MG — sustained energy for building may be limited. Ideas may outpace execution.');
  }
  if (!forges.has('Forge of Vision')) {
    insights.push('No Projector — the cluster may lack someone who sees the efficient path. Guidance could come from outside.');
  }
  if (!forges.has('Forge of Mirrors') && total >= 4) {
    insights.push('No Reflector — the group has no natural barometer for its own health. Build in regular check-ins.');
  }
  if (forges.size === allForges.length) {
    insights.push('Full Forge spectrum — this cluster has all four energy types represented. Powerful potential when each is honored.');
  }

  return { forges: [...forges], missingForges: missing, typeCount, insights };
}

/**
 * Route cluster requests based on path and method.
 */
export async function handleCluster(request, env, path) {
  const url = new URL(request.url);

  // GET /api/cluster/list
  if (path === '/api/cluster/list' && request.method === 'GET') {
    return handleList(request, env);
  }

  // POST /api/cluster/create
  if (path === '/api/cluster/create' && request.method === 'POST') {
    return handleCreate(request, env);
  }

  // POST /api/cluster/:id/join
  const joinMatch = path.match(/^\/api\/cluster\/([^/]+)\/join$/);
  if (joinMatch && request.method === 'POST') {
    return handleJoin(request, env, joinMatch[1]);
  }

  // POST /api/cluster/:id/leave
  const leaveMatch = path.match(/^\/api\/cluster\/([^/]+)\/leave$/);
  if (leaveMatch && request.method === 'POST') {
    return handleLeave(request, env, leaveMatch[1]);
  }

  // POST /api/cluster/:id/regenerate-invite
  const regenMatch = path.match(/^\/api\/cluster\/([^/]+)\/regenerate-invite$/);
  if (regenMatch && request.method === 'POST') {
    return handleRegenerateInvite(request, env, regenMatch[1]);
  }

  // GET /api/cluster/:id
  const getMatch = path.match(/^\/api\/cluster\/([^/]+)$/);
  if (getMatch && request.method === 'GET') {
    return handleGet(request, env, getMatch[1]);
  }

  // POST /api/cluster/:id/synthesize
  const synthMatch = path.match(/^\/api\/cluster\/([^/]+)\/synthesize$/);
  if (synthMatch && request.method === 'POST') {
    return handleSynthesize(request, env, synthMatch[1]);
  }

  return Response.json({ error: 'Cluster route not found' }, { status: 404 });
}

/**
 * POST /api/cluster/create
 *
 * Body: { name, challenge, createdBy }
 */
async function handleCreate(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }
  
  const { name, challenge } = body;
  const createdBy = request._user?.sub; // Always use JWT identity, never body

  if (!createdBy) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (!name || !challenge) {
    return Response.json(
      { error: 'Missing required fields: name, challenge' },
      { status: 400 }
    );
  }

  if (typeof name === 'string' && name.length > 200) {
    return Response.json({ error: 'name exceeds maximum length of 200 characters' }, { status: 400 });
  }
  if (typeof challenge === 'string' && challenge.length > 2000) {
    return Response.json({ error: 'challenge exceeds maximum length of 2000 characters' }, { status: 400 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  const result = await query(QUERIES.createCluster, [name, createdBy, challenge]);

  const clusterId = result.rows?.[0]?.id;
  const inviteCode = result.rows?.[0]?.invite_code;

  // Auto-join the creator as the first member
  if (clusterId) {
    // Try to add creator — if they provide birth data later via join, it updates via ON CONFLICT
    await query(QUERIES.addClusterMember, [
      clusterId, createdBy, 'Creator',
      null, null, null, null, null
    ]).catch(err => console.warn('[cluster] Auto-join creator failed (non-fatal):', err.message));
  }

  return Response.json({
    ok: true,
    cluster: {
      id: clusterId,
      name,
      challenge,
      inviteCode,
      createdAt: result.rows?.[0]?.created_at
    }
  }, { status: 201 });
}

/**
 * GET /api/cluster/list
 *
 * Returns all clusters the authenticated user is a member of.
 * Requires authentication.
 */
async function handleList(request, env) {
  const userId = request._user?.sub;  // BL-R-H5: JWT payload uses 'sub', not 'userId'
  
  if (!userId) {
    return Response.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    
    // Get all cluster memberships for this user
    const memberships = await query(
      QUERIES.listUserClusters,
      [userId]
    );

    const clusters = memberships.rows?.map(row => ({
      id: row.id,
      name: row.name,
      challenge: row.challenge,
      createdAt: row.created_at,
      joinedAt: row.joined_at,
      inviteCode: row.created_by === userId ? row.invite_code : undefined,
      isOwner: row.created_by === userId
    })) || [];

    return Response.json({
      ok: true,
      clusters
    });
  } catch (err) {
    return reportHandledRouteError({ request, env, error: err, source: 'cluster-list' });
  }
}

/**
 * POST /api/cluster/:id/leave
 *
 * Remove the authenticated user from a cluster.
 * Requires authentication.
 */
async function handleLeave(request, env, clusterId) {
  const userId = request._user?.sub;  // BL-R-H5: JWT payload uses 'sub', not 'userId'
  
  if (!userId) {
    return Response.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    
    // Remove the user from the cluster
    const result = await query(
      QUERIES.leaveCluster,
      [clusterId, userId]
    );

    if (!result.rows || result.rows.length === 0) {
      return Response.json(
        { error: 'Not a member of this cluster' },
        { status: 404 }
      );
    }

    return Response.json({
      ok: true,
      message: 'Successfully left cluster'
    });
  } catch (err) {
    return reportHandledRouteError({ request, env, error: err, source: 'cluster-leave' });
  }
}

/**
 * POST /api/cluster/:id/join
 *
 * Body: { inviteCode, birthDate, birthTime, birthTimezone?, lat, lng }
 *
 * P2-SEC-013: Requires a valid invite code to join.
 * Calculates the member's chart, determines their Forge role,
 * and adds them to the cluster.
 */
async function handleJoin(request, env, clusterId) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }
  
  const userId = request._user?.sub; // Always use JWT identity, never body
  const { inviteCode, birthDate, birthTime, birthTimezone, lat, lng } = body;

  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (!inviteCode || typeof inviteCode !== 'string') {
    return Response.json({ error: 'Invite code is required to join a cluster' }, { status: 400 });
  }

  if (!birthDate || !birthTime || lat === undefined || lng === undefined) {
    return Response.json(
      { error: 'Missing required fields: birthDate, birthTime, lat, lng' },
      { status: 400 }
    );
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  // P2-SEC-013: Verify invite code matches the cluster
  const clusterResult = await query(QUERIES.getClusterByInviteCode, [inviteCode.toUpperCase()]);
  if (!clusterResult.rows?.length || clusterResult.rows[0].id !== clusterId) {
    return Response.json({ error: 'Invalid invite code' }, { status: 403 });
  }

  // Calculate chart to determine Forge role
  const utc = parseToUTC(birthDate, birthTime, birthTimezone || undefined);

  const chart = calculateFullChart({
    ...utc,
    lat: parseFloat(lat), lng: parseFloat(lng),
    includeTransits: false
  });

  const forgeRole = getForgeRole(chart.chart.type);

  await query(QUERIES.addClusterMember, [
    clusterId, userId, forgeRole.role,
    birthDate, birthTime, birthTimezone || null,
    parseFloat(lat), parseFloat(lng)
  ]);

  // Track achievement event
  if (request._user) {
    await trackEvent(env, request._user.sub, 'cluster_joined', { clusterId }, request._tier || 'free', request._ctx);
  }

  return Response.json({
    ok: true,
    member: {
      userId,
      type: chart.chart.type,
      authority: chart.chart.authority,
      profile: chart.chart.profile,
      forgeRole
    }
  });
}

/**
 * POST /api/cluster/:id/regenerate-invite
 *
 * P2-SEC-013: Regenerate the invite code for a cluster.
 * Only the cluster creator can do this.
 */
async function handleRegenerateInvite(request, env, clusterId) {
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const result = await query(QUERIES.regenerateClusterInviteCode, [clusterId, userId]);

  if (!result.rows?.length) {
    return Response.json({ error: 'Only the cluster creator can regenerate the invite code' }, { status: 403 });
  }

  return Response.json({
    ok: true,
    inviteCode: result.rows[0].invite_code
  });
}

/**
 * GET /api/cluster/:id
 *
 * Returns cluster details, members, and composition analysis.
 */
async function handleGet(request, env, clusterId) {
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const userId = request._user?.sub;

  const memberCheck = await query(
    QUERIES.checkClusterMembership,
    [clusterId, userId]
  );
  if (!memberCheck.rows?.length) {
    return Response.json({ error: 'Access denied' }, { status: 403 });
  }

  // Get cluster members
  const membersResult = await query(QUERIES.getClusterMembers, [clusterId]);
  const members = (membersResult.rows || []).map(row => ({
    userId: row.id,
    displayName: row.email ? row.email.split('@')[0] : 'Member',
    forgeRole: FORGE_ROLES[Object.keys(FORGE_ROLES).find(
      t => FORGE_ROLES[t].role === row.forge_role
    )] || { forge: 'Unknown', role: row.forge_role, brings: '' }
  }));

  const composition = analyzeClusterComposition(members);

  return Response.json({
    ok: true,
    clusterId,
    members,
    composition,
    meta: { memberCount: members.length }
  });
}

/**
 * POST /api/cluster/:id/synthesize
 *
 * Runs LLM-based cluster intelligence synthesis.
 * Analyzes the group's combined HD charts and Forge roles
 * to produce actionable group guidance.
 *
 * Body: { members: [{ birthDate, birthTime, lat, lng }] }
 * (or uses stored member data from DB)
 */
async function handleSynthesize(request, env, clusterId) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }
  
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const userId = request._user?.sub;

  // SEC-016: Gate synthesis behind practitioner tier
  const tierBlock = await enforceFeatureAccess(request, env, 'practitionerTools');
  if (tierBlock) return tierBlock;

  // CFO-003: Enforce monthly AI quota so synthesis calls count against profileGenerations budget
  const quotaBlock = await enforceUsageQuota(request, env, 'profile_generation', 'profileGenerations');
  if (quotaBlock) return quotaBlock;

  const memberCheck = await query(
    QUERIES.checkClusterMembership,
    [clusterId, userId]
  );
  if (!memberCheck.rows?.length) {
    return Response.json({ error: 'Access denied' }, { status: 403 });
  }

  // Get cluster info
  let members;
  if (body.members && Array.isArray(body.members)) {
    // Inline member data provided
    members = body.members.map(m => {
      const utc = parseToUTC(m.birthDate, m.birthTime, m.birthTimezone || undefined);
      const chart = calculateFullChart({
        ...utc,
        lat: parseFloat(m.lat), lng: parseFloat(m.lng),
        includeTransits: false
      });
      const forgeRole = getForgeRole(chart.chart.type);
      return {
        name: m.name || 'Member',
        type: chart.chart.type,
        authority: chart.chart.authority,
        profile: chart.chart.profile,
        definition: chart.chart.definition,
        cross: chart.chart.cross,
        definedCenters: chart.chart.definedCenters,
        forgeRole
      };
    });
  } else {
    // Load stored member birth data from the database.
    // Birth data is persisted at join time (handleJoin), so synthesis
    // can run with no additional input from the frontend.
    const membersResult = await query(QUERIES.getClusterMembers, [clusterId]);
    const rows = membersResult.rows || [];

    if (rows.length < 2) {
      return Response.json(
        { error: 'At least 2 members are required for synthesis.' },
        { status: 400 }
      );
    }

    const missingBirth = rows.filter(r => !r.birth_date || !r.birth_time || r.birth_lat == null);
    if (missingBirth.length) {
      return Response.json(
        { error: `${missingBirth.length} member(s) are missing birth data. Please re-add those members using the Add Member form.` },
        { status: 422 }
      );
    }

    members = rows.map(r => {
      const birthDate = String(r.birth_date).slice(0, 10);
      const birthTime = String(r.birth_time).slice(0, 5);
      const utc = parseToUTC(birthDate, birthTime, r.birth_timezone || undefined);
      const chart = calculateFullChart({
        ...utc,
        lat: parseFloat(r.birth_lat), lng: parseFloat(r.birth_lng),
        includeTransits: false
      });
      const forgeRole = getForgeRole(chart.chart.type);
      return {
        name: r.email || 'Member',
        type: chart.chart.type,
        authority: chart.chart.authority,
        profile: chart.chart.profile,
        definition: chart.chart.definition,
        cross: chart.chart.cross,
        definedCenters: chart.chart.definedCenters,
        forgeRole
      };
    });
  }

  if (members.length < 2) {
    return Response.json(
      { error: 'Cluster must have at least 2 members for synthesis' },
      { status: 400 }
    );
  }

  // Analyze composition
  const composition = analyzeClusterComposition(members);

  // Build synthesis prompt for LLM
  const prompt = buildClusterSynthesisPrompt(members, composition, body.challenge || '');

  // Call LLM for synthesis
  let synthesis;
  try {
    synthesis = await callClusterLLM(prompt, env);
  } catch (err) {
    return Response.json(
      { error: 'Cluster synthesis failed. Please try again.' }, // BL-R-H2
      { status: 502 }
    );
  }

  return Response.json({
    ok: true,
    clusterId,
    synthesis,
    composition,
    members: members.map(m => ({
      name: m.name,
      type: m.type,
      profile: m.profile,
      forge: m.forgeRole.forge,
      role: m.forgeRole.role
    })),
    meta: {
      memberCount: members.length,
      synthesizedAt: new Date().toISOString()
    }
  });
}

/**
 * Build the cluster synthesis prompt.
 */
function buildClusterSynthesisPrompt(members, composition, challenge) {
  const memberDescriptions = members.map((m, i) =>
    `Member ${i + 1} (${m.name}): ${m.type} | ${m.profile} | ${m.authority} | ${m.definition} Definition | ` +
    `Forge: ${m.forgeRole.forge} | Role: ${m.forgeRole.role} | ` +
    `Defined centers: ${m.definedCenters.join(', ')}`
  ).join('\n');

  return {
    system: `You are a Prime Self Cluster Intelligence synthesizer. You analyze small group dynamics using Energy Blueprint structural logic and Prime Self Forge philosophy.

Your output must be grounded in the specific Energy Blueprint data provided — Energy Patterns, Authorities, Archetype Codes, defined centers. Never invent chart data.

The Five Forges:
- Forge of Power (Manifestor) — initiating energy
- Forge of Craft (Generator/MG) — sustaining life force
- Forge of Vision (Projector) — seeing the efficient path
- Forge of Mirrors (Reflector) — environmental wisdom

Analyze the group composition and provide actionable guidance for their shared challenge.`,

    messages: [{
      role: 'user',
      content: `Analyze this cluster for group dynamics and forge synergy:

CHALLENGE: ${challenge}

MEMBERS:
${memberDescriptions}

COMPOSITION ANALYSIS:
- Forges present: ${composition.forges.join(', ')}
- Missing forges: ${composition.missingForges.length ? composition.missingForges.join(', ') : 'None — full spectrum'}
- Insights: ${composition.insights.join(' ')}

Respond as JSON:
{
  "groupDynamic": "string — one paragraph describing how this group's energy flows",
  "forgeInterplay": "string — how the Forges present interact for this challenge",
  "blindSpots": ["string — what this group might miss"],
  "actionPlan": ["string — 3-5 specific next steps for the challenge, grounded in each member's design"],
  "communicationStrategy": "string — how this group should make decisions together given their authorities",
  "warning": "string — the biggest risk or friction point"
}`
    }],
    config: {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0
    }
  };
}

/**
 * Call LLM for cluster synthesis via AI Gateway.
 */
async function callClusterLLM(promptPayload, env) {
  const text = await callLLM(promptPayload, env);
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

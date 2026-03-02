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

  // POST /api/cluster/create
  if (path === '/api/cluster/create' && request.method === 'POST') {
    return handleCreate(request, env);
  }

  // POST /api/cluster/:id/join
  const joinMatch = path.match(/^\/api\/cluster\/([^/]+)\/join$/);
  if (joinMatch && request.method === 'POST') {
    return handleJoin(request, env, joinMatch[1]);
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
  const body = await request.json();
  const { name, challenge, createdBy } = body;

  if (!name || !challenge) {
    return Response.json(
      { error: 'Missing required fields: name, challenge' },
      { status: 400 }
    );
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  const result = await query(QUERIES.createCluster, [name, createdBy || null, challenge]);

  return Response.json({
    success: true,
    cluster: {
      id: result.rows?.[0]?.id,
      name,
      challenge,
      createdAt: result.rows?.[0]?.created_at
    }
  }, { status: 201 });
}

/**
 * POST /api/cluster/:id/join
 *
 * Body: { userId, birthDate, birthTime, birthTimezone?, lat, lng }
 *
 * Calculates the member's chart, determines their Forge role,
 * and adds them to the cluster.
 */
async function handleJoin(request, env, clusterId) {
  const body = await request.json();
  const { userId, birthDate, birthTime, birthTimezone, lat, lng } = body;

  if (!userId || !birthDate || !birthTime || lat === undefined || lng === undefined) {
    return Response.json(
      { error: 'Missing required fields: userId, birthDate, birthTime, lat, lng' },
      { status: 400 }
    );
  }

  // Calculate chart to determine Forge role
  const utc = parseToUTC(birthDate, birthTime, birthTimezone || undefined);

  const chart = calculateFullChart({
    ...utc,
    lat: parseFloat(lat), lng: parseFloat(lng),
    includeTransits: false
  });

  const forgeRole = getForgeRole(chart.chart.type);

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  await query(QUERIES.addClusterMember, [clusterId, userId, forgeRole.role]);

  return Response.json({
    success: true,
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
 * GET /api/cluster/:id
 *
 * Returns cluster details, members, and composition analysis.
 */
async function handleGet(request, env, clusterId) {
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  // Get cluster members
  const membersResult = await query(QUERIES.getClusterMembers, [clusterId]);
  const members = (membersResult.rows || []).map(row => ({
    userId: row.id,
    email: row.email,
    forgeRole: FORGE_ROLES[Object.keys(FORGE_ROLES).find(
      t => FORGE_ROLES[t].role === row.forge_role
    )] || { forge: 'Unknown', role: row.forge_role, brings: '' }
  }));

  const composition = analyzeClusterComposition(members);

  return Response.json({
    success: true,
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
  const body = await request.json();
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

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
    return Response.json(
      { error: 'Provide members array with birth data for synthesis' },
      { status: 400 }
    );
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
      { error: 'Cluster synthesis LLM call failed', message: err.message },
      { status: 502 }
    );
  }

  return Response.json({
    success: true,
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
    system: `You are a Prime Self Cluster Intelligence synthesizer. You analyze small group dynamics using Human Design structural logic and Prime Self Forge philosophy.

Your output must be grounded in the specific HD data provided — Types, Authorities, Profiles, defined centers. Never invent chart data.

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
  const gatewayUrl = env.AI_GATEWAY_URL || 'https://gateway.ai.cloudflare.com/v1';
  const apiKey = env.ANTHROPIC_API_KEY;

  const response = await fetch(`${gatewayUrl}/anthropic/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: promptPayload.config.model,
      max_tokens: promptPayload.config.max_tokens,
      temperature: promptPayload.config.temperature,
      system: promptPayload.system,
      messages: promptPayload.messages
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

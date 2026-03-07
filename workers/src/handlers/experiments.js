/**
 * Experiments Admin Handler (BL-ANA-005)
 *
 * Admin endpoints for managing A/B tests.
 *
 * Routes:
 *   GET    /api/experiments              — List all experiments
 *   GET    /api/experiments/:name        — Get experiment results + significance
 *   POST   /api/experiments              — Create a new experiment
 *   PATCH  /api/experiments/:name/status — Update experiment status (active/paused/completed)
 *
 * Access: Requires Guide tier or above.
 */

import {
  listExperiments,
  getResults,
  createExperiment,
  updateExperimentStatus,
} from '../lib/experiments.js';

/**
 * Route dispatcher for /api/experiments/*
 *
 * @param {Request} request
 * @param {object} env
 * @param {string} subpath - Everything after /api/experiments (e.g. '' or '/pricing_v2')
 * @returns {Promise<Response>}
 */
export async function handleExperiments(request, env, subpath) {
  // Tier gate: Guide+ only
  const tier = request._user?.tier;
  if (!tier || tier === 'free' || tier === 'seeker') {
    return Response.json(
      { error: 'Analytics requires Guide tier or above' },
      { status: 403 }
    );
  }

  const method = request.method;

  // ── POST /api/experiments — Create experiment ──
  if (method === 'POST' && (!subpath || subpath === '/')) {
    return handleCreate(request, env);
  }

  // ── GET /api/experiments — List all experiments ──
  if (method === 'GET' && (!subpath || subpath === '/')) {
    return handleList(request, env);
  }

  // ── PATCH /api/experiments/:name/status — Update status ──
  const statusMatch = subpath.match(/^\/([^/]+)\/status$/);
  if (method === 'PATCH' && statusMatch) {
    return handleStatusUpdate(request, env, decodeURIComponent(statusMatch[1]));
  }

  // ── GET /api/experiments/:name — Get results ──
  const nameMatch = subpath.match(/^\/([^/]+)$/);
  if (method === 'GET' && nameMatch) {
    return handleGetResults(env, decodeURIComponent(nameMatch[1]));
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

// ─── List All Experiments ────────────────────────────────────────────

async function handleList(request, env) {
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status') || null;

  const experiments = await listExperiments(env, statusFilter);

  return Response.json({
    ok: true,
    data: {
      experiments,
      total: experiments.length,
    },
  });
}

// ─── Get Experiment Results ──────────────────────────────────────────

async function handleGetResults(env, experimentName) {
  const results = await getResults(env, experimentName);

  if (!results) {
    return Response.json(
      { error: `Experiment "${experimentName}" not found` },
      { status: 404 }
    );
  }

  return Response.json({ ok: true, data: results });
}

// ─── Create Experiment ───────────────────────────────────────────────

async function handleCreate(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, description, variants, trafficPct, startDate, endDate } = body;

  // Validation
  if (!name || typeof name !== 'string' || name.length < 2) {
    return Response.json(
      { error: 'Experiment name is required (min 2 chars)' },
      { status: 400 }
    );
  }

  // Name format: lowercase, alphanumeric + underscores
  if (!/^[a-z0-9_]+$/.test(name)) {
    return Response.json(
      { error: 'Experiment name must be lowercase alphanumeric with underscores only' },
      { status: 400 }
    );
  }

  if (variants && (!Array.isArray(variants) || variants.length < 2)) {
    return Response.json(
      { error: 'Variants must be an array with at least 2 items' },
      { status: 400 }
    );
  }

  if (trafficPct !== undefined && (trafficPct < 0 || trafficPct > 100)) {
    return Response.json(
      { error: 'Traffic percentage must be between 0 and 100' },
      { status: 400 }
    );
  }

  const experiment = await createExperiment(env, {
    name,
    description,
    variants,
    trafficPct,
    startDate,
    endDate,
  });

  if (!experiment) {
    return Response.json(
      { error: 'Failed to create experiment — name may already exist' },
      { status: 409 }
    );
  }

  return Response.json(
    { ok: true, data: { experiment } },
    { status: 201 }
  );
}

// ─── Update Experiment Status ────────────────────────────────────────

async function handleStatusUpdate(request, env, experimentName) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { status } = body;

  if (!['active', 'paused', 'completed'].includes(status)) {
    return Response.json(
      { error: 'Status must be one of: active, paused, completed' },
      { status: 400 }
    );
  }

  const updated = await updateExperimentStatus(env, experimentName, status);

  if (!updated) {
    return Response.json(
      { error: `Experiment "${experimentName}" not found` },
      { status: 404 }
    );
  }

  return Response.json({ ok: true, data: { name: experimentName, status } });
}

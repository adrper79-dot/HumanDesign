/**
 * POST /api/validation/save
 * GET  /api/validation
 *
 * Behavioral validation data collection.
 * Stores decision patterns, energy patterns, and current focus
 * to validate HD chart accuracy through lived experience.
 */

import { createQueryFn, QUERIES } from '../db/queries.js';

/**
 * Save or update user's behavioral validation data.
 */
export async function handleValidationSave(request, env) {
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

  const { decisionPattern, energyPattern, currentFocus } = body;

  // Validate decision pattern
  const validDecisionPatterns = [
    'gut_impulse',       // Generator/MG - Sacral authority
    'sleep_on_it',       // Emotional authority
    'emotional_wave',    // Emotional authority
    'wait_invitation',   // Projector - waiting for invitation
    'discuss_others',    // Sounding board/External authority
    'environmental'      // Mental/No authority - environmental clarity
  ];

  if (decisionPattern && !validDecisionPatterns.includes(decisionPattern)) {
    return Response.json(
      { error: 'Invalid decision pattern', validOptions: validDecisionPatterns },
      { status: 400 }
    );
  }

  // Validate energy pattern
  const validEnergyPatterns = [
    'steady_renewing',      // Generator
    'bursts_rest',          // Manifesting Generator
    'mirrors_others',       // Projector/Reflector - undefined Sacral
    'environment_dependent', // Reflector
    'discerning_sampling',  // Projector
    'experimental_surprise' // MG or individual circuitry
  ];

  if (energyPattern && !validEnergyPatterns.includes(energyPattern)) {
    return Response.json(
      { error: 'Invalid energy pattern', validOptions: validEnergyPatterns },
      { status: 400 }
    );
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  try {
    const result = await query(QUERIES.saveValidationData, [
      userId,
      decisionPattern || null,
      energyPattern || null,
      currentFocus || null
    ]);

    return Response.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Validation save error:', error);
    return Response.json(
      { error: 'Failed to save validation data' },
      { status: 500 }
    );
  }
}

/**
 * Get user's validation data.
 */
export async function handleValidationGet(request, env) {
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  try {
    const result = await query(QUERIES.getValidationData, [userId]);

    if (result.rows.length === 0) {
      return Response.json({ data: null });
    }

    return Response.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Validation get error:', error);
    return Response.json(
      { error: 'Failed to retrieve validation data' },
      { status: 500 }
    );
  }
}

/**
 * Route handler for /api/validation/*
 */
export async function handleValidation(request, env, subpath) {
  const method = request.method;

  if (subpath === '/save' && method === 'POST') {
    return handleValidationSave(request, env);
  }

  if ((subpath === '' || subpath === '/') && method === 'GET') {
    return handleValidationGet(request, env);
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

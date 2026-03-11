/**
 * POST /api/psychometric/save
 * GET  /api/psychometric
 *
 * Psychometric assessment data (Big Five + VIA Strengths).
 * Cross-validates HD/Astro chart with behavioral psychology.
 */

import { createQueryFn, QUERIES } from '../db/queries.js';

/**
 * Calculate Big Five scores from questionnaire responses.
 * @param {Array} responses - Array of {questionId, score} objects
 * @returns {Object} - Scores for each dimension
 */
function calculateBigFiveScores(responses) {
  // Map questions to dimensions (from bigfive.json)
  const questionMap = {
    1: { dimension: 'extraversion', reverse: false },
    2: { dimension: 'agreeableness', reverse: true },
    3: { dimension: 'conscientiousness', reverse: false },
    4: { dimension: 'neuroticism', reverse: false },
    5: { dimension: 'openness', reverse: false },
    6: { dimension: 'extraversion', reverse: true },
    7: { dimension: 'agreeableness', reverse: false },
    8: { dimension: 'conscientiousness', reverse: true },
    9: { dimension: 'neuroticism', reverse: true },
    10: { dimension: 'openness', reverse: true },
    11: { dimension: 'extraversion', reverse: false },
    12: { dimension: 'agreeableness', reverse: true },
    13: { dimension: 'conscientiousness', reverse: false },
    14: { dimension: 'neuroticism', reverse: false },
    15: { dimension: 'openness', reverse: false },
    16: { dimension: 'extraversion', reverse: true },
    17: { dimension: 'agreeableness', reverse: false },
    18: { dimension: 'conscientiousness', reverse: true },
    19: { dimension: 'neuroticism', reverse: true },
    20: { dimension: 'openness', reverse: true }
  };

  const dimensionScores = {
    openness: [],
    conscientiousness: [],
    extraversion: [],
    agreeableness: [],
    neuroticism: []
  };

  // Process responses
  for (const response of responses) {
    const questionId = parseInt(response.questionId);
    const score = parseInt(response.score);
    const mapping = questionMap[questionId];

    if (!mapping) continue;

    // Reverse score if needed (6 - score)
    const adjustedScore = mapping.reverse ? (6 - score) : score;
    dimensionScores[mapping.dimension].push(adjustedScore);
  }

  // Calculate averages
  const scores = {};
  for (const [dimension, values] of Object.entries(dimensionScores)) {
    if (values.length > 0) {
      scores[dimension] = values.reduce((a, b) => a + b, 0) / values.length;
    } else {
      scores[dimension] = null;
    }
  }

  return scores;
}

/**
 * Calculate VIA Strengths ranking from responses.
 * @param {Array} responses - Array of {strength, score} objects
 * @returns {Array} - Ranked strengths with scores
 */
function calculateVIAStrengths(responses) {
  // Sort by score descending
  const ranked = responses
    .map(r => ({ strength: r.strength, score: parseFloat(r.score) }))
    .sort((a, b) => b.score - a.score);

  // Add rank
  return ranked.map((item, index) => ({
    rank: index + 1,
    ...item,
    isSignature: index < 5 && item.score >= 4.0
  }));
}

/**
 * Save or update psychometric assessment data.
 */
export async function handlePsychometricSave(request, env) {
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

  const { bigFiveResponses, viaResponses } = body;

  let bigFiveScores = null;
  let viaStrengths = null;

  // Calculate Big Five scores if provided
  if (bigFiveResponses && Array.isArray(bigFiveResponses)) {
    if (bigFiveResponses.length !== 20) {
      return Response.json(
        { error: 'Big Five requires exactly 20 responses' },
        { status: 400 }
      );
    }
    bigFiveScores = calculateBigFiveScores(bigFiveResponses);
  }

  // Calculate VIA Strengths if provided
  if (viaResponses && Array.isArray(viaResponses)) {
    if (viaResponses.length !== 24) {
      return Response.json(
        { error: 'VIA Strengths requires exactly 24 responses' },
        { status: 400 }
      );
    }
    viaStrengths = calculateVIAStrengths(viaResponses);
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  try {
    const result = await query(QUERIES.savePsychometricData, [
      userId,
      bigFiveScores ? JSON.stringify(bigFiveScores) : null,
      viaStrengths ? JSON.stringify(viaStrengths) : null
    ]);

    return Response.json({
      success: true,
      data: {
        id: result.rows[0].id,
        bigFiveScores,
        viaStrengths,
        completedAt: result.rows[0].completed_at
      }
    });
  } catch (error) {
    console.error('Psychometric save error:', error);
    return Response.json(
      { error: 'Failed to save psychometric data' },
      { status: 500 }
    );
  }
}

/**
 * Get user's psychometric data.
 */
export async function handlePsychometricGet(request, env) {
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  try {
    const result = await query(QUERIES.getPsychometricData, [userId]);

    if (result.rows.length === 0) {
      return Response.json({ data: null });
    }

    return Response.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Psychometric get error:', error);
    return Response.json(
      { error: 'Failed to retrieve psychometric data' },
      { status: 500 }
    );
  }
}

/**
 * Route handler for /api/psychometric/*
 */
export async function handlePsychometric(request, env, subpath) {
  const method = request.method;

  if (subpath === '/save' && method === 'POST') {
    return handlePsychometricSave(request, env);
  }

  if ((subpath === '' || subpath === '/') && method === 'GET') {
    return handlePsychometricGet(request, env);
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

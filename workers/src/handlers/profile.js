/**
 * POST /api/profile/generate
 *
 * Full Prime Self Profile — Layers 1-8.
 * Runs chart calculation, then calls Claude via AI Gateway
 * for synthesis, with dual-pass grounding validation.
 *
 * Request body:
 * {
 *   birthDate: "1979-08-05",
 *   birthTime: "18:51",
 *   birthTimezone: "America/New_York",
 *   lat: 27.9506,
 *   lng: -82.4572,
 *   question?: "What is my primary Forge?"
 * }
 */

import { calculateFullChart } from '../../../src/engine/index.js';
import { getCurrentTransits } from '../../../src/engine/transits.js';
import {
  buildSynthesisPrompt,
  validateSynthesisResponse,
  buildReprompt
} from '../../../src/prompts/synthesis.js';
import { parseToUTC } from '../utils/parseToUTC.js';
import { createQueryFn, QUERIES } from '../db/queries.js';
import { callLLM } from '../lib/llm.js';

/** 24-hour TTL for cached natal charts (seconds). */
const CHART_CACHE_TTL = 86400;

/**
 * Build a deterministic cache key from birth parameters.
 * Natal chart is fully deterministic for the same inputs.
 */
function chartCacheKey(birthDate, birthTime, lat, lng) {
  return `chart:${birthDate}:${birthTime}:${lat}:${lng}`;
}

export async function handleProfile(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // Validate
  const required = ['birthDate', 'birthTime', 'lat', 'lng'];
  for (const field of required) {
    if (body[field] === undefined) {
      return Response.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }

  const { birthDate, birthTime, birthTimezone, lat, lng, question } = body;

  // Convert to UTC using shared utility
  const utc = parseToUTC(birthDate, birthTime, birthTimezone);

  // ── Chart Caching (Build Bible step 2) ──
  const cacheKey = chartCacheKey(birthDate, birthTime, lat, lng);
  let chart = null;
  let cacheHit = false;

  // Try KV cache for natal chart (Layers 1-6)
  if (env.CACHE) {
    try {
      const cached = await env.CACHE.get(cacheKey, 'json');
      if (cached) {
        // Cache hit — recompute only transits (Layer 7)
        chart = cached;
        chart.transits = getCurrentTransits(chart.chart, chart.astrology);
        cacheHit = true;
      }
    } catch {
      // Cache read failed — fall through to fresh calculation
    }
  }

  // Cache miss — run full Layers 1-6, then Layer 7
  if (!chart) {
    chart = calculateFullChart({
      ...utc,
      lat: parseFloat(lat),
      lng: parseFloat(lng)
    });

    // Cache the natal portion (everything except transits) in KV
    if (env.CACHE) {
      try {
        const natalOnly = { ...chart, transits: null };
        await env.CACHE.put(cacheKey, JSON.stringify(natalOnly), {
          expirationTtl: CHART_CACHE_TTL
        });
      } catch {
        // Cache write failed — non-fatal
      }
    }
  }

  // Build Layer 8 prompt
  const promptPayload = buildSynthesisPrompt({
    hdChart: chart.chart,
    astroChart: chart.astrology,
    transits: chart.transits,
    personalityGates: chart.personalityGates,
    designGates: chart.designGates
  }, question);

  // Call LLM via AI Gateway
  let llmResponse;
  try {
    llmResponse = await callLLM(promptPayload, env);
  } catch (err) {
    return Response.json(
      { error: 'LLM call failed', message: err.message },
      { status: 502 }
    );
  }

  // Validate grounding
  let validation = validateSynthesisResponse(llmResponse);

  // Dual-pass: if grounding is incomplete, re-prompt
  if (!validation.valid && validation.parsed) {
    const repromptMsg = buildReprompt(validation.parsed);
    promptPayload.messages.push(
      { role: 'assistant', content: JSON.stringify(validation.parsed) },
      repromptMsg
    );

    try {
      const llmResponse2 = await callLLM(promptPayload, env);
      const validation2 = validateSynthesisResponse(llmResponse2);

      if (validation2.valid) {
        validation = validation2;
      } else {
        // Use the best result with a warning
        validation = validation2;
        validation.partialGrounding = true;
      }
    } catch {
      // Keep the first result with warning
      validation.partialGrounding = true;
    }
  }

  // ── DB Persistence (non-blocking) ──
  // Save chart + profile to Neon for history & caching
  let chartId = null;
  let profileId = null;
  const userId = request._user?.sub || null; // From JWT auth

  if (env.NEON_CONNECTION_STRING && userId) {
    try {
      const query = createQueryFn(env.NEON_CONNECTION_STRING);

      // Ensure user row exists (upsert by JWT sub)
      await query(QUERIES.ensureUser, [
        userId, null, null, birthDate, birthTime, birthTimezone || null,
        parseFloat(lat), parseFloat(lng)
      ]);

      // Save chart
      const chartResult = await query(QUERIES.saveChart, [
        userId,
        JSON.stringify(chart.chart),
        JSON.stringify(chart.astrology)
      ]);
      chartId = chartResult.rows?.[0]?.id || null;

      // Save profile
      if (validation.parsed && chartId) {
        const profileResult = await query(QUERIES.saveProfile, [
          userId,
          chartId,
          JSON.stringify({
            quickStartGuide: validation.parsed.quickStartGuide,
            technicalInsights: validation.parsed.technicalInsights
          }),
          promptPayload.config.model,
          JSON.stringify(validation.parsed.groundingAudit || {})
        ]);
        profileId = profileResult.rows?.[0]?.id || null;
      }
    } catch (err) {
      // DB save failure is non-fatal — log and continue
      console.error('DB save failed:', err.message);
    }
  }

  return Response.json({
    success: true,
    quickStartGuide: validation.parsed?.quickStartGuide || null,
    technicalInsights: validation.parsed?.technicalInsights || null,
    chart: {
      type: chart.chart.type,
      authority: chart.chart.authority,
      profile: chart.chart.profile,
      definition: chart.chart.definition,
      cross: chart.chart.cross,
      numerology: chart.numerology || null
    },
    meta: {
      groundingAudit: validation.parsed?.groundingAudit || null,
      partialGrounding: validation.partialGrounding || false,
      validationErrors: validation.errors,
      model: promptPayload.config.model,
      chartCacheHit: cacheHit,
      chartId,
      profileId,
      calculatedAt: new Date().toISOString()
    }
  });
}

// callLLM is imported from ../lib/llm.js — Anthropic → Grok → Groq failover

/**
 * GET /api/profile/:id
 *
 * Retrieve a Prime Self Profile by ID.
 * Auth required — only the profile owner can access it.
 */
export async function handleGetProfile(request, env, profileId) {
  const userId = request._user?.sub || null;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!env.NEON_CONNECTION_STRING) {
    return Response.json({ error: 'Database unavailable' }, { status: 503 });
  }
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const result = await query(QUERIES.getProfileById, [profileId]);
    const profile = result?.rows?.[0];
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    if (profile.user_id !== userId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    return Response.json({
      ok: true,
      data: {
        id: profile.id,
        chartId: profile.chart_id,
        profile: typeof profile.profile_json === 'string'
          ? JSON.parse(profile.profile_json)
          : profile.profile_json,
        modelUsed: profile.model_used,
        groundingAudit: typeof profile.grounding_audit === 'string'
          ? JSON.parse(profile.grounding_audit)
          : profile.grounding_audit,
        createdAt: profile.created_at
      }
    });
  } catch (err) {
    return Response.json({ error: 'Database error', detail: err.message }, { status: 500 });
  }
}

/**
 * GET /api/profile/list
 *
 * List all Prime Self Profiles for the authenticated user.
 */
export async function handleListProfiles(request, env) {
  const userId = request._user?.sub || null;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!env.NEON_CONNECTION_STRING) {
    return Response.json({ error: 'Database unavailable' }, { status: 503 });
  }
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const result = await query(QUERIES.getProfilesByUser, [userId]);
    const profiles = (result?.rows || []).map(p => ({
      id: p.id,
      chartId: p.chart_id,
      modelUsed: p.model_used,
      createdAt: p.created_at
    }));
    return Response.json({ ok: true, data: profiles });
  } catch (err) {
    return Response.json({ error: 'Database error', detail: err.message }, { status: 500 });
  }
}

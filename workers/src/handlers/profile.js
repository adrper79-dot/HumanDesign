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
import { enforceUsageQuota, recordUsage, enforceDailyCeiling, incrementDailyCounter } from '../middleware/tierEnforcement.js';
import { getTier } from '../lib/stripe.js';
import { kvCache, keys, TTL, recordCacheAccess } from '../lib/cache.js';

export async function handleProfile(request, env) {
  // Enforce usage quota for profile generation (BL-RACE-001: atomic check+insert)
  const quotaCheck = await enforceUsageQuota(request, env, 'profile_generation', 'profileGenerations');
  if (quotaCheck) return quotaCheck;

  // BL-DAILY-001: Enforce daily ceiling to prevent burning entire monthly quota in one session
  const dailyCheck = await enforceDailyCeiling(request, env, 'synthesis');
  if (dailyCheck) return dailyCheck;

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

  const { birthDate, birthTime, birthTimezone, lat, lng, question, systemPreferences } = body;

  // Convert to UTC using shared utility
  const utc = parseToUTC(birthDate, birthTime, birthTimezone);

  // ── Chart Caching via unified cache lib ──
  const cacheKey = keys.chart(birthDate, birthTime, lat, lng);

  const { data: chart, cached: cacheHit } = await kvCache.getOrSet(
    env, cacheKey, TTL.CHART,
    () => {
      const fullChart = calculateFullChart({
        ...utc,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      });
      // Store natal-only (transits recomputed fresh every time)
      return { ...fullChart, transits: null };
    }
  );

  recordCacheAccess(cacheHit);

  // Always recompute transits (Layer 7) — they change daily
  chart.transits = getCurrentTransits(chart.chart, chart.astrology);

  // Fetch validation data, psychometric data, and diary entries (if user is authenticated)
  const userId = request._user?.sub;
  let validationData = null;
  let psychometricData = null;
  let diaryEntries = null;

  let practitionerContext = null;

  if (userId) {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    
    // Parallel DB reads (same pattern as profile-stream.js)
    const [valResult, psyResult, diaryResult, practCtxResult, sharedNotesResult] = await Promise.allSettled([
      query(QUERIES.getValidationData, [userId]),
      query(QUERIES.getPsychometricData, [userId]),
      query(QUERIES.getDiaryEntries, [userId, 50, 0]),
      // HD_UPDATES4: Fetch practitioner context if this user is a client
      query(QUERIES.getPractitionerAIContext, [userId]),
      query(QUERIES.getAISharedNotes, [userId]),
    ]);

    if (valResult.status === 'fulfilled' && valResult.value.rows.length > 0) {
      validationData = valResult.value.rows[0];
    }
    if (psyResult.status === 'fulfilled' && psyResult.value.rows.length > 0) {
      psychometricData = psyResult.value.rows[0];
    }
    if (diaryResult.status === 'fulfilled' && diaryResult.value.rows.length > 0) {
      diaryEntries = diaryResult.value.rows;
    }

    // Build practitioner context from HD_UPDATES4 vectors
    const practRow = practCtxResult.status === 'fulfilled' ? practCtxResult.value.rows[0] : null;
    const sharedNotes = sharedNotesResult.status === 'fulfilled' ? sharedNotesResult.value.rows : [];
    if (practRow || sharedNotes.length > 0) {
      practitionerContext = {
        synthesisStyle: practRow?.synthesis_style || null,
        clientAiContext: practRow?.ai_context || null,
        sharedNotes,
      };
    }
  }

  // Respect systemPreferences — null out any toggled-off system
  const sp = systemPreferences || {};
  const _opt = (key, val) => (sp[key] === false ? null : (val || null));

  // Build Layer 8 prompt with all available data
  const promptPayload = buildSynthesisPrompt({
    hdChart: chart.chart,
    astroChart:        _opt('astrology',  chart.astrology),
    transits:         _opt('transits',      chart.transits),
    personalityGates: chart.personalityGates,
    designGates:      chart.designGates,
    numerology:       _opt('numerology',    chart.numerology),
    geneKeys:         _opt('geneKeys',      chart.geneKeys),
    vedic:            _opt('vedic',         chart.vedic),
    ogham:            _opt('ogham',         chart.ogham),
    mayan:            _opt('mayan',         chart.mayan),
    bazi:             _opt('bazi',          chart.bazi),
    sabian:           _opt('sabian',        chart.sabian),
    chiron:           _opt('chiron',        chart.chiron),
    lilith:           _opt('lilith',        chart.lilith),
    validationData:   _opt('behavioral',    validationData),
    psychometricData: _opt('psychometrics', psychometricData),
    diaryEntries:     _opt('diary',         diaryEntries),
  }, question, practitionerContext, request._tier || 'free');

  // Call LLM via AI Gateway
  let llmResponse;
  try {
    llmResponse = await callLLM(promptPayload, env);
  } catch (err) {
    return Response.json(
      { error: 'Profile generation failed. Please try again.' }, // BL-R-H2
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
  // userId already declared at line 110

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

      // Save profile — gated by tier's savedProfilesMax
      // Free users (max=0) get generation results but no history persistence
      const tierCfg = getTier(request._tier || 'free');
      const maxSavedProfiles = tierCfg.features.savedProfilesMax;
      let canSaveProfile = maxSavedProfiles > 0;
      if (canSaveProfile && maxSavedProfiles !== Infinity) {
        const countResult = await query(QUERIES.countSavedProfilesByUser, [userId]);
        canSaveProfile = parseInt(countResult.rows[0]?.count || 0) < maxSavedProfiles;
      }
      if (validation.parsed && chartId && canSaveProfile) {
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

  // BL-DAILY-001: Increment daily counter after successful generation
  // Note: Monthly usage is now recorded atomically inside enforceUsageQuota (BL-RACE-001)
  if (userId) {
    await incrementDailyCounter(env, userId, 'synthesis').catch(err => console.error('[profile] Daily counter increment failed:', err.message));
  }

  return Response.json({
    ok: true,
    quickStartGuide: validation.parsed?.quickStartGuide || null,
    technicalInsights: validation.parsed?.technicalInsights || null,
    chart: {
      type: chart.chart.type,
      authority: chart.chart.authority,
      profile: chart.chart.profile,
      definition: chart.chart.definition,
      cross: chart.chart.cross,
      numerology: chart.numerology || null,
      geneKeys: chart.geneKeys || null,
      vedic: chart.vedic || null,
      ogham: chart.ogham || null,
      mayan: chart.mayan || null,
      bazi: chart.bazi || null,
      sabian: chart.sabian || null,
      chiron: chart.chiron || null,
      lilith: chart.lilith || null,
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
    return Response.json({ error: 'Database error' }, { status: 500 });
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
    console.error('[list-profiles] DB error:', err.message);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}

/**
 * GET /api/profile/search?q=term
 *
 * Search saved profiles for the authenticated user by keyword.
 */
export async function handleSearchProfiles(request, env) {
  const userId = request._user?.sub || null;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!env.NEON_CONNECTION_STRING) {
    return Response.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const url = new URL(request.url);
  const searchTerm = (url.searchParams.get('q') || '').trim();
  if (!searchTerm || searchTerm.length < 2) {
    return Response.json({ error: 'Search term must be at least 2 characters' }, { status: 400 });
  }
  if (searchTerm.length > 100) {
    return Response.json({ error: 'Search term too long' }, { status: 400 });
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const result = await query(QUERIES.searchProfilesByUser, [userId, searchTerm]);
    const profiles = (result?.rows || []).map(p => ({
      id: p.id,
      chartId: p.chart_id,
      modelUsed: p.model_used,
      createdAt: p.created_at
    }));
    return Response.json({ ok: true, data: profiles });
  } catch (err) {
    console.error('[search-profiles] DB error:', err.message);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}

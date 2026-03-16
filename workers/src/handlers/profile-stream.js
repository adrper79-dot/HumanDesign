/**
 * Profile Generation Progress — Server-Sent Events (BL-OPT-004)
 *
 * POST /api/profile/generate/stream
 *
 * Streams progress updates during profile generation via SSE.
 * Same input as /api/profile/generate but returns a text/event-stream
 * with stage updates and the final result.
 *
 * SSE Events:
 *   event: progress
 *   data: {"stage": "chart", "pct": 15, "message": "Calculating your Energy Blueprint..."}
 *
 *   event: progress
 *   data: {"stage": "knowledge", "pct": 35, "message": "Loading knowledge base..."}
 *
 *   event: progress
 *   data: {"stage": "synthesis", "pct": 60, "message": "Generating your Prime Self Profile..."}
 *
 *   event: progress
 *   data: {"stage": "validation", "pct": 85, "message": "Verifying grounding..."}
 *
 *   event: complete
 *   data: { ...full profile response... }
 *
 *   event: error
 *   data: {"error": "..."}
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
import { trackEvent, trackFunnel, EVENTS, FUNNELS } from '../lib/analytics.js';
import { kvCache, keys, TTL, recordCacheAccess } from '../lib/cache.js';

// ─── Stage Definitions ───────────────────────────────────────────────

const STAGES = [
  { id: 'chart',      pct: 15,  message: 'Calculating your Energy Blueprint...' },
  { id: 'knowledge',  pct: 35,  message: 'Loading knowledge base...' },
  { id: 'synthesis',  pct: 60,  message: 'Generating your Prime Self Profile...' },
  { id: 'validation', pct: 85,  message: 'Verifying grounding & accuracy...' },
  { id: 'saving',     pct: 95,  message: 'Saving your profile...' },
  { id: 'complete',   pct: 100, message: 'Complete!' },
];

/**
 * Format an SSE event string.
 */
function sseEvent(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Handle streaming profile generation with SSE progress updates.
 */
export async function handleProfileStream(request, env, ctx) {
  // Enforce usage quota (BL-RACE-001: atomic check+insert)
  const quotaCheck = await enforceUsageQuota(request, env, 'profile_generation', 'profileGenerations');
  if (quotaCheck) return quotaCheck;

  // BL-DAILY-001: Enforce daily ceiling to prevent burning entire monthly quota in one session
  const dailyCheck = await enforceDailyCeiling(request, env, 'synthesis');
  if (dailyCheck) return dailyCheck;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const required = ['birthDate', 'birthTime', 'lat', 'lng'];
  for (const field of required) {
    if (body[field] === undefined) {
      return Response.json({ error: `Missing required field: ${field}` }, { status: 400 });
    }
  }

  const { birthDate, birthTime, birthTimezone, lat, lng, question, systemPreferences } = body;
  const userId = request._user?.sub;

  // Create a readable stream that we'll push SSE events into
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const send = async (event, data) => {
    try {
      await writer.write(encoder.encode(sseEvent(event, data)));
    } catch {
      // Client disconnected — ignore
    }
  };

  const sendProgress = async (stageId) => {
    const stage = STAGES.find(s => s.id === stageId);
    if (stage) {
      await send('progress', {
        stage: stage.id,
        pct: stage.pct,
        message: stage.message,
        elapsed: Date.now() - startTime,
      });
    }
  };

  const startTime = Date.now();

  // Run the generation pipeline asynchronously
  const pipeline = (async () => {
    try {
      // ── Stage 1: Chart Calculation ──────────────────────
      await sendProgress('chart');

      const utc = parseToUTC(birthDate, birthTime, birthTimezone);

      // Unified chart caching via cache lib
      const cacheKey = keys.chart(birthDate, birthTime, lat, lng);
      const { data: chart, cached: cacheHit } = await kvCache.getOrSet(
        env, cacheKey, TTL.CHART,
        () => {
          const fullChart = calculateFullChart({
            ...utc,
            lat: parseFloat(lat),
            lng: parseFloat(lng),
          });
          return { ...fullChart, transits: null };
        }
      );

      recordCacheAccess(cacheHit);

      // Always recompute transits
      chart.transits = getCurrentTransits(chart.chart, chart.astrology);

      // ── Stage 2: Knowledge Base + Context ───────────────
      await sendProgress('knowledge');

      let validationData = null, psychometricData = null, diaryEntries = null;
      let practitionerContext = null;

      if (userId && env.NEON_CONNECTION_STRING) {
        const query = createQueryFn(env.NEON_CONNECTION_STRING);
        const [valRes, psychRes, diaryRes, practCtxRes, sharedNotesRes] = await Promise.all([
          query(QUERIES.getValidationData, [userId]).catch(() => ({ rows: [] })),
          query(QUERIES.getPsychometricData, [userId]).catch(() => ({ rows: [] })),
          // BL-FIX: getDiaryEntries requires 3 params: user_id, limit, offset
          query(QUERIES.getDiaryEntries, [userId, 50, 0]).catch(() => ({ rows: [] })),
          // HD_UPDATES4: Fetch practitioner context if this user is a client
          query(QUERIES.getPractitionerAIContext, [userId]).catch(() => ({ rows: [] })),
          query(QUERIES.getAISharedNotes, [userId]).catch(() => ({ rows: [] })),
        ]);
        validationData = valRes.rows[0] || null;
        psychometricData = psychRes.rows[0] || null;
        diaryEntries = diaryRes.rows.length > 0 ? diaryRes.rows : null;

        // Build practitioner context from HD_UPDATES4 vectors
        const practRow = practCtxRes.rows[0] || null;
        const sharedNotes = sharedNotesRes.rows || [];
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

      const promptPayload = buildSynthesisPrompt({
        hdChart: chart.chart,
        astroChart: chart.astrology,
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

      // ── Stage 3: LLM Synthesis ─────────────────────────
      await sendProgress('synthesis');

      let llmResponse;
      try {
        llmResponse = await callLLM(promptPayload, env);
      } catch (err) {
        await send('error', { error: 'Profile generation failed' }); // BL-R-H2
        await writer.close();
        return;
      }

      // ── Stage 4: Grounding Validation ──────────────────
      await sendProgress('validation');

      let validation = validateSynthesisResponse(llmResponse);

      // Dual-pass re-prompt if grounding incomplete
      if (!validation.valid && validation.parsed) {
        const repromptMsg = buildReprompt(validation.parsed);
        promptPayload.messages.push(
          { role: 'assistant', content: JSON.stringify(validation.parsed) },
          repromptMsg
        );

        try {
          const llmResponse2 = await callLLM(promptPayload, env);
          const validation2 = validateSynthesisResponse(llmResponse2);
          validation = validation2.valid ? validation2 : { ...validation2, partialGrounding: true };
        } catch {
          validation.partialGrounding = true;
        }
      }

      // ── Stage 5: Database Persistence ──────────────────
      await sendProgress('saving');

      let chartId = null, profileId = null;

      if (env.NEON_CONNECTION_STRING && userId) {
        try {
          const query = createQueryFn(env.NEON_CONNECTION_STRING);

          await query(QUERIES.ensureUser, [
            userId, null, null, birthDate, birthTime, birthTimezone || null,
            parseFloat(lat), parseFloat(lng),
          ]);

          const chartResult = await query(QUERIES.saveChart, [
            userId,
            JSON.stringify(chart.chart),
            JSON.stringify(chart.astrology),
          ]);
          chartId = chartResult.rows?.[0]?.id || null;

          if (validation.parsed && chartId) {
            const profileResult = await query(QUERIES.saveProfile, [
              userId, chartId,
              JSON.stringify({
                quickStartGuide: validation.parsed.quickStartGuide,
                technicalInsights: validation.parsed.technicalInsights,
              }),
              promptPayload.config.model,
              JSON.stringify(validation.parsed.groundingAudit || {}),
            ]);
            profileId = profileResult.rows?.[0]?.id || null;
          }
        } catch (err) {
          console.error('DB save failed:', err.message);
        }
      }

      // BL-DAILY-001: Increment daily counter after successful generation
      // Note: Monthly usage is now recorded atomically inside enforceUsageQuota (BL-RACE-001)
      if (userId) {
        await incrementDailyCounter(env, userId, 'synthesis').catch(err => console.error('[profile-stream] Daily counter increment failed:', err.message));
      }

      // Track analytics
      await trackEvent(env, EVENTS.PROFILE_GENERATE, {
        userId,
        properties: {
          durationMs: Date.now() - startTime,
          cacheHit,
          model: promptPayload.config.model,
          partialGrounding: validation.partialGrounding || false,
        },
        request,
      }).catch(e => console.error('[profile-stream] trackEvent failed:', e.message));

      if (userId) {
        await trackFunnel(env, userId, 'onboarding', 'first_profile').catch(e => console.error('[profile-stream] trackFunnel failed:', e.message));
      }

      // ── Stage 6: Complete ──────────────────────────────
      await sendProgress('complete');

      await send('complete', {
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
          durationMs: Date.now() - startTime,
          calculatedAt: new Date().toISOString(),
        },
      });

      await writer.close();
    } catch (err) {
      console.error('[ProfileStream] Pipeline error:', err);
      await send('error', { error: 'Internal error during profile generation' });
      await writer.close();
    }
  })();

  // Keep the worker alive until the pipeline finishes writing to the stream
  if (ctx && ctx.waitUntil) {
    ctx.waitUntil(pipeline);
  }

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering if proxied
    },
  });
}

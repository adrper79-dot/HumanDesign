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
import {
  buildSynthesisPrompt,
  validateSynthesisResponse,
  buildReprompt
} from '../../../src/prompts/synthesis.js';

export async function handleProfile(request, env) {
  const body = await request.json();

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

  // Convert to UTC (reuse logic from calculate handler)
  const [year, month, day] = birthDate.split('-').map(Number);
  const [hour, minute] = birthTime.split(':').map(Number);
  // TODO: Proper timezone conversion (shared with calculate.js)
  const utc = { year, month, day, hour, minute, second: 0 };

  // Run Layers 1-7
  const chart = calculateFullChart({
    ...utc,
    lat: parseFloat(lat),
    lng: parseFloat(lng)
  });

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

  return Response.json({
    success: true,
    profile: validation.parsed?.primeProfile || null,
    chart: {
      type: chart.chart.type,
      authority: chart.chart.authority,
      profile: chart.chart.profile,
      definition: chart.chart.definition,
      cross: chart.chart.cross
    },
    meta: {
      groundingAudit: validation.parsed?.groundingAudit || null,
      partialGrounding: validation.partialGrounding || false,
      validationErrors: validation.errors,
      model: promptPayload.config.model,
      calculatedAt: new Date().toISOString()
    }
  });
}

/**
 * Call Claude via Cloudflare AI Gateway.
 */
async function callLLM(promptPayload, env) {
  // Using Cloudflare AI Gateway as proxy to Anthropic
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
  return text;
}

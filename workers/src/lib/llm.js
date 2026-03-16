/**
 * Multi-provider LLM call with automatic failover.
 *
 * Provider chain: Anthropic → Grok (xAI) → Groq
 *
 * All three accept the same promptPayload shape:
 *   { system: string, messages: [{role, content}], config: { model, max_tokens, temperature } }
 *
 * Returns the raw text string from the LLM.
 * Throws only if ALL providers fail.
 */

// Model equivalence map for failover
// Keys are Anthropic model IDs, values are [grok, groq] equivalents
const MODEL_MAP = {
  'claude-opus-4-20250514':     ['grok-4-fast',        'llama-3.3-70b-versatile'],
  'claude-opus-4-5-20251101':   ['grok-4-fast',        'llama-3.3-70b-versatile'],
  'claude-sonnet-4-20250514':   ['grok-3-mini-latest', 'llama-3.1-70b-versatile'],
  'claude-3-5-sonnet-20241022': ['grok-3-mini-latest', 'llama-3.1-70b-versatile'],
  'claude-3-haiku-20240307':    ['grok-3-mini-latest', 'llama-3.1-8b-instant'],
};

function resolveModels(anthropicModel) {
  return MODEL_MAP[anthropicModel] || ['grok-4-fast', 'llama-3.3-70b-versatile'];
}

/**
 * Resolve the endpoint URL for a provider, routing through CF AI Gateway when configured.
 * Gateway URL pattern: https://gateway.ai.cloudflare.com/v1/{account}/{gateway}/{provider}/...
 * @param {object} env - Worker env bindings
 * @param {string} providerSlug - CF AI Gateway provider slug (e.g. 'anthropic', 'grok', 'groq')
 * @param {string} directUrl - Direct API URL to use when gateway is not configured
 * @returns {string} The resolved endpoint URL
 */
function resolveEndpoint(env, providerSlug, directUrl) {
  const gatewayUrl = env.AI_GATEWAY_URL || '';
  const isRealGateway = gatewayUrl.startsWith('https://gateway.ai.cloudflare.com/');
  return isRealGateway
    ? `${gatewayUrl.replace(/\/$/, '')}/${providerSlug}`
    : directUrl;
}

// ── Provider: Anthropic ──────────────────────────────────────

async function callAnthropic(promptPayload, env) {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const endpoint = resolveEndpoint(env, 'anthropic/v1/messages', 'https://api.anthropic.com/v1/messages');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(endpoint, {
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
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    if (!text) throw new Error('Anthropic returned empty content');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Provider: Grok (xAI) — OpenAI-compatible ─────────────────

async function callGrok(promptPayload, env) {
  const apiKey = env.GROK_API_KEY;
  if (!apiKey) throw new Error('GROK_API_KEY not set');

  const [grokModel] = resolveModels(promptPayload.config.model);

  // Convert Anthropic format → OpenAI format
  const messages = [
    { role: 'system', content: promptPayload.system },
    ...promptPayload.messages
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  const endpoint = resolveEndpoint(env, 'grok/v1/chat/completions', 'https://api.x.ai/v1/chat/completions');

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: grokModel,
        max_tokens: promptPayload.config.max_tokens,
        temperature: promptPayload.config.temperature,
        messages
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Grok ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    if (!text) throw new Error('Grok returned empty content');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Provider: Groq ────────────────────────────────────────────

async function callGroq(promptPayload, env) {
  const apiKey = env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const [, groqModel] = resolveModels(promptPayload.config.model);

  // Convert Anthropic format → OpenAI format
  const messages = [
    { role: 'system', content: promptPayload.system },
    ...promptPayload.messages
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  const endpoint = resolveEndpoint(env, 'groq/openai/v1/chat/completions', 'https://api.groq.com/openai/v1/chat/completions');

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: groqModel,
        max_tokens: Math.min(promptPayload.config.max_tokens, 32000), // Groq model output limit
        temperature: promptPayload.config.temperature,
        messages
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    if (!text) throw new Error('Groq returned empty content');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Failover Chain ────────────────────────────────────────────

/**
 * Call LLM with automatic failover: Anthropic (with retry) → Grok → Groq.
 *
 * Anthropic gets 2 retries with exponential backoff before failover.
 *
 * @param {object} promptPayload - { system, messages, config: { model, max_tokens, temperature } }
 * @param {object} env           - Worker env bindings
 * @returns {Promise<string>}    - Raw text from whichever provider succeeded
 */
export async function callLLM(promptPayload, env) {
  const errors = [];
  const wallClockStart = Date.now();
  const MAX_WALL_CLOCK_MS = 55000; // 55s cap — leave headroom for CF Worker 60s limit

  function checkWallClock() {
    if (Date.now() - wallClockStart > MAX_WALL_CLOCK_MS) {
      const summary = errors.map(e => `${e.provider}: ${e.error}`).join(' | ');
      throw new Error(`LLM wall-clock timeout (${MAX_WALL_CLOCK_MS}ms) — ${summary}`);
    }
  }

  // Anthropic: try up to 3 times (initial + 2 retries) with backoff
  for (let attempt = 0; attempt < 3; attempt++) {
    checkWallClock();
    try {
      const text = await callAnthropic(promptPayload, env);
      return text;
    } catch (err) {
      console.error(`Anthropic attempt ${attempt + 1} failed: ${err.message}`);
      errors.push({ provider: `Anthropic(attempt ${attempt + 1})`, error: err.message });

      // Don't retry on missing API key or 4xx client errors
      if (err.message.includes('not set') || err.message.includes('Anthropic 4')) break;

      if (attempt < 2) {
        const delay = (attempt + 1) * 1000; // 1s, 2s
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  // Failover providers
  const fallbacks = [
    { name: 'Grok', fn: callGrok },
    { name: 'Groq', fn: callGroq }
  ];

  for (const { name, fn } of fallbacks) {
    checkWallClock();
    try {
      const text = await fn(promptPayload, env);
      console.warn(`LLM failover: used ${name} after ${errors.map(e => e.provider).join(' → ')} failed`);
      return text;
    } catch (err) {
      console.error(`LLM provider ${name} failed: ${err.message}`);
      errors.push({ provider: name, error: err.message });
    }
  }

  // All providers failed
  const summary = errors.map(e => `${e.provider}: ${e.error}`).join(' | ');
  throw new Error(`All LLM providers failed — ${summary}`);
}

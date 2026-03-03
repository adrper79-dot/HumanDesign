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
  'claude-opus-4-20250514':     ['grok-3-latest',      'llama-3.3-70b-versatile'],
  'claude-opus-4-5-20251101':   ['grok-3-latest',      'llama-3.3-70b-versatile'],
  'claude-sonnet-4-20250514':   ['grok-3-mini-latest', 'llama-3.1-70b-versatile'],
  'claude-3-5-sonnet-20241022': ['grok-3-mini-latest', 'llama-3.1-70b-versatile'],
  'claude-3-haiku-20240307':    ['grok-3-mini-latest', 'llama-3.1-8b-instant'],
};

function resolveModels(anthropicModel) {
  return MODEL_MAP[anthropicModel] || ['grok-3-latest', 'llama-3.3-70b-versatile'];
}

// ── Provider: Anthropic ──────────────────────────────────────

async function callAnthropic(promptPayload, env) {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const gatewayUrl = env.AI_GATEWAY_URL || '';
  const isRealGateway = gatewayUrl.startsWith('https://gateway.ai.cloudflare.com/');
  const endpoint = isRealGateway
    ? `${gatewayUrl.replace(/\/$/, '')}/anthropic/v1/messages`
    : 'https://api.anthropic.com/v1/messages';

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
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  if (!text) throw new Error('Anthropic returned empty content');
  return text;
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

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
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
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Grok ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('Grok returned empty content');
  return text;
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

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: groqModel,
      max_tokens: Math.min(promptPayload.config.max_tokens, 8000), // Groq context limit
      temperature: promptPayload.config.temperature,
      messages
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('Groq returned empty content');
  return text;
}

// ── Failover Chain ────────────────────────────────────────────

/**
 * Call LLM with automatic failover: Anthropic → Grok → Groq.
 *
 * @param {object} promptPayload - { system, messages, config: { model, max_tokens, temperature } }
 * @param {object} env           - Worker env bindings
 * @returns {Promise<string>}    - Raw text from whichever provider succeeded
 */
export async function callLLM(promptPayload, env) {
  const providers = [
    { name: 'Anthropic', fn: callAnthropic },
    { name: 'Grok',      fn: callGrok      },
    { name: 'Groq',      fn: callGroq      }
  ];

  const errors = [];

  for (const { name, fn } of providers) {
    try {
      const text = await fn(promptPayload, env);
      if (errors.length > 0) {
        // Log which fallback was used (visible in Workers logs)
        console.warn(`LLM failover: used ${name} after ${errors.map(e => e.provider).join(' → ')} failed`);
      }
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

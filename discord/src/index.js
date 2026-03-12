/**
 * Prime Self Discord Worker
 *
 * Handles Discord slash command interactions via webhook (no persistent process).
 * Discord POSTs to this Worker when a user invokes a slash command.
 *
 * Command:
 *   /primself date:<YYYY-MM-DD> time:<HH:MM> city:<free text>
 *   → Returns a Quick Start Guide embed (free tier, top-of-funnel)
 *
 * Security:
 *   Ed25519 signature verification runs before any processing.
 *   All user-facing errors are generic — internal details are console-only.
 *
 * Rate limiting:
 *   3 requests per Discord user ID per 24-hour rolling window (KV-backed).
 *
 * Architecture:
 *   1. Verify Discord signature
 *   2. Acknowledge with deferred response (type 5) within Discord's 3-second window
 *   3. ctx.waitUntil() → geocode → chart → format embed → send follow-up
 *
 * Secrets required (set via: npx wrangler secret put <NAME>):
 *   DISCORD_APPLICATION_ID  — Discord Developer Portal → App → General
 *   DISCORD_PUBLIC_KEY      — Discord Developer Portal → App → General
 *   DISCORD_BOT_TOKEN       — Discord Developer Portal → App → Bot
 *   PRIME_SELF_API_SECRET   — Internal API auth (Phase 2+, not required for Phase 1)
 */

// ─── Discord Interaction Types ───────────────────────────────────
const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
};

const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
};

const MessageFlags = {
  EPHEMERAL: 64,
};

// Embed color — Prime Self gold
const EMBED_COLOR = 0xB8860B;

// CTA footer for every embed
const EMBED_FOOTER =
  'Full Technical Insights, Forge Weapons & Priming Recommendations → primeselfengine.com';

// Prime Self logo (served from frontend assets)
const THUMBNAIL_URL = 'https://primeselfengine.com/icons/icon-192.png';

// Decision protocol copy, keyed by authority name from chart engine
const DECISION_PROTOCOLS = {
  Emotional:
    'Wait for emotional clarity before deciding. Sleep on important choices — your clarity comes in waves over hours or days, never in the peak of emotion.',
  Sacral:
    'Trust your gut response in the moment. A clear "uh-huh" or energetic lift means yes. Uncertainty or a flat feeling means wait or no.',
  Splenic:
    'Act on your first instinct. Your spleen speaks once, softly, and never repeats — if you missed it, wait for the next opportunity.',
  Ego:
    'Check whether you truly want to commit before agreeing. Your willpower must be behind a decision or you will not follow through on it.',
  Self:
    'Talk it through with people you trust. Your clarity emerges through your own voice — notice where your words naturally want to go.',
  Mental:
    'Consult your environment and gather multiple perspectives before deciding. You are here to advise, not to carry the weight of decisions alone.',
  Lunar:
    'Wait a full lunar cycle (28 days) for major decisions. Sample different environments and let time reveal which direction still feels right.',
};

// ─── Ed25519 Signature Verification ─────────────────────────────

/**
 * Convert a hex string to a Uint8Array.
 * @param {string} hex
 * @returns {Uint8Array}
 */
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Verify Discord's Ed25519 request signature.
 * Must be called before any other processing — Discord will reject the
 * Interactions Endpoint URL if this verification fails.
 *
 * @param {Request} request - Incoming request (body must not yet be consumed)
 * @param {string} rawBody  - Raw request body string
 * @param {string} publicKey - Hex-encoded Ed25519 public key from Discord
 * @returns {Promise<boolean>}
 */
async function verifyDiscordSignature(request, rawBody, publicKey) {
  const signature = request.headers.get('X-Signature-Ed25519');
  const timestamp = request.headers.get('X-Signature-Timestamp');

  if (!signature || !timestamp) return false;

  // Reject suspiciously old or future timestamps (> 5 minutes drift)
  const nowSecs = Math.floor(Date.now() / 1000);
  const tsSecs = parseInt(timestamp, 10);
  if (isNaN(tsSecs) || Math.abs(nowSecs - tsSecs) > 300) return false;

  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      hexToBytes(publicKey),
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    const message = new TextEncoder().encode(timestamp + rawBody);
    return await crypto.subtle.verify('Ed25519', cryptoKey, hexToBytes(signature), message);
  } catch {
    return false;
  }
}

// ─── Rate Limiting (KV-backed, rolling 24h window) ───────────────

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check and increment the rate limit for a Discord user.
 * @param {string} userId
 * @param {object} env
 * @returns {Promise<{ allowed: boolean, remaining: number, resetAt: number }>}
 */
async function checkRateLimit(userId, env) {
  const key = `rl:${userId}`;
  const now = Date.now();

  let record = null;
  try {
    record = await env.DISCORD_RATE_LIMIT.get(key, { type: 'json' });
  } catch {
    // KV read failure — fail open to avoid blocking all users
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
  }

  const windowStart = record?.windowStart ?? now;
  const count = record?.count ?? 0;

  // If the window has expired, start a fresh one
  if (now - windowStart > RATE_LIMIT_WINDOW_MS) {
    await env.DISCORD_RATE_LIMIT.put(
      key,
      JSON.stringify({ count: 1, windowStart: now }),
      { expirationTtl: 86400 },
    );
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
  }

  if (count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetAt: windowStart + RATE_LIMIT_WINDOW_MS };
  }

  await env.DISCORD_RATE_LIMIT.put(
    key,
    JSON.stringify({ count: count + 1, windowStart }),
    { expirationTtl: 86400 },
  );
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX - count - 1,
    resetAt: windowStart + RATE_LIMIT_WINDOW_MS,
  };
}

// ─── Input Validation ────────────────────────────────────────────

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Validate slash command options for /primself.
 * @param {string} date
 * @param {string} time
 * @param {string} city
 * @returns {{ valid: boolean, error?: string }}
 */
function validateInputs(date, time, city) {
  if (!DATE_RE.test(date)) {
    return { valid: false, error: 'Date must be in YYYY-MM-DD format (e.g., `1990-06-15`).' };
  }
  if (!TIME_RE.test(time)) {
    return { valid: false, error: 'Time must be in HH:MM 24-hour format (e.g., `14:30` for 2:30 PM).' };
  }
  if (!city || city.trim().length < 2) {
    return { valid: false, error: 'City must be at least 2 characters (e.g., `New York, USA`).' };
  }
  // Reject dates in the future
  const parsed = new Date(`${date}T00:00:00Z`);
  if (isNaN(parsed.getTime()) || parsed > new Date()) {
    return { valid: false, error: 'Birth date cannot be in the future.' };
  }
  return { valid: true };
}

// ─── Prime Self API Calls ─────────────────────────────────────────

/**
 * Geocode a city name to lat, lng, and IANA timezone.
 * Calls the existing public /api/geocode endpoint.
 * @param {string} city
 * @param {string} apiUrl - Base URL of the Prime Self Worker
 * @returns {Promise<{ lat: number, lng: number, timezone: string, displayName: string }>}
 */
async function geocodeCity(city, apiUrl) {
  const url = `${apiUrl}/api/geocode?q=${encodeURIComponent(city)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PrimeSelf-Discord-Bot/1.0' },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Geocoding failed (HTTP ${res.status})`);
  }
  const data = await res.json();
  if (!data.lat || !data.lng) {
    throw new Error(`Could not locate "${city}" — try a more specific city name.`);
  }
  return data;
}

/**
 * Calculate a full Human Design chart.
 * Calls the existing public /api/chart/calculate endpoint.
 * @param {{ birthDate: string, birthTime: string, lat: number, lng: number, birthTimezone: string }} params
 * @param {string} apiUrl
 * @returns {Promise<object>}
 */
async function calculateChart(params, apiUrl) {
  const res = await fetch(`${apiUrl}/api/chart/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Chart engine error (HTTP ${res.status})`);
  }
  return res.json();
}

// ─── Embed Formatting ────────────────────────────────────────────

/**
 * Derive a plain-language "Who You Are" summary from chart data.
 * Intentionally leaves out the deep synthesis to drive CTA clicks.
 * @param {object} chart
 * @returns {string}
 */
function buildWhoYouAre(chart) {
  const hd = chart.humanDesign ?? chart;
  const type = hd.type ?? 'Unknown';
  const authority = hd.authority ?? 'Unknown';
  const profile = hd.profile ?? 'Unknown';
  const definition = hd.definition ?? '';

  return (
    `**${type}** · ${profile} Profile · ${authority} Authority` +
    (definition ? ` · ${definition} Definition` : '')
  );
}

/**
 * Build the "This Month's Energy" field from available transit data.
 * Falls back gracefully if transits are unavailable.
 * @param {object} chart
 * @returns {string}
 */
function buildTransitContext(chart) {
  const transits = chart.transits ?? chart.currentTransits;
  if (!transits) {
    return 'Transit data unavailable — visit primeselfengine.com for your full monthly forecast.';
  }

  // Surface the top active transit gate if present
  const sunGate = transits.personality?.Sun?.gate ?? transits.Sun?.gate;
  const moonGate = transits.personality?.Moon?.gate ?? transits.Moon?.gate;

  const parts = [];
  if (sunGate) parts.push(`Sun in Gate ${sunGate}`);
  if (moonGate) parts.push(`Moon in Gate ${moonGate}`);

  if (parts.length === 0) {
    return 'Visit primeselfengine.com for your full personalized transit forecast.';
  }

  return (
    `Current transits: ${parts.join(', ')}. ` +
    'See your full personalized breakdown at primeselfengine.com.'
  );
}

/**
 * Build the Discord embed payload for a Quick Start Guide.
 * @param {object} chart - Response from /api/chart/calculate
 * @param {string} guildId - Discord guild ID for UTM attribution
 * @returns {object} Discord embed object
 */
function buildQuickStartEmbed(chart, guildId) {
  const hd = chart.humanDesign ?? chart;
  const authority = hd.authority ?? '';
  const protocol =
    DECISION_PROTOCOLS[authority] ??
    'Trust your body\'s signals — slow down and notice your authentic response before committing.';

  const ctaUrl =
    `https://primeselfengine.com` +
    `?utm_source=discord&utm_medium=bot&utm_campaign=quickstart` +
    `&utm_content=${encodeURIComponent(guildId || 'unknown')}`;

  return {
    title: 'Your Prime Self Quick Start',
    color: EMBED_COLOR,
    fields: [
      {
        name: '🔑 Who You Are',
        value: buildWhoYouAre(chart).slice(0, 1024),
        inline: false,
      },
      {
        name: '⚡ Your Decision Protocol',
        value: protocol.slice(0, 1024),
        inline: false,
      },
      {
        name: '🌀 This Month\'s Energy',
        value: buildTransitContext(chart).slice(0, 1024),
        inline: false,
      },
    ],
    footer: {
      text: EMBED_FOOTER,
      icon_url: THUMBNAIL_URL,
    },
    thumbnail: { url: THUMBNAIL_URL },
    url: ctaUrl,
  };
}

// ─── Discord Follow-up Message ────────────────────────────────────

/**
 * Send or replace the deferred follow-up message.
 * Uses Discord's PATCH followup endpoint to fill in the "thinking..." placeholder.
 * @param {string} applicationId
 * @param {string} interactionToken
 * @param {object} payload - Message payload (embeds, content, flags)
 * @param {string} botToken
 */
async function sendFollowup(applicationId, interactionToken, payload, botToken) {
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${botToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error('[discord] Follow-up failed:', res.status, body);
  }
}

/**
 * Send an ephemeral error follow-up (visible only to the invoking user).
 */
async function sendEphemeralFollowup(applicationId, interactionToken, message, botToken) {
  await sendFollowup(
    applicationId,
    interactionToken,
    { content: message, flags: MessageFlags.EPHEMERAL },
    botToken,
  );
}

// ─── /primself Command Handler ────────────────────────────────────

/**
 * Core command logic — runs inside ctx.waitUntil().
 * Errors are caught and sent as ephemeral messages; never exposed as unhandled rejections.
 */
async function handlePrimself(interaction, env) {
  const { application_id, token, guild_id, member, user } = interaction;
  const userId = (member?.user ?? user)?.id ?? 'unknown';

  // Parse options
  const opts = Object.fromEntries(
    (interaction.data?.options ?? []).map((o) => [o.name, o.value]),
  );
  const { date = '', time = '', city = '' } = opts;

  // Input validation
  const { valid, error: validationError } = validateInputs(date, time, city.trim());
  if (!valid) {
    await sendEphemeralFollowup(
      application_id,
      token,
      `❌ ${validationError}`,
      env.DISCORD_BOT_TOKEN,
    );
    return;
  }

  try {
    // Step 1: Geocode city → lat, lng, timezone
    let geo;
    try {
      geo = await geocodeCity(city.trim(), env.PRIME_SELF_API_URL);
    } catch (err) {
      console.error('[discord] Geocode error:', err.message);
      await sendEphemeralFollowup(
        application_id,
        token,
        `❌ Location not found for **${city}**. Try a more specific city name, e.g. "Tampa, FL, USA".`,
        env.DISCORD_BOT_TOKEN,
      );
      return;
    }

    // Step 2: Calculate chart
    let chart;
    try {
      chart = await calculateChart(
        {
          birthDate: date,
          birthTime: time,
          birthTimezone: geo.timezone,
          lat: geo.lat,
          lng: geo.lng,
        },
        env.PRIME_SELF_API_URL,
      );
    } catch (err) {
      console.error('[discord] Chart engine error:', err.message);
      await sendEphemeralFollowup(
        application_id,
        token,
        '❌ Chart calculation failed — this is usually a temporary issue. Please try again in a moment.',
        env.DISCORD_BOT_TOKEN,
      );
      return;
    }

    // Step 3: Build and send embed
    const embed = buildQuickStartEmbed(chart, guild_id ?? '');
    await sendFollowup(
      application_id,
      token,
      { embeds: [embed] },
      env.DISCORD_BOT_TOKEN,
    );
  } catch (err) {
    // Catch-all — log internally, send generic user message
    console.error('[discord] Unhandled error in handlePrimself:', err);
    await sendEphemeralFollowup(
      application_id,
      token,
      '❌ An unexpected error occurred. Please try again, or visit primeselfengine.com for your full chart.',
      env.DISCORD_BOT_TOKEN,
    );
  }
}

// ─── Worker Entry Point ───────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    // Only POST is valid for Discord interactions
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Read body once — Web Crypto verification needs the raw string,
    // and JSON.parse needs the same content
    const rawBody = await request.text();

    // ── Security: verify Ed25519 signature BEFORE processing ──────
    const isValid = await verifyDiscordSignature(request, rawBody, env.DISCORD_PUBLIC_KEY);
    if (!isValid) {
      return new Response('Unauthorized', { status: 401 });
    }

    let interaction;
    try {
      interaction = JSON.parse(rawBody);
    } catch {
      return new Response('Bad Request', { status: 400 });
    }

    // ── PING — Discord endpoint verification handshake ────────────
    if (interaction.type === InteractionType.PING) {
      return Response.json({ type: InteractionResponseType.PONG });
    }

    // ── APPLICATION_COMMAND ───────────────────────────────────────
    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
      const commandName = interaction.data?.name;

      if (commandName !== 'primself') {
        return Response.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: 'Unknown command.', flags: MessageFlags.EPHEMERAL },
        });
      }

      // Rate limit check (per Discord user ID, rolling 24h window)
      const userId = (interaction.member?.user ?? interaction.user)?.id ?? 'unknown';
      const rl = await checkRateLimit(userId, env);

      if (!rl.allowed) {
        const resetTime = new Date(rl.resetAt);
        const hours = Math.ceil((rl.resetAt - Date.now()) / 3_600_000);
        return Response.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content:
              `⏳ You have used all **${RATE_LIMIT_MAX}** free lookups for today. ` +
              `Your limit resets in approximately **${hours} hour${hours !== 1 ? 's' : ''}** ` +
              `(around ${resetTime.toUTCString()}). ` +
              `Visit [primeselfengine.com](https://primeselfengine.com) for unlimited access.`,
            flags: MessageFlags.EPHEMERAL,
          },
        });
      }

      // Defer immediately — Discord requires a response within 3 seconds
      // The actual computation runs in ctx.waitUntil()
      ctx.waitUntil(handlePrimself(interaction, env));

      return Response.json({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      });
    }

    // Unknown interaction type
    return new Response('Bad Request', { status: 400 });
  },
};

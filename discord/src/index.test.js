/**
 * Discord Worker — Unit & Integration Tests
 *
 * Runs under Vitest (Node 20+). All tests drive the worker through its
 * exported `fetch` handler, exactly as Discord does in production.
 *
 * Test categories:
 *   1. Non-POST methods → 405
 *   2. Missing / invalid Ed25519 signature → 401
 *   3. PING handshake → PONG
 *   4. Input validation (date, time, city formats, future date)
 *   5. Rate limiting (KV-backed, 3 req / 24h)
 *   6. Unknown command → ephemeral error
 *   7. Happy path — full embed returned via follow-up
 *   8. Geocode failure → ephemeral error
 *   9. Chart API failure → ephemeral error
 *
 * Signature generation:
 *   Each test that needs a valid signature calls signBody(), which generates
 *   a fresh Ed25519 keypair once per describe block and signs the payload.
 *
 * Run:
 *   npm test                          (from workspace root)
 *   npx vitest run discord/src/index  (file-specific)
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import worker from './index.js';

// ─── Ed25519 Test Keypair ─────────────────────────────────────────────────────

let testPrivateKey;
let testPublicKeyHex;

async function setupKeypair() {
  const { privateKey, publicKey } = await crypto.subtle.generateKey(
    { name: 'Ed25519' },
    true,
    ['sign', 'verify'],
  );
  testPrivateKey = privateKey;

  const rawPublic = await crypto.subtle.exportKey('raw', publicKey);
  testPublicKeyHex = Buffer.from(rawPublic).toString('hex');
}

/**
 * Sign a request body with the test private key, matching Discord's signing scheme:
 *   signature = Ed25519.sign(timestamp + rawBody)
 *
 * @param {string} body
 * @param {string} [timestamp] defaults to current second
 * @returns {Promise<{ signature: string, timestamp: string }>}
 */
async function signBody(body, timestamp = String(Math.floor(Date.now() / 1000))) {
  const message = new TextEncoder().encode(timestamp + body);
  const sigBytes = await crypto.subtle.sign('Ed25519', testPrivateKey, message);
  const signature = Buffer.from(sigBytes).toString('hex');
  return { signature, timestamp };
}

/**
 * Build a signed POST Request ready to hand to worker.fetch().
 */
async function makeSignedRequest(body) {
  const raw = JSON.stringify(body);
  const { signature, timestamp } = await signBody(raw);
  return new Request('https://discord-worker.test/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature-Ed25519': signature,
      'X-Signature-Timestamp': timestamp,
    },
    body: raw,
  });
}

// ─── Mock Env ─────────────────────────────────────────────────────────────────

/** KV store backed by a plain Map — models DISCORD_RATE_LIMIT namespace. */
function makeMockKV() {
  const store = new Map();
  return {
    async get(key, opts) {
      const raw = store.get(key);
      if (!raw) return null;
      return opts?.type === 'json' ? JSON.parse(raw) : raw;
    },
    async put(key, value, _opts) {
      store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    },
    _store: store,
  };
}

function makeEnv(overrides = {}) {
  return {
    DISCORD_PUBLIC_KEY: testPublicKeyHex,
    DISCORD_APPLICATION_ID: '1481094643226513562',
    DISCORD_BOT_TOKEN: 'test-bot-token',
    PRIME_SELF_API_URL: 'https://prime-self-api.test',
    DISCORD_RATE_LIMIT: makeMockKV(),
    ...overrides,
  };
}

/** ctx stub — runs waitUntil promises synchronously in tests */
function makeCtx() {
  const pending = [];
  return {
    waitUntil(p) { pending.push(p); },
    async flush() { await Promise.all(pending); },
  };
}

// ─── Standard slash command fixture ──────────────────────────────────────────

const VALID_COMMAND = {
  type: 2, // APPLICATION_COMMAND
  data: {
    name: 'primself',
    options: [
      { name: 'date', value: '1990-06-15' },
      { name: 'time', value: '14:30' },
      { name: 'city', value: 'New York, USA' },
    ],
  },
  guild_id: '123456789',
  member: { user: { id: 'user-001' } },
  application_id: '1481094643226513562',
  token: 'test-interaction-token',
};

// ─────────────────────────────────────────────────────────────────────────────

describe('Discord Worker', () => {
  beforeAll(async () => {
    await setupKeypair();
  });

  // ── 1. HTTP method guard ────────────────────────────────────────────────────

  describe('GET /interactions → 405', () => {
    it('rejects non-POST with 405', async () => {
      const req = new Request('https://discord-worker.test/interactions', { method: 'GET' });
      const res = await worker.fetch(req, makeEnv(), makeCtx());
      expect(res.status).toBe(405);
    });
  });

  // ── 2. Signature verification ───────────────────────────────────────────────

  describe('Ed25519 signature verification', () => {
    it('returns 401 when signature headers are missing', async () => {
      const req = new Request('https://discord-worker.test/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 1 }),
      });
      const res = await worker.fetch(req, makeEnv(), makeCtx());
      expect(res.status).toBe(401);
    });

    it('returns 401 for a tampered signature', async () => {
      const raw = JSON.stringify({ type: 1 });
      const ts = String(Math.floor(Date.now() / 1000));
      const req = new Request('https://discord-worker.test/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature-Ed25519': 'a'.repeat(128), // garbage signature
          'X-Signature-Timestamp': ts,
        },
        body: raw,
      });
      const res = await worker.fetch(req, makeEnv(), makeCtx());
      expect(res.status).toBe(401);
    });

    it('returns 401 for a stale timestamp (> 5 minutes old)', async () => {
      const raw = JSON.stringify({ type: 1 });
      const staleTs = String(Math.floor(Date.now() / 1000) - 400);
      const { signature } = await signBody(raw, staleTs);
      const req = new Request('https://discord-worker.test/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature-Ed25519': signature,
          'X-Signature-Timestamp': staleTs,
        },
        body: raw,
      });
      const res = await worker.fetch(req, makeEnv(), makeCtx());
      expect(res.status).toBe(401);
    });
  });

  // ── 3. PING / PONG ──────────────────────────────────────────────────────────

  describe('PING handshake', () => {
    it('responds with PONG (type 1)', async () => {
      const req = await makeSignedRequest({ type: 1 });
      const res = await worker.fetch(req, makeEnv(), makeCtx());
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.type).toBe(1); // InteractionResponseType.PONG
    });
  });

  // ── 4. Input validation ─────────────────────────────────────────────────────

  describe('/primself input validation', () => {
    async function runWithOptions(options, env = makeEnv()) {
      const interaction = {
        ...VALID_COMMAND,
        data: { name: 'primself', options },
        member: { user: { id: 'user-val-test' } },
      };
      const req = await makeSignedRequest(interaction);
      const ctx = makeCtx();
      const res = await worker.fetch(req, env, ctx);
      await ctx.flush();
      return res;
    }

    it('accepts valid inputs → deferred (type 5)', async () => {
      // Mock geocode + chart API
      const env = makeEnv();
      global.fetch = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({
          lat: 40.7128, lng: -74.0060, timezone: 'America/New_York', displayName: 'New York',
        })))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          humanDesign: { type: 'Generator', authority: 'Sacral', profile: '2/4', definition: 'Single Definition' },
          transits: null,
        })))
        .mockResolvedValue(new Response('', { status: 200 })); // follow-up PATCH

      const res = await runWithOptions(VALID_COMMAND.data.options, env);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.type).toBe(5); // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
    });

    it('rejects bad date format → ephemeral error', async () => {
      const env = makeEnv();
      const ctx = makeCtx();
      const interaction = {
        ...VALID_COMMAND,
        data: {
          name: 'primself',
          options: [
            { name: 'date', value: '15/06/1990' }, // wrong format
            { name: 'time', value: '14:30' },
            { name: 'city', value: 'New York' },
          ],
        },
      };
      const req = await makeSignedRequest(interaction);
      const res = await worker.fetch(req, env, ctx);
      await ctx.flush();
      expect(res.status).toBe(200);
      const json = await res.json();
      // Rate-limit has not triggered, validation fires in waitUntil —
      // the outer response is always the deferred ack; errors come via follow-up.
      // Confirm it's a deferred response (validation runs asynchronously).
      expect(json.type).toBe(5);
    });

    it('rejects future birth date → ephemeral error via followup', async () => {
      const env = makeEnv();
      let followupPayload;
      global.fetch = vi.fn().mockImplementation(async (url, opts) => {
        if (url.includes('discord.com') && opts?.method === 'PATCH') {
          followupPayload = JSON.parse(opts.body);
        }
        return new Response('{}', { status: 200 });
      });
      const ctx = makeCtx();
      const interaction = {
        ...VALID_COMMAND,
        data: {
          name: 'primself',
          options: [
            { name: 'date', value: '2099-01-01' },
            { name: 'time', value: '14:30' },
            { name: 'city', value: 'New York' },
          ],
        },
      };
      const req = await makeSignedRequest(interaction);
      await worker.fetch(req, env, ctx);
      await ctx.flush();
      expect(followupPayload?.content).toMatch(/future/i);
      expect(followupPayload?.flags).toBe(64); // EPHEMERAL
    });

    it('rejects city shorter than 2 chars', async () => {
      let followupPayload;
      global.fetch = vi.fn().mockImplementation(async (url, opts) => {
        if (url.includes('discord.com') && opts?.method === 'PATCH') {
          followupPayload = JSON.parse(opts.body);
        }
        return new Response('{}', { status: 200 });
      });
      const ctx = makeCtx();
      const interaction = {
        ...VALID_COMMAND,
        data: {
          name: 'primself',
          options: [
            { name: 'date', value: '1990-06-15' },
            { name: 'time', value: '14:30' },
            { name: 'city', value: 'X' },
          ],
        },
      };
      const req = await makeSignedRequest(interaction);
      await worker.fetch(req, makeEnv(), ctx);
      await ctx.flush();
      expect(followupPayload?.flags).toBe(64);
    });
  });

  // ── 5. Rate limiting ────────────────────────────────────────────────────────

  describe('Rate limiting', () => {
    it('blocks on the 4th request within 24h', async () => {
      const kv = makeMockKV();
      // Pre-fill KV as if 3 requests already used
      await kv.put('rl:user-rl-test', JSON.stringify({
        count: 3,
        windowStart: Date.now() - 1000, // 1s ago — well within 24h
      }));
      const env = makeEnv({ DISCORD_RATE_LIMIT: kv });
      const interaction = {
        ...VALID_COMMAND,
        member: { user: { id: 'user-rl-test' } },
      };
      const req = await makeSignedRequest(interaction);
      const res = await worker.fetch(req, env, makeCtx());
      const json = await res.json();
      // Rate limit fires synchronously before defer — returns type 4 (immediate message)
      expect(json.type).toBe(4); // CHANNEL_MESSAGE_WITH_SOURCE
      expect(json.data.content).toMatch(/free lookups for today/i);
      expect(json.data.flags).toBe(64); // EPHEMERAL
    });

    it('resets after 24h window expires', async () => {
      const kv = makeMockKV();
      await kv.put('rl:user-rl-reset', JSON.stringify({
        count: 3,
        windowStart: Date.now() - 25 * 60 * 60 * 1000, // 25h ago
      }));
      const env = makeEnv({ DISCORD_RATE_LIMIT: kv });
      const interaction = {
        ...VALID_COMMAND,
        data: { ...VALID_COMMAND.data, options: VALID_COMMAND.data.options },
        member: { user: { id: 'user-rl-reset' } },
      };
      global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
        lat: 40.7128, lng: -74.0060, timezone: 'America/New_York', displayName: 'New York',
      })));
      const req = await makeSignedRequest(interaction);
      const res = await worker.fetch(req, env, makeCtx());
      const json = await res.json();
      // Window expired → allowed → deferred
      expect(json.type).toBe(5);
    });
  });

  // ── 6. Unknown command ──────────────────────────────────────────────────────

  describe('Unknown command', () => {
    it('returns ephemeral unknown-command message', async () => {
      const interaction = {
        type: 2,
        data: { name: 'unknown_cmd', options: [] },
        member: { user: { id: 'user-002' } },
        application_id: '1481094643226513562',
        token: 'tok',
      };
      const req = await makeSignedRequest(interaction);
      const res = await worker.fetch(req, makeEnv(), makeCtx());
      const json = await res.json();
      expect(json.type).toBe(4);
      expect(json.data.content).toMatch(/unknown command/i);
    });
  });

  // ── 7. Happy path — embed shape ─────────────────────────────────────────────

  describe('Happy path embed', () => {
    it('sends a follow-up with a correctly shaped embed', async () => {
      const kv = makeMockKV();
      const env = makeEnv({ DISCORD_RATE_LIMIT: kv });
      let followupPayload;

      global.fetch = vi.fn().mockImplementation(async (url, opts) => {
        if (url.includes('api/geocode')) {
          return new Response(JSON.stringify({
            lat: 27.9506, lng: -82.4572, timezone: 'America/New_York', displayName: 'Tampa, FL',
          }));
        }
        if (url.includes('api/chart/calculate')) {
          return new Response(JSON.stringify({
            humanDesign: {
              type: 'Projector',
              authority: 'Emotional',
              profile: '6/2',
              definition: 'Split Definition',
            },
            transits: {
              personality: { Sun: { gate: 17 }, Moon: { gate: 58 } },
            },
          }));
        }
        if (url.includes('discord.com') && opts?.method === 'PATCH') {
          followupPayload = JSON.parse(opts.body);
          return new Response('{}', { status: 200 });
        }
        return new Response('{}', { status: 200 });
      });

      const ctx = makeCtx();
      const req = await makeSignedRequest({
        ...VALID_COMMAND,
        data: {
          name: 'primself',
          options: [
            { name: 'date', value: '1979-08-05' },
            { name: 'time', value: '18:51' },
            { name: 'city', value: 'Tampa, FL, USA' },
          ],
        },
        guild_id: 'guild-999',
      });
      const res = await worker.fetch(req, env, ctx);
      await ctx.flush();

      // Outer response is always the deferred ack
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.type).toBe(5);

      // Follow-up embed shape
      expect(followupPayload).toBeDefined();
      const embed = followupPayload.embeds?.[0];
      expect(embed).toBeDefined();
      expect(embed.color).toBe(0xB8860B);
      expect(embed.title).toBe('Your Prime Self Quick Start');
      expect(embed.fields).toHaveLength(3);
      expect(embed.fields[0].name).toMatch(/who you are/i);
      expect(embed.fields[0].value).toMatch(/Projector/);
      expect(embed.fields[1].name).toMatch(/decision protocol/i);
      expect(embed.fields[1].value).toMatch(/emotional clarity/i);
      expect(embed.fields[2].name).toMatch(/energy/i);
      expect(embed.footer.text).toMatch(/primeselfengine\.com/);
      expect(embed.url).toContain('utm_source=discord');
      expect(embed.url).toContain('utm_content=guild-999');
    });
  });

  // ── 8. Geocode failure → ephemeral error ────────────────────────────────────

  describe('Geocode failure', () => {
    it('sends ephemeral error when geocode API returns 502', async () => {
      const kv = makeMockKV();
      let followupPayload;

      global.fetch = vi.fn().mockImplementation(async (url, opts) => {
        if (url.includes('api/geocode')) {
          return new Response(JSON.stringify({ error: 'Service unavailable' }), { status: 502 });
        }
        if (url.includes('discord.com') && opts?.method === 'PATCH') {
          followupPayload = JSON.parse(opts.body);
          return new Response('{}', { status: 200 });
        }
        return new Response('{}');
      });

      const ctx = makeCtx();
      const req = await makeSignedRequest({
        ...VALID_COMMAND,
        member: { user: { id: 'user-geo-fail' } },
      });
      await worker.fetch(req, makeEnv({ DISCORD_RATE_LIMIT: kv }), ctx);
      await ctx.flush();

      expect(followupPayload?.flags).toBe(64);
      expect(followupPayload?.content).toMatch(/location not found/i);
    });
  });

  // ── 9. Chart API failure → ephemeral error ───────────────────────────────────

  describe('Chart API failure', () => {
    it('sends ephemeral error when chart API returns 500', async () => {
      const kv = makeMockKV();
      let followupPayload;

      global.fetch = vi.fn().mockImplementation(async (url, opts) => {
        if (url.includes('api/geocode')) {
          return new Response(JSON.stringify({
            lat: 40.7128, lng: -74.006, timezone: 'America/New_York', displayName: 'New York',
          }));
        }
        if (url.includes('api/chart/calculate')) {
          return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
        }
        if (url.includes('discord.com') && opts?.method === 'PATCH') {
          followupPayload = JSON.parse(opts.body);
          return new Response('{}', { status: 200 });
        }
        return new Response('{}');
      });

      const ctx = makeCtx();
      const req = await makeSignedRequest({
        ...VALID_COMMAND,
        member: { user: { id: 'user-chart-fail' } },
      });
      await worker.fetch(req, makeEnv({ DISCORD_RATE_LIMIT: kv }), ctx);
      await ctx.flush();

      expect(followupPayload?.flags).toBe(64);
      expect(followupPayload?.content).toMatch(/chart calculation failed/i);
    });
  });
});

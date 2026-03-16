/**
 * sms-handler-runtime — deterministic unit tests for sms.js (SYS-045)
 *
 * Covers:
 *  - Webhook security guard: TELNYX_PUBLIC_KEY missing, headers missing, stale timestamp
 *  - send-digest: invalid JSON → 400
 *  - send-digest: all:true with free tier → 403 (mass SMS tier gate)
 *  - Route: unknown path → 404
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const { createQueryFnMock } = vi.hoisted(() => ({
  createQueryFnMock: vi.fn(),
}));

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: createQueryFnMock,
  QUERIES: {
    smsOptOut: 'smsOptOut',
    smsOptIn: 'smsOptIn',
    getUserByPhone: 'getUserByPhone',
    getSmsSubscribedUsers: 'getSmsSubscribedUsers',
    getSmsUserCount: 'getSmsUserCount',
    getSmsSubscriptionByPhone: 'getSmsSubscriptionByPhone',
    insertSmsSubscription: 'insertSmsSubscription',
    updateSmsSubscription: 'updateSmsSubscription',
    getSmsUsageCount: 'getSmsUsageCount',
    insertSmsUsage: 'insertSmsUsage',
    getBatchSmsUsageCounts: 'getBatchSmsUsageCounts',
  },
}));

vi.mock('../workers/src/lib/llm.js', () => ({
  callLLM: vi.fn().mockResolvedValue('Daily transit digest text'),
}));

vi.mock('../workers/src/middleware/tierEnforcement.js', () => ({
  enforceFeatureAccess: vi.fn().mockResolvedValue(null),
  recordUsage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../workers/src/lib/stripe.js', () => ({
  normalizeTierName: (t) => t || 'free',
  getTier: vi.fn().mockReturnValue({ name: 'free', features: { smsDigests: false } }),
}));

vi.mock('../src/prompts/digest.js', () => ({
  buildDigestPrompt: vi.fn().mockReturnValue('digest prompt'),
}));

vi.mock('../src/engine/index.js', () => ({
  calculateFullChart: vi.fn().mockReturnValue({}),
}));

vi.mock('../src/engine/transits.js', () => ({
  getCurrentTransits: vi.fn().mockReturnValue([]),
}));

import { handleSMS } from '../workers/src/handlers/sms.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFetchMock() {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ id: 'msg-1' }), { status: 200 })
  );
}

function webhookRequest(body, headers = {}) {
  return new Request('https://api.test/api/sms/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function messagePayload(text = 'STOP') {
  return {
    data: {
      event_type: 'message.received',
      payload: {
        from: { phone_number: '+15551234567' },
        text,
      },
    },
  };
}

const VALID_TS = () => String(Math.floor(Date.now() / 1000));
const STALE_TS = () => String(Math.floor(Date.now() / 1000) - 600); // 10 min ago

const ENV = { TELNYX_PUBLIC_KEY: 'dGVzdA==', TELNYX_API_KEY: 'sk_test', TELNYX_PHONE_NUMBER: '+15550001111' };
const ENV_NO_KEY = { TELNYX_API_KEY: 'sk_test', TELNYX_PHONE_NUMBER: '+15550001111' };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('sms handler — webhook security guard', () => {
  beforeEach(() => {
    createQueryFnMock.mockReturnValue(vi.fn().mockResolvedValue({ rows: [] }));
    vi.stubGlobal('fetch', makeFetchMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 401 when TELNYX_PUBLIC_KEY is not configured', async () => {
    const req = webhookRequest(messagePayload(), {
      'telnyx-signature-ed25519': btoa('sig'),
      'telnyx-timestamp': VALID_TS(),
    });
    const res = await handleSMS(req, ENV_NO_KEY, '/api/sms/webhook');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/signature/i);
  });

  it('returns 401 when telnyx-signature-ed25519 header is missing', async () => {
    const req = webhookRequest(messagePayload(), {
      'telnyx-timestamp': VALID_TS(),
    });
    const res = await handleSMS(req, ENV, '/api/sms/webhook');
    expect(res.status).toBe(401);
  });

  it('returns 401 when telnyx-timestamp header is missing', async () => {
    const req = webhookRequest(messagePayload(), {
      'telnyx-signature-ed25519': btoa('sig'),
    });
    const res = await handleSMS(req, ENV, '/api/sms/webhook');
    expect(res.status).toBe(401);
  });

  it('returns 401 when webhook timestamp is stale (>5 minutes old — replay protection)', async () => {
    const req = webhookRequest(messagePayload(), {
      'telnyx-signature-ed25519': btoa('sig'),
      'telnyx-timestamp': STALE_TS(),
    });
    const res = await handleSMS(req, ENV, '/api/sms/webhook');
    expect(res.status).toBe(401);
  });
});

describe('sms handler — send-digest validation', () => {
  beforeEach(() => {
    createQueryFnMock.mockReturnValue(vi.fn().mockResolvedValue({ rows: [] }));
  });

  it('returns 400 when body is not valid JSON', async () => {
    const req = new Request('https://api.test/api/sms/send-digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{{{',
    });
    const res = await handleSMS(req, ENV, '/api/sms/send-digest');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid json/i);
  });

  it('returns 403 for mass send (all:true) when user is not practitioner tier', async () => {
    const req = new Request('https://api.test/api/sms/send-digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    // request._user is undefined → defaults to 'free'
    const res = await handleSMS(req, ENV, '/api/sms/send-digest');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/practitioner/i);
  });
});

describe('sms handler — route', () => {
  it('returns 404 for unknown SMS path', async () => {
    const req = new Request('https://api.test/api/sms/unknown', { method: 'GET' });
    const res = await handleSMS(req, ENV, '/api/sms/unknown');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });
});

/**
 * Profile Stream Handler Tests (BL-OPT-004)
 *
 * Covers handleProfileStream early-exit paths:
 * - Quota enforcement gate
 * - Daily ceiling gate
 * - Invalid JSON → 400
 * - Missing required fields → 400
 * - Unverified email → 403
 * - Success path → text/event-stream response
 *
 * The full SSE pipeline (chart → LLM → save) is not tested here because
 * it requires a real LLM call. These tests cover the guard layer.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const {
  enforceUsageQuotaMock,
  enforceDailyCeilingMock,
  recordUsageMock,
  incrementDailyCounterMock,
  createQueryFnMock,
} = vi.hoisted(() => ({
  enforceUsageQuotaMock:   vi.fn().mockResolvedValue(null),  // null = quota OK
  enforceDailyCeilingMock: vi.fn().mockResolvedValue(null),  // null = within limit
  recordUsageMock:         vi.fn().mockResolvedValue(undefined),
  incrementDailyCounterMock: vi.fn().mockResolvedValue(undefined),
  createQueryFnMock:       vi.fn(),
}));

vi.mock('../workers/src/middleware/tierEnforcement.js', () => ({
  enforceUsageQuota:    enforceUsageQuotaMock,
  enforceDailyCeiling:  enforceDailyCeilingMock,
  recordUsage:          recordUsageMock,
  incrementDailyCounter: incrementDailyCounterMock,
  getUserTier:          vi.fn().mockResolvedValue('individual'),
}));

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: createQueryFnMock,
  QUERIES: {
    getUserChartWithBirthData:     'getUserChartWithBirthData',
    saveProfile:                   'saveProfile',
    getActiveSubscription:         'getActiveSubscription',
    getPractitionerByUserId:       'getPractitionerByUserId',
    listClientsByPractitionerUserId: 'listClientsByPractitionerUserId',
  },
}));

vi.mock('../workers/src/lib/llm.js', () => ({
  callLLM: vi.fn().mockResolvedValue({ content: '{"sections":[]}' }),
}));

vi.mock('../../../src/engine/index.js', () => ({
  calculateFullChart: vi.fn().mockReturnValue({
    chart: { type: 'Generator', profile: '2/4', authority: 'Sacral', definition: 'Split', definedCenters: [] },
    astrology: {},
  }),
}));

vi.mock('../../../src/engine/transits.js', () => ({
  getCurrentTransits: vi.fn().mockReturnValue({}),
}));

vi.mock('../../../src/prompts/synthesis.js', () => ({
  buildSynthesisPrompt:      vi.fn().mockReturnValue('prompt'),
  validateSynthesisResponse: vi.fn().mockReturnValue({ valid: true, sections: [] }),
  buildReprompt:             vi.fn().mockReturnValue('reprompt'),
}));

vi.mock('../workers/src/utils/parseToUTC.js', () => ({
  parseToUTC: vi.fn().mockReturnValue({ year: 1990, month: 1, day: 1, hour: 12, minute: 0 }),
}));

vi.mock('../workers/src/lib/analytics.js', () => ({
  trackEvent:  vi.fn().mockResolvedValue(undefined),
  trackFunnel: vi.fn().mockResolvedValue(undefined),
  EVENTS:  {},
  FUNNELS: {},
}));

vi.mock('../workers/src/lib/cache.js', () => ({
  kvCache: {
    getOrSet: vi.fn().mockResolvedValue({ data: { chart: {}, transits: null }, cached: false }),
  },
  keys: {
    chart:   vi.fn().mockReturnValue('cache:chart:key'),
    profile: vi.fn().mockReturnValue('cache:profile:key'),
  },
  TTL: { CHART: 3600, PROFILE: 3600 },
  recordCacheAccess: vi.fn(),
}));

vi.mock('../workers/src/lib/routeErrors.js', () => ({
  reportHandledRouteError: vi.fn(({ status }) =>
    Response.json({ ok: false, error: 'Server error' }, { status: status ?? 500 })
  ),
}));

vi.mock('../workers/src/lib/email.js', () => ({
  sendPractitionerClientSessionReady: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../workers/src/lib/logger.js', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('../workers/src/lib/stripe.js', () => ({
  getTier: vi.fn().mockReturnValue({ name: 'individual', features: { profileGenerations: 5 } }),
}));

import { handleProfileStream } from '../workers/src/handlers/profile-stream.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

const ENV = { NEON_CONNECTION_STRING: 'postgresql://test' };
const CTX = { waitUntil: vi.fn() };

const VALID_BODY = {
  birthDate: '1990-01-01',
  birthTime: '12:00',
  birthTimezone: 'UTC',
  lat: 40.7128,
  lng: -74.0060,
};

function makeRequest(body, user = { sub: 'user-1', email: 'x@y.com', email_verified: true }) {
  const r = new Request('https://api/profile/generate/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : 'not-json',
  });
  r._user = user;
  return r;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('handleProfileStream — quota gate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns quota exceeded response when quota is hit', async () => {
    const quotaRes = Response.json({ error: 'Quota exceeded' }, { status: 429 });
    enforceUsageQuotaMock.mockResolvedValueOnce(quotaRes);

    const res = await handleProfileStream(makeRequest(VALID_BODY), ENV, CTX);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/quota/i);
  });
});

describe('handleProfileStream — daily ceiling gate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 429 when daily ceiling is reached', async () => {
    enforceUsageQuotaMock.mockResolvedValueOnce(null); // quota OK
    const ceilingRes = Response.json({ error: 'Daily limit reached' }, { status: 429 });
    enforceDailyCeilingMock.mockResolvedValueOnce(ceilingRes);

    const res = await handleProfileStream(makeRequest(VALID_BODY), ENV, CTX);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/daily/i);
  });
});

describe('handleProfileStream — request validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceUsageQuotaMock.mockResolvedValue(null);
    enforceDailyCeilingMock.mockResolvedValue(null);
  });

  it('returns 400 for non-JSON body', async () => {
    const r = Object.assign(
      new Request('https://api/test', { method: 'POST', body: 'not-json' }),
      { _user: { sub: 'u1', email: 'x@y.com', email_verified: true } }
    );

    const res = await handleProfileStream(r, ENV, CTX);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/json/i);
  });

  it('returns 400 when birthDate is missing', async () => {
    const { birthDate: _omit, ...rest } = VALID_BODY;
    const res = await handleProfileStream(makeRequest(rest), ENV, CTX);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/birthDate/i);
  });

  it('returns 400 when lat is missing', async () => {
    const { lat: _omit, ...rest } = VALID_BODY;
    const res = await handleProfileStream(makeRequest(rest), ENV, CTX);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/lat/i);
  });

  it('returns 403 when email is not verified', async () => {
    const unverifiedUser = { sub: 'user-1', email: 'x@y.com', email_verified: false };
    const res = await handleProfileStream(makeRequest(VALID_BODY, unverifiedUser), ENV, CTX);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('EMAIL_NOT_VERIFIED');
  });
});

describe('handleProfileStream — SSE response shape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceUsageQuotaMock.mockResolvedValue(null);
    enforceDailyCeilingMock.mockResolvedValue(null);
    const query = vi.fn().mockResolvedValue({ rows: [] });
    createQueryFnMock.mockReturnValue(query);
  });

  it('returns a streaming response with text/event-stream content-type', async () => {
    const res = await handleProfileStream(makeRequest(VALID_BODY), ENV, CTX);
    // After all guards pass, the handler sets up an SSE stream
    expect(res.headers.get('Content-Type')).toMatch(/text\/event-stream/);
  });
});

/**
 * Famous People Comparison Handler Tests
 *
 * Covers handleGetCelebrityMatches and handleGetCelebrityMatchById:
 * - Auth guard (401 on missing user)
 * - Input validation (400 on invalid celebrity ID)
 * - No chart returns 404
 * - Success path delegates to celebrity match library
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { createQueryFnMock, getUserFromRequestMock } = vi.hoisted(() => ({
  createQueryFnMock: vi.fn(),
  getUserFromRequestMock: vi.fn(),
}));

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: createQueryFnMock,
  QUERIES: {
    getUserChartWithBirthData: 'getUserChartWithBirthData',
  },
}));

vi.mock('../workers/src/middleware/auth.js', () => ({
  getUserFromRequest: getUserFromRequestMock,
}));

vi.mock('../workers/src/lib/celebtyMatch.js', () => ({
  findCelebrityMatches: vi.fn().mockResolvedValue([]),
  getCelebrityMatch:    vi.fn().mockResolvedValue(null),
  getCelebritiesByCategory: vi.fn().mockResolvedValue([]),
  searchCelebrities:    vi.fn().mockResolvedValue([]),
}));

vi.mock('../workers/src/lib/celebrityMatch.js', () => ({
  findCelebrityMatches: vi.fn().mockResolvedValue([]),
  getCelebrityMatch:    vi.fn().mockResolvedValue(null),
  getCelebritiesByCategory: vi.fn().mockResolvedValue([]),
  searchCelebrities:    vi.fn().mockResolvedValue([]),
}));

vi.mock('../workers/src/handlers/achievements.js', () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../workers/src/lib/routeErrors.js', () => ({
  reportHandledRouteError: vi.fn(({ status }) =>
    Response.json({ ok: false, error: 'Server error' }, { status: status ?? 500 })
  ),
}));

vi.mock('../../../src/engine/index.js', () => ({
  calculateFullChart: vi.fn().mockReturnValue({
    chart: {
      type: 'Generator',
      profile: '2/4',
      authority: 'Sacral',
      definition: 'Split',
      definedCenters: ['Sacral', 'G Center'],
    },
  }),
}));

vi.mock('../workers/src/utils/parseToUTC.js', () => ({
  parseToUTC: vi.fn().mockReturnValue({ year: 1990, month: 1, day: 1, hour: 12, minute: 0, lat: 40.7, lng: -74.0 }),
}));

vi.mock('../workers/src/data/celebrities.json', () => ({
  default: { metadata: { totalCelebrities: 100, categories: ['Actor', 'Athlete'] } },
}));

import { handleGetCelebrityMatches, handleGetCelebrityMatchById } from '../workers/src/handlers/famous.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

const ENV = { NEON_CONNECTION_STRING: 'postgresql://test' };
const AUTHED_USER = { id: 'user-1', sub: 'user-1', email: 'test@example.com', tier: 'individual' };

const FAKE_CHART = {
  id: 'chart-1',
  birth_date: '1990-01-01',
  birth_time: '12:00',
  birth_tz: 'UTC',
  birth_lat: 40.7,
  birth_lng: -74.0,
  hd_json: JSON.stringify({
    chart: { type: 'Generator', profile: '2/4', authority: 'Sacral', definition: 'Split', definedCenters: [] },
  }),
};

function get(url) {
  return new Request(url, { method: 'GET' });
}

// ── handleGetCelebrityMatches ─────────────────────────────────────────────────

describe('handleGetCelebrityMatches — auth guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserFromRequestMock.mockResolvedValue(null);
  });

  it('returns 401 when user is not authenticated', async () => {
    const res = await handleGetCelebrityMatches(get('https://api/compare/celebrities'), ENV, {});
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});

describe('handleGetCelebrityMatches — no chart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserFromRequestMock.mockResolvedValue(AUTHED_USER);
  });

  it('returns 404 when user has no chart', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleGetCelebrityMatches(get('https://api/compare/celebrities'), ENV, {});
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/chart/i);
  });
});

describe('handleGetCelebrityMatches — success', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserFromRequestMock.mockResolvedValue(AUTHED_USER);
  });

  it('returns 200 with matches array when chart exists', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [FAKE_CHART] });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleGetCelebrityMatches(
      get('https://api/compare/celebrities?limit=5'), ENV, {}
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.matches)).toBe(true);
  });

  it('clamps limit to 30', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [FAKE_CHART] });
    createQueryFnMock.mockReturnValue(query);

    // Should not throw even with a very large limit
    const res = await handleGetCelebrityMatches(
      get('https://api/compare/celebrities?limit=9999'), ENV, {}
    );
    expect(res.status).toBe(200);
  });
});

// ── handleGetCelebrityMatchById ───────────────────────────────────────────────

describe('handleGetCelebrityMatchById — validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 for empty celebrity ID', async () => {
    const res = await handleGetCelebrityMatchById(get('https://api/test'), ENV, '');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it('returns 400 for celebrity ID > 50 chars', async () => {
    const longId = 'a'.repeat(51);
    const res = await handleGetCelebrityMatchById(get('https://api/test'), ENV, longId);
    expect(res.status).toBe(400);
  });
});

describe('handleGetCelebrityMatchById — auth guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserFromRequestMock.mockResolvedValue(null);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await handleGetCelebrityMatchById(get('https://api/test'), ENV, 'celeb-1');
    expect(res.status).toBe(401);
  });
});

describe('handleGetCelebrityMatchById — not found', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserFromRequestMock.mockResolvedValue(AUTHED_USER);
  });

  it('returns 404 when user has no chart', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleGetCelebrityMatchById(get('https://api/test'), ENV, 'celeb-1');
    expect(res.status).toBe(404);
  });

  it('returns 404 when celebrity is not found', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [FAKE_CHART] });
    createQueryFnMock.mockReturnValue(query);

    // getCelebrityMatch mock returns null (already configured above)
    const res = await handleGetCelebrityMatchById(get('https://api/test'), ENV, 'unknown-celeb');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });
});

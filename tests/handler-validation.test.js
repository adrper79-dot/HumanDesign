/**
 * Handler Validation Tests — Auth & Input Validation
 *
 * Tests auth rejection and input validation for DB-dependent handlers.
 * DB queries are mocked so these run without a live database.
 * Focus: every handler returns correct 4xx before touching the DB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock DB ─────────────────────────────────────────────────

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: vi.fn(() => vi.fn().mockResolvedValue({ rows: [] })),
  QUERIES: new Proxy({}, { get: (_t, p) => p }),
}));

// ─── Mock auth middleware ─────────────────────────────────────

vi.mock('../workers/src/middleware/auth.js', () => ({
  getUserFromRequest: vi.fn().mockResolvedValue(null),
}));

// ─── Mock tier enforcement ────────────────────────────────────

vi.mock('../workers/src/middleware/tierEnforcement.js', () => ({
  enforceFeatureAccess: vi.fn().mockResolvedValue(null),
}));

// ─── Mock push notifications (used by achievements trackEvent) ─

vi.mock('../workers/src/handlers/push.js', () => ({
  sendNotificationToUser: vi.fn().mockResolvedValue(undefined),
}));

import { getUserFromRequest } from '../workers/src/middleware/auth.js';
import { handleAgency }           from '../workers/src/handlers/agency.js';
import { handleCheckinCreate }    from '../workers/src/handlers/checkin.js';
import { handleGetAchievements }  from '../workers/src/handlers/achievements.js';
import {
  handleListNotes,
  handleCreateNote,
} from '../workers/src/handlers/session-notes.js';

// ─── Helpers ──────────────────────────────────────────────────

const mockEnv = {
  NEON_CONNECTION_STRING: 'postgresql://test',
  JWT_SECRET: 'test-secret',
};

function makeRequest(method, url, body, extraProps = {}) {
  const init = { method, headers: { 'Content-Type': 'application/json' } };
  if (body && method !== 'GET') init.body = JSON.stringify(body);
  const req = new Request(url, init);
  return Object.assign(req, extraProps);
}

function makeGetRequest(url, extraProps = {}) {
  const req = new Request(url, { method: 'GET' });
  return Object.assign(req, extraProps);
}

beforeEach(() => {
  vi.mocked(getUserFromRequest).mockResolvedValue(null);
});

// ─── Agency handler ───────────────────────────────────────────

describe('handleAgency — auth and routing', () => {
  it('returns 401 when _user is not set', async () => {
    const req = makeGetRequest('https://api.test/api/agency/seats');
    const res = await handleAgency(req, mockEnv, '/seats');
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/authentication/i);
  });

  it('returns 404 for unknown subpath', async () => {
    const req = makeGetRequest('https://api.test/api/agency/unknown',
      { _user: { sub: 'user-1', tier: 'agency' } });
    const res = await handleAgency(req, mockEnv, '/unknown');
    expect(res.status).toBe(404);
  });

  it('returns 400 for invite with invalid email', async () => {
    const req = makeRequest('POST',
      'https://api.test/api/agency/seats/invite',
      { email: 'not-an-email' },
      { _user: { sub: 'user-1', tier: 'agency' } }
    );
    const res = await handleAgency(req, mockEnv, '/seats/invite');
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/email/i);
  });

  it('returns 400 for invite with missing email', async () => {
    const req = makeRequest('POST',
      'https://api.test/api/agency/seats/invite',
      {},
      { _user: { sub: 'user-1', tier: 'agency' } }
    );
    const res = await handleAgency(req, mockEnv, '/seats/invite');
    expect(res.status).toBe(400);
  });
});

// ─── Checkin handler ──────────────────────────────────────────

describe('handleCheckinCreate — auth and validation', () => {
  it('returns 401 when user is not authenticated', async () => {
    const req = makeRequest('POST', 'https://api.test/api/checkin', {
      alignmentScore: 7,
      followedStrategy: true,
      followedAuthority: true,
    });
    // getUserFromRequest already mocked to return null by default
    const res = await handleCheckinCreate(req, mockEnv, {});
    expect(res.status).toBe(401);
  });

  it('returns 400 when alignmentScore is missing', async () => {
    vi.mocked(getUserFromRequest).mockResolvedValueOnce({ id: 'u1', tier: 'free' });
    const req = makeRequest('POST', 'https://api.test/api/checkin', {
      followedStrategy: true,
      followedAuthority: true,
    });
    const res = await handleCheckinCreate(req, mockEnv, {});
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/alignmentScore/i);
  });

  it('returns 400 when alignmentScore is out of range', async () => {
    vi.mocked(getUserFromRequest).mockResolvedValueOnce({ id: 'u1', tier: 'free' });
    const req = makeRequest('POST', 'https://api.test/api/checkin', {
      alignmentScore: 11,
      followedStrategy: true,
      followedAuthority: true,
    });
    const res = await handleCheckinCreate(req, mockEnv, {});
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/alignmentScore/i);
  });

  it('returns 400 when followedStrategy is not boolean', async () => {
    vi.mocked(getUserFromRequest).mockResolvedValueOnce({ id: 'u1', tier: 'free' });
    const req = makeRequest('POST', 'https://api.test/api/checkin', {
      alignmentScore: 7,
      followedStrategy: 'yes',
      followedAuthority: true,
    });
    const res = await handleCheckinCreate(req, mockEnv, {});
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/followedStrategy/i);
  });

  it('returns 400 when mood is invalid', async () => {
    vi.mocked(getUserFromRequest).mockResolvedValueOnce({ id: 'u1', tier: 'free' });
    const req = makeRequest('POST', 'https://api.test/api/checkin', {
      alignmentScore: 7,
      followedStrategy: true,
      followedAuthority: true,
      mood: 'fantastic',
    });
    const res = await handleCheckinCreate(req, mockEnv, {});
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/mood/i);
  });

  it('returns 400 when notes exceed 2000 characters', async () => {
    vi.mocked(getUserFromRequest).mockResolvedValueOnce({ id: 'u1', tier: 'free' });
    const req = makeRequest('POST', 'https://api.test/api/checkin', {
      alignmentScore: 7,
      followedStrategy: true,
      followedAuthority: true,
      notes: 'x'.repeat(2001),
    });
    const res = await handleCheckinCreate(req, mockEnv, {});
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/notes/i);
  });
});

// ─── Achievements handler ─────────────────────────────────────

describe('handleGetAchievements — auth', () => {
  it('returns 401 when user is not authenticated', async () => {
    const req = makeGetRequest('https://api.test/api/achievements');
    const res = await handleGetAchievements(req, mockEnv, {});
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/authentication/i);
  });
});

// ─── Session-notes handler ────────────────────────────────────

describe('handleListNotes — auth (null guard fix)', () => {
  it('returns 401 when _user is undefined', async () => {
    const req = makeGetRequest('https://api.test/api/session-notes');
    // _user is not set on the request
    const res = await handleListNotes(req, mockEnv);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/authentication/i);
  });

  it('returns 401 when _user.sub is missing', async () => {
    const req = makeGetRequest('https://api.test/api/session-notes',
      { _user: {} }  // _user exists but no sub
    );
    const res = await handleListNotes(req, mockEnv);
    expect(res.status).toBe(401);
  });
});

describe('handleCreateNote — auth and validation', () => {
  it('returns 401 when _user is undefined', async () => {
    const req = makeRequest('POST', 'https://api.test/api/session-notes',
      { clientId: 'c1', content: 'Note body' }
    );
    const res = await handleCreateNote(req, mockEnv);
    expect(res.status).toBe(401);
  });
});

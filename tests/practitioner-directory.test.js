/**
 * Practitioner Directory Handler Tests
 *
 * Covers handleListDirectory, handleGetPublicProfile,
 * handleGetDirectoryProfile, and handleUpdateDirectoryProfile.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { createQueryFnMock } = vi.hoisted(() => ({
  createQueryFnMock: vi.fn(),
}));

const { enforceFeatureAccessMock } = vi.hoisted(() => ({
  enforceFeatureAccessMock: vi.fn(),
}));

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: createQueryFnMock,
  QUERIES: {
    listPublicPractitioners:         'listPublicPractitioners',
    searchPublicPractitioners:        'searchPublicPractitioners',
    getPractitionerBySlug:            'getPractitionerBySlug',
    getPractitionerDirectoryProfile:  'getPractitionerDirectoryProfile',
    getPractitionerDirectoryProfileLegacy: 'getPractitionerDirectoryProfileLegacy',
    updatePractitionerProfile:        'updatePractitionerProfile',
    getPractitionerByUserId:          'getPractitionerByUserId',
    getPractitionerDirectoryViewStats:'getPractitionerDirectoryViewStats',
  },
}));

vi.mock('../workers/src/middleware/tierEnforcement.js', () => ({
  enforceFeatureAccess: enforceFeatureAccessMock,
}));

vi.mock('../workers/src/lib/analytics.js', () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
  captureRequestContext: vi.fn().mockReturnValue({}),
}));

import {
  handleListDirectory,
  handleGetPublicProfile,
  handleGetDirectoryProfile,
  handleUpdateDirectoryProfile,
  handleGetDirectoryStats,
} from '../workers/src/handlers/practitioner-directory.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const ENV = { NEON_CONNECTION_STRING: 'postgresql://test' };

function req(method, url, body, user = null) {
  const init = { method, headers: { 'Content-Type': 'application/json' } };
  if (body && method !== 'GET') init.body = JSON.stringify(body);
  return Object.assign(new Request(url, init), { _user: user });
}

const PUBLIC_PRACTITIONER = {
  id: 'pract-1',
  slug: 'jane-doe',
  display_name: 'Jane Doe',
  bio: 'Expert practitioner.',
  is_public: true,
  photo_url: null,
  specializations: ['Generators'],
  certification: 'IHDS',
  languages: ['English'],
  session_format: 'Remote',
  booking_url: 'https://calendly.com/jane',
  review_count: 5,
  avg_rating: 4.8,
};

// ── handleListDirectory ───────────────────────────────────────────────────────

describe('GET /api/directory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all practitioners without filters', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [PUBLIC_PRACTITIONER] });
    createQueryFnMock.mockReturnValue(query);
    const ENV_NO_KV = { ...ENV };

    const res = await handleListDirectory(req('GET', 'https://api/api/directory'), ENV_NO_KV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.practitioners)).toBe(true);
  });

  it('uses KV cache when available and no filters', async () => {
    const cachedPayload = { ok: true, practitioners: [PUBLIC_PRACTITIONER], pagination: { limit: 20, offset: 0, count: 1 } };
    const ENV_WITH_KV = {
      ...ENV,
      KV: { get: vi.fn().mockResolvedValue(cachedPayload), put: vi.fn() },
    };

    const res = await handleListDirectory(req('GET', 'https://api/api/directory'), ENV_WITH_KV);
    expect(res.status).toBe(200);
    // DB query should not be called on cache hit
    expect(createQueryFnMock).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.practitioners).toHaveLength(1);
  });

  it('queries DB and populates KV cache on cache miss', async () => {
    const kvPut = vi.fn().mockResolvedValue(undefined);
    const ENV_WITH_KV = {
      ...ENV,
      KV: { get: vi.fn().mockResolvedValue(null), put: kvPut },
    };
    const query = vi.fn().mockResolvedValue({ rows: [PUBLIC_PRACTITIONER] });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleListDirectory(req('GET', 'https://api/api/directory'), ENV_WITH_KV);
    expect(res.status).toBe(200);
    expect(kvPut).toHaveBeenCalledWith('directory:all', expect.any(String), { expirationTtl: 900 });
  });

  it('bypasses KV and filters when specialty param is provided', async () => {
    const ENV_WITH_KV = {
      ...ENV,
      KV: { get: vi.fn(), put: vi.fn() },
    };
    const query = vi.fn().mockResolvedValue({ rows: [PUBLIC_PRACTITIONER] });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleListDirectory(
      req('GET', 'https://api/api/directory?specialty=Generators'), ENV_WITH_KV
    );
    expect(res.status).toBe(200);
    // KV.get should not be called since we have filters
    expect(ENV_WITH_KV.KV.get).not.toHaveBeenCalled();
  });

  it('clamps limit to 50', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleListDirectory(
      req('GET', 'https://api/api/directory?limit=999'), ENV
    );
    expect(res.status).toBe(200);
    // limit param in query call should be clamped to 50
    expect(query).toHaveBeenCalledWith(
      'listPublicPractitioners',
      expect.arrayContaining([50])
    );
  });
});

// ── handleGetPublicProfile ────────────────────────────────────────────────────

describe('GET /api/directory/:slug', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 for invalid slug characters', async () => {
    const res = await handleGetPublicProfile(req('GET', 'https://api/test'), ENV, '../etc/passwd');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/slug/i);
  });

  it('returns 400 for empty slug', async () => {
    const res = await handleGetPublicProfile(req('GET', 'https://api/test'), ENV, '');
    expect(res.status).toBe(400);
  });

  it('returns 404 when practitioner not found in DB', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    createQueryFnMock.mockReturnValue(query);
    const ENV_NO_KV = { ...ENV };

    const res = await handleGetPublicProfile(req('GET', 'https://api/test'), ENV_NO_KV, 'jane-doe');
    expect(res.status).toBe(404);
  });

  it('returns cached profile on KV hit without DB query', async () => {
    const cached = { ok: true, practitioner: PUBLIC_PRACTITIONER };
    const ENV_WITH_KV = {
      ...ENV,
      KV: { get: vi.fn().mockResolvedValue(cached), put: vi.fn() },
    };

    const res = await handleGetPublicProfile(req('GET', 'https://api/test'), ENV_WITH_KV, 'jane-doe');
    expect(res.status).toBe(200);
    expect(createQueryFnMock).not.toHaveBeenCalled();
  });

  it('returns 200 with sanitized practitioner on DB hit', async () => {
    const ENV_NO_KV = { ...ENV };
    const query = vi.fn().mockResolvedValue({ rows: [PUBLIC_PRACTITIONER] });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleGetPublicProfile(req('GET', 'https://api/test'), ENV_NO_KV, 'jane-doe');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.practitioner).toBeDefined();
  });
});

// ── handleGetDirectoryProfile ─────────────────────────────────────────────────

describe('GET /api/practitioner/directory-profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceFeatureAccessMock.mockResolvedValue(null);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await handleGetDirectoryProfile(req('GET', 'https://api/test'), ENV);
    expect(res.status).toBe(401);
  });

  it('returns 404 when user is not a practitioner', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    createQueryFnMock.mockReturnValue(query);
    const authedReq = req('GET', 'https://api/test', null, { sub: 'user-1' });

    const res = await handleGetDirectoryProfile(authedReq, ENV);
    expect(res.status).toBe(404);
  });

  it('returns own directory profile when practitioner is found', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [PUBLIC_PRACTITIONER] });
    createQueryFnMock.mockReturnValue(query);
    const authedReq = req('GET', 'https://api/test', null, { sub: 'user-1' });

    const res = await handleGetDirectoryProfile(authedReq, ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.profile).toBeDefined();
  });

  it('returns tier enforcement response when practitioner tools are not available', async () => {
    enforceFeatureAccessMock.mockResolvedValue(Response.json({ error: 'locked' }, { status: 403 }));
    const authedReq = req('GET', 'https://api/test', null, { sub: 'user-1' });

    const res = await handleGetDirectoryProfile(authedReq, ENV);
    expect(res.status).toBe(403);
    expect(createQueryFnMock).not.toHaveBeenCalled();
  });

  it('falls back to legacy practitioner directory query when scheduling embed column is missing', async () => {
    const legacyErr = Object.assign(new Error('missing column'), { code: '42703' });
    const query = vi.fn(async (sql) => {
      if (sql === 'getPractitionerDirectoryProfile') throw legacyErr;
      if (sql === 'getPractitionerDirectoryProfileLegacy') return { rows: [PUBLIC_PRACTITIONER] };
      return { rows: [] };
    });
    createQueryFnMock.mockReturnValue(query);
    const authedReq = req('GET', 'https://api/test', null, { sub: 'user-1' });

    const res = await handleGetDirectoryProfile(authedReq, ENV);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.profile).toBeDefined();
    expect(query).toHaveBeenCalledWith('getPractitionerDirectoryProfileLegacy', ['user-1']);
  });
});

describe('GET /api/practitioner/directory-stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceFeatureAccessMock.mockResolvedValue(null);
  });

  it('returns tier enforcement response when practitioner tools are not available', async () => {
    enforceFeatureAccessMock.mockResolvedValue(Response.json({ error: 'locked' }, { status: 403 }));
    const authedReq = req('GET', 'https://api/test', null, { sub: 'user-1' });

    const res = await handleGetDirectoryStats(authedReq, ENV);
    expect(res.status).toBe(403);
    expect(createQueryFnMock).not.toHaveBeenCalled();
  });
});

// ── handleUpdateDirectoryProfile ─────────────────────────────────────────────

describe('PUT /api/practitioner/directory-profile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    const res = await handleUpdateDirectoryProfile(req('PUT', 'https://api/test'), ENV);
    expect(res.status).toBe(401);
  });

  it('returns 404 when user is not a practitioner', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    createQueryFnMock.mockReturnValue(query);
    const authedReq = req('PUT', 'https://api/test', { display_name: 'X' }, { sub: 'user-1' });

    const res = await handleUpdateDirectoryProfile(authedReq, ENV);
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid JSON', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [PUBLIC_PRACTITIONER] });
    createQueryFnMock.mockReturnValue(query);
    const badBodyReq = Object.assign(
      new Request('https://api/test', { method: 'PUT', body: 'not json' }),
      { _user: { sub: 'user-1' } }
    );

    const res = await handleUpdateDirectoryProfile(badBodyReq, ENV);
    expect(res.status).toBe(400);
  });

  it('silently strips invalid booking URL (non-https protocol)', async () => {
    const savedProfile = { ...PUBLIC_PRACTITIONER, booking_url: '' };
    const query = vi.fn(async (sql) => {
      if (sql === 'getPractitionerDirectoryProfile') return { rows: [PUBLIC_PRACTITIONER] };
      if (sql === 'updatePractitionerProfile') return { rows: [savedProfile] };
      return { rows: [] };
    });
    createQueryFnMock.mockReturnValue(query);
    const authedReq = req('PUT', 'https://api/test',
      { display_name: 'Jane', booking_url: 'javascript:alert(1)' },
      { sub: 'user-1' }
    );

    const res = await handleUpdateDirectoryProfile(authedReq, ENV);
    // non-https booking_url is silently cleared — handler returns 200
    expect(res.status).toBe(200);
    // update query must have been called with an empty string (not the malicious URL)
    expect(query).toHaveBeenCalledWith(
      'updatePractitionerProfile',
      expect.arrayContaining([expect.not.stringContaining('javascript')])
    );
  });

  it('strips unknown specializations and only accepts allowlisted values', async () => {
    const savedProfile = { ...PUBLIC_PRACTITIONER, specializations: ['Generators'] };
    const query = vi.fn(async (sql) => {
      if (sql === 'getPractitionerDirectoryProfile') return { rows: [PUBLIC_PRACTITIONER] };
      if (sql === 'updatePractitionerProfile') return { rows: [savedProfile] };
      return { rows: [] };
    });
    createQueryFnMock.mockReturnValue(query);
    const authedReq = req('PUT', 'https://api/test',
      { display_name: 'Jane', specializations: ['Generators', 'INVALID_VALUE'] },
      { sub: 'user-1' }
    );

    const res = await handleUpdateDirectoryProfile(authedReq, ENV);
    // Only 'Generators' passes the allowlist filter
    expect(query).toHaveBeenCalledWith(
      'updatePractitionerProfile',
      expect.arrayContaining([expect.not.stringContaining('INVALID_VALUE')])
    );
  });

  it('returns updated profile on success', async () => {
    const updatedProfile = { ...PUBLIC_PRACTITIONER, display_name: 'Jane Updated' };
    const query = vi.fn(async (sql) => {
      if (sql === 'getPractitionerDirectoryProfile') return { rows: [PUBLIC_PRACTITIONER] };
      if (sql === 'updatePractitionerProfile') return { rows: [updatedProfile] };
      return { rows: [] };
    });
    createQueryFnMock.mockReturnValue(query);
    const authedReq = req('PUT', 'https://api/test',
      { display_name: 'Jane Updated', specializations: ['Generators'], certification: 'IHDS', session_format: 'Remote' },
      { sub: 'user-1' }
    );

    const res = await handleUpdateDirectoryProfile(authedReq, ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

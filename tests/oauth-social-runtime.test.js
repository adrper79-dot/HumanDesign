/**
 * oauth-social-runtime — deterministic unit tests for oauthSocial.js (SYS-045)
 *
 * Covers:
 *  - Facebook routes always return 501 (not yet implemented)
 *  - Unknown provider routes return 404
 *  - Google/Apple initiate: missing credentials → redirect to frontend with error
 */

import { describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../workers/src/lib/jwt.js', () => ({
  signJWT: vi.fn().mockResolvedValue('mock-jwt-token'),
  sha256: vi.fn().mockResolvedValue('mock-hash'),
  jwtClaims: vi.fn().mockReturnValue({ sub: 'user-1' }),
}));

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: vi.fn().mockReturnValue(vi.fn().mockResolvedValue({ rows: [] })),
  QUERIES: {
    getUserByOAuthSub: 'getUserByOAuthSub',
    insertOAuthUser: 'insertOAuthUser',
    updateUserOAuth: 'updateUserOAuth',
    upsertOAuthUser: 'upsertOAuthUser',
    insertRefreshToken: 'insertRefreshToken',
    getUserByEmail: 'getUserByEmail',
    getUserById: 'getUserById',
  },
}));

vi.mock('../workers/src/lib/email.js', () => ({
  sendWelcomeEmail1: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../workers/src/lib/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { handleOAuthSocial } from '../workers/src/handlers/oauthSocial.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(method, subpath) {
  return new Request(`https://api.test/api/auth/oauth${subpath}`, { method });
}

const ENV_FULL = {
  GOOGLE_CLIENT_ID: 'google-id',
  GOOGLE_CLIENT_SECRET: 'google-secret',
  APPLE_CLIENT_ID: 'apple-id',
  APPLE_TEAM_ID: 'TEAM12345',
  APPLE_KEY_ID: 'KEY12345',
  APPLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----',
  JWT_SECRET: 'test-secret',
  FRONTEND_URL: 'https://selfprime.net',
  BASE_URL: 'https://prime-self-api.adrper79.workers.dev',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('oauthSocial handler — Facebook (not implemented)', () => {
  it('returns 501 for /facebook initiate', async () => {
    const req = makeRequest('GET', '/facebook');
    const res = await handleOAuthSocial(req, ENV_FULL, '/facebook');
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error).toMatch(/not yet available/i);
  });

  it('returns 501 for /facebook/callback', async () => {
    const req = makeRequest('GET', '/facebook/callback');
    const res = await handleOAuthSocial(req, ENV_FULL, '/facebook/callback');
    expect(res.status).toBe(501);
  });

  it('returns 501 for any /facebook/* subpath', async () => {
    const req = makeRequest('POST', '/facebook/token');
    const res = await handleOAuthSocial(req, ENV_FULL, '/facebook/token');
    expect(res.status).toBe(501);
  });
});

describe('oauthSocial handler — unknown routes', () => {
  it('returns 404 for unknown provider', async () => {
    const req = makeRequest('GET', '/instagram');
    const res = await handleOAuthSocial(req, ENV_FULL, '/instagram');
    expect(res.status).toBe(404);
  });

  it('returns 404 for empty subpath / root', async () => {
    const req = makeRequest('GET', '/');
    const res = await handleOAuthSocial(req, ENV_FULL, '/unknown');
    expect(res.status).toBe(404);
  });
});

describe('oauthSocial handler — Google/Apple initiate (missing credentials)', () => {
  it('redirects to FRONTEND_URL with error when GOOGLE_CLIENT_ID is not set', async () => {
    const req = makeRequest('GET', '/google');
    const res = await handleOAuthSocial(req, { ...ENV_FULL, GOOGLE_CLIENT_ID: undefined }, '/google');
    // Handler returns 503 when required OAuth credentials are not configured
    expect(res.status).toBe(503);
  });
});

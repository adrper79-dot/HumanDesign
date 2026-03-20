import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createQueryFnMock } = vi.hoisted(() => ({
  createQueryFnMock: vi.fn(),
}));

const { getUserTierMock } = vi.hoisted(() => ({
  getUserTierMock: vi.fn(),
}));

vi.mock('../workers/src/db/queries.js', async () => {
  const actual = await vi.importActual('../workers/src/db/queries.js');
  return {
    ...actual,
    createQueryFn: createQueryFnMock,
  };
});

vi.mock('../workers/src/middleware/tierEnforcement.js', () => ({
  getUserTier: getUserTierMock,
}));

import { handleAuth } from '../workers/src/handlers/auth.js';
import { QUERIES } from '../workers/src/db/queries.js';

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserTierMock.mockResolvedValue('individual');
  });

  it('uses the safe query shape and omits sensitive auth fields', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{
        id: 'user-1',
        email: 'user@example.com',
        tier: 'individual',
        referral_code: 'PRIME-123',
        totp_enabled: true,
        password_hash: 'should-not-leak',
        totp_secret: 'should-not-leak',
      }],
    });
    createQueryFnMock.mockReturnValue(query);

    const request = new Request('https://api.test/api/auth/me', { method: 'GET' });
    request._user = { sub: 'user-1' };

    const response = await handleAuth(request, { NEON_CONNECTION_STRING: 'postgresql://test' }, '/api/auth/me');
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalledWith(QUERIES.getUserByIdSafe, ['user-1']);
    expect(getUserTierMock).toHaveBeenCalledWith({ NEON_CONNECTION_STRING: 'postgresql://test' }, 'user-1');
    expect(json.ok).toBe(true);
    expect(json.user).toMatchObject({
      id: 'user-1',
      email: 'user@example.com',
      tier: 'individual',
      stored_tier: 'individual',
      referral_code: 'PRIME-123',
      totp_enabled: true,
    });
    expect(json.user).not.toHaveProperty('password_hash');
    expect(json.user).not.toHaveProperty('totp_secret');
  });

  it('returns 401 when no authenticated user is attached', async () => {
    const request = new Request('https://api.test/api/auth/me', { method: 'GET' });

    const response = await handleAuth(request, { NEON_CONNECTION_STRING: 'postgresql://test' }, '/api/auth/me');
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns effective tier when stored tier drifts from subscription tier', async () => {
    getUserTierMock.mockResolvedValue('individual');
    const query = vi.fn().mockResolvedValue({
      rows: [{
        id: 'user-1',
        email: 'user@example.com',
        tier: 'practitioner',
        referral_code: null,
        totp_enabled: false,
      }],
    });
    createQueryFnMock.mockReturnValue(query);

    const request = new Request('https://api.test/api/auth/me', { method: 'GET' });
    request._user = { sub: 'user-1' };

    const response = await handleAuth(request, { NEON_CONNECTION_STRING: 'postgresql://test' }, '/api/auth/me');
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.user.tier).toBe('individual');
    expect(json.user.stored_tier).toBe('practitioner');
  });
});
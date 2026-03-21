import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  createQueryFnMock: vi.fn(),
  trackEventMock: vi.fn(() => Promise.resolve()),
  captureRequestContextMock: vi.fn((request) => ({
    url: request.url,
    method: request.method,
  })),
}));

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: hoisted.createQueryFnMock,
  QUERIES: {
    adminGetOverviewStats: 'adminGetOverviewStats',
    adminSetTier: 'adminSetTier',
  },
}));

vi.mock('../workers/src/lib/analytics.js', () => ({
  EVENTS: {
    ADMIN_AUTH_FAIL: 'admin_auth_fail',
    ADMIN_ACCESS: 'admin_accessed_dashboard',
    ADMIN_ACTION: 'admin_action',
  },
  captureRequestContext: hoisted.captureRequestContextMock,
  trackEvent: hoisted.trackEventMock,
}));

import { handleAdmin } from '../workers/src/handlers/admin.js';

describe('admin handler', () => {
  beforeEach(() => {
    hoisted.createQueryFnMock.mockReset();
    hoisted.trackEventMock.mockClear();
    hoisted.captureRequestContextMock.mockClear();
  });

  it('rejects invalid admin tokens and records an auth failure event', async () => {
    const response = await handleAdmin(
      new Request('https://api.test/api/admin/stats', { method: 'GET' }),
      { ADMIN_TOKEN: 'secret-token' },
      '/stats'
    );

    expect(response.status).toBe(403);
    expect(hoisted.trackEventMock).toHaveBeenCalledWith(
      { ADMIN_TOKEN: 'secret-token' },
      'admin_auth_fail',
      expect.objectContaining({
        requestContext: expect.objectContaining({
          url: 'https://api.test/api/admin/stats',
          method: 'GET',
        }),
        properties: expect.objectContaining({
          actionType: 'auth_failed',
          path: '/api/admin/stats',
        }),
      })
    );
  });

  it('returns overview stats and records dashboard access', async () => {
    const query = vi.fn(async (sql) => {
      expect(sql).toBe('adminGetOverviewStats');
      return {
        rows: [{ total_users: 11, new_users_24h: 2 }],
      };
    });
    hoisted.createQueryFnMock.mockReturnValue(query);

    const response = await handleAdmin(
      new Request('https://api.test/api/admin/stats', {
        method: 'GET',
        headers: { 'X-Admin-Token': 'secret-token' },
      }),
      { ADMIN_TOKEN: 'secret-token', NEON_CONNECTION_STRING: 'postgresql://test' },
      '/stats'
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, stats: { total_users: 11, new_users_24h: 2 } });
    expect(hoisted.trackEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ ADMIN_TOKEN: 'secret-token' }),
      'admin_accessed_dashboard',
      expect.objectContaining({
        properties: expect.objectContaining({
          actionType: 'view_stats',
          path: '/api/admin/stats',
        }),
      })
    );
  });

  it('updates a user tier and records the admin action', async () => {
    const query = vi.fn(async (sql, params) => {
      expect(sql).toBe('adminSetTier');
      expect(params).toEqual(['agency', '123e4567-e89b-12d3-a456-426614174000']);
      return {
        rows: [{
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'user@example.com',
          tier: 'agency',
        }],
      };
    });
    hoisted.createQueryFnMock.mockReturnValue(query);

    const response = await handleAdmin(
      new Request('https://api.test/api/admin/users/123e4567-e89b-12d3-a456-426614174000/tier', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': 'secret-token',
        },
        body: JSON.stringify({ tier: 'agency' }),
      }),
      { ADMIN_TOKEN: 'secret-token', NEON_CONNECTION_STRING: 'postgresql://test' },
      '/users/123e4567-e89b-12d3-a456-426614174000/tier'
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.user.tier).toBe('agency');
    expect(hoisted.trackEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ ADMIN_TOKEN: 'secret-token' }),
      'admin_action',
      expect.objectContaining({
        properties: expect.objectContaining({
          actionType: 'set_user_tier',
          targetUserId: '123e4567-e89b-12d3-a456-426614174000',
          tier: 'agency',
        }),
      })
    );
  });
});
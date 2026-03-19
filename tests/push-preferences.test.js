/**
 * Push Notification Preferences Tests
 * Item 1.6 — Push Notification Preferences
 *
 * Tests the push handler routing, VAPID key, preferences, and subscription validation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQueryFn = vi.fn();

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: () => mockQueryFn,
  QUERIES: {
    getNotificationPreferences: 'getNotificationPreferences',
    getNotificationPrefsById: 'getNotificationPrefsById',
    insertDefaultNotificationPrefs: 'insertDefaultNotificationPrefs',
    getPushSubscriptionByEndpoint: 'getPushSubscriptionByEndpoint',
    insertPushSubscription: 'insertPushSubscription',
    updatePushSubscriptionLastUsed: 'updatePushSubscriptionLastUsed',
    deletePushSubscription: 'deletePushSubscription',
    getActivePushSubscriptions: 'getActivePushSubscriptions',
    getPushNotificationHistory: 'getPushNotificationHistory',
    countPushNotifications: 'countPushNotifications'
  }
}));

vi.mock('../workers/src/middleware/auth.js', () => ({
  getUserFromRequest: vi.fn()
}));

vi.mock('../workers/src/lib/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  })
}));

const { handlePush } = await import('../workers/src/handlers/push.js');
const { getUserFromRequest } = await import('../workers/src/middleware/auth.js');

function makeRequest(method, path, body) {
  const url = `https://api.primeself.app/api/push${path}`;
  const opts = { method, headers: new Headers({ 'Content-Type': 'application/json' }) };
  if (body) opts.body = JSON.stringify(body);
  const req = new Request(url, opts);
  req._user = { sub: 'user-123', id: 'user-123' };
  return req;
}

const env = {
  VAPID_PUBLIC_KEY: 'BNbX-abc-test-vapid-public-key',
  VAPID_PRIVATE_KEY: 'test-vapid-private-key',
  VAPID_SUBJECT: 'mailto:push@primeself.app',
  NEON_CONNECTION_STRING: 'postgres://test'
};

beforeEach(() => {
  vi.clearAllMocks();
  getUserFromRequest.mockResolvedValue({ id: 'user-123', sub: 'user-123' });
});

describe('GET /api/push/vapid-key', () => {
  it('returns VAPID public key without auth', async () => {
    const req = makeRequest('GET', '/vapid-key');
    const res = await handlePush(req, env, '/vapid-key');
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.publicKey).toBe('BNbX-abc-test-vapid-public-key');
  });

  it('returns 500 if VAPID key not configured', async () => {
    const req = makeRequest('GET', '/vapid-key');
    const res = await handlePush(req, { NEON_CONNECTION_STRING: 'x' }, '/vapid-key');
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(res.status).toBe(500);
  });
});

describe('GET /api/push/preferences', () => {
  it('returns default preferences when none saved', async () => {
    mockQueryFn.mockResolvedValueOnce({ rows: [] });
    const req = makeRequest('GET', '/preferences');
    const res = await handlePush(req, env, '/preferences');
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.preferences.transitDaily).toBe(true);
    expect(data.preferences.weeklyDigest).toBe(true);
    expect(data.preferences.quietHoursStart).toBeNull();
  });

  it('returns saved preferences', async () => {
    mockQueryFn.mockResolvedValueOnce({
      rows: [{
        transit_daily: false,
        gate_activation: true,
        cycle_approaching: true,
        transit_alert: false,
        weekly_digest: true,
        quiet_hours_start: 22,
        quiet_hours_end: 7,
        timezone: 'America/New_York',
        daily_digest_time: '08:00',
        weekly_digest_day: 1
      }]
    });
    const req = makeRequest('GET', '/preferences');
    const res = await handlePush(req, env, '/preferences');
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.preferences.transitDaily).toBe(false);
    expect(data.preferences.transitAlert).toBe(false);
    expect(data.preferences.quietHoursStart).toBe(22);
    expect(data.preferences.quietHoursEnd).toBe(7);
  });
});

describe('PUT /api/push/preferences', () => {
  it('updates preferences with valid fields', async () => {
    mockQueryFn.mockResolvedValueOnce({ rows: [] });
    const req = makeRequest('PUT', '/preferences', { transitDaily: false, weeklyDigest: false });
    const res = await handlePush(req, env, '/preferences');
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockQueryFn).toHaveBeenCalled();
  });

  it('rejects empty update', async () => {
    const req = makeRequest('PUT', '/preferences', {});
    const res = await handlePush(req, env, '/preferences');
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/push/subscribe', () => {
  it('rejects missing fields', async () => {
    const req = makeRequest('POST', '/subscribe', { endpoint: 'https://push.example.com/sub1' });
    const res = await handlePush(req, env, '/subscribe');
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(res.status).toBe(400);
  });

  it('rejects non-HTTPS endpoint', async () => {
    const req = makeRequest('POST', '/subscribe', {
      endpoint: 'http://push.example.com/sub1',
      keys: { p256dh: 'testkey', auth: 'testauth' }
    });
    const res = await handlePush(req, env, '/subscribe');
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(res.status).toBe(400);
  });
});

describe('Authentication', () => {
  it('returns 401 for unauthenticated requests', async () => {
    getUserFromRequest.mockResolvedValueOnce(null);
    const req = makeRequest('GET', '/preferences');
    delete req._user;
    const res = await handlePush(req, env, '/preferences');
    expect(res.status).toBe(401);
  });
});

describe('Routing', () => {
  it('returns 404 for unknown path', async () => {
    const req = makeRequest('GET', '/unknown');
    const res = await handlePush(req, env, '/unknown');
    expect(res.status).toBe(404);
  });
});

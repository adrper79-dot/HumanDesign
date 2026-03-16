/**
 * push-handler-runtime — deterministic unit tests for push.js (SYS-045)
 *
 * Covers:
 *  - Auth guard: protected routes return 401 when unauthenticated
 *  - VAPID key endpoint: 500 when missing, 200 with key when present
 *  - Subscribe: validation (missing fields, HTTP endpoint, oversized endpoint)
 *  - Unsubscribe: missing endpoint → 400
 *  - Preferences: default preferences returned when none set
 *  - sendNotificationToUser: short-circuits on disabled pref + no-subscriptions path
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const {
  getUserFromRequestMock,
  createQueryFnMock,
} = vi.hoisted(() => ({
  getUserFromRequestMock: vi.fn(),
  createQueryFnMock: vi.fn(),
}));

vi.mock('../workers/src/middleware/auth.js', () => ({
  getUserFromRequest: getUserFromRequestMock,
}));

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: createQueryFnMock,
  QUERIES: {
    getPushSubscriptionByEndpoint: 'getPushSubscriptionByEndpoint',
    updatePushSubscriptionLastUsed: 'updatePushSubscriptionLastUsed',
    insertPushSubscription: 'insertPushSubscription',
    getNotificationPrefsById: 'getNotificationPrefsById',
    insertDefaultNotificationPrefs: 'insertDefaultNotificationPrefs',
    deletePushSubscription: 'deletePushSubscription',
    getActivePushSubscriptions: 'getActivePushSubscriptions',
    getNotificationPreferences: 'getNotificationPreferences',
    insertNotificationPreferences: 'insertNotificationPreferences',
    getPushNotificationHistory: 'getPushNotificationHistory',
    countPushNotifications: 'countPushNotifications',
    getActivePushSubscriptionsFull: 'getActivePushSubscriptionsFull',
    insertPushNotification: 'insertPushNotification',
    insertPushNotificationFull: 'insertPushNotificationFull',
    deactivatePushSubscription: 'deactivatePushSubscription',
  },
}));

// Silence logger in tests
vi.mock('../workers/src/lib/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { handlePush, sendNotificationToUser } from '../workers/src/handlers/push.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeRequest(method, path, body, headers = {}) {
  const url = `https://prime-self-api.adrper79.workers.dev/api/push${path}`;
  const init = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  // GET and HEAD cannot have a body (Fetch API spec)
  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

const USER = { id: 'user-1', sub: 'user-1', email: 'test@example.com', tier: 'free' };

const ENV_WITH_VAPID = {
  VAPID_PUBLIC_KEY: 'BLc-fake-public-key',
  VAPID_PRIVATE_KEY: 'fake-private-key',
};
const ENV_NO_VAPID = {};

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('push handler — auth guard', () => {
  beforeEach(() => {
    getUserFromRequestMock.mockResolvedValue(null);
    createQueryFnMock.mockReturnValue(vi.fn());
  });

  const protectedPaths = [
    ['POST', '/subscribe'],
    ['DELETE', '/unsubscribe'],
    ['POST', '/test'],
    ['GET', '/preferences'],
    ['PUT', '/preferences'],
    ['GET', '/history'],
  ];

  it.each(protectedPaths)('%s %s returns 401 when unauthenticated', async (method, path) => {
    const req = makeRequest(method, path, {});
    const res = await handlePush(req, ENV_NO_VAPID, path);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});

describe('push handler — GET /vapid-key (public)', () => {
  it('returns 500 when VAPID_PUBLIC_KEY is not configured', async () => {
    const req = makeRequest('GET', '/vapid-key');
    const res = await handlePush(req, ENV_NO_VAPID, '/vapid-key');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it('returns 200 with publicKey when VAPID_PUBLIC_KEY is configured', async () => {
    const req = makeRequest('GET', '/vapid-key');
    const res = await handlePush(req, ENV_WITH_VAPID, '/vapid-key');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.publicKey).toBe('BLc-fake-public-key');
  });
});

describe('push handler — POST /subscribe validation', () => {
  beforeEach(() => {
    getUserFromRequestMock.mockResolvedValue(USER);
    const queryMock = vi.fn()
      .mockResolvedValueOnce({ rows: [] })   // getPushSubscriptionByEndpoint → no existing
      .mockResolvedValueOnce({ rows: [{ id: 'sub-1', endpoint: 'https://fcm.example.com/sub/1', active: true, subscription_time: new Date().toISOString() }] }) // insertPushSubscription
      .mockResolvedValueOnce({ rows: [] }); // getNotificationPrefsById
    createQueryFnMock.mockReturnValue(queryMock);
  });

  it('returns 400 when endpoint is missing', async () => {
    const req = makeRequest('POST', '/subscribe', { keys: { p256dh: 'k', auth: 'a' } });
    const res = await handlePush(req, ENV_WITH_VAPID, '/subscribe');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('Missing required fields');
  });

  it('returns 400 when keys.p256dh is missing', async () => {
    const req = makeRequest('POST', '/subscribe', { endpoint: 'https://fcm.example.com/sub/1', keys: { auth: 'a' } });
    const res = await handlePush(req, ENV_WITH_VAPID, '/subscribe');
    expect(res.status).toBe(400);
  });

  it('returns 400 when endpoint is not HTTPS', async () => {
    const req = makeRequest('POST', '/subscribe', {
      endpoint: 'http://fcm.example.com/sub/1',
      keys: { p256dh: 'key', auth: 'aut' },
    });
    const res = await handlePush(req, ENV_WITH_VAPID, '/subscribe');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/HTTPS/i);
  });

  it('returns 400 when endpoint exceeds 2048 characters', async () => {
    const req = makeRequest('POST', '/subscribe', {
      endpoint: 'https://fcm.example.com/' + 'x'.repeat(2040),
      keys: { p256dh: 'key', auth: 'aut' },
    });
    const res = await handlePush(req, ENV_WITH_VAPID, '/subscribe');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('endpoint exceeds');
  });
});

describe('push handler — DELETE /unsubscribe validation', () => {
  beforeEach(() => {
    getUserFromRequestMock.mockResolvedValue(USER);
  });

  it('returns 400 when endpoint is missing', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [] });
    createQueryFnMock.mockReturnValue(queryMock);

    const req = makeRequest('DELETE', '/unsubscribe', {});
    const res = await handlePush(req, ENV_WITH_VAPID, '/unsubscribe');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('Missing endpoint');
  });

  it('returns 404 when subscription is not found', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [] });
    createQueryFnMock.mockReturnValue(queryMock);

    const req = makeRequest('DELETE', '/unsubscribe', { endpoint: 'https://fcm.example.com/sub/1' });
    const res = await handlePush(req, ENV_WITH_VAPID, '/unsubscribe');
    expect(res.status).toBe(404);
  });
});

describe('push handler — GET /preferences defaults', () => {
  beforeEach(() => {
    getUserFromRequestMock.mockResolvedValue(USER);
  });

  it('returns default preferences when user has none set', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [] }); // no prefs found
    createQueryFnMock.mockReturnValue(queryMock);

    const req = makeRequest('GET', '/preferences');
    const res = await handlePush(req, ENV_WITH_VAPID, '/preferences');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.preferences.transitDaily).toBe(true);
    expect(body.preferences.timezone).toBe('UTC');
  });
});

describe('push handler — GET /history pagination', () => {
  beforeEach(() => {
    getUserFromRequestMock.mockResolvedValue(USER);
  });

  it('returns paginated notification history', async () => {
    const queryMock = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 'n-1', notification_type: 'transit_daily', title: 'Today', body: 'X', sent_at: new Date().toISOString(), success: true }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });
    createQueryFnMock.mockReturnValue(queryMock);

    const req = makeRequest('GET', '/history?limit=10&offset=0');
    // history uses the full URL for search params; reconstruct with proper URL
    const fullReq = new Request('https://prime-self-api.adrper79.workers.dev/api/push/history?limit=10&offset=0', { method: 'GET' });
    const res = await handlePush(fullReq, ENV_WITH_VAPID, '/history');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.notifications).toHaveLength(1);
    expect(body.pagination.total).toBe('1');
  });
});

describe('sendNotificationToUser — preference short-circuit', () => {
  it('returns 0 and does not send when notification type is disabled by user pref', async () => {
    const queryMock = vi.fn()
      .mockResolvedValueOnce({ rows: [{ transit_daily: false, gate_activation: true, cycle_approaching: true, transit_alert: true, weekly_digest: true, quiet_hours_start: null, quiet_hours_end: null, timezone: 'UTC' }] });
    createQueryFnMock.mockReturnValue(queryMock);

    const count = await sendNotificationToUser(ENV_WITH_VAPID, 'user-1', 'transit_daily', { title: 'Test', body: 'Body' });
    expect(count).toBe(0);
    // query should only have been called once (getNotificationPreferences) — no subscription fetch
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('returns 0 when user has no active subscriptions', async () => {
    const queryMock = vi.fn()
      .mockResolvedValueOnce({ rows: [] })   // getNotificationPreferences → no prefs
      .mockResolvedValueOnce({ rows: [] });  // getActivePushSubscriptionsFull → no subscriptions
    createQueryFnMock.mockReturnValue(queryMock);

    const count = await sendNotificationToUser(ENV_WITH_VAPID, 'user-1', 'transit_daily', { title: 'Test', body: 'Body' });
    expect(count).toBe(0);
  });
});

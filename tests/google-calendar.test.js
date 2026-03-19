/**
 * Google Calendar 2-Way Sync Tests — Item 3.2
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/* ───────── Query structure tests ───────── */
describe('Google Calendar — queries', () => {
  it('storeGoogleCalendarToken upserts with ON CONFLICT', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(typeof QUERIES.storeGoogleCalendarToken).toBe('string');
    expect(QUERIES.storeGoogleCalendarToken).toContain('INSERT INTO google_calendar_tokens');
    expect(QUERIES.storeGoogleCalendarToken).toContain('ON CONFLICT');
    expect(QUERIES.storeGoogleCalendarToken).toContain('RETURNING');
  });

  it('getGoogleCalendarToken selects by user_id', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(QUERIES.getGoogleCalendarToken).toContain('user_id');
    expect(QUERIES.getGoogleCalendarToken).toContain('SELECT');
  });

  it('deleteGoogleCalendarToken deletes by user_id', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(QUERIES.deleteGoogleCalendarToken).toContain('DELETE');
    expect(QUERIES.deleteGoogleCalendarToken).toContain('user_id');
    expect(QUERIES.deleteGoogleCalendarToken).toContain('RETURNING');
  });

  it('updateGoogleCalSyncToken updates sync_token and last_synced_at', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(QUERIES.updateGoogleCalSyncToken).toContain('sync_token');
    expect(QUERIES.updateGoogleCalSyncToken).toContain('last_synced_at');
  });

  it('storeGoogleCalendarToken stores encrypted tokens', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(QUERIES.storeGoogleCalendarToken).toContain('encrypted_access_token');
    expect(QUERIES.storeGoogleCalendarToken).toContain('encrypted_refresh_token');
  });
});

/* ───────── Handler tests ───────── */
describe('Google Calendar — handler', () => {
  let handleGoogleCalendar;
  let lastQuery;
  let queryRows;

  beforeEach(async () => {
    vi.resetModules();
    lastQuery = null;
    queryRows = [];

    vi.doMock('../workers/src/db/queries.js', () => ({
      QUERIES: {
        storeGoogleCalendarToken: 'INSERT gcal_tokens',
        getGoogleCalendarToken: 'SELECT gcal_tokens',
        deleteGoogleCalendarToken: 'DELETE gcal_tokens',
        updateGoogleCalSyncToken: 'UPDATE gcal_sync',
        listCalendarEvents: 'SELECT cal_events',
        createCalendarEvent: 'INSERT cal_events',
        updateCalendarEvent: 'UPDATE cal_events',
      },
      createQueryFn: () => async (sql, params) => {
        lastQuery = { sql, params };
        return { rows: queryRows };
      },
    }));
    vi.doMock('../workers/src/lib/analytics.js', () => ({
      trackEvent: vi.fn(),
    }));
    vi.doMock('../workers/src/lib/tokenCrypto.js', () => ({
      importEncryptionKey: vi.fn(async () => 'mock-key'),
      encryptToken: vi.fn(async (text) => `enc:${text}`),
      decryptToken: vi.fn(async (text) => text.replace('enc:', '')),
    }));

    const mod = await import('../workers/src/handlers/google-calendar.js');
    handleGoogleCalendar = mod.handleGoogleCalendar;
  });

  it('connect returns OAuth URL with calendar scope', async () => {
    const req = new Request('https://x.com/api/calendar/google/connect', { method: 'POST' });
    const env = {
      GOOGLE_CLIENT_ID: 'test-client-id',
      BASE_URL: 'https://api.test.com',
      CACHE: {
        put: vi.fn(async () => {}),
      },
    };
    const resp = await handleGoogleCalendar(req, env, '/connect', 'user-1');
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(body.url).toContain('accounts.google.com');
    expect(body.url).toContain('calendar');
    expect(body.url).toContain('offline');
    // Should store state in KV
    expect(env.CACHE.put).toHaveBeenCalledTimes(1);
    const putArgs = env.CACHE.put.mock.calls[0];
    expect(putArgs[0]).toMatch(/^gcal_state:/);
    expect(putArgs[1]).toBe('user-1');
  });

  it('connect returns 503 when GOOGLE_CLIENT_ID missing', async () => {
    const req = new Request('https://x.com/api/calendar/google/connect', { method: 'POST' });
    const resp = await handleGoogleCalendar(req, {}, '/connect', 'user-1');
    expect(resp.status).toBe(503);
  });

  it('callback redirects with error on missing code', async () => {
    const req = new Request('https://x.com/api/calendar/google/callback?state=abc');
    const env = {
      FRONTEND_URL: 'https://app.test.com',
      CACHE: { get: vi.fn(async () => 'user-1'), delete: vi.fn(async () => {}) },
    };
    const resp = await handleGoogleCalendar(req, env, '/callback', null);
    // Should redirect with error
    expect(resp.status).toBe(302);
    const location = resp.headers.get('Location');
    expect(location).toContain('gcal=error');
  });

  it('callback redirects with error on invalid state', async () => {
    const req = new Request('https://x.com/api/calendar/google/callback?code=abc&state=bad');
    const env = {
      FRONTEND_URL: 'https://app.test.com',
      BASE_URL: 'https://api.test.com',
      CACHE: { get: vi.fn(async () => null), delete: vi.fn(async () => {}) },
    };
    const resp = await handleGoogleCalendar(req, env, '/callback', null);
    expect(resp.status).toBe(302);
    expect(resp.headers.get('Location')).toContain('invalid_state');
  });

  it('disconnect deletes tokens and returns ok', async () => {
    queryRows = [{ id: 'token-1' }];
    const env = { NEON_CONNECTION_STRING: 'x' };
    const req = new Request('https://x.com/api/calendar/google/disconnect', { method: 'DELETE' });
    const resp = await handleGoogleCalendar(req, env, '/disconnect', 'user-1');
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(lastQuery.sql).toBe('DELETE gcal_tokens');
    expect(lastQuery.params[0]).toBe('user-1');
  });

  it('sync returns 400 when not connected', async () => {
    queryRows = []; // No token row
    const req = new Request('https://x.com/api/calendar/google/sync', { method: 'POST' });
    const env = {
      NEON_CONNECTION_STRING: 'x',
      GOOGLE_TOKEN_ENCRYPTION_KEY: 'a'.repeat(32),
    };
    const resp = await handleGoogleCalendar(req, env, '/sync', 'user-1');
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toContain('not connected');
  });

  it('returns 404 for unknown subpath', async () => {
    const req = new Request('https://x.com/api/calendar/google/unknown');
    const resp = await handleGoogleCalendar(req, {}, '/unknown', 'user-1');
    expect(resp.status).toBe(404);
  });
});

/* ───────── Calendar handler delegation test ───────── */
describe('Google Calendar — calendar.js delegation', () => {
  let handleCalendar;

  beforeEach(async () => {
    vi.resetModules();

    vi.doMock('../workers/src/db/queries.js', () => ({
      QUERIES: {},
      createQueryFn: () => async () => ({ rows: [] }),
    }));
    vi.doMock('../workers/src/lib/analytics.js', () => ({
      trackEvent: vi.fn(),
    }));
    vi.doMock('../workers/src/lib/routeErrors.js', () => ({
      reportHandledRouteError: vi.fn(() => Response.json({ error: 'err' }, { status: 500 })),
    }));
    vi.doMock('../workers/src/middleware/tierEnforcement.js', () => ({
      enforceFeatureAccess: vi.fn(async () => null),
    }));
    vi.doMock('../workers/src/handlers/google-calendar.js', () => ({
      handleGoogleCalendar: vi.fn(async (req, env, sub, uid) =>
        Response.json({ delegated: true, subpath: sub, userId: uid })
      ),
    }));

    const mod = await import('../workers/src/handlers/calendar.js');
    handleCalendar = mod.default;
  });

  it('delegates /google/connect to google-calendar handler', async () => {
    const req = new Request('https://x.com/api/calendar/google/connect', { method: 'POST' });
    req._user = { sub: 'user-1' };
    req._tier = 'practitioner';
    const resp = await handleCalendar(req, { NEON_CONNECTION_STRING: 'x' }, '/google/connect');
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.delegated).toBe(true);
    expect(body.subpath).toBe('/connect');
    expect(body.userId).toBe('user-1');
  });

  it('delegates /google/callback without requiring auth', async () => {
    const req = new Request('https://x.com/api/calendar/google/callback?code=abc&state=xyz');
    // No _user — callback is unauthenticated
    const resp = await handleCalendar(req, { NEON_CONNECTION_STRING: 'x' }, '/google/callback');
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.delegated).toBe(true);
    expect(body.subpath).toBe('/callback');
    expect(body.userId).toBeNull();
  });
});

/* ───────── Migration file test ───────── */
describe('Google Calendar — migration', () => {
  it('061_google_calendar_tokens.sql exists with correct schema', () => {
    const migPath = resolve(__dirname, '../workers/src/db/migrations/061_google_calendar_tokens.sql');
    expect(existsSync(migPath)).toBe(true);
    const sql = readFileSync(migPath, 'utf-8');
    expect(sql).toContain('google_calendar_tokens');
    expect(sql).toContain('encrypted_access_token');
    expect(sql).toContain('encrypted_refresh_token');
    expect(sql).toContain('user_id');
    expect(sql).toContain('UNIQUE(user_id)');
  });
});

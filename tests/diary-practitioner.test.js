/**
 * Diary-to-Practitioner Visibility Tests — Item 1.11
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Diary Practitioner Visibility — queries', () => {
  it('getDiaryEntriesForClient query joins practitioner access check', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(typeof QUERIES.getDiaryEntriesForClient).toBe('string');
    expect(QUERIES.getDiaryEntriesForClient).toContain('practitioner_clients');
    expect(QUERIES.getDiaryEntriesForClient).toContain('share_diary = true');
    expect(QUERIES.getDiaryEntriesForClient).toContain('diary_entries');
  });

  it('getMyDiarySharingPreferences returns practitioner info', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(typeof QUERIES.getMyDiarySharingPreferences).toBe('string');
    expect(QUERIES.getMyDiarySharingPreferences).toContain('share_diary');
    expect(QUERIES.getMyDiarySharingPreferences).toContain('practitioner_name');
  });

  it('setMyDiarySharing updates share_diary for correct relationship', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(typeof QUERIES.setMyDiarySharing).toBe('string');
    expect(QUERIES.setMyDiarySharing).toContain('share_diary');
    expect(QUERIES.setMyDiarySharing).toContain('client_user_id');
  });

  it('getDiaryEntriesForClient excludes transit_snapshot', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(QUERIES.getDiaryEntriesForClient).not.toContain('transit_snapshot');
  });
});

describe('Diary Practitioner — practitioner handler', () => {
  let handlePractitioner;
  let lastQuery;

  beforeEach(async () => {
    vi.resetModules();
    lastQuery = null;
    vi.doMock('../workers/src/db/queries.js', () => ({
      QUERIES: {
        getPractitionerProfile: 'SELECT 1',
        checkPractitionerAccess: 'SELECT 1',
        getDiaryEntriesForClient: 'SELECT 1',
      },
      createQueryFn: () => async (sql, params) => {
        lastQuery = { sql, params };
        // For checkPractitionerAccess, return a row to pass access check
        if (params && params.length === 2 && sql === 'SELECT 1') {
          return { rows: [{ '?column?': 1 }] };
        }
        return { rows: [] };
      },
    }));
    vi.doMock('../workers/src/lib/analytics.js', () => ({
      trackEvent: vi.fn(),
    }));
    vi.doMock('../workers/src/lib/errors.js', () => ({
      reportHandledRouteError: vi.fn(() => Response.json({ error: 'err' }, { status: 500 })),
    }));
    vi.doMock('../workers/src/lib/routeErrors.js', () => ({
      reportHandledRouteError: vi.fn(() => Response.json({ error: 'err' }, { status: 500 })),
    }));
    vi.doMock('../workers/src/lib/logger.js', () => ({
      createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
    }));
    vi.doMock('../workers/src/middleware/tierEnforcement.js', () => ({
      enforceFeatureAccess: vi.fn(() => null),
    }));

    const mod = await import('../workers/src/handlers/practitioner.js');
    handlePractitioner = mod.default || mod.handlePractitioner;
  });

  it('returns diary entries for valid client relationship', async () => {
    const req = new Request('https://x.com/api/practitioner/clients/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/diary');
    req._user = { sub: 'prac-user-1' };
    const resp = await handlePractitioner(req, { NEON_CONNECTION_STRING: 'x' }, '/clients/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/diary');
    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('rejects unauthenticated diary access', async () => {
    const req = new Request('https://x.com/api/practitioner/clients/xxx/diary');
    req._user = null;
    const resp = await handlePractitioner(req, { NEON_CONNECTION_STRING: 'x' }, '/clients/xxx/diary');
    expect(resp.status).toBe(401);
  });
});

describe('Diary Sharing — client handler', () => {
  let handleGetDiarySharingPrefs, handleSetDiarySharing;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('../workers/src/db/queries.js', () => ({
      QUERIES: {
        getMyDiarySharingPreferences: 'SELECT 1',
        setMyDiarySharing: 'UPDATE 1',
      },
      createQueryFn: () => async () => ({ rows: [{ share_diary: true, practitioner_user_id: 'p1', practitioner_name: 'Dr X' }] }),
    }));
    vi.doMock('../workers/src/lib/analytics.js', () => ({
      trackEvent: vi.fn(() => Promise.resolve()),
    }));
    vi.doMock('../workers/src/lib/logger.js', () => ({
      createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
    }));

    const mod = await import('../workers/src/handlers/client-portal.js');
    handleGetDiarySharingPrefs = mod.handleGetDiarySharingPrefs;
    handleSetDiarySharing = mod.handleSetDiarySharing;
  });

  it('GET diary-sharing returns prefs for authenticated user', async () => {
    const req = new Request('https://x.com/api/client/diary-sharing');
    req._user = { sub: 'user-1' };
    const resp = await handleGetDiarySharingPrefs(req, { NEON_CONNECTION_STRING: 'x' });
    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0]).toHaveProperty('share_diary');
  });

  it('GET diary-sharing rejects unauthenticated', async () => {
    const req = new Request('https://x.com/api/client/diary-sharing');
    req._user = null;
    const resp = await handleGetDiarySharingPrefs(req, { NEON_CONNECTION_STRING: 'x' });
    expect(resp.status).toBe(401);
  });

  it('PUT diary-sharing rejects missing body', async () => {
    const req = new Request('https://x.com/api/client/diary-sharing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    req._user = { sub: 'user-1' };
    const resp = await handleSetDiarySharing(req, { NEON_CONNECTION_STRING: 'x' });
    expect(resp.status).toBe(400);
  });

  it('PUT diary-sharing accepts valid toggle', async () => {
    const req = new Request('https://x.com/api/client/diary-sharing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ practitioner_user_id: 'p1', share_diary: true })
    });
    req._user = { sub: 'user-1' };
    const resp = await handleSetDiarySharing(req, { NEON_CONNECTION_STRING: 'x' });
    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(body.share_diary).toBe(true);
  });
});

describe('Diary Practitioner — migration', () => {
  it('migration file exists with share_diary column', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('workers/src/db/migrations/059_diary_practitioner_visibility.sql', 'utf8');
    expect(content).toContain('share_diary');
    expect(content).toContain('practitioner_clients');
  });
});

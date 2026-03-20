import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { createQueryFnMock } = vi.hoisted(() => ({
  createQueryFnMock: vi.fn(),
}));

const { verifyHS256Mock } = vi.hoisted(() => ({
  verifyHS256Mock: vi.fn(),
}));

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: createQueryFnMock,
  QUERIES: {
    getPractitionerByUserId: 'getPractitionerByUserId',
    checkPractitionerAccess:  'checkPractitionerAccess',
    createSessionNote:        'createSessionNote',
  },
}));

vi.mock('../workers/src/lib/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock('../workers/src/lib/jwt.js', () => ({
  verifyHS256: verifyHS256Mock,
  jwtClaims:   vi.fn(() => ({})),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import {
  handleCreateInvite,
  handleJoinSession,
  handleLiveSessionConnect,
  handleEndSession,
} from '../workers/src/handlers/live-session.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Make an authenticated request with _user already set (simulates middleware).
 */
function makeRequest(method, url, { user, body, headers = {} } = {}) {
  const init = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body) init.body = JSON.stringify(body);
  const req = new Request(url, init);
  if (user) req._user = user;
  return req;
}

/**
 * Build the standard test env with KV and DO stubs.
 */
function makeEnv({ doFetch, cacheGet } = {}) {
  const doFetchFn = doFetch ?? vi.fn();
  return {
    NEON_CONNECTION_STRING: 'postgresql://test',
    JWT_SECRET:             'test-secret',
    FRONTEND_URL:           'https://selfprime.net',
    CACHE: {
      get:    cacheGet ?? vi.fn().mockResolvedValue(null),
      put:    vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    LIVE_SESSION: {
      idFromName: vi.fn().mockReturnValue('do-id-1'),
      get:        vi.fn().mockReturnValue({ fetch: doFetchFn }),
    },
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// handleCreateInvite
// ═════════════════════════════════════════════════════════════════════════════

describe('handleCreateInvite', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when _user is not set', async () => {
    const res = await handleCreateInvite(
      makeRequest('POST', 'https://api.test/api/live-session/invite/client-1'),
      makeEnv(),
      'client-1',
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 when requester is not a registered practitioner', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleCreateInvite(
      makeRequest('POST', 'https://api.test/api/live-session/invite/client-1', {
        user: { sub: 'user-nobody' },
      }),
      makeEnv(),
      'client-1',
    );

    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toMatch(/practitioner/i);
  });

  it('returns 403 when client is not on the practitioner roster', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [{ id: 'pract-1' }] };
      if (sql === 'checkPractitionerAccess')  return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleCreateInvite(
      makeRequest('POST', 'https://api.test/api/live-session/invite/other-client', {
        user: { sub: 'user-pract' },
      }),
      makeEnv(),
      'other-client',
    );

    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toMatch(/roster/i);
  });

  it('creates session + invite KV entries and returns sessionId + clientJoinUrl', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [{ id: 'pract-1' }] };
      if (sql === 'checkPractitionerAccess')  return { rows: [{ '?column?': 1 }] };
      throw new Error(`Unexpected query: ${sql}`);
    });
    createQueryFnMock.mockReturnValue(query);

    const env = makeEnv();
    const res = await handleCreateInvite(
      makeRequest('POST', 'https://api.test/api/live-session/invite/client-7', {
        user: { sub: 'user-pract' },
      }),
      env,
      'client-7',
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toHaveProperty('sessionId');
    expect(body).toHaveProperty('clientJoinUrl');
    expect(body.clientJoinUrl).toContain('/live/');

    // Two KV entries must be written: session + invite token
    expect(env.CACHE.put).toHaveBeenCalledTimes(2);

    const [[sessionKey, sessionVal], [tokenKey, tokenVal]] = env.CACHE.put.mock.calls;
    expect(sessionKey).toMatch(/^live_session:/);
    expect(tokenKey).toMatch(/^live_invite:/);

    const session = JSON.parse(sessionVal);
    expect(session.practitionerUserId).toBe('user-pract');
    expect(session.clientId).toBe('client-7');
    expect(session.sessionId).toBe(body.sessionId);

    const invite = JSON.parse(tokenVal);
    expect(invite.clientId).toBe('client-7');
    expect(invite.sessionId).toBe(body.sessionId);
  });

  it('stores KV entries with 8-hour TTL', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [{ id: 'pract-1' }] };
      if (sql === 'checkPractitionerAccess')  return { rows: [{ '?column?': 1 }] };
      throw new Error(`Unexpected query: ${sql}`);
    });
    createQueryFnMock.mockReturnValue(query);

    const env = makeEnv();
    await handleCreateInvite(
      makeRequest('POST', 'https://api.test/', { user: { sub: 'pract-user' } }),
      env,
      'client-7',
    );

    for (const [, , opts] of env.CACHE.put.mock.calls) {
      expect(opts?.expirationTtl).toBe(28800); // 8h in seconds
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// handleJoinSession
// ═════════════════════════════════════════════════════════════════════════════

describe('handleJoinSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when _user is not set', async () => {
    const res = await handleJoinSession(
      makeRequest('GET', 'https://api.test/api/live-session/join/tok-1'),
      makeEnv(),
      'tok-1',
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when the token does not exist in KV', async () => {
    const env = makeEnv({ cacheGet: vi.fn().mockResolvedValue(null) });
    const res = await handleJoinSession(
      makeRequest('GET', 'https://api.test/', { user: { sub: 'client-1' } }),
      env,
      'missing-token',
    );

    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error).toMatch(/invalid|expired/i);
  });

  it('returns 403 when the token belongs to a different client', async () => {
    const inviteData = JSON.stringify({
      sessionId:          'session-abc',
      practitionerUserId: 'pract-1',
      clientId:           'client-correct',
    });
    const env = makeEnv({ cacheGet: vi.fn().mockResolvedValue(inviteData) });

    const res = await handleJoinSession(
      makeRequest('GET', 'https://api.test/', { user: { sub: 'client-wrong' } }),
      env,
      'tok-xyz',
    );

    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toMatch(/not for your account/i);
  });

  it('returns sessionId when the correct client presents their token', async () => {
    const inviteData = JSON.stringify({
      sessionId:          'session-abc',
      practitionerUserId: 'pract-1',
      clientId:           'client-correct',
    });
    const env = makeEnv({ cacheGet: vi.fn().mockResolvedValue(inviteData) });

    const res = await handleJoinSession(
      makeRequest('GET', 'https://api.test/', { user: { sub: 'client-correct' } }),
      env,
      'tok-xyz',
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.sessionId).toBe('session-abc');

    // Token must be deleted after use (single-use enforcement)
    expect(env.CACHE.delete).toHaveBeenCalledWith('live_invite:tok-xyz');
  });

  it('cannot reuse a token that was already consumed (KV returns null on second call)', async () => {
    // Simulate first-use returning data, second-use returning null (already deleted)
    const inviteData = JSON.stringify({
      sessionId: 'session-abc',
      practitionerUserId: 'pract-1',
      clientId: 'client-correct',
    });
    const cacheGet = vi.fn()
      .mockResolvedValueOnce(inviteData)  // first call: valid
      .mockResolvedValueOnce(null);        // second call: deleted

    const env = makeEnv({ cacheGet });

    // First join succeeds
    const res1 = await handleJoinSession(
      makeRequest('GET', 'https://api.test/', { user: { sub: 'client-correct' } }),
      env,
      'tok-xyz',
    );
    expect(res1.status).toBe(200);

    // Second join fails
    const res2 = await handleJoinSession(
      makeRequest('GET', 'https://api.test/', { user: { sub: 'client-correct' } }),
      env,
      'tok-xyz',
    );
    expect(res2.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// handleLiveSessionConnect
// ═════════════════════════════════════════════════════════════════════════════

describe('handleLiveSessionConnect', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 426 when request is not a WebSocket upgrade', async () => {
    const res = await handleLiveSessionConnect(
      makeRequest('GET', 'https://api.test/', { user: { sub: 'user-1' } }),
      makeEnv(),
      'session-1',
    );
    expect(res.status).toBe(426);
  });

  it('returns 401 when no user identity is available', async () => {
    const req = makeRequest('GET', 'https://api.test/', {
      headers: { Upgrade: 'websocket' },
    });
    const env = makeEnv({ cacheGet: vi.fn().mockResolvedValue(null) });
    const res = await handleLiveSessionConnect(req, env, 'session-1');
    expect(res.status).toBe(401);
  });

  it('returns 404 when session does not exist in KV', async () => {
    const req = Object.assign(
      makeRequest('GET', 'https://api.test/', {
        user: { sub: 'user-1' },
        headers: { Upgrade: 'websocket' },
      }),
      { _user: { sub: 'user-1' } },
    );
    const env = makeEnv({ cacheGet: vi.fn().mockResolvedValue(null) });
    const res = await handleLiveSessionConnect(req, env, 'session-999');
    expect(res.status).toBe(404);
  });

  it('returns 403 when user is neither the practitioner nor the invited client', async () => {
    const sessionData = JSON.stringify({
      practitionerUserId: 'pract-user',
      clientId:           'client-user',
      sessionId:          'session-1',
    });
    const req = makeRequest('GET', 'https://api.test/', {
      user: { sub: 'stranger' },
      headers: { Upgrade: 'websocket' },
    });
    const env = makeEnv({ cacheGet: vi.fn().mockResolvedValue(sessionData) });
    const res = await handleLiveSessionConnect(req, env, 'session-1');
    expect(res.status).toBe(403);
  });

  it('forwards practitioner upgrade to the Durable Object with correct role header', async () => {
    const sessionData = JSON.stringify({
      practitionerUserId: 'pract-user',
      clientId:           'client-user',
      sessionId:          'session-1',
    });
    const doFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const req = makeRequest('GET', 'https://api.test/', {
      user: { sub: 'pract-user' },
      headers: { Upgrade: 'websocket' },
    });

    const env = makeEnv({ cacheGet: vi.fn().mockResolvedValue(sessionData), doFetch });
    await handleLiveSessionConnect(req, env, 'session-1');

    expect(doFetch).toHaveBeenCalledTimes(1);
    const [[doRequest]] = doFetch.mock.calls;
    expect(doRequest.headers.get('X-User-Role')).toBe('practitioner');
    expect(doRequest.headers.get('X-User-Id')).toBe('pract-user');
  });

  it('assigns client role when the joining user is the invited client', async () => {
    const sessionData = JSON.stringify({
      practitionerUserId: 'pract-user',
      clientId:           'client-user',
      sessionId:          'session-1',
    });
    const doFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const req = makeRequest('GET', 'https://api.test/', {
      user: { sub: 'client-user' },
      headers: { Upgrade: 'websocket' },
    });

    const env = makeEnv({ cacheGet: vi.fn().mockResolvedValue(sessionData), doFetch });
    await handleLiveSessionConnect(req, env, 'session-1');

    const [[doRequest]] = doFetch.mock.calls;
    expect(doRequest.headers.get('X-User-Role')).toBe('client');
    expect(doRequest.headers.get('X-User-Id')).toBe('client-user');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// handleEndSession
// ═════════════════════════════════════════════════════════════════════════════

describe('handleEndSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when _user is not set', async () => {
    const res = await handleEndSession(
      makeRequest('POST', 'https://api.test/'),
      makeEnv(),
      'session-1',
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when session does not exist in KV', async () => {
    const env = makeEnv({ cacheGet: vi.fn().mockResolvedValue(null) });
    const res = await handleEndSession(
      makeRequest('POST', 'https://api.test/', { user: { sub: 'pract-user' } }),
      env,
      'session-1',
    );

    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it('returns 403 when requester is not the session practitioner', async () => {
    const sessionData = JSON.stringify({
      practitionerUserId: 'pract-user',
      clientId:           'client-user',
      practitionerId:     'pract-db-1',
      sessionId:          'session-1',
    });
    const env = makeEnv({ cacheGet: vi.fn().mockResolvedValue(sessionData) });

    const res = await handleEndSession(
      makeRequest('POST', 'https://api.test/', { user: { sub: 'client-user' } }),
      env,
      'session-1',
    );

    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toMatch(/practitioner/i);
  });

  it('ends session without saving note when DO reports empty note content', async () => {
    const sessionData = JSON.stringify({
      practitionerUserId: 'pract-user',
      clientId:           'client-user',
      practitionerId:     'pract-db-1',
      sessionId:          'session-1',
    });

    const doFetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ noteContent: '', chartState: { tab: 'chart' } }))  // GET /state
      .mockResolvedValueOnce(Response.json({ ok: true }));                                       // POST /broadcast

    const env = makeEnv({ cacheGet: vi.fn().mockResolvedValue(sessionData), doFetch });
    createQueryFnMock.mockReturnValue(vi.fn()); // should not be called

    const res = await handleEndSession(
      makeRequest('POST', 'https://api.test/', { user: { sub: 'pract-user' } }),
      env,
      'session-1',
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.noteSaved).toBe(false);
    // KV key for the session must be removed
    expect(env.CACHE.delete).toHaveBeenCalledWith('live_session:session-1');
  });

  it('saves session note to DB when DO has non-empty note content', async () => {
    const sessionData = JSON.stringify({
      practitionerUserId: 'pract-user',
      clientId:           'client-user',
      practitionerId:     'pract-db-1',
      sessionId:          'session-1',
    });

    const doFetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ noteContent: 'Gate 45 activation noted.', chartState: {} }))
      .mockResolvedValueOnce(Response.json({ ok: true }));

    const query = vi.fn(async (sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [{ id: 'pract-db-1' }] };
      if (sql === 'createSessionNote')        return { rows: [{ id: 'note-new-1' }] };
      throw new Error(`Unexpected query: ${sql}`);
    });
    createQueryFnMock.mockReturnValue(query);

    const env = makeEnv({ cacheGet: vi.fn().mockResolvedValue(sessionData), doFetch });

    const res = await handleEndSession(
      makeRequest('POST', 'https://api.test/', { user: { sub: 'pract-user' } }),
      env,
      'session-1',
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.noteSaved).toBe(true);

    // Verify createSessionNote was called with correct params
    const createNoteCalls = query.mock.calls.filter(([sql]) => sql === 'createSessionNote');
    expect(createNoteCalls).toHaveLength(1);
    const [, [practId, clientId, content, shareWithAI, , date]] = createNoteCalls[0];
    expect(practId).toBe('pract-db-1');
    expect(clientId).toBe('client-user');
    expect(content).toBe('Gate 45 activation noted.');
    expect(shareWithAI).toBe(true);
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/); // ISO date

    // KV cleanup
    expect(env.CACHE.delete).toHaveBeenCalledWith('live_session:session-1');
  });

  it('broadcasts session_ended before deleting KV (ordering check)', async () => {
    const sessionData = JSON.stringify({
      practitionerUserId: 'pract-user',
      clientId:           'client-user',
      practitionerId:     'pract-db-1',
      sessionId:          'session-1',
    });

    const callOrder = [];
    const doFetch = vi.fn().mockImplementation(async (req) => {
      if (req.url.endsWith('/state')) {
        callOrder.push('do-state');
        return Response.json({ noteContent: '', chartState: {} });
      }
      if (req.url.endsWith('/broadcast')) {
        callOrder.push('do-broadcast');
        return Response.json({ ok: true });
      }
    });

    const env = makeEnv({ cacheGet: vi.fn().mockResolvedValue(sessionData), doFetch });
    env.CACHE.delete = vi.fn().mockImplementation(() => {
      callOrder.push('kv-delete');
      return Promise.resolve();
    });

    await handleEndSession(
      makeRequest('POST', 'https://api.test/', { user: { sub: 'pract-user' } }),
      env,
      'session-1',
    );

    expect(callOrder).toEqual(['do-state', 'do-broadcast', 'kv-delete']);
  });
});

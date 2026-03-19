/**
 * Messaging Handler Tests (item 5.1)
 *
 * Tests auth guards, input validation, DB delegation, and response shapes for
 * the five messaging endpoints.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { createQueryFnMock } = vi.hoisted(() => ({
  createQueryFnMock: vi.fn(),
}));

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: createQueryFnMock,
  QUERIES: {
    getPractitionerByUserId:            'getPractitionerByUserId',
    checkPractitionerAccess:            'checkPractitionerAccess',
    listMessages:                       'listMessages',
    markThreadRead:                     'markThreadRead',
    createMessage:                      'createMessage',
    markMessageRead:                    'markMessageRead',
    listClientMessages:                 'listClientMessages',
    getPractitionerUserIdByPractitionerId: 'getPractitionerUserIdByPractitionerId',
    getActivePushSubscriptionsFull:     'getActivePushSubscriptionsFull',
  },
}));

vi.mock('../workers/src/lib/analytics.js', () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../workers/src/handlers/push.js', () => ({
  sendPushNotification: vi.fn(),
}));

vi.mock('../workers/src/lib/logger.js', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

import {
  handlePractitionerListMessages,
  handlePractitionerSendMessage,
  handleClientListMessages,
  handleClientSendMessage,
  handleMarkMessageRead,
} from '../workers/src/handlers/messages.js';

// ── Helpers ────────────────────────────────────────────────────────────────

const ENV = { NEON_CONNECTION_STRING: 'postgresql://test' };

function req(method, url, body, userId = 'user-1') {
  const init = { method, headers: { 'Content-Type': 'application/json' } };
  if (body && method !== 'GET') init.body = JSON.stringify(body);
  return Object.assign(new Request(url, init), { _user: userId ? { sub: userId } : undefined });
}

function noAuthReq(method, url, body) {
  return req(method, url, body, null);
}

// ── handlePractitionerListMessages ────────────────────────────────────────

describe('GET /api/practitioner/clients/:id/messages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    const r = noAuthReq('GET', 'https://api/test');
    const res = await handlePractitionerListMessages(r, ENV, 'client-1');
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not a practitioner', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [] };
      throw new Error(`Unexpected: ${sql}`);
    });
    createQueryFnMock.mockReturnValue(query);

    const res = await handlePractitionerListMessages(
      req('GET', 'https://api/test?limit=10'), ENV, 'client-1'
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not registered/i);
  });

  it('returns 403 when client not on roster', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'getPractitionerByUserId')  return { rows: [{ id: 'pract-1' }] };
      if (sql === 'checkPractitionerAccess')  return { rows: [] };
      throw new Error(`Unexpected: ${sql}`);
    });
    createQueryFnMock.mockReturnValue(query);

    const res = await handlePractitionerListMessages(
      req('GET', 'https://api/test'), ENV, 'stranger-client'
    );
    expect(res.status).toBe(403);
  });

  it('returns messages and marks thread read on success', async () => {
    const fakeMsgs = [
      { id: 1, body: 'Hi', sender_name: 'Doc', created_at: new Date().toISOString() },
    ];
    const query = vi.fn(async (sql) => {
      if (sql === 'getPractitionerByUserId')  return { rows: [{ id: 'pract-1' }] };
      if (sql === 'checkPractitionerAccess')  return { rows: [{ id: 'client-1' }] };
      if (sql === 'listMessages')             return { rows: fakeMsgs };
      if (sql === 'markThreadRead')           return { rows: [] };
      throw new Error(`Unexpected: ${sql}`);
    });
    createQueryFnMock.mockReturnValue(query);

    const res = await handlePractitionerListMessages(
      req('GET', 'https://api/test?limit=20&offset=0'), ENV, 'client-1'
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages).toEqual(fakeMsgs);
  });
});

// ── handlePractitionerSendMessage ─────────────────────────────────────────

describe('POST /api/practitioner/clients/:id/messages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    const r = noAuthReq('POST', 'https://api/test', { body: 'hello' });
    const res = await handlePractitionerSendMessage(r, ENV, 'client-1');
    expect(res.status).toBe(401);
  });

  it('returns 400 for empty message body', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [{ id: 'pract-1' }] };
      if (sql === 'checkPractitionerAccess') return { rows: [{ id: 'client-1' }] };
      throw new Error(`Unexpected: ${sql}`);
    });
    createQueryFnMock.mockReturnValue(query);

    const res = await handlePractitionerSendMessage(
      req('POST', 'https://api/test', { body: '   ' }), ENV, 'client-1'
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for message exceeding 2000 chars', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [{ id: 'pract-1' }] };
      if (sql === 'checkPractitionerAccess') return { rows: [{ id: 'client-1' }] };
      throw new Error(`Unexpected: ${sql}`);
    });
    createQueryFnMock.mockReturnValue(query);

    const res = await handlePractitionerSendMessage(
      req('POST', 'https://api/test', { body: 'x'.repeat(2001) }), ENV, 'client-1'
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/2000 character/i);
  });

  it('returns 201 with saved message on success', async () => {
    const fakeMsg = { id: 99, body: 'hello', created_at: new Date().toISOString() };
    const query = vi.fn(async (sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [{ id: 'pract-1' }] };
      if (sql === 'checkPractitionerAccess') return { rows: [{ id: 'client-1' }] };
      if (sql === 'createMessage')           return { rows: [fakeMsg] };
      if (sql === 'getActivePushSubscriptionsFull') return { rows: [] };
      throw new Error(`Unexpected: ${sql}`);
    });
    createQueryFnMock.mockReturnValue(query);

    const res = await handlePractitionerSendMessage(
      req('POST', 'https://api/test', { body: 'hello' }), ENV, 'client-1'
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.message).toEqual(fakeMsg);
  });
});

// ── handleClientListMessages ───────────────────────────────────────────────

describe('GET /api/client/messages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    const r = noAuthReq('GET', 'https://api/test');
    const res = await handleClientListMessages(r, ENV);
    expect(res.status).toBe(401);
  });

  it('returns all messages for client on success', async () => {
    const fakeMsgs = [{ id: 1, body: 'Welcome', practitioner_id: 'pract-1' }];
    const query = vi.fn(async (sql) => {
      if (sql === 'listClientMessages') return { rows: fakeMsgs };
      throw new Error(`Unexpected: ${sql}`);
    });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleClientListMessages(req('GET', 'https://api/test'), ENV);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.messages).toEqual(fakeMsgs);
  });
});

// ── handleClientSendMessage ────────────────────────────────────────────────

describe('POST /api/client/messages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    const r = noAuthReq('POST', 'https://api/test', { practitionerId: 'p', body: 'hi' });
    const res = await handleClientSendMessage(r, ENV);
    expect(res.status).toBe(401);
  });

  it('returns 400 when practitionerId is missing', async () => {
    createQueryFnMock.mockReturnValue(vi.fn());
    const res = await handleClientSendMessage(
      req('POST', 'https://api/test', { body: 'hi' }), ENV
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/practitionerId/);
  });

  it('returns 400 when body is empty', async () => {
    createQueryFnMock.mockReturnValue(vi.fn());
    const res = await handleClientSendMessage(
      req('POST', 'https://api/test', { practitionerId: 'pract-1', body: '' }), ENV
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when practitioner not found', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'getPractitionerUserIdByPractitionerId') return { rows: [] };
      throw new Error(`Unexpected: ${sql}`);
    });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleClientSendMessage(
      req('POST', 'https://api/test', { practitionerId: 'bad-id', body: 'hi' }), ENV
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 when client not on practitioner roster', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'getPractitionerUserIdByPractitionerId') return { rows: [{ user_id: 'puser-1' }] };
      if (sql === 'checkPractitionerAccess') return { rows: [] };
      throw new Error(`Unexpected: ${sql}`);
    });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleClientSendMessage(
      req('POST', 'https://api/test', { practitionerId: 'pract-1', body: 'hi' }), ENV
    );
    expect(res.status).toBe(403);
  });

  it('returns 201 with message on success', async () => {
    const fakeMsg = { id: 7, body: 'hi', created_at: new Date().toISOString() };
    const query = vi.fn(async (sql) => {
      if (sql === 'getPractitionerUserIdByPractitionerId') return { rows: [{ user_id: 'puser-1' }] };
      if (sql === 'checkPractitionerAccess') return { rows: [{ id: 'r1' }] };
      if (sql === 'createMessage')           return { rows: [fakeMsg] };
      if (sql === 'getActivePushSubscriptionsFull') return { rows: [] };
      throw new Error(`Unexpected: ${sql}`);
    });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleClientSendMessage(
      req('POST', 'https://api/test', { practitionerId: 'pract-1', body: 'hi' }), ENV
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.message).toEqual(fakeMsg);
  });
});

// ── handleMarkMessageRead ──────────────────────────────────────────────────

describe('PUT /api/messages/:id/read', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    const r = noAuthReq('PUT', 'https://api/test');
    const res = await handleMarkMessageRead(r, ENV, '42');
    expect(res.status).toBe(401);
  });

  it('returns 404 when message not found or already read', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'markMessageRead') return { rows: [] };
      throw new Error(`Unexpected: ${sql}`);
    });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleMarkMessageRead(
      req('PUT', 'https://api/test'), ENV, '99'
    );
    expect(res.status).toBe(404);
  });

  it('returns 200 with updated message on success', async () => {
    const fakeMsg = { id: 5, is_read: true };
    const query = vi.fn(async (sql) => {
      if (sql === 'markMessageRead') return { rows: [fakeMsg] };
      throw new Error(`Unexpected: ${sql}`);
    });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleMarkMessageRead(
      req('PUT', 'https://api/test'), ENV, '5'
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.message).toEqual(fakeMsg);
  });
});

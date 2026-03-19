/**
 * Session Actions Tests
 * Item 2.2 — Session Actions (Practitioner-assigned client actions)
 *
 * Tests CRUD operations, access control, validation, and client completion.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQueryFn = vi.fn();

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: () => mockQueryFn,
  QUERIES: {
    getPractitionerByUserId: 'getPractitionerByUserId',
    getPractitionerClient: 'getPractitionerClient',
    createSessionAction: 'createSessionAction',
    listSessionActions: 'listSessionActions',
    countSessionActions: 'countSessionActions',
    updateSessionAction: 'updateSessionAction',
    deleteSessionAction: 'deleteSessionAction',
    getClientActions: 'getClientActions',
    completeClientAction: 'completeClientAction'
  }
}));

vi.mock('../workers/src/lib/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  })
}));

const {
  handleListActions,
  handleCreateAction,
  handleUpdateAction,
  handleDeleteAction,
  handleClientActions,
  handleCompleteAction
} = await import('../workers/src/handlers/session-actions.js');

const PRAC = { id: 'prac-1', user_id: 'user-1' };
const CLIENT_ID = 'client-1';
const ACTION_ID = 'action-1';
const env = { NEON_CONNECTION_STRING: 'postgres://test' };

function makeRequest(method, path, body, authed = true) {
  const url = `https://api.primeself.app${path}`;
  const opts = { method, headers: new Headers({ 'Content-Type': 'application/json' }) };
  if (body) opts.body = JSON.stringify(body);
  const req = new Request(url, opts);
  if (authed) req._user = { sub: 'user-1', id: 'user-1' };
  return req;
}

function mockPracAccess() {
  mockQueryFn.mockImplementation((sql) => {
    if (sql === 'getPractitionerByUserId') return { rows: [PRAC] };
    if (sql === 'getPractitionerClient') return { rows: [{ id: CLIENT_ID }] };
    return { rows: [] };
  });
}

beforeEach(() => { vi.clearAllMocks(); });

describe('handleCreateAction', () => {
  it('creates an action with valid input', async () => {
    const created = { id: ACTION_ID, title: 'Journal daily', status: 'pending' };
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [PRAC] };
      if (sql === 'getPractitionerClient') return { rows: [{ id: CLIENT_ID }] };
      if (sql === 'createSessionAction') return { rows: [created] };
      return { rows: [] };
    });

    const req = makeRequest('POST', `/api/practitioner/clients/${CLIENT_ID}/actions`, {
      title: 'Journal daily',
      due_date: '2026-04-01'
    });

    const res = await handleCreateAction(req, env, CLIENT_ID);
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.ok).toBe(true);
    expect(data.action.title).toBe('Journal daily');
  });

  it('rejects missing title', async () => {
    mockPracAccess();
    const req = makeRequest('POST', `/api/practitioner/clients/${CLIENT_ID}/actions`, {
      description: 'no title provided'
    });
    const res = await handleCreateAction(req, env, CLIENT_ID);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Title is required');
  });

  it('rejects title over max length', async () => {
    mockPracAccess();
    const req = makeRequest('POST', `/api/practitioner/clients/${CLIENT_ID}/actions`, {
      title: 'a'.repeat(201)
    });
    const res = await handleCreateAction(req, env, CLIENT_ID);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('exceeds');
  });

  it('rejects description over max length', async () => {
    mockPracAccess();
    const req = makeRequest('POST', `/api/practitioner/clients/${CLIENT_ID}/actions`, {
      title: 'Valid title',
      description: 'x'.repeat(5001)
    });
    const res = await handleCreateAction(req, env, CLIENT_ID);
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const req = makeRequest('POST', `/api/practitioner/clients/${CLIENT_ID}/actions`, { title: 'test' }, false);
    const res = await handleCreateAction(req, env, CLIENT_ID);
    expect(res.status).toBe(401);
  });

  it('returns 403 when not the practitioner', async () => {
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [] };
      return { rows: [] };
    });
    const req = makeRequest('POST', `/api/practitioner/clients/${CLIENT_ID}/actions`, { title: 'test' });
    const res = await handleCreateAction(req, env, CLIENT_ID);
    expect(res.status).toBe(403);
  });
});

describe('handleListActions', () => {
  it('lists actions for a client', async () => {
    const actions = [
      { id: 'a1', title: 'Journal daily', status: 'pending' },
      { id: 'a2', title: 'Meditate', status: 'completed' }
    ];
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [PRAC] };
      if (sql === 'getPractitionerClient') return { rows: [{ id: CLIENT_ID }] };
      if (sql === 'listSessionActions') return { rows: actions };
      if (sql === 'countSessionActions') return { rows: [{ total: 2 }] };
      return { rows: [] };
    });

    const req = makeRequest('GET', `/api/practitioner/clients/${CLIENT_ID}/actions`);
    const res = await handleListActions(req, env, CLIENT_ID);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.actions)).toBe(true);
    expect(data.actions.length).toBe(2);
    expect(data.total).toBe(2);
  });
});

describe('handleUpdateAction', () => {
  it('updates an action', async () => {
    const updated = { id: ACTION_ID, title: 'Journal twice daily', status: 'pending' };
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [PRAC] };
      if (sql === 'updateSessionAction') return { rows: [updated] };
      return { rows: [] };
    });
    const req = makeRequest('PUT', `/api/practitioner/actions/${ACTION_ID}`, { title: 'Journal twice daily' });
    const res = await handleUpdateAction(req, env, ACTION_ID);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.action.title).toBe('Journal twice daily');
  });

  it('returns 404 for missing action', async () => {
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [PRAC] };
      if (sql === 'updateSessionAction') return { rows: [] };
      return { rows: [] };
    });
    const req = makeRequest('PUT', `/api/practitioner/actions/nonexistent`, { title: 'test' });
    const res = await handleUpdateAction(req, env, 'nonexistent');
    expect(res.status).toBe(404);
  });

  it('rejects invalid status', async () => {
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [PRAC] };
      return { rows: [] };
    });
    const req = makeRequest('PUT', `/api/practitioner/actions/${ACTION_ID}`, { status: 'invalid' });
    const res = await handleUpdateAction(req, env, ACTION_ID);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Invalid status');
  });
});

describe('handleDeleteAction', () => {
  it('deletes an action', async () => {
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [PRAC] };
      if (sql === 'deleteSessionAction') return { rows: [] };
      return { rows: [] };
    });
    const req = makeRequest('DELETE', `/api/practitioner/actions/${ACTION_ID}`);
    const res = await handleDeleteAction(req, env, ACTION_ID);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });
});

describe('handleClientActions', () => {
  it('returns actions for a client user', async () => {
    const actions = [{ id: 'a1', title: 'Journal', status: 'pending', practitioner_name: 'Dr Test' }];
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'getClientActions') return { rows: actions };
      return { rows: [] };
    });
    const req = makeRequest('GET', '/api/client/my-actions');
    const res = await handleClientActions(req, env);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.actions)).toBe(true);
    expect(data.actions[0].practitioner_name).toBe('Dr Test');
  });

  it('returns 401 without auth', async () => {
    const req = makeRequest('GET', '/api/client/my-actions', null, false);
    const res = await handleClientActions(req, env);
    expect(res.status).toBe(401);
  });
});

describe('handleCompleteAction', () => {
  it('completes a pending action', async () => {
    const completed = { id: ACTION_ID, status: 'completed', completed_at: new Date().toISOString() };
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'completeClientAction') return { rows: [completed] };
      return { rows: [] };
    });
    const req = makeRequest('PUT', `/api/client/actions/${ACTION_ID}/complete`);
    const res = await handleCompleteAction(req, env, ACTION_ID);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.action.status).toBe('completed');
  });

  it('returns 404 if action not found or already completed', async () => {
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'completeClientAction') return { rows: [] };
      return { rows: [] };
    });
    const req = makeRequest('PUT', `/api/client/actions/${ACTION_ID}/complete`);
    const res = await handleCompleteAction(req, env, ACTION_ID);
    expect(res.status).toBe(404);
  });
});

/**
 * Divination Readings Tests
 * Item 2.1 — Divination Reading Log
 *
 * Tests CRUD operations, access control, and validation for divination readings.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQueryFn = vi.fn();

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: () => mockQueryFn,
  QUERIES: {
    getPractitionerByUserId: 'getPractitionerByUserId',
    getPractitionerClient: 'getPractitionerClient',
    createDivinationReading: 'createDivinationReading',
    listDivinationReadings: 'listDivinationReadings',
    countDivinationReadings: 'countDivinationReadings',
    getDivinationReading: 'getDivinationReading',
    updateDivinationReading: 'updateDivinationReading',
    deleteDivinationReading: 'deleteDivinationReading',
    getSharedDivinationReadings: 'getSharedDivinationReadings'
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
  handleListReadings,
  handleCreateReading,
  handleGetReading,
  handleUpdateReading,
  handleDeleteReading,
  handleClientReadings
} = await import('../workers/src/handlers/divination-readings.js');

const PRAC = { id: 'prac-1', user_id: 'user-1' };
const CLIENT_ID = 'client-1';
const READING_ID = 'reading-1';
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
  mockQueryFn.mockImplementation((sql, params) => {
    if (sql === 'getPractitionerByUserId') return { rows: [PRAC] };
    if (sql === 'getPractitionerClient') return { rows: [{ id: CLIENT_ID }] };
    return { rows: [] };
  });
}

beforeEach(() => { vi.clearAllMocks(); });

describe('handleCreateReading', () => {
  it('creates a reading with valid input', async () => {
    const created = { id: READING_ID, reading_type: 'tarot', interpretation: 'The Fool signals new beginnings.' };
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [PRAC] };
      if (sql === 'getPractitionerClient') return { rows: [{ id: CLIENT_ID }] };
      if (sql === 'createDivinationReading') return { rows: [created] };
      return { rows: [] };
    });

    const req = makeRequest('POST', `/api/practitioner/clients/${CLIENT_ID}/readings`, {
      reading_type: 'tarot',
      interpretation: 'The Fool signals new beginnings.',
      reading_date: '2026-03-18'
    });

    const res = await handleCreateReading(req, env, CLIENT_ID);
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.ok).toBe(true);
    expect(data.reading.reading_type).toBe('tarot');
  });

  it('rejects invalid reading_type', async () => {
    mockPracAccess();
    const req = makeRequest('POST', `/api/practitioner/clients/${CLIENT_ID}/readings`, {
      reading_type: 'crystal_ball',
      interpretation: 'test'
    });
    const res = await handleCreateReading(req, env, CLIENT_ID);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Invalid reading_type');
  });

  it('rejects interpretation over max length', async () => {
    mockPracAccess();
    const req = makeRequest('POST', `/api/practitioner/clients/${CLIENT_ID}/readings`, {
      interpretation: 'a'.repeat(10001)
    });
    const res = await handleCreateReading(req, env, CLIENT_ID);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('exceeds');
  });

  it('rejects too many cards', async () => {
    mockPracAccess();
    const cards = Array.from({ length: 79 }, (_, i) => ({ name: `Card ${i}` }));
    const req = makeRequest('POST', `/api/practitioner/clients/${CLIENT_ID}/readings`, {
      cards,
      interpretation: 'test'
    });
    const res = await handleCreateReading(req, env, CLIENT_ID);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Too many cards');
  });

  it('returns 401 without auth', async () => {
    const req = makeRequest('POST', `/api/practitioner/clients/${CLIENT_ID}/readings`, { interpretation: 'test' }, false);
    const res = await handleCreateReading(req, env, CLIENT_ID);
    expect(res.status).toBe(401);
  });

  it('returns 403 when not the practitioner', async () => {
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [] };
      return { rows: [] };
    });
    const req = makeRequest('POST', `/api/practitioner/clients/${CLIENT_ID}/readings`, { interpretation: 'test' });
    const res = await handleCreateReading(req, env, CLIENT_ID);
    expect(res.status).toBe(403);
  });
});

describe('handleListReadings', () => {
  it('lists readings for a client', async () => {
    const readings = [
      { id: 'r1', reading_type: 'tarot', reading_date: '2026-03-18' },
      { id: 'r2', reading_type: 'oracle', reading_date: '2026-03-17' }
    ];
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [PRAC] };
      if (sql === 'getPractitionerClient') return { rows: [{ id: CLIENT_ID }] };
      if (sql === 'listDivinationReadings') return { rows: readings };
      if (sql === 'countDivinationReadings') return { rows: [{ total: 2 }] };
      return { rows: [] };
    });

    const req = makeRequest('GET', `/api/practitioner/clients/${CLIENT_ID}/readings?limit=10&offset=0`);
    const res = await handleListReadings(req, env, CLIENT_ID);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.readings)).toBe(true);
    expect(data.readings.length).toBe(2);
    expect(data.total).toBe(2);
    expect(data.hasMore).toBe(false);
  });
});

describe('handleGetReading', () => {
  it('returns a single reading', async () => {
    const reading = { id: READING_ID, reading_type: 'runes', interpretation: 'Fehu reversed.' };
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [PRAC] };
      if (sql === 'getDivinationReading') return { rows: [reading] };
      return { rows: [] };
    });
    const req = makeRequest('GET', `/api/practitioner/readings/${READING_ID}`);
    const res = await handleGetReading(req, env, READING_ID);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.reading.id).toBe(READING_ID);
  });

  it('returns 404 for missing reading', async () => {
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [PRAC] };
      if (sql === 'getDivinationReading') return { rows: [] };
      return { rows: [] };
    });
    const req = makeRequest('GET', `/api/practitioner/readings/nonexistent`);
    const res = await handleGetReading(req, env, 'nonexistent');
    expect(res.status).toBe(404);
  });
});

describe('handleDeleteReading', () => {
  it('deletes a reading', async () => {
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [PRAC] };
      if (sql === 'deleteDivinationReading') return { rows: [] };
      return { rows: [] };
    });
    const req = makeRequest('DELETE', `/api/practitioner/readings/${READING_ID}`);
    const res = await handleDeleteReading(req, env, READING_ID);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });
});

describe('handleClientReadings', () => {
  it('returns shared readings for a client user', async () => {
    const readings = [{ id: 'r1', share_with_ai: true }];
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'getSharedDivinationReadings') return { rows: readings };
      return { rows: [] };
    });
    const req = makeRequest('GET', '/api/client/my-readings');
    const res = await handleClientReadings(req, env);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.readings)).toBe(true);
    expect(data.readings.length).toBe(1);
  });

  it('returns 401 without auth', async () => {
    const req = makeRequest('GET', '/api/client/my-readings', null, false);
    const res = await handleClientReadings(req, env);
    expect(res.status).toBe(401);
  });
});

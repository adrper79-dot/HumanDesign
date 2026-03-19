/**
 * Client Portal — Unit Tests
 *
 * Tests the client-facing reverse view of the practitioner–client relationship.
 * Validates auth guards, access checks, and response shapes.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createQueryFnMock } = vi.hoisted(() => ({
  createQueryFnMock: vi.fn(),
}));

const { trackEventMock } = vi.hoisted(() => ({
  trackEventMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: createQueryFnMock,
  QUERIES: {
    getClientPractitioners: 'getClientPractitioners',
    checkClientPractitionerAccess: 'checkClientPractitionerAccess',
    getClientPractitionerInfo: 'getClientPractitionerInfo',
    getLatestChart: 'getLatestChart',
    getLatestProfile: 'getLatestProfile',
    getClientSharedNotes: 'getClientSharedNotes',
    getAllClientSharedNotes: 'getAllClientSharedNotes',
    countAllClientSharedNotes: 'countAllClientSharedNotes',
  },
}));

vi.mock('../workers/src/lib/analytics.js', () => ({
  trackEvent: trackEventMock,
  EVENTS: {},
}));

vi.mock('../workers/src/lib/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

import {
  handleGetClientPractitioners,
  handleGetClientPortal,
  handleGetClientSharedNotes,
} from '../workers/src/handlers/client-portal.js';

// ─── Helpers ─────────────────────────────────────────────────

const mockEnv = { NEON_CONNECTION_STRING: 'postgresql://test' };

function makeGetRequest(url, userId) {
  return Object.assign(
    new Request(url, { method: 'GET' }),
    { _user: userId ? { sub: userId } : undefined }
  );
}

// ─── GET /api/client/my-practitioners ────────────────────────

describe('GET /api/client/my-practitioners', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    const res = await handleGetClientPractitioners(
      makeGetRequest('https://api.test/api/client/my-practitioners', null),
      mockEnv,
    );
    expect(res.status).toBe(401);
  });

  it('returns empty array when client has no practitioners', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleGetClientPractitioners(
      makeGetRequest('https://api.test/api/client/my-practitioners', 'user-1'),
      mockEnv,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.practitioners).toEqual([]);
  });

  it('returns practitioners list with correct shape', async () => {
    const mockPractitioners = [
      {
        id: 'prac-1',
        display_name: 'Dr. Blueprint',
        photo_url: null,
        specializations: ['transit reading'],
        bio: 'Expert in energy work',
        session_format: 'virtual',
        booking_url: 'https://book.test',
        slug: 'dr-blueprint',
        relationship_since: '2026-01-15',
      },
    ];
    const query = vi.fn().mockResolvedValue({ rows: mockPractitioners });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleGetClientPractitioners(
      makeGetRequest('https://api.test/api/client/my-practitioners', 'user-1'),
      mockEnv,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.practitioners).toHaveLength(1);
    expect(body.practitioners[0].display_name).toBe('Dr. Blueprint');
    expect(query).toHaveBeenCalledWith('getClientPractitioners', ['user-1']);
  });
});

// ─── GET /api/client/portal/:practitionerId ──────────────────

describe('GET /api/client/portal/:practitionerId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    const res = await handleGetClientPortal(
      makeGetRequest('https://api.test/api/client/portal/prac-1', null),
      mockEnv,
      'prac-1',
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 when client is not on practitioner roster', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'checkClientPractitionerAccess') return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleGetClientPortal(
      makeGetRequest('https://api.test/api/client/portal/prac-1', 'user-1'),
      mockEnv,
      'prac-1',
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toMatch(/not a client/i);
  });

  it('returns portal data when access is valid', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'checkClientPractitionerAccess') return { rows: [{ '?column?': 1 }] };
      if (sql === 'getClientPractitionerInfo') return {
        rows: [{
          id: 'prac-1', display_name: 'Dr. Energy', photo_url: null,
          specializations: ['gates'], bio: 'Specialist', session_format: 'virtual',
          booking_url: 'https://book.test',
        }],
      };
      if (sql === 'getLatestChart') return {
        rows: [{ id: 'chart-1', calculated_at: '2026-01-01' }],
      };
      if (sql === 'getLatestProfile') return {
        rows: [{ id: 'profile-1', created_at: '2026-01-02' }],
      };
      if (sql === 'getClientSharedNotes') return {
        rows: [{
          id: 'note-1', content: 'Great session', session_date: '2026-01-10', created_at: '2026-01-10',
        }],
      };
      throw new Error(`Unexpected query: ${sql}`);
    });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleGetClientPortal(
      makeGetRequest('https://api.test/api/client/portal/prac-1', 'user-1'),
      mockEnv,
      'prac-1',
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.practitioner.display_name).toBe('Dr. Energy');
    expect(body.chart.id).toBe('chart-1');
    expect(body.profile.id).toBe('profile-1');
    expect(body.sharedNotes).toHaveLength(1);
    expect(body.sharedNotes[0].content).toBe('Great session');
  });

  it('handles null chart and profile gracefully', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'checkClientPractitionerAccess') return { rows: [{ '?column?': 1 }] };
      if (sql === 'getClientPractitionerInfo') return {
        rows: [{ id: 'prac-1', display_name: 'Test', photo_url: null, specializations: null, bio: null, session_format: null, booking_url: null }],
      };
      if (sql === 'getLatestChart') return { rows: [] };
      if (sql === 'getLatestProfile') return { rows: [] };
      if (sql === 'getClientSharedNotes') return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleGetClientPortal(
      makeGetRequest('https://api.test/api/client/portal/prac-1', 'user-1'),
      mockEnv,
      'prac-1',
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.chart).toBeNull();
    expect(body.profile).toBeNull();
    expect(body.sharedNotes).toEqual([]);
  });
});

// ─── GET /api/client/shared-notes ────────────────────────────

describe('GET /api/client/shared-notes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    const res = await handleGetClientSharedNotes(
      makeGetRequest('https://api.test/api/client/shared-notes', null),
      mockEnv,
    );
    expect(res.status).toBe(401);
  });

  it('returns paginated notes with practitioner names', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'getAllClientSharedNotes') return {
        rows: [
          { id: 'n1', content: 'Note 1', session_date: '2026-03-01', created_at: '2026-03-01', display_name: 'Dr. A' },
          { id: 'n2', content: 'Note 2', session_date: '2026-03-02', created_at: '2026-03-02', display_name: 'Dr. B' },
        ],
      };
      if (sql === 'countAllClientSharedNotes') return { rows: [{ total: 5 }] };
      throw new Error(`Unexpected query: ${sql}`);
    });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleGetClientSharedNotes(
      makeGetRequest('https://api.test/api/client/shared-notes?limit=2&offset=0', 'user-1'),
      mockEnv,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.notes).toHaveLength(2);
    expect(body.notes[0].practitioner_name).toBe('Dr. A');
    expect(body.total).toBe(5);
    expect(body.hasMore).toBe(true);
  });

  it('returns empty when no shared notes exist', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'getAllClientSharedNotes') return { rows: [] };
      if (sql === 'countAllClientSharedNotes') return { rows: [{ total: 0 }] };
      throw new Error(`Unexpected query: ${sql}`);
    });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleGetClientSharedNotes(
      makeGetRequest('https://api.test/api/client/shared-notes', 'user-1'),
      mockEnv,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.notes).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.hasMore).toBe(false);
  });
});

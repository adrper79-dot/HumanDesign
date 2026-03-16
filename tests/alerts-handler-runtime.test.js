/**
 * alerts-handler-runtime — deterministic unit tests for alerts.js (SYS-045)
 *
 * Covers:
 *  - Auth guard: all routes return 401 when unauthenticated
 *  - Create alert: invalid type → 400
 *  - Create alert: name too long (>200 chars) → 400
 *  - Create alert: description too long (>1000 chars) → 400
 *  - Create alert: tier limit reached (free = 3 alerts) → 403
 *  - List alerts: successful empty list → 200
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const { getUserFromRequestMock, createQueryFnMock } = vi.hoisted(() => ({
  getUserFromRequestMock: vi.fn(),
  createQueryFnMock: vi.fn(),
}));

vi.mock('../workers/src/middleware/auth.js', () => ({
  getUserFromRequest: getUserFromRequestMock,
}));

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: createQueryFnMock,
  QUERIES: {
    listUserAlerts: 'listUserAlerts',
    insertAlert: 'insertAlert',
    countUserAlerts: 'countUserAlerts',
    getAlertById: 'getAlertById',
    updateAlert: 'updateAlert',
    deleteAlert: 'deleteAlert',
    listAlertTemplates: 'listAlertTemplates',
    getAlertTemplateById: 'getAlertTemplateById',
    insertAlertFromTemplate: 'insertAlertFromTemplate',
    getAlertHistory: 'getAlertHistory',
  },
}));

vi.mock('../workers/src/lib/webhookDispatcher.js', () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../workers/src/handlers/push.js', () => ({
  sendNotificationToUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../workers/src/lib/stripe.js', () => ({
  normalizeTierName: (tierName) => {
    const t = (tierName || 'free').toLowerCase();
    const legacyMap = { guide: 'practitioner', white_label: 'agency', studio: 'agency' };
    return legacyMap[t] || t;
  },
  getTier: vi.fn(),
}));

vi.mock('../workers/src/lib/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { handleAlerts } from '../workers/src/handlers/alerts.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(method, path, body) {
  const url = `https://api.test/api/alerts${path}`;
  const init = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

const USER = { id: 'user-1', email: 'test@example.com', tier: 'free' };

const VALID_GATE_ALERT = {
  type: 'gate_activation',
  config: { gate: 10, planet: 'Sun' },
  name: 'My Gate Alert',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('alerts handler — auth guard', () => {
  beforeEach(() => {
    getUserFromRequestMock.mockResolvedValue(null);
    createQueryFnMock.mockReturnValue(vi.fn());
  });

  it('returns 401 for GET / when unauthenticated', async () => {
    const req = makeRequest('GET', '/');
    const res = await handleAlerts(req, {}, '/');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it('returns 401 for POST / when unauthenticated', async () => {
    const req = makeRequest('POST', '/', VALID_GATE_ALERT);
    const res = await handleAlerts(req, {}, '/');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});

describe('alerts handler — create alert validation', () => {
  beforeEach(() => {
    getUserFromRequestMock.mockResolvedValue(USER);
    createQueryFnMock.mockReturnValue(
      vi.fn().mockResolvedValue({ rows: [{ count: 0 }] })
    );
  });

  it('returns 400 for invalid alert type', async () => {
    const req = makeRequest('POST', '/', {
      type: 'invalid_type',
      config: { gate: 10, planet: 'Sun' },
      name: 'Test',
    });
    const res = await handleAlerts(req, {}, '/');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/invalid alert type/i);
  });

  it('returns 400 when name exceeds 200 characters', async () => {
    const req = makeRequest('POST', '/', {
      type: 'gate_activation',
      config: { gate: 10, planet: 'Sun' },
      name: 'x'.repeat(201),
    });
    const res = await handleAlerts(req, {}, '/');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/name exceeds/i);
  });

  it('returns 400 when description exceeds 1000 characters', async () => {
    const req = makeRequest('POST', '/', {
      type: 'gate_activation',
      config: { gate: 10, planet: 'Sun' },
      name: 'Fine name',
      description: 'd'.repeat(1001),
    });
    const res = await handleAlerts(req, {}, '/');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/description exceeds/i);
  });

  it('returns 403 when free-tier alert limit (3) is reached', async () => {
    createQueryFnMock.mockReturnValue(
      vi.fn().mockResolvedValue({ rows: [{ count: 3 }] })
    );
    const req = makeRequest('POST', '/', VALID_GATE_ALERT);
    const res = await handleAlerts(req, {}, '/');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/limit reached/i);
    expect(body.limit).toBe(3);
  });
});

describe('alerts handler — list alerts', () => {
  beforeEach(() => {
    getUserFromRequestMock.mockResolvedValue(USER);
    createQueryFnMock.mockReturnValue(
      vi.fn().mockResolvedValue({ rows: [] })
    );
  });

  it('returns 200 with empty alerts array when no alerts exist', async () => {
    const req = makeRequest('GET', '/');
    const res = await handleAlerts(req, {}, '/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.alerts).toEqual([]);
    expect(body.count).toBe(0);
  });
});

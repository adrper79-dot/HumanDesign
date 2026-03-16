import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  createQueryFnMock: vi.fn(),
  enforceFeatureAccessMock: vi.fn(),
  dispatchWebhookEventMock: vi.fn(() => Promise.resolve()),
  getUserFromRequestMock: vi.fn(),
  trackErrorMock: vi.fn(() => Promise.resolve()),
  captureRequestContextMock: vi.fn((request) => ({
    url: request?.url,
    method: request?.method,
  })),
  captureExceptionMock: vi.fn(() => Promise.resolve()),
  captureSentryRequestMock: vi.fn((request) => ({
    url: request?.url,
    method: request?.method,
  })),
  initSentryMock: vi.fn(),
  trackEventMock: vi.fn(() => Promise.resolve()),
}));

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: hoisted.createQueryFnMock,
  QUERIES: {
    insertWebhook: 'insertWebhook',
    getCheckinByDate: 'getCheckinByDate',
  },
}));

vi.mock('../workers/src/middleware/tierEnforcement.js', () => ({
  enforceFeatureAccess: hoisted.enforceFeatureAccessMock,
}));

vi.mock('../workers/src/lib/webhookDispatcher.js', () => ({
  dispatchWebhookEvent: hoisted.dispatchWebhookEventMock,
}));

vi.mock('../workers/src/middleware/auth.js', () => ({
  getUserFromRequest: hoisted.getUserFromRequestMock,
}));

vi.mock('../workers/src/lib/analytics.js', () => ({
  trackError: hoisted.trackErrorMock,
  captureRequestContext: hoisted.captureRequestContextMock,
}));

vi.mock('../workers/src/lib/sentry.js', () => ({
  initSentry: hoisted.initSentryMock,
  captureSentryRequest: hoisted.captureSentryRequestMock,
}));

vi.mock('../workers/src/handlers/achievements.js', () => ({
  trackEvent: hoisted.trackEventMock,
}));

vi.mock('../src/engine/transits.js', () => ({
  getCurrentTransits: vi.fn(() => ({ transitPositions: {}, gateActivations: [], transitToNatalAspects: [] })),
}));

import { handleWebhooks } from '../workers/src/handlers/webhooks.js';
import { handleCheckinToday } from '../workers/src/handlers/checkin.js';

describe('route observability sweep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.enforceFeatureAccessMock.mockResolvedValue(null);
    hoisted.getUserFromRequestMock.mockResolvedValue({ id: 'user-1', sub: 'user-1', tier: 'practitioner' });
    hoisted.initSentryMock.mockReturnValue({
      captureException: hoisted.captureExceptionMock,
      captureMessage: vi.fn(() => Promise.resolve()),
      addBreadcrumb: vi.fn(),
    });
  });

  it('reports webhook registration failures through the handled-route pipeline', async () => {
    const pending = [];
    const request = Object.assign(new Request('https://api.test/api/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/hook', events: ['chart.created'] }),
    }), {
      _reqId: 'req-webhook-1',
      _user: { sub: 'user-1' },
      _log: { error: vi.fn() },
      _ctx: { waitUntil(promise) { pending.push(promise); } },
    });

    const query = vi.fn(async () => {
      throw new Error('webhook db offline');
    });
    hoisted.createQueryFnMock.mockReturnValue(query);

    const response = await handleWebhooks(request, { ENVIRONMENT: 'test', NEON_CONNECTION_STRING: 'postgresql://test' }, '/');
    await Promise.all(pending);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get('X-Request-ID')).toBe('req-webhook-1');
    expect(body.error).toBe('Failed to register webhook');
    expect(body.requestId).toBe('req-webhook-1');
    expect(hoisted.trackErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ ENVIRONMENT: 'test' }),
      expect.any(Error),
      expect.objectContaining({
        endpoint: '/api/webhooks',
        source: 'webhooks_register',
        requestId: 'req-webhook-1',
        handled: true,
      })
    );
    expect(hoisted.captureExceptionMock).toHaveBeenCalledTimes(1);
  });

  it('reports check-in retrieval failures through the handled-route pipeline', async () => {
    const pending = [];
    const request = Object.assign(new Request('https://api.test/api/checkin?timezone=UTC', {
      method: 'GET',
    }), {
      _reqId: 'req-checkin-1',
      _user: { sub: 'user-1' },
      _log: { error: vi.fn() },
      _ctx: { waitUntil(promise) { pending.push(promise); } },
    });

    const query = vi.fn(async () => {
      throw new Error('checkin db offline');
    });
    hoisted.createQueryFnMock.mockReturnValue(query);

    const response = await handleCheckinToday(request, { ENVIRONMENT: 'test', NEON_CONNECTION_STRING: 'postgresql://test' });
    await Promise.all(pending);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get('X-Request-ID')).toBe('req-checkin-1');
    expect(body.error).toBe('Failed to retrieve today\'s check-in');
    expect(body.requestId).toBe('req-checkin-1');
    expect(hoisted.trackErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ ENVIRONMENT: 'test' }),
      expect.any(Error),
      expect.objectContaining({
        endpoint: '/api/checkin',
        source: 'checkin_today',
        requestId: 'req-checkin-1',
        handled: true,
      })
    );
    expect(hoisted.captureExceptionMock).toHaveBeenCalledTimes(1);
  });
});
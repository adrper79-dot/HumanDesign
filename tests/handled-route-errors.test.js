import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  createQueryFnMock: vi.fn(),
  enforceFeatureAccessMock: vi.fn(),
  sendPractitionerInvitationEmailMock: vi.fn(),
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
}));

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: hoisted.createQueryFnMock,
  QUERIES: {
    getPractitionerByUserId: 'getPractitionerByUserId',
  },
}));

vi.mock('../workers/src/middleware/tierEnforcement.js', () => ({
  enforceFeatureAccess: hoisted.enforceFeatureAccessMock,
}));

vi.mock('../workers/src/lib/email.js', () => ({
  sendPractitionerInvitationEmail: hoisted.sendPractitionerInvitationEmailMock,
}));

vi.mock('../workers/src/lib/analytics.js', () => ({
  trackError: hoisted.trackErrorMock,
  captureRequestContext: hoisted.captureRequestContextMock,
}));

vi.mock('../workers/src/lib/sentry.js', () => ({
  initSentry: hoisted.initSentryMock,
  captureSentryRequest: hoisted.captureSentryRequestMock,
}));

import { reportHandledRouteError } from '../workers/src/lib/routeErrors.js';
import { handlePractitioner } from '../workers/src/handlers/practitioner.js';

describe('handled route error pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.enforceFeatureAccessMock.mockResolvedValue(null);
    hoisted.initSentryMock.mockReturnValue({
      captureException: hoisted.captureExceptionMock,
      captureMessage: vi.fn(() => Promise.resolve()),
      addBreadcrumb: vi.fn(),
    });
  });

  it('reports handled route errors through analytics, sentry, and request correlation', async () => {
    const pending = [];
    const requestLog = { error: vi.fn() };
    const request = Object.assign(new Request('https://api.test/api/example', { method: 'POST' }), {
      _reqId: 'req-handled-1',
      _user: { sub: 'user-1' },
      _log: requestLog,
      _ctx: {
        waitUntil(promise) {
          pending.push(promise);
        },
      },
    });

    const response = await reportHandledRouteError({
      request,
      env: { ENVIRONMENT: 'test' },
      error: new Error('database offline'),
      source: 'test_route',
      fallbackMessage: 'Operation failed',
      extra: { phase: 'save' },
    });

    await Promise.all(pending);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get('X-Request-ID')).toBe('req-handled-1');
    expect(body.error).toBe('Operation failed');
    expect(body.requestId).toBe('req-handled-1');
    expect(body.hint).toBeTruthy();

    expect(requestLog.error).toHaveBeenCalledWith(
      'handled_route_error',
      expect.objectContaining({
        source: 'test_route',
        requestId: 'req-handled-1',
        error: 'database offline',
        errorClass: 'Error',
      })
    );

    expect(hoisted.trackErrorMock).toHaveBeenCalledWith(
      { ENVIRONMENT: 'test' },
      expect.any(Error),
      expect.objectContaining({
        endpoint: '/api/example',
        source: 'test_route',
        requestId: 'req-handled-1',
        handled: true,
      })
    );

    expect(hoisted.captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        request: expect.objectContaining({
          url: 'https://api.test/api/example',
          method: 'POST',
        }),
        tags: expect.objectContaining({
          path: '/api/example',
          method: 'POST',
          reqId: 'req-handled-1',
          source: 'test_route',
          handled: 'true',
        }),
      })
    );
  });

  it('routes practitioner handler failures through the shared handled-error reporter', async () => {
    const pending = [];
    const request = Object.assign(new Request('https://api.test/api/practitioner/profile', { method: 'GET' }), {
      _reqId: 'req-pract-1',
      _user: { sub: 'pract-user-1' },
      _log: { error: vi.fn() },
      _ctx: {
        waitUntil(promise) {
          pending.push(promise);
        },
      },
    });

    const query = vi.fn(async () => {
      throw new Error('practitioner db offline');
    });
    hoisted.createQueryFnMock.mockReturnValue(query);

    const response = await handlePractitioner(
      request,
      { ENVIRONMENT: 'test', NEON_CONNECTION_STRING: 'postgresql://test' },
      '/profile'
    );

    await Promise.all(pending);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Service temporarily unavailable');
    expect(body.requestId).toBe('req-pract-1');

    expect(hoisted.trackErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ ENVIRONMENT: 'test' }),
      expect.any(Error),
      expect.objectContaining({
        endpoint: '/api/practitioner/profile',
        source: 'practitioner',
        requestId: 'req-pract-1',
        handled: true,
      })
    );

    expect(hoisted.captureExceptionMock).toHaveBeenCalledTimes(1);
  });
});

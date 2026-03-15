import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  handleCalculateMock: vi.fn(),
  handleGetChartMock: vi.fn(),
  trackEventMock: vi.fn(() => Promise.resolve()),
  trackErrorMock: vi.fn(() => Promise.resolve()),
  aggregateDailyMock: vi.fn(() => Promise.resolve()),
  captureExceptionMock: vi.fn(() => Promise.resolve()),
  captureMessageMock: vi.fn(() => Promise.resolve()),
  initSentryMock: vi.fn(),
}));

vi.mock('../workers/src/handlers/calculate.js', () => ({
  handleCalculate: hoisted.handleCalculateMock,
  handleGetChart: hoisted.handleGetChartMock,
}));

vi.mock('../workers/src/lib/analytics.js', () => ({
  trackEvent: hoisted.trackEventMock,
  trackError: hoisted.trackErrorMock,
  aggregateDaily: hoisted.aggregateDailyMock,
  EVENTS: { API_CALL: 'api_call', ERROR: 'error' },
}));

vi.mock('../workers/src/lib/sentry.js', () => ({
  initSentry: hoisted.initSentryMock,
}));

describe('worker top-level error pipeline', () => {
  beforeEach(() => {
    hoisted.handleCalculateMock.mockReset();
    hoisted.handleGetChartMock.mockReset();
    hoisted.trackEventMock.mockClear();
    hoisted.trackErrorMock.mockClear();
    hoisted.aggregateDailyMock.mockClear();
    hoisted.captureExceptionMock.mockClear();
    hoisted.captureMessageMock.mockClear();
    hoisted.initSentryMock.mockReset();

    hoisted.initSentryMock.mockReturnValue({
      captureException: hoisted.captureExceptionMock,
      captureMessage: hoisted.captureMessageMock,
      addBreadcrumb: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('captures thrown handler errors via analytics and sentry without leaking internals', async () => {
    const thrown = new Error('database transaction exploded');
    hoisted.handleCalculateMock.mockImplementation(() => {
      throw thrown;
    });

    const { default: worker } = await import('../workers/src/index.js');

    const pending = [];
    const ctx = {
      waitUntil(promise) {
        pending.push(promise);
      },
    };

    const env = {
      ENVIRONMENT: 'production',
      CACHE: {
        get: vi.fn(async () => null),
        put: vi.fn(async () => {}),
      },
      SENTRY_DSN: 'https://public@example.ingest.sentry.io/123456',
    };

    const request = new Request('https://api.test/api/chart/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ birthDate: '1979-08-05' }),
    });

    const response = await worker.fetch(request, env, ctx);
    await Promise.all(pending);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('Something unexpected happened.');
    expect(json.technical).toBeUndefined();

    expect(hoisted.trackErrorMock).toHaveBeenCalledTimes(1);
    expect(hoisted.trackErrorMock).toHaveBeenCalledWith(
      env,
      thrown,
      expect.objectContaining({
        endpoint: '/api/chart/calculate',
        severity: 'high',
        request,
      })
    );

    expect(hoisted.captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(hoisted.captureExceptionMock).toHaveBeenCalledWith(
      thrown,
      expect.objectContaining({
        request,
        user: undefined,
        tags: expect.objectContaining({ path: '/api/chart/calculate', method: 'POST' }),
      })
    );

    expect(hoisted.trackEventMock).not.toHaveBeenCalled();
  });
});
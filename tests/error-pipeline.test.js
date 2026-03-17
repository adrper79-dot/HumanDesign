/**
 * BL-S20-C3: Top-level Worker exception pipeline tests
 *
 * Proves that:
 *  1. An unhandled error in a route handler is caught at the top level
 *  2. ctx.waitUntil() is called — error tracking is non-blocking
 *  3. trackError (analytics) is included in the waitUntil payload
 *  4. Sentry captureException is included in the waitUntil payload
 *  5. The Worker still returns a JSON 500 response (not a hanging promise)
 *  6. All of the above work even when SENTRY_DSN is absent (no-op path)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ───────────────────────────────────────────────────────────

const { trackErrorMock, sentryCaptureMock } = vi.hoisted(() => ({
  trackErrorMock:   vi.fn().mockResolvedValue(undefined),
  sentryCaptureMock: vi.fn().mockResolvedValue(undefined),
}));

// Mock analytics so trackError is observable without a real DB
// Mock sentry so we can spy on captureException without real HTTP
vi.mock('../workers/src/lib/sentry.js', () => ({
  initSentry: vi.fn(() => ({
    captureException: sentryCaptureMock,
    addBreadcrumb: vi.fn(),
  })),
  captureSentryRequest: vi.fn((req) => ({ url: req.url, method: req.method })),
}));

// Mock a single route handler to throw a controlled error
vi.mock('../workers/src/handlers/geocode.js', () => ({
  handleGeocode: vi.fn().mockRejectedValue(
    Object.assign(new Error('forced geocode failure'), { status: 500 })
  ),
}));

// Stub all heavy dependencies that the Worker imports at module level
vi.mock('../workers/src/db/queries.js', async () => {
  const actual = await vi.importActual('../workers/src/db/queries.js');
  return { ...actual, createQueryFn: vi.fn(() => vi.fn().mockResolvedValue({ rows: [] })) };
});

vi.mock('../workers/src/middleware/auth.js', () => ({
  authenticate: vi.fn().mockResolvedValue(null),
}));

vi.mock('../workers/src/middleware/rateLimit.js', () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
  addRateLimitHeaders: vi.fn((r) => r),
}));

vi.mock('../workers/src/middleware/cache.js', () => ({
  applyCacheForPublicAPI: vi.fn((r) => r),
}));

vi.mock('../workers/src/middleware/security.js', () => ({
  applySecurityHeaders: vi.fn((r) => r),
}));

vi.mock('../workers/src/middleware/validate.js', () => ({
  validateRequestBody: vi.fn().mockResolvedValue(null),
}));

vi.mock('../workers/src/middleware/cors.js', () => ({
  getCorsHeaders: vi.fn(() => ({})),
  handleOptions: vi.fn(() => new Response(null, { status: 204 })),
}));

vi.mock('../workers/src/lib/logger.js', () => ({
  createLogger: vi.fn(() => ({ error: vi.fn(), info: vi.fn() })),
  generateRequestId: vi.fn(() => 'test-req-id'),
}));

vi.mock('../workers/src/lib/errorMessages.js', () => ({
  errorResponse: vi.fn((err, status) =>
    Response.json({ error: err.message }, { status })
  ),
}));

vi.mock('../workers/src/lib/cache.js', () => ({
  getCacheMetrics: vi.fn(() => ({ hits: 0, misses: 0 })),
  kvCache: { invalidatePrefix: vi.fn() },
}));

vi.mock('../workers/src/lib/analytics.js', async () => {
  const actual = await vi.importActual('../workers/src/lib/analytics.js');
  return {
    ...actual,
    trackError: trackErrorMock,
    trackEvent: vi.fn().mockResolvedValue(undefined),
    captureRequestContext: vi.fn(() => ({})),
    EVENTS: { API_CALL: 'api_call' },
  };
});

// ─────────────────────────────────────────────────────────────────────────────

function makeRequest(path = '/api/geocode', method = 'GET') {
  return new Request(`https://worker.test${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeEnv(overrides = {}) {
  return {
    NEON_CONNECTION_STRING: 'postgres://test:test@localhost/test',
    JWT_SECRET: 'test-secret',
    ENVIRONMENT: 'test',
    ...overrides,
  };
}

function makeCtx() {
  const waitUntilArg = [];
  return {
    waitUntil: vi.fn((p) => { waitUntilArg.push(p); }),
    _waitUntilArg: waitUntilArg,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BL-S20-C3: top-level exception pipeline', () => {
  beforeEach(() => {
    trackErrorMock.mockClear();
    sentryCaptureMock.mockClear();
  });

  describe('error catch + non-blocking dispatch', () => {
    it('calls ctx.waitUntil when a route handler throws', async () => {
      const worker = await import('../workers/src/index.js');
      const ctx = makeCtx();

      await worker.default.fetch(makeRequest('/api/geocode'), makeEnv(), ctx);

      expect(ctx.waitUntil).toHaveBeenCalled();
      // The argument must be a Promise (fire-and-forget pattern)
      const arg = ctx._waitUntilArg[0];
      expect(typeof arg?.then).toBe('function');
    });

    it('still returns a JSON response even when handler throws', async () => {
      const worker = await import('../workers/src/index.js');
      const ctx = makeCtx();

      const response = await worker.default.fetch(makeRequest('/api/geocode'), makeEnv(), ctx);

      expect(response).toBeDefined();
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toHaveProperty('error');
    });

    it('includes trackError in the ctx.waitUntil batch', async () => {
      const worker = await import('../workers/src/index.js');
      const ctx = makeCtx();

      await worker.default.fetch(makeRequest('/api/geocode'), makeEnv(), ctx);

      // Allow the fire-and-forget promise to settle
      await ctx._waitUntilArg[0];

      expect(trackErrorMock).toHaveBeenCalledOnce();
      const [, err, meta] = trackErrorMock.mock.calls[0];
      expect(err.message).toBe('forced geocode failure');
      expect(meta).toMatchObject({ endpoint: '/api/geocode' });
    });

    it('includes sentry.captureException in the ctx.waitUntil batch', async () => {
      const worker = await import('../workers/src/index.js');
      const ctx = makeCtx();

      await worker.default.fetch(makeRequest('/api/geocode'), makeEnv(), ctx);

      await ctx._waitUntilArg[0];

      expect(sentryCaptureMock).toHaveBeenCalledOnce();
      const [err] = sentryCaptureMock.mock.calls[0];
      expect(err.message).toBe('forced geocode failure');
    });
  });

  describe('no-op when SENTRY_DSN absent', () => {
    it('does not throw when SENTRY_DSN is missing', async () => {
      const worker = await import('../workers/src/index.js');
      const ctx = makeCtx();
      const env = makeEnv(); // no SENTRY_DSN

      await expect(
        worker.default.fetch(makeRequest('/api/geocode'), env, ctx)
      ).resolves.toBeDefined();
    });

    it('error response is still returned when Sentry is absent', async () => {
      const worker = await import('../workers/src/index.js');
      const ctx = makeCtx();
      const env = makeEnv(); // no SENTRY_DSN

      const response = await worker.default.fetch(makeRequest('/api/geocode'), env, ctx);
      expect(response.status).toBe(500);
    });
  });

  describe('error severity tagging', () => {
    it('tags severity=high for 500-class errors', async () => {
      const worker = await import('../workers/src/index.js');
      const ctx = makeCtx();

      await worker.default.fetch(makeRequest('/api/geocode'), makeEnv(), ctx);
      await ctx._waitUntilArg[0];

      const [, , meta] = trackErrorMock.mock.calls[0];
      expect(meta.severity).toBe('high');
    });
  });
});

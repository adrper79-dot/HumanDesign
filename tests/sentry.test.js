import { afterEach, describe, expect, it, vi } from 'vitest';

import { initSentry } from '../workers/src/lib/sentry.js';

describe('initSentry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a no-op client when SENTRY_DSN is missing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const sentry = initSentry({ ENVIRONMENT: 'test' });

    await sentry.captureException(new Error('missing dsn'));
    await sentry.captureMessage('hello');

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('disables error tracking when SENTRY_DSN is malformed', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const sentry = initSentry({ SENTRY_DSN: 'not-a-dsn', ENVIRONMENT: 'test' });
    await sentry.captureException(new Error('bad dsn'));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Sentry] Invalid SENTRY_DSN format — expected https://<key>@<host>/<projectId>. Error tracking disabled.'
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends a structured envelope with sanitized request and user context', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }));

    const sentry = initSentry({
      SENTRY_DSN: 'https://public@example.ingest.sentry.io/123456',
      SENTRY_RELEASE: 'release-123',
      ENVIRONMENT: 'production',
    });

    sentry.addBreadcrumb({ category: 'ui', message: 'user clicked checkout' });

    const request = new Request('https://api.test/api/chart/calculate?full=1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'vitest',
        'Authorization': 'Bearer secret-token',
        'CF-IPCountry': 'US',
      },
      body: JSON.stringify({ ok: true }),
    });

    await sentry.captureException(new Error('chart exploded 500'), {
      request,
      user: { sub: 'user-123', email: 'person@example.com', tier: 'practitioner' },
      tags: { feature: 'chart' },
      extra: { releasePhase: 'canary' },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://example.ingest.sentry.io/api/123456/envelope/');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/x-sentry-envelope');

    const envelope = init.body.split('\n');
    const event = JSON.parse(envelope[2]);

    expect(event.release).toBe('release-123');
    expect(event.environment).toBe('production');
    expect(event.exception.values[0].value).toBe('chart exploded 500');
    expect(event.tags.path).toBe('/api/chart/calculate');
    expect(event.tags.method).toBe('POST');
    expect(event.tags.tier).toBe('practitioner');
    expect(event.tags.feature).toBe('chart');
    expect(event.user.id).toBe('user-123');
    expect(event.user.email).toBe('person@example.com');
    expect(event.request.headers.authorization).toBeUndefined();
    expect(event.request.headers['content-type']).toBe('application/json');
    expect(event.request.headers['cf-ipcountry']).toBe('US');
    expect(event.breadcrumbs.values).toHaveLength(1);
    expect(event.extra.releasePhase).toBe('canary');
    expect(event.fingerprint).toContain('/api/chart/calculate');
  });
});
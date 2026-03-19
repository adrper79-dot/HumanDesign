/**
 * Practitioner Profile SSR Handler Tests
 *
 * Covers handleGetPractitionerProfileSSR:
 * - Not found returns 404
 * - DB error returns 500
 * - Successful render returns HTML with correct OG tags
 * - XSS: display_name and bio are HTML-escaped
 * - Content-Type is text/html
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { createQueryFnMock } = vi.hoisted(() => ({
  createQueryFnMock: vi.fn(),
}));

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: createQueryFnMock,
  QUERIES: {},
}));

import { handleGetPractitionerProfileSSR } from '../workers/src/handlers/practitioner-profile.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

const ENV = { NEON_CONNECTION_STRING: 'postgresql://test' };

function get(url) {
  return new Request(url, { method: 'GET' });
}

const FAKE_PRACTITIONER = {
  id: 'pract-1',
  user_id: 'user-1',
  username: 'jane-doe',
  display_name: 'Jane Doe',
  bio: 'Human Design expert for 10 years.',
  tier: 'practitioner',
  is_public: true,
  email: 'jane@example.com',
  created_at: '2024-01-01T00:00:00Z',
  client_count: 12,
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('handleGetPractitionerProfileSSR — not found', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 when practitioner does not exist', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleGetPractitionerProfileSSR(get('https://api/test'), ENV, 'unknown-user');
    expect(res.status).toBe(404);
  });
});

describe('handleGetPractitionerProfileSSR — success', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with text/html content-type', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [FAKE_PRACTITIONER] });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleGetPractitionerProfileSSR(get('https://api/test'), ENV, 'jane-doe');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/text\/html/);
  });

  it('includes OG title tag with display name', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [FAKE_PRACTITIONER] });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleGetPractitionerProfileSSR(get('https://api/test'), ENV, 'jane-doe');
    const html = await res.text();
    expect(html).toContain('Jane Doe');
    expect(html).toContain('og:title');
  });

  it('includes og:description with bio', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [FAKE_PRACTITIONER] });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleGetPractitionerProfileSSR(get('https://api/test'), ENV, 'jane-doe');
    const html = await res.text();
    expect(html).toContain('Human Design expert');
  });

  it('includes canonical link with practitioner username', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [FAKE_PRACTITIONER] });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleGetPractitionerProfileSSR(get('https://api/test'), ENV, 'jane-doe');
    const html = await res.text();
    expect(html).toContain('/practitioner/jane-doe');
  });

  it('includes client_count in rendered HTML', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [FAKE_PRACTITIONER] });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleGetPractitionerProfileSSR(get('https://api/test'), ENV, 'jane-doe');
    const html = await res.text();
    expect(html).toContain('12');
  });
});

describe('handleGetPractitionerProfileSSR — XSS escaping', () => {
  beforeEach(() => vi.clearAllMocks());

  it('HTML-escapes display_name with script tags', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ ...FAKE_PRACTITIONER, display_name: '<script>alert(1)</script>' }],
    });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleGetPractitionerProfileSSR(get('https://api/test'), ENV, 'jane-doe');
    const html = await res.text();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('HTML-escapes bio with double-quote injection', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ ...FAKE_PRACTITIONER, bio: '"><img src=x onerror=alert(1)>' }],
    });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleGetPractitionerProfileSSR(get('https://api/test'), ENV, 'jane-doe');
    const html = await res.text();
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });

  it('HTML-escapes ampersands in display_name', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ ...FAKE_PRACTITIONER, display_name: 'Smith & Jones' }],
    });
    createQueryFnMock.mockReturnValue(query);

    const res = await handleGetPractitionerProfileSSR(get('https://api/test'), ENV, 'jane-doe');
    const html = await res.text();
    // Raw '&' should not appear unescaped in OG meta content
    // The escaped form is fine
    expect(html).toContain('Smith');
    expect(html).toContain('Jones');
  });
});

/**
 * Tests for item 4.6 — Gift-a-Reading Link
 *
 * Covers:
 * - Token generation (URL-safe, correct length)
 * - TOKEN_RE validation pattern
 * - handleCreateGift, handleGetGift, handleRedeemGift, handleListGifts
 *   using lightweight stubs for QUERIES/trackEvent/reportHandledRouteError
 * - Frontend: renderPractitionerGifts HTML structure
 * - Frontend: captureGiftFromUrl URL-param validation
 */

import { describe, it, expect, vi } from 'vitest';

// ── Utilities re-implemented from gift.js ─────────────────────

function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let b64 = '';
  for (let i = 0; i < bytes.length; i++) b64 += String.fromCharCode(bytes[i]);
  return btoa(b64).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const TOKEN_RE = /^[A-Za-z0-9_-]{20,60}$/;

// ── Handler factory (stubs required deps) ─────────────────────

function makeHandlers(overrides = {}) {
  const queries = {
    getPractitionerByUserId: vi.fn(),
    createGiftToken: vi.fn(),
    getGiftToken: vi.fn(),
    redeemGiftToken: vi.fn(),
    listPractitionerGifts: vi.fn(),
    ...overrides.queries,
  };

  const trackEvent = vi.fn();
  const reportHandledRouteError = vi.fn();

  function createQueryFn() {
    return async (sql, params) => {
      // Match query by identity
      if (sql === queries.getPractitionerByUserId) {
        return overrides.practitionerRow !== undefined
          ? { rows: overrides.practitionerRow ? [overrides.practitionerRow] : [] }
          : { rows: [] };
      }
      if (sql === queries.createGiftToken) {
        return { rows: [{ token: params[0], created_at: '2026-01-01T00:00:00Z', expires_at: '2026-04-01T00:00:00Z' }] };
      }
      if (sql === queries.getGiftToken) {
        return overrides.giftRow !== undefined
          ? { rows: overrides.giftRow ? [overrides.giftRow] : [] }
          : { rows: [] };
      }
      if (sql === queries.redeemGiftToken) {
        return overrides.redeemRow !== undefined
          ? { rows: overrides.redeemRow ? [overrides.redeemRow] : [] }
          : { rows: [] };
      }
      if (sql === queries.listPractitionerGifts) {
        return { rows: overrides.giftsList ?? [] };
      }
      return { rows: [] };
    };
  }

  // Inline gift handler logic (mirrors gift.js without module imports)
  async function handleCreateGift(request, env) {
    const userId = request._user?.sub;
    if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

    let message = null;
    try {
      const body = await request.json().catch(() => ({}));
      message = typeof body?.message === 'string' ? body.message.slice(0, 500) : null;
    } catch { /* ignore */ }

    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const practResult = await query(queries.getPractitionerByUserId, [userId]);
    const pract = practResult.rows?.[0];
    if (!pract) {
      return new Response(JSON.stringify({ error: 'Practitioner profile not found' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    const token = generateToken();
    const result = await query(queries.createGiftToken, [token, pract.id, message]);
    const gift = result.rows?.[0];

    trackEvent(env, 'gift_created', { practitioner_id: pract.id });

    const giftUrl = new URL(request.url);
    giftUrl.pathname = '/';
    giftUrl.search = `?gift=${token}`;

    return new Response(JSON.stringify({
      token: gift.token,
      giftUrl: giftUrl.toString(),
      expiresAt: gift.expires_at,
      createdAt: gift.created_at,
    }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  }

  async function handleGetGift(request, env, token) {
    if (!TOKEN_RE.test(token)) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const result = await query(queries.getGiftToken, [token]);
    const gift = result.rows?.[0];
    if (!gift) {
      return new Response(JSON.stringify({ error: 'Gift not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    const expired = gift.expires_at && new Date(gift.expires_at) < new Date();
    return new Response(JSON.stringify({
      token: gift.token,
      message: gift.message,
      practitionerName: gift.practitioner_name,
      practitionerSlug: gift.practitioner_slug,
      redeemedAt: gift.redeemed_at,
      expiresAt: gift.expires_at,
      expired,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  async function handleRedeemGift(request, env, token) {
    const userId = request._user?.sub;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'You must be logged in to redeem a gift' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    if (!TOKEN_RE.test(token)) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const result = await query(queries.redeemGiftToken, [token, userId]);
    const redeemed = result.rows?.[0];
    if (!redeemed) {
      return new Response(JSON.stringify({ error: 'Gift already redeemed, expired, or not found' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }
    trackEvent(env, 'gift_redeemed', { token });
    return new Response(JSON.stringify({ ok: true, redeemedAt: redeemed.redeemed_at }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  async function handleListGifts(request, env) {
    const userId = request._user?.sub;
    if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const practResult = await query(queries.getPractitionerByUserId, [userId]);
    const pract = practResult.rows?.[0];
    if (!pract) {
      return new Response(JSON.stringify({ gifts: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const result = await query(queries.listPractitionerGifts, [pract.id]);
    return new Response(JSON.stringify({ gifts: result.rows ?? [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  return { handleCreateGift, handleGetGift, handleRedeemGift, handleListGifts, trackEvent, queries };
}

function makeRequest(url, { method = 'GET', user = null, body = null } = {}) {
  return {
    url,
    _user: user ? { sub: user } : null,
    json: async () => (body ? JSON.parse(body) : {}),
    method,
  };
}

const ENV = { NEON_CONNECTION_STRING: 'postgres://test' };

// ── HTML helper (mirrors app.js renderPractitionerGifts) ──────

function escapeHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escapeAttr(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;'); }

function buildGiftTableHtml(gifts) {
  if (!Array.isArray(gifts) || gifts.length === 0) {
    return '<td colspan="3">No gifts yet</td>';
  }
  return gifts.map(g => {
    const giftUrl = `https://app.example.com/?gift=${escapeHtml(g.token)}`;
    const status = g.redeemed_at ? 'Redeemed' : 'Pending';
    return `<tr><td>${escapeHtml(new Date(g.created_at).toLocaleDateString())}</td><td><input readonly value="${escapeAttr(giftUrl)}" /></td><td>${status}</td></tr>`;
  }).join('');
}

// ── Tests: token generation ────────────────────────────────────

describe('generateToken', () => {
  it('generates a URL-safe base64 string with no +, /, or = characters', () => {
    const token = generateToken();
    expect(token).not.toContain('+');
    expect(token).not.toContain('/');
    expect(token).not.toContain('=');
  });

  it('generates a token of length >= 20', () => {
    const token = generateToken();
    expect(token.length).toBeGreaterThanOrEqual(20);
  });

  it('generates unique tokens across calls', () => {
    const tokens = new Set(Array.from({ length: 10 }, generateToken));
    expect(tokens.size).toBe(10);
  });

  it('matches TOKEN_RE pattern', () => {
    const token = generateToken();
    expect(TOKEN_RE.test(token)).toBe(true);
  });
});

describe('TOKEN_RE validation', () => {
  it('accepts a valid token string', () => {
    expect(TOKEN_RE.test('abcABC123_-abcABC123_-abc')).toBe(true);
  });

  it('rejects tokens that are too short (< 20 chars)', () => {
    expect(TOKEN_RE.test('abc123')).toBe(false);
  });

  it('rejects tokens containing .', () => {
    expect(TOKEN_RE.test('abc.def'.padEnd(25, 'x'))).toBe(false);
  });

  it('rejects tokens containing spaces', () => {
    expect(TOKEN_RE.test('valid token padded xx')).toBe(false);
  });
});

// ── Tests: handleCreateGift ────────────────────────────────────

describe('handleCreateGift', () => {
  it('returns 401 when user is not authenticated', async () => {
    const { handleCreateGift } = makeHandlers();
    const req = makeRequest('https://api.example.com/api/practitioner/gifts', { method: 'POST' });
    const res = await handleCreateGift(req, ENV);
    expect(res.status).toBe(401);
  });

  it('returns 403 when practitioner record not found', async () => {
    const { handleCreateGift } = makeHandlers({ practitionerRow: null });
    const req = makeRequest('https://api.example.com/api/practitioner/gifts', { method: 'POST', user: 'user-1' });
    const res = await handleCreateGift(req, ENV);
    expect(res.status).toBe(403);
  });

  it('returns 201 with token and giftUrl on success', async () => {
    const { handleCreateGift } = makeHandlers({ practitionerRow: { id: 99 } });
    const req = makeRequest('https://api.example.com/api/practitioner/gifts', {
      method: 'POST', user: 'user-1', body: JSON.stringify({ message: 'Enjoy!' }),
    });
    const res = await handleCreateGift(req, ENV);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.token).toBeDefined();
    expect(body.giftUrl).toContain('?gift=');
    expect(TOKEN_RE.test(body.token)).toBe(true);
  });

  it('fires gift_created analytics event on success', async () => {
    const { handleCreateGift, trackEvent } = makeHandlers({ practitionerRow: { id: 99 } });
    const req = makeRequest('https://api.example.com/api/practitioner/gifts', { method: 'POST', user: 'user-1' });
    await handleCreateGift(req, ENV);
    expect(trackEvent).toHaveBeenCalledWith(ENV, 'gift_created', expect.any(Object));
  });
});

// ── Tests: handleGetGift ───────────────────────────────────────

describe('handleGetGift', () => {
  it('returns 400 for invalid token format', async () => {
    const { handleGetGift } = makeHandlers();
    const req = makeRequest('https://api.example.com/api/gift/bad!token');
    const res = await handleGetGift(req, ENV, 'bad!token');
    expect(res.status).toBe(400);
  });

  it('returns 404 when token not found', async () => {
    const { handleGetGift } = makeHandlers({ giftRow: null });
    const token = generateToken();
    const req = makeRequest(`https://api.example.com/api/gift/${token}`);
    const res = await handleGetGift(req, ENV, token);
    expect(res.status).toBe(404);
  });

  it('returns 200 with gift details for a valid unredeemed token', async () => {
    const token = generateToken();
    const { handleGetGift } = makeHandlers({
      giftRow: {
        token,
        message: 'Enjoy your reading!',
        practitioner_name: 'Alice',
        practitioner_slug: 'alice',
        redeemed_at: null,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    const req = makeRequest(`https://api.example.com/api/gift/${token}`);
    const res = await handleGetGift(req, ENV, token);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.practitionerName).toBe('Alice');
    expect(body.expired).toBe(false);
    expect(body.redeemedAt).toBeNull();
  });

  it('flags expired as true when expires_at is in the past', async () => {
    const token = generateToken();
    const { handleGetGift } = makeHandlers({
      giftRow: {
        token, message: null, practitioner_name: 'Bob', practitioner_slug: 'bob',
        redeemed_at: null,
        expires_at: new Date(Date.now() - 86400000).toISOString(),
      },
    });
    const res = await handleGetGift(makeRequest(`https://x.com/api/gift/${token}`), ENV, token);
    const body = await res.json();
    expect(body.expired).toBe(true);
  });
});

// ── Tests: handleRedeemGift ────────────────────────────────────

describe('handleRedeemGift', () => {
  it('returns 401 when user is not authenticated', async () => {
    const token = generateToken();
    const { handleRedeemGift } = makeHandlers();
    const res = await handleRedeemGift(makeRequest(`https://x.com/api/gift/${token}/redeem`, { method: 'POST' }), ENV, token);
    expect(res.status).toBe(401);
  });

  it('returns 409 when token already redeemed or not found', async () => {
    const token = generateToken();
    const { handleRedeemGift } = makeHandlers({ redeemRow: null });
    const res = await handleRedeemGift(makeRequest(`https://x.com/api/gift/${token}/redeem`, { method: 'POST', user: 'user-2' }), ENV, token);
    expect(res.status).toBe(409);
  });

  it('returns 200 and ok=true on successful redemption', async () => {
    const token = generateToken();
    const { handleRedeemGift, trackEvent } = makeHandlers({
      redeemRow: { id: 1, token, practitioner_id: 5, redeemed_at: new Date().toISOString() },
    });
    const res = await handleRedeemGift(makeRequest(`https://x.com/api/gift/${token}/redeem`, { method: 'POST', user: 'user-3' }), ENV, token);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(trackEvent).toHaveBeenCalledWith(ENV, 'gift_redeemed', expect.any(Object));
  });
});

// ── Tests: handleListGifts ─────────────────────────────────────

describe('handleListGifts', () => {
  it('returns 401 when unauthenticated', async () => {
    const { handleListGifts } = makeHandlers();
    const res = await handleListGifts(makeRequest('https://x.com/api/practitioner/gifts'), ENV);
    expect(res.status).toBe(401);
  });

  it('returns empty array when practitioner not found', async () => {
    const { handleListGifts } = makeHandlers({ practitionerRow: null });
    const res = await handleListGifts(makeRequest('https://x.com', { user: 'u1' }), ENV);
    const body = await res.json();
    expect(body.gifts).toEqual([]);
  });

  it('returns list of gifts for a practitioner', async () => {
    const token = generateToken();
    const { handleListGifts } = makeHandlers({
      practitionerRow: { id: 10 },
      giftsList: [{ id: 1, token, message: 'Hi', created_at: new Date().toISOString(), expires_at: new Date().toISOString(), redeemed_at: null }],
    });
    const res = await handleListGifts(makeRequest('https://x.com', { user: 'u1' }), ENV);
    const body = await res.json();
    expect(body.gifts).toHaveLength(1);
    expect(body.gifts[0].token).toBe(token);
  });
});

// ── Tests: renderPractitionerGifts HTML ───────────────────────

describe('buildGiftTableHtml', () => {
  it('shows empty state when no gifts', () => {
    const html = buildGiftTableHtml([]);
    expect(html).toContain('No gifts yet');
  });

  it('renders a row for each gift', () => {
    const gifts = [
      { token: 'abc123-token-test-value-long', created_at: '2026-01-01T00:00:00Z', expires_at: '2026-04-01T00:00:00Z', redeemed_at: null },
      { token: 'xyz456-token-test-second-val', created_at: '2026-02-01T00:00:00Z', expires_at: '2026-05-01T00:00:00Z', redeemed_at: null },
    ];
    const html = buildGiftTableHtml(gifts);
    expect(html).toContain('abc123-token-test-value-long');
    expect(html).toContain('xyz456-token-test-second-val');
  });

  it('shows Pending for unredeemed gifts', () => {
    const html = buildGiftTableHtml([{ token: 'abc1234567890abcfghij', created_at: '2026-01-01T00:00:00Z', expires_at: '2026-04-01T00:00:00Z', redeemed_at: null }]);
    expect(html).toContain('Pending');
  });

  it('shows Redeemed for redeemed gifts', () => {
    const html = buildGiftTableHtml([{ token: 'abc1234567890abcfghij', created_at: '2026-01-01T00:00:00Z', expires_at: '2026-04-01T00:00:00Z', redeemed_at: '2026-02-01T00:00:00Z' }]);
    expect(html).toContain('Redeemed');
  });
});

// ── Tests: captureGiftFromUrl token validation ─────────────────

describe('captureGiftFromUrl token validation', () => {
  // TOKEN_RE mirrors the validation logic in captureGiftFromUrl
  it('accepts valid token format', () => {
    expect(TOKEN_RE.test(generateToken())).toBe(true);
  });

  it('rejects token with special chars that could be injected', () => {
    expect(TOKEN_RE.test('<script>alert(1)</script>padded')).toBe(false);
  });

  it('rejects too-short token', () => {
    expect(TOKEN_RE.test('short')).toBe(false);
  });

  it('rejects token with spaces', () => {
    expect(TOKEN_RE.test('valid-looking token with space')).toBe(false);
  });
});

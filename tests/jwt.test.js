/**
 * JWT E2E Tests (PRA-TEST-002)
 *
 * Exercises real HS256 sign/verify with actual Web Crypto.
 * No mocks — validates the full JWT lifecycle used in production.
 */

import { describe, it, expect } from 'vitest';
import { signJWT, verifyHS256, jwtClaims } from '../workers/src/lib/jwt.js';

const SECRET = 'test-jwt-secret-32-chars-minimum!';

// ── jwtClaims env-awareness ──────────────────────────────────

describe('jwtClaims(env)', () => {
  it('returns defaults when env is empty', () => {
    const c = jwtClaims({});
    expect(c.issuer).toBe('primeself');
    expect(c.audience).toBe('primeself-api');
  });

  it('reads issuer/audience from env bindings', () => {
    const c = jwtClaims({ JWT_ISSUER: 'staging', JWT_AUDIENCE: 'staging-api' });
    expect(c.issuer).toBe('staging');
    expect(c.audience).toBe('staging-api');
  });

  it('partial override — only issuer set', () => {
    const c = jwtClaims({ JWT_ISSUER: 'custom' });
    expect(c.issuer).toBe('custom');
    expect(c.audience).toBe('primeself-api');
  });

  it('handles null/undefined env gracefully', () => {
    expect(jwtClaims(null).issuer).toBe('primeself');
    expect(jwtClaims(undefined).issuer).toBe('primeself');
  });
});

// ── Happy-path sign + verify ─────────────────────────────────

describe('signJWT + verifyHS256 — happy path', () => {
  it('signs and verifies a token with default claims', async () => {
    const token = await signJWT({ sub: 'user-1', role: 'user' }, SECRET, 3600);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);

    const payload = await verifyHS256(token, SECRET);
    expect(payload).not.toBeNull();
    expect(payload.sub).toBe('user-1');
    expect(payload.role).toBe('user');
    expect(payload.iss).toBe('primeself');
    expect(payload.aud).toBe('primeself-api');
  });

  it('carries all supplied payload fields', async () => {
    const token = await signJWT({ sub: 'u2', email: 'a@b.com', tier: 'pro' }, SECRET, 60);
    const p = await verifyHS256(token, SECRET);
    expect(p.email).toBe('a@b.com');
    expect(p.tier).toBe('pro');
  });

  it('embeds iat and exp claims', async () => {
    const before = Math.floor(Date.now() / 1000);
    const token = await signJWT({ sub: 'u3' }, SECRET, 100);
    const after = Math.floor(Date.now() / 1000);
    const p = await verifyHS256(token, SECRET);
    expect(p.iat).toBeGreaterThanOrEqual(before);
    expect(p.iat).toBeLessThanOrEqual(after);
    expect(p.exp).toBeGreaterThanOrEqual(before + 100);
  });

  it('uses custom env issuer and audience when provided', async () => {
    const claims = { issuer: 'staging', audience: 'staging-api' };
    const token = await signJWT({ sub: 'u4' }, SECRET, 3600, claims);
    const p = await verifyHS256(token, SECRET, claims);
    expect(p.iss).toBe('staging');
    expect(p.aud).toBe('staging-api');
  });
});

// ── Signature validation ─────────────────────────────────────

describe('verifyHS256 — invalid signature', () => {
  it('returns null for a tampered payload', async () => {
    const token = await signJWT({ sub: 'u5' }, SECRET, 3600);
    const [h, , s] = token.split('.');
    // Replace payload with a different one
    const fakePayload = btoa(JSON.stringify({ sub: 'attacker', iss: 'primeself', aud: 'primeself-api', exp: 9999999999 }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const tampered = `${h}.${fakePayload}.${s}`;
    expect(await verifyHS256(tampered, SECRET)).toBeNull();
  });

  it('returns null for wrong secret', async () => {
    const token = await signJWT({ sub: 'u6' }, SECRET, 3600);
    expect(await verifyHS256(token, 'wrong-secret')).toBeNull();
  });

  it('returns null for malformed token (fewer than 3 parts)', async () => {
    expect(await verifyHS256('notavalidjwt', SECRET)).toBeNull();
    expect(await verifyHS256('header.payload', SECRET)).toBeNull();
  });

  it('returns null for empty string', async () => {
    expect(await verifyHS256('', SECRET)).toBeNull();
  });
});

// ── Expiry ───────────────────────────────────────────────────

describe('verifyHS256 — expiry', () => {
  it('returns null for an already-expired token', async () => {
    // ttl = -1 → token expired 1 second in the past
    const token = await signJWT({ sub: 'u7' }, SECRET, -1);
    expect(await verifyHS256(token, SECRET)).toBeNull();
  });

  it('skipExp option bypasses expiry check', async () => {
    const token = await signJWT({ sub: 'u8' }, SECRET, -1);
    const p = await verifyHS256(token, SECRET, { skipExp: true });
    expect(p).not.toBeNull();
    expect(p.sub).toBe('u8');
  });
});

// ── Issuer / audience mismatch ───────────────────────────────

describe('verifyHS256 — issuer and audience', () => {
  it('rejects token from wrong issuer', async () => {
    const token = await signJWT({ sub: 'u9' }, SECRET, 3600, { issuer: 'prod', audience: 'primeself-api' });
    // Verifying with default issuer 'primeself' should fail
    expect(await verifyHS256(token, SECRET)).toBeNull();
  });

  it('rejects token for wrong audience', async () => {
    const token = await signJWT({ sub: 'u10' }, SECRET, 3600, { issuer: 'primeself', audience: 'other-service' });
    expect(await verifyHS256(token, SECRET)).toBeNull();
  });

  it('accepts token when issuer and audience both match custom env', async () => {
    const claims = jwtClaims({ JWT_ISSUER: 'staging', JWT_AUDIENCE: 'staging-api' });
    const token = await signJWT({ sub: 'u11' }, SECRET, 3600, claims);
    const p = await verifyHS256(token, SECRET, claims);
    expect(p).not.toBeNull();
    expect(p.sub).toBe('u11');
  });

  it('cross-env replay: staging token rejected by prod verifier', async () => {
    const stagingClaims = { issuer: 'staging', audience: 'staging-api' };
    const prodClaims    = { issuer: 'primeself', audience: 'primeself-api' };
    const stagingToken = await signJWT({ sub: 'u12' }, SECRET, 3600, stagingClaims);
    // Production verifier should reject staging token
    expect(await verifyHS256(stagingToken, SECRET, prodClaims)).toBeNull();
  });
});

/**
 * Security Fixes Tests — Deep Dive Audit Remediation
 *
 * Tests for the fixes applied during the 2026-07-17 deep dive audit:
 * - BL-RATELIMIT-001: Rate limiter fails closed when KV unavailable
 * - BL-ADMIN-001: Constant-time comparison for admin token
 * - BL-RACE-001: Atomic quota query structure
 * - MED-N+1-001: Batch SMS usage query exists in QUERIES registry
 * - MED-INLINE-SQL: Webhook queries registered (no inline SQL)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rateLimit } from '../workers/src/middleware/rateLimit.js';
import { QUERIES } from '../workers/src/db/queries.js';

// ─── Rate Limiter: Fail-Closed Behavior ─────────────────────

describe('rateLimit — fail-closed when KV unavailable', () => {
  it('returns 503 when CACHE KV is not bound (undefined)', async () => {
    const request = new Request('https://api.test/api/auth/login', { method: 'POST' });
    const env = {}; // No CACHE binding
    const result = await rateLimit(request, env);
    expect(result).not.toBeNull();
    expect(result.status).toBe(503);
    const json = await result.json();
    expect(json.error).toMatch(/temporarily unavailable/i);
  });

  it('returns 503 when CACHE KV is null', async () => {
    const request = new Request('https://api.test/api/auth/login', { method: 'POST' });
    const env = { CACHE: null };
    const result = await rateLimit(request, env);
    expect(result).not.toBeNull();
    expect(result.status).toBe(503);
  });

  it('includes Retry-After header on 503', async () => {
    const request = new Request('https://api.test/api/auth/login', { method: 'POST' });
    const env = {};
    const result = await rateLimit(request, env);
    expect(result.headers.get('Retry-After')).toBe('30');
  });

  it('returns null (pass-through) when KV is available and within limit', async () => {
    const mockKV = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
    };
    const request = new Request('https://api.test/api/auth/login', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '1.2.3.4' },
    });
    const env = { CACHE: mockKV };
    const result = await rateLimit(request, env);
    expect(result).toBeNull();
  });
});

// ─── QUERIES Registry: Atomic & Batch Queries Exist ───────────

describe('QUERIES registry — new queries from deep dive audit', () => {
  it('has atomicQuotaCheckAndInsert query (BL-RACE-001)', () => {
    expect(QUERIES.atomicQuotaCheckAndInsert).toBeDefined();
    expect(typeof QUERIES.atomicQuotaCheckAndInsert).toBe('string');
    // Should contain CTE pattern
    expect(QUERIES.atomicQuotaCheckAndInsert).toMatch(/WITH/i);
    expect(QUERIES.atomicQuotaCheckAndInsert).toMatch(/INSERT INTO usage_records/i);
    expect(QUERIES.atomicQuotaCheckAndInsert).toMatch(/quota_exceeded/i);
  });

  it('has updateTransitPassExpiry query (MED-INLINE-SQL)', () => {
    expect(QUERIES.updateTransitPassExpiry).toBeDefined();
    expect(QUERIES.updateTransitPassExpiry).toMatch(/UPDATE users SET transit_pass_expires/i);
  });

  it('has grantLifetimeAccess query (MED-INLINE-SQL)', () => {
    expect(QUERIES.grantLifetimeAccess).toBeDefined();
    expect(QUERIES.grantLifetimeAccess).toMatch(/UPDATE users SET tier.*lifetime_access/i);
  });

  it('has getBatchSmsUsageCounts query (MED-N+1-001)', () => {
    expect(QUERIES.getBatchSmsUsageCounts).toBeDefined();
    expect(QUERIES.getBatchSmsUsageCounts).toMatch(/ANY\(\$1\)/i);
    expect(QUERIES.getBatchSmsUsageCounts).toMatch(/sms_digest/i);
  });

  it('still has all pre-existing usage queries', () => {
    expect(QUERIES.createUsageRecord).toBeDefined();
    expect(QUERIES.getUsageByUserAndAction).toBeDefined();
    expect(QUERIES.countSavedProfilesByUser).toBeDefined();
  });
});

// ─── Rate Limit Config: Promo endpoint covered ───────────────

describe('rateLimit config — promo endpoint (MED-PROMO-RATE)', () => {
  it('returns 429 for /api/promo/validate when limit exceeded', async () => {
    // Must compute the same window boundary as the rate limiter:
    // windowStart = now - (now % windowSec)
    const now = Math.floor(Date.now() / 1000);
    const windowSec = 60; // matches RATE_LIMITS['/api/promo/validate'].windowSec
    const windowStart = now - (now % windowSec);

    const mockKV = {
      get: vi.fn().mockResolvedValue({ count: 10, window: windowStart }),
      put: vi.fn().mockResolvedValue(undefined),
    };

    const request = new Request('https://api.test/api/promo/validate', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '1.2.3.4' },
    });
    const env = { CACHE: mockKV };
    const result = await rateLimit(request, env);
    expect(result).not.toBeNull();
    expect(result.status).toBe(429);
  });
});

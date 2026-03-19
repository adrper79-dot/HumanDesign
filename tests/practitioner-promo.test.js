/**
 * Practitioner Promo Codes Tests — Item 1.9
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Practitioner Promo — query presence', () => {
  it('createPractitionerPromo query exists with correct table', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(typeof QUERIES.createPractitionerPromo).toBe('string');
    expect(QUERIES.createPractitionerPromo).toContain('promo_codes');
    expect(QUERIES.createPractitionerPromo).toContain('practitioner_id');
    expect(QUERIES.createPractitionerPromo).toContain('percentage');
  });

  it('getPractitionerActivePromo query exists and limits to 1', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(typeof QUERIES.getPractitionerActivePromo).toBe('string');
    expect(QUERIES.getPractitionerActivePromo).toContain('practitioner_id');
    expect(QUERIES.getPractitionerActivePromo).toContain('active = true');
    expect(QUERIES.getPractitionerActivePromo).toContain('LIMIT 1');
  });

  it('deactivatePractitionerPromo query checks ownership', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(typeof QUERIES.deactivatePractitionerPromo).toBe('string');
    expect(QUERIES.deactivatePractitionerPromo).toContain('practitioner_id = $2');
    expect(QUERIES.deactivatePractitionerPromo).toContain('active = false');
  });
});

describe('Practitioner Promo — handler validation', () => {
  let handlePractitioner;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('../workers/src/db/queries.js', () => ({
      QUERIES: {
        getPractitionerProfile: 'SELECT 1',
        getPractitionerActivePromo: 'SELECT 1',
        createPractitionerPromo: 'SELECT 1',
        deactivatePractitionerPromo: 'SELECT 1',
      },
      createQueryFn: () => async () => ({ rows: [] }),
    }));
    vi.doMock('../workers/src/lib/analytics.js', () => ({
      trackEvent: vi.fn(),
    }));
    vi.doMock('../workers/src/lib/errors.js', () => ({
      reportHandledRouteError: vi.fn(() => Response.json({ error: 'err' }, { status: 500 })),
    }));
    vi.doMock('../workers/src/middleware/tierEnforcement.js', () => ({
      enforceFeatureAccess: vi.fn(() => null), // null = access granted
    }));

    const mod = await import('../workers/src/handlers/practitioner.js');
    handlePractitioner = mod.handlePractitioner;
  });

  it('GET /api/practitioner/promo returns ok with null promo when none exists', async () => {
    const request = {
      _user: { sub: 'user-1', tier: 'practitioner' },
      url: 'https://test.com/api/practitioner/promo',
      method: 'GET',
    };
    const env = { NEON_CONNECTION_STRING: 'test' };
    const resp = await handlePractitioner(request, env, '/promo');
    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(body.promo).toBeNull();
  });

  it('POST /api/practitioner/promo rejects empty code', async () => {
    const request = {
      _user: { sub: 'user-1', tier: 'practitioner' },
      url: 'https://test.com/api/practitioner/promo',
      method: 'POST',
      json: async () => ({ code: '', discount_value: 20 }),
    };
    const env = { NEON_CONNECTION_STRING: 'test' };
    const resp = await handlePractitioner(request, env, '/promo');
    const body = await resp.json();
    expect(resp.status).toBe(400);
    expect(body.error).toContain('3-32 characters');
  });

  it('POST /api/practitioner/promo rejects discount below 10%', async () => {
    const request = {
      _user: { sub: 'user-1', tier: 'practitioner' },
      url: 'https://test.com/api/practitioner/promo',
      method: 'POST',
      json: async () => ({ code: 'TESTCODE', discount_value: 5 }),
    };
    const env = { NEON_CONNECTION_STRING: 'test' };
    const resp = await handlePractitioner(request, env, '/promo');
    const body = await resp.json();
    expect(resp.status).toBe(400);
    expect(body.error).toContain('10%');
  });

  it('POST /api/practitioner/promo rejects discount above 50%', async () => {
    const request = {
      _user: { sub: 'user-1', tier: 'practitioner' },
      url: 'https://test.com/api/practitioner/promo',
      method: 'POST',
      json: async () => ({ code: 'TESTCODE', discount_value: 75 }),
    };
    const env = { NEON_CONNECTION_STRING: 'test' };
    const resp = await handlePractitioner(request, env, '/promo');
    const body = await resp.json();
    expect(resp.status).toBe(400);
    expect(body.error).toContain('50%');
  });

  it('DELETE /api/practitioner/promo/:id rejects invalid UUID', async () => {
    const request = {
      _user: { sub: 'user-1', tier: 'practitioner' },
      url: 'https://test.com/api/practitioner/promo/not-a-uuid',
      method: 'DELETE',
    };
    const env = { NEON_CONNECTION_STRING: 'test' };
    const resp = await handlePractitioner(request, env, '/promo/not-a-uuid');
    const body = await resp.json();
    expect(resp.status).toBe(400);
    expect(body.error).toContain('Invalid promo ID');
  });
});

describe('Practitioner Promo — migration', () => {
  it('migration file exists for practitioner_id column', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.resolve('workers/src/db/migrations/058_practitioner_promo.sql');
    const content = fs.readFileSync(migrationPath, 'utf8');
    expect(content).toContain('practitioner_id');
    expect(content).toContain('promo_codes');
  });
});

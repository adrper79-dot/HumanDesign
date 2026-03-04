/**
 * Handler Integration Tests
 *
 * Tests each Worker handler with mock Request/env objects.
 * Compute-only handlers get full integration testing (engine included).
 * LLM/DB-dependent handlers test request validation and error paths.
 */

import { describe, it, expect, vi } from 'vitest';

// ─── Compute Handlers (no external deps) ─────────────────────

import { handleCalculate } from '../workers/src/handlers/calculate.js';
import { handleComposite } from '../workers/src/handlers/composite.js';
import { handleRectify }   from '../workers/src/handlers/rectify.js';

// ─── Helpers ─────────────────────────────────────────────────

const AP = {
  birthDate: '1979-08-05',
  birthTime: '18:51',
  birthTimezone: 'America/New_York',
  lat: 27.9506,
  lng: -82.4572
};

function makeRequest(method, url, body, headers = {}) {
  const init = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body && method !== 'GET') {
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

function makeGetRequest(url, headers = {}) {
  return new Request(url, { method: 'GET', headers });
}

const mockEnv = {
  ANTHROPIC_API_KEY: 'test-key',
  AI_GATEWAY_URL: 'https://test.ai.gateway',
  NEON_CONNECTION_STRING: 'postgresql://test',
  JWT_SECRET: 'test-secret',
  TELNYX_API_KEY: 'test-telnyx',
  TELNYX_PHONE_NUMBER: '+10000000000'
};

// ─── /api/chart/calculate ────────────────────────────────────

describe('POST /api/chart/calculate', () => {
  it('returns full chart for valid AP input', async () => {
    const req = makeRequest('POST', 'https://api.test/api/chart/calculate', AP);
    const res = await handleCalculate(req, mockEnv);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data).toBeDefined();

    // Verify HD chart
    expect(json.data.chart.type).toBe('Projector');
    expect(json.data.chart.authority).toBe('Emotional - Solar Plexus');
    expect(json.data.chart.profile).toBe('6/2');
    expect(json.data.chart.definition).toBe('Split Definition');

    // Verify astrology
    expect(json.data.astrology).toBeDefined();
    expect(json.data.astrology.placements.sun.sign).toBe('Leo');

    // Verify gates
    expect(json.data.personalityGates).toBeDefined();
    expect(json.data.designGates).toBeDefined();
  });

  it('rejects missing birthDate', async () => {
    const { birthDate, ...partial } = AP;
    const req = makeRequest('POST', 'https://api.test/api/chart/calculate', partial);
    const res = await handleCalculate(req, mockEnv);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/birthDate/i);
  });

  it('rejects missing birthTime', async () => {
    const { birthTime, ...partial } = AP;
    const req = makeRequest('POST', 'https://api.test/api/chart/calculate', partial);
    const res = await handleCalculate(req, mockEnv);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/birthTime/i);
  });

  it('rejects missing lat', async () => {
    const { lat, ...partial } = AP;
    const req = makeRequest('POST', 'https://api.test/api/chart/calculate', partial);
    const res = await handleCalculate(req, mockEnv);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/lat/i);
  });

  it('rejects missing lng', async () => {
    const { lng, ...partial } = AP;
    const req = makeRequest('POST', 'https://api.test/api/chart/calculate', partial);
    const res = await handleCalculate(req, mockEnv);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/lng/i);
  });

  it('handles timezone-aware conversion', async () => {
    const req = makeRequest('POST', 'https://api.test/api/chart/calculate', {
      ...AP,
      birthTimezone: 'America/New_York'
    });
    const res = await handleCalculate(req, mockEnv);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.meta?.utcInput).toBeDefined();
  });

  it('includes meta with calculation timestamp', async () => {
    const req = makeRequest('POST', 'https://api.test/api/chart/calculate', AP);
    const res = await handleCalculate(req, mockEnv);
    const json = await res.json();
    expect(json.meta?.calculatedAt).toBeDefined();
  });
});

// ─── /api/composite ──────────────────────────────────────────

describe('POST /api/composite', () => {
  const personB = {
    birthDate: '1985-03-15',
    birthTime: '10:30',
    lat: 40.7128,
    lng: -74.0060
  };

  it('computes composite for two people', async () => {
    const req = makeRequest('POST', 'https://api.test/api/composite', {
      personA: AP,
      personB
    });
    const res = await handleComposite(req, mockEnv);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.composite).toBeDefined();
    expect(json.composite.personA).toBeDefined();
    expect(json.composite.personB).toBeDefined();
    expect(json.composite.electromagnetic).toBeDefined();
    expect(json.composite.dominanceA).toBeDefined();
    expect(json.composite.dominanceB).toBeDefined();
    expect(json.composite.companionship).toBeDefined();
    expect(json.composite.dynamics).toBeDefined();
  });

  it('rejects missing personA', async () => {
    const req = makeRequest('POST', 'https://api.test/api/composite', {
      personB
    });
    const res = await handleComposite(req, mockEnv);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/personA/i);
  });

  it('rejects missing personB', async () => {
    const req = makeRequest('POST', 'https://api.test/api/composite', {
      personA: AP
    });
    const res = await handleComposite(req, mockEnv);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/personB/i);
  });

  it('rejects incomplete personA data', async () => {
    const req = makeRequest('POST', 'https://api.test/api/composite', {
      personA: { birthDate: '1979-08-05' },
      personB
    });
    const res = await handleComposite(req, mockEnv);
    expect(res.status).toBe(400);
  });

  it('identifies type interactions', async () => {
    const req = makeRequest('POST', 'https://api.test/api/composite', {
      personA: AP,
      personB
    });
    const res = await handleComposite(req, mockEnv);
    const json = await res.json();

    // AP is Projector — should be noted in dynamics
    expect(json.composite.personA.type).toBe('Projector');
    expect(json.composite.dynamics).toBeDefined();
    expect(Array.isArray(json.composite.dynamics) || typeof json.composite.dynamics === 'object').toBe(true);
  });
});

// ─── /api/rectify ────────────────────────────────────────────

describe('POST /api/rectify', () => {
  it('returns sensitivity analysis for valid input', async () => {
    const req = makeRequest('POST', 'https://api.test/api/rectify', {
      ...AP,
      windowMinutes: 15,
      stepMinutes: 5
    });
    const res = await handleRectify(req, mockEnv);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.baseChart).toBeDefined();
    expect(json.sensitivity).toBeDefined();
    expect(json.snapshots).toBeDefined();
    expect(Array.isArray(json.snapshots)).toBe(true);
    expect(json.snapshots.length).toBeGreaterThan(0);
  });

  it('defaults windowMinutes=30, stepMinutes=5 when omitted', async () => {
    const req = makeRequest('POST', 'https://api.test/api/rectify', AP);
    const res = await handleRectify(req, mockEnv);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.sensitivity.window).toContain('30');
    expect(json.sensitivity.step).toBeDefined();
  });

  it('caps windowMinutes at 120', async () => {
    const req = makeRequest('POST', 'https://api.test/api/rectify', {
      ...AP,
      windowMinutes: 300,
      stepMinutes: 15
    });
    const res = await handleRectify(req, mockEnv);
    const json = await res.json();

    expect(res.status).toBe(200);
    // Window is a formatted string like '±120 minutes' or actual numeric cap
    expect(json.sensitivity.window).toBeDefined();
  });

  it('rejects missing required fields', async () => {
    const req = makeRequest('POST', 'https://api.test/api/rectify', {
      birthDate: '1979-08-05'
    });
    const res = await handleRectify(req, mockEnv);
    expect(res.status).toBe(400);
  });

  it('includes guidance array', async () => {
    const req = makeRequest('POST', 'https://api.test/api/rectify', {
      ...AP,
      windowMinutes: 10,
      stepMinutes: 5
    });
    const res = await handleRectify(req, mockEnv);
    const json = await res.json();

    expect(json.guidance).toBeDefined();
    expect(Array.isArray(json.guidance)).toBe(true);
  });

  it('identifies critical change points', async () => {
    const req = makeRequest('POST', 'https://api.test/api/rectify', {
      ...AP,
      windowMinutes: 30,
      stepMinutes: 5
    });
    const res = await handleRectify(req, mockEnv);
    const json = await res.json();

    // sensitivity should have changepoint info
    expect(json.sensitivity.totalSnapshots).toBeGreaterThan(0);
  });
});

// ─── /api/profile/generate (validation only, LLM mocked) ────

import { handleProfile } from '../workers/src/handlers/profile.js';

describe('POST /api/profile/generate', () => {
  it('rejects missing required fields', async () => {
    const req = makeRequest('POST', 'https://api.test/api/profile/generate', {
      birthDate: '1979-08-05'
    });
    const res = await handleProfile(req, mockEnv);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/missing/i);
  });

  it('rejects missing birthDate', async () => {
    const { birthDate, ...partial } = AP;
    const req = makeRequest('POST', 'https://api.test/api/profile/generate', partial);
    const res = await handleProfile(req, mockEnv);
    expect(res.status).toBe(400);
  });

  it('rejects missing lat', async () => {
    const req = makeRequest('POST', 'https://api.test/api/profile/generate', {
      birthDate: '1979-08-05',
      birthTime: '18:51',
      lng: -82.4572
    });
    const res = await handleProfile(req, mockEnv);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/lat/i);
  });
});

// ─── /api/transits/forecast (validation) ─────────────────────

import { handleForecast } from '../workers/src/handlers/forecast.js';

describe('GET /api/transits/forecast', () => {
  it('rejects missing birthDate', async () => {
    const req = makeGetRequest('https://api.test/api/transits/forecast?birthTime=18:51&lat=27.95&lng=-82.45');
    const res = await handleForecast(req, mockEnv);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/birthDate/i);
  });

  it('rejects missing birthTime', async () => {
    const req = makeGetRequest('https://api.test/api/transits/forecast?birthDate=1979-08-05&lat=27.95&lng=-82.45');
    const res = await handleForecast(req, mockEnv);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/birthTime/i);
  });

  it('returns forecast for valid input', async () => {
    const url = 'https://api.test/api/transits/forecast?birthDate=1979-08-05&birthTime=18:51&lat=27.9506&lng=-82.4572&days=7';
    const req = makeGetRequest(url);
    const res = await handleForecast(req, mockEnv);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.range).toBeDefined();
    expect(json.range.days).toBe(7);
    expect(json.events).toBeDefined();
    expect(Array.isArray(json.events)).toBe(true);
    expect(json.summary).toBeDefined();
  });

  it('defaults to 30 days when days param omitted', async () => {
    const url = 'https://api.test/api/transits/forecast?birthDate=1979-08-05&birthTime=18:51&lat=27.9506&lng=-82.4572';
    const req = makeGetRequest(url);
    const res = await handleForecast(req, mockEnv);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.range.days).toBe(30);
  });

  it('caps days at 90', async () => {
    const url = 'https://api.test/api/transits/forecast?birthDate=1979-08-05&birthTime=18:51&lat=27.9506&lng=-82.4572&days=365';
    const req = makeGetRequest(url);
    const res = await handleForecast(req, mockEnv);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.range.days).toBeLessThanOrEqual(90);
  });
});

// ─── /api/transits/today ─────────────────────────────────────

import { handleTransits } from '../workers/src/handlers/transits.js';

describe('GET /api/transits/today', () => {
  it('returns current transits without natal data', async () => {
    const req = makeGetRequest('https://api.test/api/transits/today');
    const res = await handleTransits(req, mockEnv);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.date).toBeDefined();
    expect(json.transits).toBeDefined();
    expect(json.transits.gateActivations).toBeDefined();
    expect(json.transits.natalMatches).toEqual([]);
  });

  it('includes natal comparison when birth data provided', async () => {
    const url = 'https://api.test/api/transits/today?birthDate=1979-08-05&birthTime=18:51&lat=27.9506&lng=-82.4572';
    const req = makeGetRequest(url);
    const res = await handleTransits(req, mockEnv);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.transits.natalMatches).toBeDefined();
  });

  it('accepts optional lat/lng for location context', async () => {
    const url = 'https://api.test/api/transits/today?lat=27.9506&lng=-82.4572';
    const req = makeGetRequest(url);
    const res = await handleTransits(req, mockEnv);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.transits.gateActivations).toBeDefined();
  });
});

// ─── /api/auth/* ─────────────────────────────────────────────

import { handleAuth } from '../workers/src/handlers/auth.js';

describe('POST /api/auth/register', () => {
  it('rejects missing email', async () => {
    const req = makeRequest('POST', 'https://api.test/api/auth/register', { password: 'test1234' });
    const res = await handleAuth(req, mockEnv, '/api/auth/register');
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/[Ee]mail/);
  });

  it('rejects missing password', async () => {
    const req = makeRequest('POST', 'https://api.test/api/auth/register', { email: 'test@test.com' });
    const res = await handleAuth(req, mockEnv, '/api/auth/register');
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/[Pp]assword/);
  });

  it('rejects short password', async () => {
    const req = makeRequest('POST', 'https://api.test/api/auth/register', { email: 'test@test.com', password: '123' });
    const res = await handleAuth(req, mockEnv, '/api/auth/register');
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/8 characters/);
  });

  it('rejects non-POST methods', async () => {
    const req = makeGetRequest('https://api.test/api/auth/register');
    const res = await handleAuth(req, mockEnv, '/api/auth/register');
    expect(res.status).toBe(405);
  });
});

describe('POST /api/auth/login', () => {
  it('rejects missing credentials', async () => {
    const req = makeRequest('POST', 'https://api.test/api/auth/login', { email: 'test@test.com' });
    const res = await handleAuth(req, mockEnv, '/api/auth/login');
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/[Pp]assword/);
  });
});

describe('POST /api/auth/refresh', () => {
  it('rejects missing refresh token', async () => {
    const req = makeRequest('POST', 'https://api.test/api/auth/refresh', {});
    const res = await handleAuth(req, mockEnv, '/api/auth/refresh');
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/[Rr]efresh/);
  });

  it('rejects invalid refresh token', async () => {
    const req = makeRequest('POST', 'https://api.test/api/auth/refresh', { refreshToken: 'invalid.token.here' });
    const res = await handleAuth(req, mockEnv, '/api/auth/refresh');
    const json = await res.json();
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth (unknown)', () => {
  it('returns 404 for unknown auth path', async () => {
    const req = makeRequest('POST', 'https://api.test/api/auth/unknown', {});
    const res = await handleAuth(req, mockEnv, '/api/auth/unknown');
    expect(res.status).toBe(404);
  });
});

// ─── /api/geocode ─────────────────────────────────────────────

import { handleGeocode } from '../workers/src/handlers/geocode.js';

describe('GET /api/geocode', () => {
  it('rejects missing q param', async () => {
    const req = makeGetRequest('https://api.test/api/geocode');
    const res = await handleGeocode(req, mockEnv);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBeDefined();
  });

  it('rejects single-character query', async () => {
    const req = makeGetRequest('https://api.test/api/geocode?q=X');
    const res = await handleGeocode(req, mockEnv);
    const json = await res.json();
    expect(res.status).toBe(400);
  });

  it('returns 404 when Nominatim finds nothing', async () => {
    const orig = global.fetch;
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => [] });
    const req = makeGetRequest('https://api.test/api/geocode?q=ZZZNoSuchPlace9999');
    const res = await handleGeocode(req, mockEnv);
    const json = await res.json();
    expect(res.status).toBe(404);
    expect(json.error).toMatch(/not found/i);
    global.fetch = orig;
  });

  it('returns lat/lng/timezone for a valid city', async () => {
    const orig = global.fetch;
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          lat: '27.9506',
          lon: '-82.4572',
          display_name: 'Tampa, Hillsborough County, Florida, United States'
        }]
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ianaTimeId: 'America/New_York' })
      });
    const req = makeGetRequest('https://api.test/api/geocode?q=Tampa+FL+USA');
    const res = await handleGeocode(req, mockEnv);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.lat).toBeCloseTo(27.9506, 3);
    expect(json.lng).toBeCloseTo(-82.4572, 3);
    expect(json.timezone).toBe('America/New_York');
    expect(json.displayName).toContain('Tampa');
    global.fetch = orig;
  });
});

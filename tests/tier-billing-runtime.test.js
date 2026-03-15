import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateQueryFn, getUserTierMock } = vi.hoisted(() => ({
  mockCreateQueryFn: vi.fn(),
  getUserTierMock: vi.fn().mockResolvedValue('agency'), // analytics tests use agency/practitioner tier
}));

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: mockCreateQueryFn,
  QUERIES: {
    getActiveSubscription: 'getActiveSubscription',
    getAgencyOwnerForMember: 'getAgencyOwnerForMember',
    getAnalyticsMrr: 'getAnalyticsMrr',
    getAnalyticsTierDistribution: 'getAnalyticsTierDistribution',
    getAnalyticsMonthlyChurn: 'getAnalyticsMonthlyChurn',
  },
}));

// CIO-006 fix: analytics handler now resolves tier via DB, not JWT claim.
vi.mock('../workers/src/middleware/tierEnforcement.js', async () => {
  const actual = await vi.importActual('../workers/src/middleware/tierEnforcement.js');
  return { ...actual, getUserTier: getUserTierMock };
});

vi.mock('../workers/src/lib/stripe.js', () => ({
  normalizeTierName: (tierName) => {
    const normalized = tierName ? String(tierName).toLowerCase() : 'free';
    const legacyMap = {
      regular: 'individual',
      explorer: 'individual',
      seeker: 'individual',
      guide: 'practitioner',
      white_label: 'agency',
      studio: 'agency',
    };
    return legacyMap[normalized] || normalized;
  },
  getTier: (tierName) => {
    const normalized = tierName === 'white_label' ? 'agency' : tierName;
    const prices = {
      free: 0,
      individual: 1900,
      practitioner: 9700,
      agency: 34900,
    };
    return {
      name: normalized,
      price: prices[normalized] ?? 0,
      features: {
        practitionerTools: normalized === 'practitioner' || normalized === 'agency',
        whiteLabel: normalized === 'agency',
      },
    };
  },
  hasFeatureAccess: (tierName, feature) => {
    const normalized = tierName === 'white_label' ? 'agency' : tierName;
    const featureMatrix = {
      practitionerTools: normalized === 'practitioner' || normalized === 'agency',
      whiteLabel: normalized === 'agency',
    };
    return featureMatrix[feature] === true;
  },
  isQuotaExceeded: () => false,
}));

vi.mock('../workers/src/lib/analytics.js', () => ({
  FUNNELS: {},
}));

import { enforceFeatureAccess } from '../workers/src/middleware/tierEnforcement.js';
import { handleAnalytics } from '../workers/src/handlers/analytics.js';
import { handleEmbedValidate } from '../workers/src/handlers/embed.js';

describe('tier and billing runtime alignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps past_due subscriptions entitled through the billing-active subscription path', async () => {
    const query = vi.fn(async (sql) => {
      if (typeof sql === 'string' && sql.includes('SELECT lifetime_access')) {
        return { rows: [{ lifetime_access: false, transit_pass_expires: null }] };
      }
      if (sql === 'getActiveSubscription') {
        return { rows: [{ tier: 'guide', status: 'past_due' }] };
      }
      if (sql === 'getAgencyOwnerForMember') {
        return { rows: [] };
      }
      return { rows: [] };
    });
    mockCreateQueryFn.mockReturnValue(query);

    const request = new Request('https://api.test/feature');
    request._user = { sub: 'user-1' };

    const result = await enforceFeatureAccess(
      request,
      { NEON_CONNECTION_STRING: 'postgresql://test' },
      'practitionerTools'
    );

    expect(result).toBeNull();
    expect(request._tier).toBe('practitioner');
    expect(query).toHaveBeenCalledWith('getActiveSubscription', ['user-1']);
  });

  it('reports revenue using canonical tier names and current pricing', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'getAnalyticsMrr') {
        return {
          rows: [{
            individual_count: '2',
            practitioner_count: '3',
            agency_count: '1',
            total_active: '6',
            recent_churn: '1',
          }],
        };
      }
      if (sql === 'getAnalyticsTierDistribution') {
        return {
          rows: [
            { tier: 'individual', count: '5' },
            { tier: 'practitioner', count: '3' },
            { tier: 'agency', count: '1' },
          ],
        };
      }
      if (sql === 'getAnalyticsMonthlyChurn') {
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    mockCreateQueryFn.mockReturnValue(query);

    const request = new Request('https://api.test/api/analytics/revenue');
    request._user = { sub: 'admin-test', tier: 'white_label' };

    const response = await handleAnalytics(
      request,
      { NEON_CONNECTION_STRING: 'postgresql://test' },
      '/revenue'
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.mrr.totalCents).toBe(67800);
    expect(json.data.mrr.totalUsd).toBe('$678.00');
    expect(json.data.mrr.breakdown).toEqual({
      individual: { count: 2, revenueCents: 3800 },
      practitioner: { count: 3, revenueCents: 29100 },
      agency: { count: 1, revenueCents: 34900 },
    });
  });

  it('treats a valid practitioner API key as valid without white-label permission', async () => {
    const query = vi.fn(async (sql) => {
      if (typeof sql === 'string' && sql.includes('FROM api_keys')) {
        return {
          rows: [{ active: true, expires_at: null, user_tier: 'practitioner' }],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    mockCreateQueryFn.mockReturnValue(query);

    const response = await handleEmbedValidate(
      new Request('https://api.test/api/embed/validate?apiKey=ps_test_key', { method: 'GET' }),
      { NEON_CONNECTION_STRING: 'postgresql://test' }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.valid).toBe(true);
    expect(json.tier).toBe('practitioner');
    expect(json.features.hideAttribution).toBe(false);
  });

  it('normalizes legacy white_label accounts to agency capabilities for embeds', async () => {
    const query = vi.fn(async (sql) => {
      if (typeof sql === 'string' && sql.includes('FROM api_keys')) {
        return {
          rows: [{ active: true, expires_at: null, user_tier: 'white_label' }],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    mockCreateQueryFn.mockReturnValue(query);

    const response = await handleEmbedValidate(
      new Request('https://api.test/api/embed/validate?apiKey=ps_test_key', { method: 'GET' }),
      { NEON_CONNECTION_STRING: 'postgresql://test' }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.valid).toBe(true);
    expect(json.tier).toBe('agency');
    expect(json.features.hideAttribution).toBe(true);
  });
});
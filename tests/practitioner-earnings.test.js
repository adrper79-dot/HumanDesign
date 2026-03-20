/**
 * Practitioner Revenue/Earnings Card Tests — Item 1.8
 */
import { describe, it, expect } from 'vitest';
import { beforeEach, vi } from 'vitest';

describe('Practitioner Earnings — query fix', () => {
  it('getPractitionerReferralStats is no longer a stub', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(typeof QUERIES.getPractitionerReferralStats).toBe('string');
    // Must query real data, not return hard-coded zeros
    expect(QUERIES.getPractitionerReferralStats).toContain('referrals');
    expect(QUERIES.getPractitionerReferralStats).not.toContain('0::int as referral_count');
  });

  it('getPractitionerReferralStats queries referral_count from referrals table', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(QUERIES.getPractitionerReferralStats).toContain('referral_count');
    expect(QUERIES.getPractitionerReferralStats).toContain('referrer_user_id');
  });

  it('getPractitionerReferralStats sums monthly earnings from reward_value', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(QUERIES.getPractitionerReferralStats).toContain('earnings_this_month');
    expect(QUERIES.getPractitionerReferralStats).toContain('reward_value');
    expect(QUERIES.getPractitionerReferralStats).toContain('reward_granted');
  });

  it('existing referral queries still intact', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(typeof QUERIES.countReferrals).toBe('string');
    expect(typeof QUERIES.getReferralRewardStats).toBe('string');
    expect(typeof QUERIES.countPendingReferralRewards).toBe('string');
    expect(typeof QUERIES.countConvertedReferrals).toBe('string');
  });
});

describe('Practitioner Earnings — handler', () => {
  it('handleGetReferralLink is exported', async () => {
    const mod = await import('../workers/src/handlers/practitioner.js');
    expect(typeof mod.handleGetReferralLink).toBe('function');
  });

  it('handleGetReferralLink requires auth', async () => {
    const mod = await import('../workers/src/handlers/practitioner.js');
    const request = { _user: null };
    const env = {};
    const resp = await mod.handleGetReferralLink(request, env);
    const body = await resp.json();
    expect(resp.status).toBe(401);
    expect(body.error).toContain('Authentication required');
  });

  beforeEach(() => {
    vi.resetModules();
  });

  it('returns tier enforcement response when practitioner tools are unavailable', async () => {
    const queryMock = vi.fn();
    const enforceFeatureAccessMock = vi.fn().mockResolvedValue(Response.json({ error: 'locked' }, { status: 403 }));

    vi.doMock('../workers/src/db/queries.js', async () => {
      const actual = await vi.importActual('../workers/src/db/queries.js');
      return {
        ...actual,
        createQueryFn: () => queryMock,
      };
    });
    vi.doMock('../workers/src/middleware/tierEnforcement.js', async () => {
      const actual = await vi.importActual('../workers/src/middleware/tierEnforcement.js');
      return {
        ...actual,
        enforceFeatureAccess: enforceFeatureAccessMock,
      };
    });

    const mod = await import('../workers/src/handlers/practitioner.js');
    const resp = await mod.handleGetReferralLink({ _user: { sub: 'user-1' } }, { NEON_CONNECTION_STRING: 'postgresql://test' });

    expect(resp.status).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('falls back to legacy directory profile query when scheduling embed column is missing', async () => {
    const missingColumn = Object.assign(new Error('missing column'), { code: '42703' });
    const { QUERIES } = await import('../workers/src/db/queries.js');
    const queryMock = vi.fn(async (sql) => {
      if (sql === QUERIES.getPractitionerDirectoryProfile) throw missingColumn;
      if (sql === QUERIES.getPractitionerDirectoryProfileLegacy) return { rows: [{ slug: 'jane-doe' }] };
      if (sql === QUERIES.getPractitionerReferralStats) return { rows: [{ referral_count: 2, earnings_this_month: 12.5 }] };
      return { rows: [] };
    });
    const enforceFeatureAccessMock = vi.fn().mockResolvedValue(null);

    vi.doMock('../workers/src/db/queries.js', async () => {
      const actual = await vi.importActual('../workers/src/db/queries.js');
      return {
        ...actual,
        createQueryFn: () => queryMock,
      };
    });
    vi.doMock('../workers/src/middleware/tierEnforcement.js', async () => {
      const actual = await vi.importActual('../workers/src/middleware/tierEnforcement.js');
      return {
        ...actual,
        enforceFeatureAccess: enforceFeatureAccessMock,
      };
    });

    const mod = await import('../workers/src/handlers/practitioner.js');
    const resp = await mod.handleGetReferralLink(
      { _user: { sub: 'user-1' } },
      { NEON_CONNECTION_STRING: 'postgresql://test', FRONTEND_URL: 'https://selfprime.net' }
    );
    const body = await resp.json();

    expect(resp.status).toBe(200);
    expect(body.referralUrl).toBe('https://selfprime.net/?ref=jane-doe');
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('scheduling_embed_url'), ['user-1']);
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("''::text AS scheduling_embed_url"), ['user-1']);
  });
});


describe('Practitioner Earnings — referrals handler', () => {
  it('handleGetStats is exported from referrals handler', async () => {
    const mod = await import('../workers/src/handlers/referrals.js');
    expect(typeof mod.handleGetStats).toBe('function');
  });

  it('getReferralRewardStats query returns proper columns', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(QUERIES.getReferralRewardStats).toContain('rewards_count');
    expect(QUERIES.getReferralRewardStats).toContain('total_value');
    expect(QUERIES.getReferralRewardStats).toContain('reward_granted');
  });
});

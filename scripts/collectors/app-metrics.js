/**
 * collectors/app-metrics.js
 * Pulls app-level analytics from the Prime Self Worker via X-Audit-Token.
 *
 * Returns: { available, dau, wau, mau, errorRatePct, topErrors, mrr }
 *
 * Requires env vars: PROD_API, AUDIT_SECRET
 * Gracefully degrades — audit continues if this endpoint is unreachable.
 */

export async function collectAppMetrics() {
  const prodApi     = process.env.PROD_API;
  const auditSecret = process.env.AUDIT_SECRET;

  if (!prodApi || !auditSecret) {
    console.warn('[App Metrics] PROD_API or AUDIT_SECRET not set — skipping.');
    return { available: false, reason: 'missing credentials' };
  }

  const headers = {
    'X-Audit-Token': auditSecret,
    'Content-Type': 'application/json',
  };

  try {
    const [overviewRes, errorsRes, revenueRes] = await Promise.all([
      fetch(`${prodApi}/api/analytics/audit`, { headers }).catch(e => ({ ok: false, _err: e.message })),
    ]);

    if (!overviewRes.ok) {
      const reason = overviewRes._err || `HTTP ${overviewRes.status}`;
      console.warn('[App Metrics] Analytics endpoint unavailable:', reason);
      return { available: false, reason };
    }

    const data = await overviewRes.json();

    return {
      available:    true,
      dau:          data.activeUsers?.daily   || 0,
      wau:          data.activeUsers?.weekly  || 0,
      mau:          data.activeUsers?.monthly || 0,
      errorRatePct: data.errorRate            || '0%',
      topErrors:    data.topErrors            || [],
      mrr:          data.mrr                  || null,
      tierBreakdown: data.tierDistribution    || [],
    };
  } catch (err) {
    console.warn('[App Metrics] Unexpected error:', err.message);
    return { available: false, reason: err.message };
  }
}

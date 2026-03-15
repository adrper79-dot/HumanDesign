/**
 * collectors/cloudflare-metrics.js
 * Queries the Cloudflare GraphQL Analytics API for Worker metrics.
 *
 * Returns: { totalRequests, totalErrors, errorRatePct, p50CpuMs, p99CpuMs, peakErrorHour, available }
 *
 * Requires env vars: CF_API_TOKEN, CF_ACCOUNT_ID
 */

const CF_GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql';
const WORKER_NAME = 'prime-self-api';

export async function collectCloudflareMetrics() {
  const token     = process.env.CF_API_TOKEN;
  const accountId = process.env.CF_ACCOUNT_ID;

  if (!token || !accountId) {
    console.warn('[CF Metrics] CF_API_TOKEN or CF_ACCOUNT_ID not set — skipping.');
    return { available: false, reason: 'missing credentials' };
  }

  // Last 7 days
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const query = `
    query WorkerMetrics($accountTag: String!, $scriptName: String!, $since: String!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workersInvocationsAdaptive(
            limit: 10000
            filter: {
              scriptName: $scriptName
              datetime_geq: $since
            }
            orderBy: [datetime_ASC]
          ) {
            sum {
              requests
              errors
              subrequests
            }
            quantiles {
              cpuTimeP50
              cpuTimeP99
            }
            dimensions {
              datetime
            }
          }
        }
      }
    }
  `;

  let res;
  try {
    res = await fetch(CF_GRAPHQL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { accountTag: accountId, scriptName: WORKER_NAME, since },
      }),
    });
  } catch (err) {
    console.warn('[CF Metrics] Fetch failed:', err.message);
    return { available: false, reason: err.message };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.warn('[CF Metrics] API error:', res.status, text.slice(0, 200));
    return { available: false, reason: `HTTP ${res.status}` };
  }

  const json = await res.json();

  if (json.errors?.length) {
    console.warn('[CF Metrics] GraphQL errors:', JSON.stringify(json.errors));
    return { available: false, reason: json.errors[0]?.message || 'GraphQL error' };
  }

  const rows = json?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive || [];

  if (rows.length === 0) {
    return { available: true, totalRequests: 0, totalErrors: 0, errorRatePct: 0, p50CpuMs: 0, p99CpuMs: 0 };
  }

  let totalRequests = 0;
  let totalErrors   = 0;
  let peakErrors    = 0;
  let peakErrorHour = null;

  for (const row of rows) {
    totalRequests += row.sum.requests   || 0;
    totalErrors   += row.sum.errors     || 0;
    if ((row.sum.errors || 0) > peakErrors) {
      peakErrors    = row.sum.errors;
      peakErrorHour = row.dimensions.datetime;
    }
  }

  // CPU quantiles: average across buckets (approximate)
  const p50Vals = rows.map(r => r.quantiles?.cpuTimeP50 || 0).filter(Boolean);
  const p99Vals = rows.map(r => r.quantiles?.cpuTimeP99 || 0).filter(Boolean);
  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const p50CpuUs = avg(p50Vals);
  const p99CpuUs = avg(p99Vals);

  return {
    available:     true,
    period:        '7d',
    totalRequests,
    totalErrors,
    errorRatePct:  totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(2) : '0.00',
    p50CpuMs:      (p50CpuUs / 1000).toFixed(2),   // microseconds → milliseconds
    p99CpuMs:      (p99CpuUs / 1000).toFixed(2),
    peakErrorHour: peakErrorHour || null,
  };
}

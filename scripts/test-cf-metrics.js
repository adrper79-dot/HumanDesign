#!/usr/bin/env node
/**
 * test-cf-metrics.js
 * Validates that your Cloudflare API token has the permissions needed
 * for the audit loop's Cloudflare metrics collector.
 *
 * Usage:
 *   CF_API_TOKEN=your_token CF_ACCOUNT_ID=your_account_id node scripts/test-cf-metrics.js
 *
 * Or if you have wrangler authenticated:
 *   node scripts/test-cf-metrics.js --use-wrangler
 */

const CF_GRAPHQL  = 'https://api.cloudflare.com/client/v4/graphql';
const CF_API_BASE = 'https://api.cloudflare.com/client/v4';
const WORKER_NAME = 'prime-self-api';

const token     = process.env.CF_API_TOKEN;
const accountId = process.env.CF_ACCOUNT_ID;

if (!token || !accountId) {
  console.error(`
Missing credentials. Run with:

  CF_API_TOKEN=<token> CF_ACCOUNT_ID=<account_id> node scripts/test-cf-metrics.js

Where to find them:
  CF_API_TOKEN  → Cloudflare Dashboard → My Profile → API Tokens
  CF_ACCOUNT_ID → Cloudflare Dashboard → right sidebar on any account page
`);
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type':  'application/json',
};

async function check(label, fn) {
  process.stdout.write(`  ${label}... `);
  try {
    const result = await fn();
    console.log(`✓  ${result}`);
    return true;
  } catch (err) {
    console.log(`✗  ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('\nCloudflare API Token Test\n' + '─'.repeat(40));

  // ── 1. Basic auth ──
  const authOk = await check('Token auth (verify token)', async () => {
    const res = await fetch(`${CF_API_BASE}/user/tokens/verify`, { headers });
    const j   = await res.json();
    if (!j.success) throw new Error(j.errors?.[0]?.message || 'Auth failed');
    return `Token "${j.result?.status}" — ID ${j.result?.id?.slice(0, 8)}...`;
  });

  if (!authOk) {
    console.error('\n→ Fix: Check CF_API_TOKEN is correct and not expired.\n');
    process.exit(1);
  }

  // ── 2. Account access ──
  const accountOk = await check('Account access', async () => {
    const res = await fetch(`${CF_API_BASE}/accounts/${accountId}`, { headers });
    const j   = await res.json();
    if (!j.success) throw new Error(j.errors?.[0]?.message || `HTTP ${res.status}`);
    return `Account "${j.result?.name}"`;
  });

  // ── 3. Workers list (Workers:Read) ──
  await check('Workers list (Workers:Read permission)', async () => {
    const res = await fetch(`${CF_API_BASE}/accounts/${accountId}/workers/scripts`, { headers });
    const j   = await res.json();
    if (!j.success) throw new Error(j.errors?.[0]?.message || `HTTP ${res.status}`);
    const found = j.result?.find(s => s.id === WORKER_NAME);
    return found
      ? `Found worker "${WORKER_NAME}"`
      : `${j.result?.length ?? 0} workers listed (${WORKER_NAME} not found — check worker name)`;
  });

  // ── 4. Analytics GraphQL (Account Analytics:Read) ──
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const analyticsOk = await check('Analytics GraphQL (Account Analytics:Read permission)', async () => {
    const res = await fetch(CF_GRAPHQL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: `
          query ($accountTag: String!, $scriptName: String!, $since: String!) {
            viewer {
              accounts(filter: { accountTag: $accountTag }) {
                workersInvocationsAdaptive(
                  limit: 1
                  filter: { scriptName: $scriptName, datetime_geq: $since }
                ) {
                  sum { requests errors }
                }
              }
            }
          }
        `,
        variables: { accountTag: accountId, scriptName: WORKER_NAME, since },
      }),
    });
    const j = await res.json();
    if (j.errors?.length) throw new Error(j.errors[0].message);
    const rows = j.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [];
    const reqs = rows.reduce((s, r) => s + (r.sum?.requests || 0), 0);
    return `Analytics readable — ${reqs} requests in last 24h`;
  });

  // ── Summary ──
  console.log('\n' + '─'.repeat(40));

  if (!analyticsOk) {
    console.log(`
✗ Analytics permission missing.

Fix:
  1. Go to Cloudflare Dashboard → My Profile → API Tokens
  2. Find the token used for CLOUDFLARE_API_TOKEN
  3. Click Edit → Add permission:
       Account → Account Analytics → Read
  4. Save — no need to regenerate the token value
  5. Re-run this script to confirm

Or create a new token with these permissions:
  • Account:Account Analytics:Read
  • Account:Cloudflare Workers Scripts:Read (optional, for worker listing)
`);
    process.exit(1);
  }

  console.log('\n✓ All checks passed. CF metrics will work in the audit loop.\n');
  console.log('Next: confirm CLOUDFLARE_API_TOKEN in GitHub secrets matches this token.');
  process.exit(0);
}

main().catch(err => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});

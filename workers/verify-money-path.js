#!/usr/bin/env node
const base = process.env.PUBLIC_API || 'https://selfprime.net/api';
const email = `gatecheck_${Date.now()}@example.com`;
const password = 'GateCheck123!';

function fail(message) {
  throw new Error(message);
}

async function jsonFetch(path, options = {}) {
  const res = await fetch(base + path, options);
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { res, body, text };
}

async function main() {
  const register = await jsonFetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!register.res.ok) {
    fail(`register failed: ${register.res.status} ${register.text}`);
  }

  const token = register.body?.accessToken || register.body?.access_token;
  if (!token) {
    fail('missing access token from register');
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const checkoutUrls = {
    successUrl: 'https://selfprime.net/billing/success.html',
    cancelUrl: 'https://selfprime.net/billing/cancel.html',
  };

  const individual = await jsonFetch('/billing/checkout', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ ...checkoutUrls, tier: 'individual' })
  });
  if (!individual.res.ok || individual.body?.ok !== true) {
    fail(`individual checkout failed: ${individual.res.status} ${individual.text}`);
  }
  if (!individual.body?.sessionId?.startsWith('cs_')) {
    fail('individual checkout missing Stripe sessionId');
  }
  if (!/^https:\/\/checkout\.stripe\.com\//.test(individual.body?.url || '')) {
    fail('individual checkout missing Stripe URL');
  }

  const individualDupe = await jsonFetch('/billing/checkout', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ ...checkoutUrls, tier: 'individual' })
  });
  if (!individualDupe.res.ok) {
    fail(`duplicate individual checkout failed: ${individualDupe.res.status} ${individualDupe.text}`);
  }
  if (individualDupe.body?.sessionId !== individual.body?.sessionId) {
    fail('duplicate individual checkout did not reuse session');
  }

  const practitioner = await jsonFetch('/billing/checkout', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ ...checkoutUrls, tier: 'practitioner' })
  });
  if (!practitioner.res.ok || practitioner.body?.ok !== true) {
    fail(`practitioner checkout failed: ${practitioner.res.status} ${practitioner.text}`);
  }
  if (!practitioner.body?.sessionId?.startsWith('cs_')) {
    fail('practitioner checkout missing Stripe sessionId');
  }
  if (practitioner.body.sessionId === individual.body.sessionId) {
    fail('practitioner checkout reused the individual session');
  }

  const agency = await jsonFetch('/billing/checkout', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ ...checkoutUrls, tier: 'agency' })
  });
  if (!agency.res.ok || agency.body?.contactRequired !== true) {
    fail(`agency checkout was not contact-gated: ${agency.res.status} ${agency.text}`);
  }

  const portal = await jsonFetch('/billing/portal', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ returnUrl: 'https://selfprime.net/' })
  });

  console.log(JSON.stringify({
    base,
    email,
    individualSessionId: individual.body.sessionId,
    individualSessionReused: individualDupe.body.sessionId === individual.body.sessionId,
    practitionerSessionId: practitioner.body.sessionId,
    agencyContactRequired: agency.body.contactRequired === true,
    portalStatus: portal.res.status,
    portalOk: portal.res.ok,
    portalBody: portal.body,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

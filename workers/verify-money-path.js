#!/usr/bin/env node
const apiBase = process.env.PROD_API || process.env.PUBLIC_API || 'https://prime-self-api.adrper79.workers.dev';
const frontendBase = process.env.FRONTEND_BASE || 'https://selfprime.net';
const testEmail = process.env.E2E_TEST_EMAIL || `gatecheck_${Date.now()}@example.com`;
const testPassword = process.env.E2E_TEST_PASSWORD || 'GateCheck123!';

function fail(message) {
  throw new Error(message);
}

async function jsonFetch(path, options = {}) {
  const res = await fetch(apiBase + path, options);
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
  let authMode = 'register';
  let authResponse;

  if (process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD) {
    authMode = 'login';
    authResponse = await jsonFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });

    if (!authResponse.res.ok) {
      fail(`login failed: ${authResponse.res.status} ${authResponse.text}`);
    }
  } else {
    authResponse = await jsonFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });

    if (!authResponse.res.ok) {
      fail(`register failed: ${authResponse.res.status} ${authResponse.text}`);
    }
  }

  const token = authResponse.body?.accessToken || authResponse.body?.access_token;
  if (!token) {
    fail(`missing access token from ${authMode}`);
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const checkoutUrls = {
    successUrl: `${frontendBase}/billing/success.html`,
    cancelUrl: `${frontendBase}/billing/cancel.html`,
  };

  const individual = await jsonFetch('/api/billing/checkout', {
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

  const individualDupe = await jsonFetch('/api/billing/checkout', {
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

  const practitioner = await jsonFetch('/api/billing/checkout', {
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

  const agency = await jsonFetch('/api/billing/checkout', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ ...checkoutUrls, tier: 'agency' })
  });
  if (!agency.res.ok || agency.body?.contactRequired !== true) {
    fail(`agency checkout was not contact-gated: ${agency.res.status} ${agency.text}`);
  }

  const portal = await jsonFetch('/api/billing/portal', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ returnUrl: `${frontendBase}/` })
  });

  // BL-TEST-P1-1: Verify cycles and rectify param validation return 400, not 401
  const cyclesNoParams = await jsonFetch('/api/cycles?birthDate=');
  if (cyclesNoParams.res.status !== 400) {
    fail(`cycles missing params should return 400, got ${cyclesNoParams.res.status}`);
  }
  if (cyclesNoParams.body?.error !== 'Missing required parameters: birthDate, birthTime') {
    fail(`cycles error message incorrect: ${cyclesNoParams.body?.error}`);
  }

  const rectifyNoParams = await jsonFetch('/api/rectify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (rectifyNoParams.res.status !== 400) {
    fail(`rectify missing params should return 400, got ${rectifyNoParams.res.status}`);
  }
  const rectifyError = rectifyNoParams.body?.error || '';
  const rectifyValidationOk =
    rectifyError.includes('Missing required field') ||
    rectifyError === 'Validation failed';
  if (!rectifyValidationOk) {
    fail(`rectify error message incorrect: ${rectifyNoParams.body?.error}`);
  }

  console.log(JSON.stringify({
    apiBase,
    frontendBase,
    authMode,
    email: testEmail,
    individualSessionId: individual.body.sessionId,
    individualSessionReused: individualDupe.body.sessionId === individual.body.sessionId,
    practitionerSessionId: practitioner.body.sessionId,
    agencyContactRequired: agency.body.contactRequired === true,
    portalStatus: portal.res.status,
    portalOk: portal.res.ok,
    portalBody: portal.body,
    cyclesParamValidation: {
      status: cyclesNoParams.res.status,
      errorCorrect: cyclesNoParams.body?.error === 'Missing required parameters: birthDate, birthTime'
    },
    rectifyParamValidation: {
      status: rectifyNoParams.res.status,
      errorCorrect: rectifyValidationOk,
      error: rectifyError
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

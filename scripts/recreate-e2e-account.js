#!/usr/bin/env node
/**
 * recreate-e2e-account.js
 *
 * Ensures the E2E test account exists and is authenticated on production.
 * Tries login first; falls back to register if the account is missing.
 *
 * Usage:
 *   node scripts/recreate-e2e-account.js
 *
 * Required env vars (loaded from .env.local):
 *   E2E_TEST_EMAIL    — test account email
 *   E2E_TEST_PASSWORD — test account password
 *
 * Exit 0 = account is ready.  Exit 1 = unrecoverable failure.
 */

import { loadLocalEnv } from './load-local-env.js';

loadLocalEnv();

const BASE_URL = process.env.TEST_BASE_URL || 'https://selfprime.net';
const email    = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;

if (!email || !password) {
  console.error('[e2e-setup] E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set in .env.local');
  process.exit(1);
}

async function tryLogin() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.ok;
}

async function tryRegister() {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[e2e-setup] Register failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
    return false;
  }
  return true;
}

async function main() {
  console.log(`[e2e-setup] Checking account: ${email} @ ${BASE_URL}`);

  if (await tryLogin()) {
    console.log('[e2e-setup] Login succeeded — account is ready.');
    process.exit(0);
  }

  console.log('[e2e-setup] Login failed — attempting to create account...');
  if (!await tryRegister()) {
    process.exit(1);
  }

  if (await tryLogin()) {
    console.log('[e2e-setup] Account created and login verified.');
    process.exit(0);
  }

  console.error('[e2e-setup] Account created but login still fails — check credentials or server state.');
  process.exit(1);
}

main().catch(err => {
  console.error('[e2e-setup] Unexpected error:', err.message);
  process.exit(1);
});

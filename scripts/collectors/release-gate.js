/**
 * collectors/release-gate.js
 * Runs the production gate in JSON mode so audit output can distinguish
 * browser-smoke status from Vitest results.
 */

import { execSync } from 'child_process';

function fallbackResult(reason) {
  return {
    ok: false,
    apiOnly: false,
    strictBrowser: false,
    hasBrowserCreds: Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD),
    results: [],
    error: reason,
  };
}

export async function collectReleaseGate() {
  let stdout = '';

  try {
    stdout = execSync('node scripts/run-prod-gate.js --json', {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err) {
    stdout = err.stdout || '';
    if (!stdout) {
      return fallbackResult(err.message || 'Release gate failed before producing JSON output.');
    }
  }

  try {
    return JSON.parse(stdout);
  } catch {
    return fallbackResult('Could not parse release gate JSON output.');
  }
}
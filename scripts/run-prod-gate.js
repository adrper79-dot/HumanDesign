#!/usr/bin/env node

import { spawn } from 'child_process';
import { loadLocalEnv } from './load-local-env.js';

loadLocalEnv();

const args = new Set(process.argv.slice(2));

const apiOnly = args.has('--api-only');
const jsonOnly = args.has('--json');
const allowSkipBrowser = args.has('--allow-skip-browser');
const strictBrowser = args.has('--strict-browser') || !allowSkipBrowser;

const testBaseUrl = process.env.TEST_BASE_URL || 'https://selfprime.net';
const prodApi = process.env.PROD_API || 'https://prime-self-api.adrper79.workers.dev';
const hasBrowserCreds = Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);

const results = [];

function resolveCommand(command) {
  if (command === 'node') {
    return process.execPath;
  }

  if (process.platform === 'win32' && command === 'npx') {
    return 'npx.cmd';
  }

  return command;
}

function log(message) {
  if (!jsonOnly) {
    console.log(message);
  }
}

function runStep(name, command, commandArgs, extraEnv = {}) {
  return new Promise((resolve) => {
    log(`\n[prod-gate] ${name}`);

    const child = spawn(resolveCommand(command), commandArgs, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        TEST_BASE_URL: testBaseUrl,
        PROD_API: prodApi,
        ...extraEnv,
      },
      stdio: jsonOnly ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    if (jsonOnly) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on('close', (code) => {
      const ok = code === 0;
      results.push({ name, ok, code, stdout, stderr });
      if (!jsonOnly) {
        log(`[prod-gate] ${ok ? 'PASS' : 'FAIL'} ${name}`);
      }
      resolve(ok);
    });
  });
}

async function main() {
  log(`[prod-gate] Starting against ${testBaseUrl} and ${prodApi}`);

  const apiSteps = [
    ['worker verification', 'node', ['workers/verify-production.js']],
    ['public canary', 'node', ['workers/verify-canary.js']],
    ['money path canary', 'node', ['workers/verify-money-path.js']],
  ];

  let failed = false;
  for (const [name, command, commandArgs] of apiSteps) {
    const ok = await runStep(name, command, commandArgs);
    if (!ok) {
      failed = true;
    }
  }

  if (!apiOnly) {
    if (!hasBrowserCreds) {
      const message = 'Missing E2E_TEST_EMAIL/E2E_TEST_PASSWORD for browser smoke.';
      results.push({ name: 'browser smoke', ok: !strictBrowser, skipped: !strictBrowser, code: strictBrowser ? 1 : 0, stdout: '', stderr: message });
      if (strictBrowser) {
        failed = true;
        log(`[prod-gate] FAIL browser smoke: ${message}`);
      } else {
        log(`[prod-gate] SKIP browser smoke: ${message}`);
      }
    } else {
      const ok = await runStep(
        'browser smoke',
        'npx',
        ['playwright', 'test', 'tests/e2e/prod-smoke.spec.ts', '--project=chromium'],
        { PLAYWRIGHT_SKIP_WEBSERVER: '1' }
      );
      if (!ok) {
        failed = true;
      }
    }
  }

  if (jsonOnly) {
    console.log(JSON.stringify({
      ok: !failed,
      baseUrl: testBaseUrl,
      prodApi,
      apiOnly,
      strictBrowser,
      allowSkipBrowser,
      hasBrowserCreds,
      results,
    }, null, 2));
  }

  if (failed) {
    process.exit(1);
  }
}

main().catch((error) => {
  if (jsonOnly) {
    console.log(JSON.stringify({ ok: false, error: error.message, results }, null, 2));
  } else {
    console.error('[prod-gate] Fatal error:', error.message);
  }
  process.exit(1);
});
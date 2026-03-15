#!/usr/bin/env node
/*
  Assertive verification script for production endpoints.
  Uses global fetch available in Node 18+ or newer runtime.
  Usage: node workers/verify-production.js
*/
const BASE = process.env.PROD_API || 'https://prime-self-api.adrper79.workers.dev';

function fail(message) {
  throw new Error(message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function check(name, path, opts = {}, assertResponse) {
  const url = BASE + path;
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    const contentType = res.headers.get('content-type') || '';
    let body = text;

    if (contentType.includes('application/json')) {
      try {
        body = JSON.parse(text);
      } catch {
        fail(`${name}: expected JSON response but parsing failed`);
      }
    }

    await assertResponse({ res, body, text, contentType });
    console.log(`PASS ${name} -> ${res.status}`);
    return { ok: true, name, status: res.status };
  } catch (err) {
    console.error(`FAIL ${name} -> ${err.message}`);
    return { ok: false, name, error: err.message };
  }
}

async function main() {
  console.log('Verifying production endpoints against', BASE);

  const results = [];

  results.push(await check('health', '/api/health', {}, ({ res, body }) => {
    if (res.status !== 200) fail(`expected 200, got ${res.status}`);
    if (!isObject(body)) fail('expected JSON object');
    if (body.status !== 'ok') fail(`expected status=ok, got ${body.status}`);
    if (typeof body.version !== 'string' || !body.version) fail('missing version');
    if (typeof body.timestamp !== 'string' || !body.timestamp) fail('missing timestamp');
    if (!isObject(body.cache)) fail('missing cache object');
  }));

  results.push(await check('geocode', '/api/geocode?q=Tampa', {}, ({ res, body }) => {
    if (res.status !== 200) fail(`expected 200, got ${res.status}`);
    if (!isObject(body)) fail('expected JSON object');
    if (typeof body.lat !== 'number' || typeof body.lng !== 'number') fail('missing coordinates');
    if (typeof body.timezone !== 'string' || !body.timezone) fail('missing timezone');
    if (typeof body.displayName !== 'string' || !body.displayName) fail('missing displayName');
  }));

  results.push(await check(
    'register validation',
    '/api/auth/register',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    ({ res, body }) => {
      if (res.status !== 400) fail(`expected 400, got ${res.status}`);
      if (!isObject(body) || typeof body.error !== 'string') fail('missing validation error');
      if (!/email and password/i.test(body.error)) fail(`unexpected error message: ${body.error}`);
    }
  ));

  results.push(await check('forecast validation', '/api/transits/forecast', {}, ({ res, body }) => {
    if (res.status !== 400) fail(`expected 400, got ${res.status}`);
    if (!isObject(body) || typeof body.error !== 'string') fail('missing validation error');
    if (!/required params/i.test(body.error)) fail(`unexpected error message: ${body.error}`);
  }));

  const failed = results.filter(result => !result.ok);
  console.log(`Verification complete: ${results.length - failed.length}/${results.length} passed`);

  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error('Verification failed:', error.message);
  process.exit(1);
});

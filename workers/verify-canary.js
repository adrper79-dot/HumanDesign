#!/usr/bin/env node
/*
  Public canary verification for production frontend + API journeys.
  Usage: node workers/verify-canary.js
*/

const API_BASE = process.env.PROD_API || 'https://prime-self-api.adrper79.workers.dev';
const FRONTEND_BASE = process.env.FRONTEND_BASE || 'https://selfprime.net';

function fail(message) {
  throw new Error(message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function checkText(name, url, assertions) {
  try {
    const res = await fetch(url);
    const text = await res.text();
    const contentType = res.headers.get('content-type') || '';

    if (res.status !== 200) fail(`${name}: expected 200, got ${res.status}`);
    if (!contentType.includes('text/html')) fail(`${name}: expected text/html, got ${contentType}`);

    await assertions({ res, text, contentType });
    console.log(`PASS ${name} -> ${res.status}`);
    return { ok: true, name, status: res.status };
  } catch (err) {
    console.error(`FAIL ${name} -> ${err.message}`);
    return { ok: false, name, error: err.message };
  }
}

async function checkJson(name, path, options, assertions) {
  const url = API_BASE + path;
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    const contentType = res.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      fail(`${name}: expected application/json, got ${contentType}`);
    }

    let body;
    try {
      body = JSON.parse(text);
    } catch {
      fail(`${name}: response body was not valid JSON`);
    }

    await assertions({ res, body });
    console.log(`PASS ${name} -> ${res.status}`);
    return { ok: true, name, status: res.status };
  } catch (err) {
    console.error(`FAIL ${name} -> ${err.message}`);
    return { ok: false, name, error: err.message };
  }
}

async function main() {
  console.log('Running public canary against', FRONTEND_BASE, 'and', API_BASE);

  const results = [];

  results.push(await checkText('frontend home', `${FRONTEND_BASE}/`, ({ text }) => {
    if (!text.includes('Prime Self')) fail('missing Prime Self marker');
    if (!text.includes('manifest.json')) fail('missing PWA manifest link');
  }));

  results.push(await checkText('frontend pricing', `${FRONTEND_BASE}/pricing.html`, ({ text }) => {
    if (!text.includes('Pricing — Prime Self')) fail('missing pricing title');
    if (!text.includes('Plans for Every Journey')) fail('missing pricing hero copy');
  }));

  results.push(await checkText('frontend embed', `${FRONTEND_BASE}/embed.html`, ({ text }) => {
    if (!text.includes('calculatorForm')) fail('missing embed calculator form');
    if (!text.includes('Calculate My Chart')) fail('missing embed CTA');
  }));

  results.push(await checkJson('api health', '/api/health', {}, ({ res, body }) => {
    if (res.status !== 200) fail(`expected 200, got ${res.status}`);
    if (!isObject(body)) fail('expected JSON object');
    if (body.status !== 'ok') fail(`expected status=ok, got ${body.status}`);
    if (typeof body.version !== 'string' || !body.version) fail('missing version');
  }));

  results.push(await checkJson('api geocode', '/api/geocode?q=Tampa', {}, ({ res, body }) => {
    if (res.status !== 200) fail(`expected 200, got ${res.status}`);
    if (typeof body.lat !== 'number' || typeof body.lng !== 'number') fail('missing coordinates');
    if (typeof body.timezone !== 'string' || !body.timezone) fail('missing timezone');
  }));

  results.push(await checkJson(
    'api register validation',
    '/api/auth/register',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    ({ res, body }) => {
      if (res.status !== 400) fail(`expected 400, got ${res.status}`);
      if (!isObject(body) || typeof body.error !== 'string') fail('missing validation error');
      if (!/email and password/i.test(body.error)) fail(`unexpected error: ${body.error}`);
    }
  ));

  results.push(await checkJson(
    'api chart calculate',
    '/api/chart/calculate',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        birthDate: '1979-08-05',
        birthTime: '18:51',
        birthTimezone: 'America/New_York',
        lat: 27.9506,
        lng: -82.4572,
      }),
    },
    ({ res, body }) => {
      if (res.status !== 200) fail(`expected 200, got ${res.status}`);
      if (body.ok !== true) fail('expected ok=true');
      if (!isObject(body.data?.chart)) fail('missing chart object');
      if (typeof body.data.chart.type !== 'string' || !body.data.chart.type) fail('missing chart type');
      if (typeof body.data.chart.profile !== 'string' || !body.data.chart.profile) fail('missing chart profile');
    }
  ));

  const failed = results.filter(result => !result.ok);
  console.log(`Canary complete: ${results.length - failed.length}/${results.length} passed`);

  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error('Canary failed:', error.message);
  process.exit(1);
});
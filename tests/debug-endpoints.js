#!/usr/bin/env node
// Debug chart GET with proper hdChart extraction and timing
const API = 'https://prime-self-api.adrper79.workers.dev';
const ts = Date.now();

async function run() {
  await new Promise(r => setTimeout(r, 2000));
  const r1 = await fetch(API + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `chartget_${ts}@mailtest.dev`, password: 'TestPass123!' })
  });
  const d1 = await r1.json();
  const token = d1.accessToken;
  console.log('1. Register:', r1.status, 'uid:', d1.user?.id, 'token:', !!token);

  await new Promise(r => setTimeout(r, 2000));
  const rc = await fetch(API + '/api/chart/calculate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ birthDate: '1990-03-15', birthTime: '14:30', lat: 27.95, lng: -82.45, tz: 'America/New_York' })
  });
  const dc = await rc.json();
  console.log('2. Calculate:', rc.status, 'keys:', Object.keys(dc || {}).join(','));
  // The chart data is nested inside .data
  const hdChart = dc?.data?.hdChart || dc?.data?.chart || dc?.hdChart || dc?.chart;
  console.log('   hdChart found:', !!hdChart, 'data keys:', Object.keys(dc?.data || {}).join(','));

  await new Promise(r => setTimeout(r, 2000));
  const rs = await fetch(API + '/api/chart/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ birthDate: '1990-03-15', birthTime: '14:30', lat: 27.95, lng: -82.45, hdChart: hdChart || { test: 1 } })
  });
  const ds = await rs.json();
  console.log('3. Save:', rs.status, 'chartId:', ds?.chartId);

  if (ds?.chartId) {
    await new Promise(r => setTimeout(r, 2000));
    const rg = await fetch(API + '/api/chart/' + ds.chartId, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const ct = rg.headers.get('content-type') || '';
    if (ct.includes('json')) {
      const dg = await rg.json();
      console.log('4. GET chart:', rg.status, JSON.stringify(dg).slice(0, 300));
    } else {
      const text = await rg.text();
      console.log('4. GET chart:', rg.status, ct, '(html):', text.slice(0, 200));
    }
  }
}

run().catch(console.error);


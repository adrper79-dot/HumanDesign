/**
 * Prime Self – k6 Load Test
 *
 * Validates that the API handles 50 concurrent users without errors.
 *
 * Usage:
 *   k6 run tests/load-test.k6.js
 *   k6 run --env BASE_URL=https://prime-self-api.adrper79.workers.dev tests/load-test.k6.js
 *
 * Install k6: https://k6.io/docs/get-started/installation/
 *
 * Thresholds:
 *   - p95 chart latency < 3 s (calculation is synchronous, no LLM)
 *   - error rate < 1 %
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// ── Custom metrics ────────────────────────────────────────────
const chartLatency   = new Trend('chart_duration_ms',   true);
const errorRate      = new Rate('error_rate');

// ── Test configuration ────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // ramp-up
    { duration: '60s', target: 50 },  // hold at 50 concurrent users
    { duration: '30s', target: 0  },  // ramp-down
  ],
  thresholds: {
    chart_duration_ms:   ['p(95)<3000'],   // 3 s for chart calc
    error_rate:          ['rate<0.01'],    // < 1 % errors
    http_req_failed:     ['rate<0.01'],
  },
};

// ── Configuration ─────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'https://prime-self-api.adrper79.workers.dev';

// Sample birth data for load testing. Payloads must match the live handler contract.
const SAMPLE_BIRTHS = [
  { birthDate: '1969-06-12', birthTime: '12:00', birthTimezone: 'America/New_York', lat: 40.7128, lng: -74.0060 },
  { birthDate: '1980-03-22', birthTime: '08:30', birthTimezone: 'Europe/London', lat: 51.5072, lng: -0.1276 },
  { birthDate: '1975-11-05', birthTime: '15:45', birthTimezone: 'Asia/Tokyo', lat: 35.6764, lng: 139.6500 },
  { birthDate: '1990-07-19', birthTime: '06:00', birthTimezone: 'Australia/Sydney', lat: -33.8688, lng: 151.2093 },
  { birthDate: '1985-02-28', birthTime: '20:00', birthTimezone: 'Europe/Berlin', lat: 52.5200, lng: 13.4050 },
];

// ── Helper ────────────────────────────────────────────────────
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Virtual user scenario ─────────────────────────────────────
export default function () {
  const birth = pickRandom(SAMPLE_BIRTHS);
  const headers = { 'Content-Type': 'application/json' };

  // 1. Health check
  const health = http.get(`${BASE_URL}/api/health`, { tags: { name: 'health' } });
  const healthOk = check(health, {
    'health 200': r => r.status === 200,
    'health status ok': r => {
      try { return JSON.parse(r.body).status === 'ok'; } catch { return false; }
    },
  });
  errorRate.add(!healthOk);

  sleep(0.5);

  // 2. Chart calculation (synchronous — purely algorithmic, no LLM)
  const chartStart = Date.now();
  const chartRes = http.post(
    `${BASE_URL}/api/chart/calculate`,
    JSON.stringify(birth),
    { headers, tags: { name: 'chart' } }
  );
  chartLatency.add(Date.now() - chartStart);

  const chartOk = check(chartRes, {
    'chart 200': r => r.status === 200,
    'chart response ok': r => {
      try { return JSON.parse(r.body).ok === true; } catch { return false; }
    },
    'chart has data payload': r => {
      try { return !!JSON.parse(r.body).data; } catch { return false; }
    },
  });
  errorRate.add(!chartOk);

  sleep(Math.random() * 2 + 1); // 1–3 s think time between requests
}

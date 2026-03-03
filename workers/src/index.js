/**
 * Prime Self API — Cloudflare Worker Entry Point
 *
 * Routes:
 *   POST /api/chart/calculate          – Full chart calculation
 *   POST /api/profile/generate         – Prime Self Profile (LLM synthesis)
 *   GET  /api/transits/today           – Current transit positions
 *   GET  /api/transits/forecast        – Transit forecast
 *   POST /api/composite                – Relationship / composite chart
 *   POST /api/rectify                  – Birth-time sensitivity analysis
 *   POST /api/cluster/create           – Create a cluster
 *   POST /api/cluster/:id/join         – Add member to cluster
 *   GET  /api/cluster/:id              – Get cluster details
 *   POST /api/cluster/:id/synthesize   – Cluster intelligence synthesis
 *   POST /api/sms/webhook              – Telnyx inbound SMS webhook
 *   POST /api/sms/send-digest          – Trigger digest send
 *   POST /api/auth/register            – Create account, get JWT
 *   POST /api/auth/login               – Email-based login, get JWT
 *   POST /api/auth/refresh             – Refresh access token
 *   GET  /api/health                   – Health check
 *   POST /api/practitioner/register       – Register as practitioner
 *   GET  /api/practitioner/profile        – Get practitioner profile
 *   GET  /api/practitioner/clients        – List clients
 *   POST /api/practitioner/clients/add    – Add client by email
 *   GET  /api/practitioner/clients/:id    – Client detail (chart + profile)
 *   DELETE /api/practitioner/clients/:id – Remove client
 */

// Data injection for Workers runtime — MUST be first import
import './engine-compat.js';

import { handleCalculate } from './handlers/calculate.js';
import { handleProfile } from './handlers/profile.js';
import { handleTransits } from './handlers/transits.js';
import { handleForecast } from './handlers/forecast.js';
import { handleComposite } from './handlers/composite.js';
import { handleRectify } from './handlers/rectify.js';
import { handleCluster } from './handlers/cluster.js';
import { handleSMS } from './handlers/sms.js';
import { handleAuth } from './handlers/auth.js';
import { handlePdfExport } from './handlers/pdf.js';
import { handlePractitioner } from './handlers/practitioner.js';
import { corsHeaders, handleOptions } from './middleware/cors.js';
import { authenticate } from './middleware/auth.js';
import { rateLimit, addRateLimitHeaders } from './middleware/rateLimit.js';
import { runDailyTransitCron } from './cron.js';

// Routes that require authentication
const AUTH_ROUTES = new Set([
  '/api/profile/generate',
  '/api/composite',
  '/api/sms/send-digest'
]);

// Prefix-based auth routes (cluster endpoints, profile export, practitioner)
const AUTH_PREFIXES = ['/api/cluster/', '/api/profile/', '/api/practitioner/'];

// Public routes (no auth required)
const PUBLIC_ROUTES = new Set([
  '/api/chart/calculate',
  '/api/transits/today',
  '/api/transits/forecast',
  '/api/rectify',
  '/api/sms/webhook',
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/health'
]);

function requiresAuth(path) {
  if (AUTH_ROUTES.has(path)) return true;
  for (const prefix of AUTH_PREFIXES) {
    if (path.startsWith(prefix)) return true;
  }
  return false;
}

export default {
  /**
   * HTTP request handler.
   */
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Authentication check (protected routes)
      if (requiresAuth(path)) {
        const authResult = await authenticate(request, env);
        if (authResult) return addCorsHeaders(authResult);
      }

      // Rate limiting (all API routes)
      if (path.startsWith('/api/')) {
        const rlResult = await rateLimit(request, env);
        if (rlResult) return addCorsHeaders(rlResult);
      }

      let response;

      // ─── Route matching ────────────────────────────────
      if (path === '/api/chart/calculate' && request.method === 'POST') {
        response = await handleCalculate(request, env);

      } else if (path === '/api/profile/generate' && request.method === 'POST') {
        response = await handleProfile(request, env);

      } else if (path === '/api/transits/today' && request.method === 'GET') {
        response = await handleTransits(request, env);

      } else if (path.startsWith('/api/transits/forecast') && request.method === 'GET') {
        response = await handleForecast(request, env);

      } else if (path === '/api/composite' && request.method === 'POST') {
        response = await handleComposite(request, env);

      } else if (path === '/api/rectify' && request.method === 'POST') {
        response = await handleRectify(request, env);

      } else if (path.startsWith('/api/cluster/')) {
        response = await handleCluster(request, env, path);

      } else if (path.startsWith('/api/sms/')) {
        response = await handleSMS(request, env, path);

      } else if (path.startsWith('/api/auth/')) {
        response = await handleAuth(request, env, path);

      } else if (path.startsWith('/api/practitioner/')) {
        const subpath = path.replace('/api/practitioner', '') || '/';
        response = await handlePractitioner(request, env, subpath);

      } else if (path.match(/^\/api\/profile\/[^/]+\/pdf$/)) {
        const profileId = path.split('/')[3];
        response = await handlePdfExport(request, env, profileId);

      } else if (path === '/api/health') {
        response = Response.json({
          status: 'ok',
          version: '0.3.0',
          endpoints: 23
        });

      } else {
        response = Response.json(
          { error: 'Not Found', path },
          { status: 404 }
        );
      }

      // Add rate limit + CORS headers
      response = addRateLimitHeaders(response, request);
      return addCorsHeaders(response);

    } catch (err) {
      console.error('Worker error:', err);
      return Response.json(
        { error: 'Internal Server Error', message: err.message },
        { status: 500, headers: corsHeaders }
      );
    }
  },

  /**
   * Scheduled cron handler — daily transit snapshot + digest delivery.
   */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDailyTransitCron(env));
  }
};

function addCorsHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    headers
  });
}

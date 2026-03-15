/**
 * Social OAuth Handler — Google, Apple
 *
 * Flow:
 *   1. GET /api/auth/oauth/:provider          → generate state, redirect to provider
 *   2. GET /api/auth/oauth/:provider/callback → exchange code, upsert user, issue JWT, redirect to app
 *      (Apple uses POST for its callback — both are handled)
 *
 * After success, browser is redirected to:
 *   ${FRONTEND_URL}/?oauth=success&token=ACCESS_JWT
 * The refresh token is set as an HttpOnly cookie (ps_refresh).
 *
 * Required Worker secrets per provider:
 *
 *   Google:
 *     GOOGLE_CLIENT_ID      — from Google Cloud Console
 *     GOOGLE_CLIENT_SECRET  — from Google Cloud Console
 *
 *   Apple:
 *     APPLE_CLIENT_ID       — your Services ID (e.g. net.selfprime.web)
 *     APPLE_TEAM_ID         — 10-char Apple Developer team ID
 *     APPLE_KEY_ID          — key ID from the .p8 file name
 *     APPLE_PRIVATE_KEY     — full contents of the .p8 file (PEM, newlines as \n)
 *
 *   Shared:
 *     JWT_SECRET            — existing secret (already set)
 *     NEON_CONNECTION_STRING— existing secret (already set)
 *     FRONTEND_URL          — existing secret (e.g. https://selfprime.net)
 */

import { signJWT, sha256, jwtClaims } from '../lib/jwt.js';
import { createQueryFn, QUERIES } from '../db/queries.js';
import { sendWelcomeEmail1 } from '../lib/email.js';

const ACCESS_TOKEN_TTL  = 60 * 15;             // 15 minutes (matches auth.js)
const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30;  // 30 days

function buildRefreshCookie(refreshToken) {
  return `ps_refresh=${refreshToken}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${REFRESH_TOKEN_TTL}`;
}
const STATE_TTL_MS      = 10 * 60 * 1000;      // 10 minutes

// ─── Router ──────────────────────────────────────────────────

export async function handleOAuthSocial(request, env, subpath) {
  const method = request.method;

  // GET /api/auth/oauth/google
  // GET /api/auth/oauth/apple
  const initiateMatch = subpath.match(/^\/(google|apple)$/);
  if (initiateMatch && method === 'GET') {
    return initiateOAuth(initiateMatch[1], env);
  }

  // GET /api/auth/oauth/google/callback
  // GET|POST /api/auth/oauth/apple/callback  (Apple POSTs)
  const callbackMatch = subpath.match(/^\/(google|apple)\/callback$/);
  if (callbackMatch && (method === 'GET' || method === 'POST')) {
    return handleCallback(callbackMatch[1], request, env);
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

// ─── Step 1: Initiate — redirect to provider ─────────────────

function initiateOAuth(provider, env) {
  const state = crypto.randomUUID();
  const workerBase = env.BASE_URL || 'https://prime-self-api.adrper79.workers.dev';
  const redirectUri = `${workerBase}/api/auth/oauth/${provider}/callback`;

  // Store state in KV (10 min TTL) — lightweight, no DB round-trip needed
  // Falls back to in-memory check if KV unavailable (single-instance, not suitable for prod scale)
  // For production, use QUERIES.insertOAuthStatePublic to store in DB
  let authUrl;

  switch (provider) {
    case 'google': {
      if (!env.GOOGLE_CLIENT_ID) return configError('GOOGLE_CLIENT_ID');
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'openid email profile');
      url.searchParams.set('state', state);
      url.searchParams.set('access_type', 'online');
      url.searchParams.set('prompt', 'select_account');
      authUrl = url.toString();
      break;
    }
    case 'apple': {
      if (!env.APPLE_CLIENT_ID) return configError('APPLE_CLIENT_ID');
      const url = new URL('https://appleid.apple.com/auth/authorize');
      url.searchParams.set('client_id', env.APPLE_CLIENT_ID);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'name email');
      url.searchParams.set('response_mode', 'form_post'); // Apple POSTs the callback
      url.searchParams.set('state', state);
      authUrl = url.toString();
      break;
    }
    default:
      return Response.json({ error: 'Unsupported provider' }, { status: 400 });
  }

  // Store state in KV with 10-min expiry for CSRF protection
  const storeState = env.CACHE
    ? env.CACHE.put(`oauth_state:${state}`, provider, { expirationTtl: 600 })
    : Promise.resolve();

  // Return redirect — browser follows it
  return storeState.then(() => Response.redirect(authUrl, 302)).catch(() => Response.redirect(authUrl, 302));
}

// ─── Step 2: Callback — exchange code, issue JWT ─────────────

async function handleCallback(provider, request, env) {
  const workerBase = env.BASE_URL || 'https://prime-self-api.adrper79.workers.dev';
  const frontendUrl = env.FRONTEND_URL || 'https://selfprime.net';
  const redirectUri = `${workerBase}/api/auth/oauth/${provider}/callback`;

  try {
    // Parse params from GET query string or POST form body
    let code, state, firstName, lastName;
    if (request.method === 'POST') {
      const form = await request.formData();
      code      = form.get('code');
      state     = form.get('state');
      // Apple sends name only on first authorization — grab it
      const userJson = form.get('user');
      if (userJson) {
        try {
          const u = JSON.parse(userJson);
          firstName = u?.name?.firstName;
          lastName  = u?.name?.lastName;
        } catch { /* ignore */ }
      }
    } else {
      const url = new URL(request.url);
      code  = url.searchParams.get('code');
      state = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      if (error) return oauthErrorRedirect(frontendUrl, `Provider error: ${error}`);
    }

    if (!code || !state) return oauthErrorRedirect(frontendUrl, 'Missing code or state');

    // CISO-006: Verify CSRF state token — fail closed if state cannot be verified.
    // If KV is configured, the state MUST be present and match; missing state
    // (e.g. forged callback or expired token) is treated as an attack.
    if (env.CACHE) {
      const storedProvider = await env.CACHE.get(`oauth_state:${state}`).catch(() => null);
      if (!storedProvider) {
        return oauthErrorRedirect(frontendUrl, 'Invalid or expired OAuth state — please try again');
      }
      if (storedProvider !== provider) {
        return oauthErrorRedirect(frontendUrl, 'State mismatch');
      }
      env.CACHE.delete(`oauth_state:${state}`).catch(e => console.error('[oauth] state cleanup failed:', e.message));
    }
    // If KV is not configured (local dev only) we skip the state check.
    // In production, CACHE must always be bound.

    // Exchange code for user info
    let providerUserId, providerEmail, displayName, avatarUrl;

    switch (provider) {
      case 'google': {
        const result = await exchangeGoogle(code, redirectUri, env);
        providerUserId = result.sub;
        providerEmail  = result.email;
        displayName    = result.name;
        avatarUrl      = result.picture;
        break;
      }
      case 'apple': {
        const result = await exchangeApple(code, redirectUri, env);
        providerUserId = result.sub;
        providerEmail  = result.email;
        // Apple only sends name on first auth
        displayName    = [firstName, lastName].filter(Boolean).join(' ') || result.email?.split('@')[0] || 'Apple User';
        break;
      }
      default:
        return oauthErrorRedirect(frontendUrl, 'Unsupported provider');
    }

    if (!providerUserId) return oauthErrorRedirect(frontendUrl, 'Could not retrieve user ID from provider');

    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Look up existing social account
    const existing = await query(QUERIES.getSocialAccount, [provider, providerUserId]);
    let userId, userEmail, isNewUser = false;

    if (existing.rows?.length) {
      // Returning user — refresh display name / avatar (ON CONFLICT DO UPDATE handles this)
      userId    = existing.rows[0].user_id;
      userEmail = existing.rows[0].email;
      await query(QUERIES.insertSocialAccount, [
        userId, provider, providerUserId,
        providerEmail?.toLowerCase() || null,
        displayName || null,
        avatarUrl || null
      ]).catch(err => console.error('[OAuth] Social account upsert failed:', err.message)); // best-effort update
    } else {
      // No social account found — check by email to link existing account
      let userRow = null;
      if (providerEmail) {
        const byEmail = await query(QUERIES.getUserByEmail, [providerEmail.toLowerCase()]);
        if (byEmail.rows?.length) userRow = byEmail.rows[0];
      }

      if (!userRow) {
        // New user — create account without password (OAuth-only)
        const created = await query(QUERIES.createUser, [
          providerEmail?.toLowerCase() || null,
          null,   // phone
          null,   // birth_date
          null,   // birth_time
          null,   // birth_tz
          null,   // birth_lat
          null    // birth_lng
        ]);
        userRow   = created.rows[0];
        isNewUser = true;
      }

      userId    = userRow.id;
      userEmail = userRow.email;

      // Link social account to this user
      await query(QUERIES.insertSocialAccount, [
        userId, provider, providerUserId,
        providerEmail?.toLowerCase() || null,
        displayName || null,
        avatarUrl || null
      ]);
    }

    // Issue JWT pair (same logic as email login)
    const accessToken = await signJWT(
      { sub: userId, email: userEmail, type: 'access' },
      env.JWT_SECRET,
      ACCESS_TOKEN_TTL,
      jwtClaims(env)
    );

    const familyId    = crypto.randomUUID();
    const refreshToken = await signJWT(
      { sub: userId, type: 'refresh', fid: familyId },
      env.JWT_SECRET,
      REFRESH_TOKEN_TTL,
      jwtClaims(env)
    );

    const tokenHash    = await sha256(refreshToken);
    const expiresEpoch = Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL;
    await query(QUERIES.insertRefreshToken, [userId, tokenHash, familyId, expiresEpoch]);

    // Send welcome email to new users (fire-and-forget)
    if (isNewUser && providerEmail && env.RESEND_API_KEY) {
      sendWelcomeEmail1(
        providerEmail.toLowerCase(),
        displayName || providerEmail.split('@')[0],
        env.RESEND_API_KEY,
        env.FROM_EMAIL || 'Prime Self <hello@primeself.app>'
      ).catch(err => console.error('[OAuth] Welcome email failed:', err.message));
    }

    // P2-SEC-011: Authorization code flow — never put tokens in URL.
    // Store tokens under a random one-time code in KV (60s TTL).
    // Frontend exchanges the code via POST /api/auth/oauth/exchange.
    const oauthCode = crypto.randomUUID();
    const codePayload = JSON.stringify({
      accessToken,
      refreshToken,
      isNewUser,
      userId
    });

    if (env.CACHE) {
      await env.CACHE.put(`oauth_code:${oauthCode}`, codePayload, { expirationTtl: 60 });
    } else {
      console.error('[oauth] KV CACHE unavailable — cannot store auth code');
      return oauthErrorRedirect(frontendUrl, 'Service temporarily unavailable — please try again');
    }

    const dest = new URL(`${frontendUrl}/`);
    dest.searchParams.set('oauth', 'success');
    dest.searchParams.set('code', oauthCode);
    if (isNewUser) dest.searchParams.set('new_user', '1');
    return Response.redirect(dest.toString(), 302);

  } catch (err) {
    console.error(`[oauth:${provider}] callback error:`, err.message);
    return oauthErrorRedirect(frontendUrl, 'Authentication failed — please try again');
  }
}

// ─── Google token exchange ────────────────────────────────────

async function exchangeGoogle(code, redirectUri, env) {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code'
    })
  });
  const tokens = await tokenRes.json();
  if (tokens.error) throw new Error(`Google token error: ${tokens.error_description || tokens.error}`);

  // Decode the id_token (JWT) to get user info — no extra round-trip needed
  const idToken  = tokens.id_token;
  const [, payload] = idToken.split('.');
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
}

// ─── Apple token exchange ─────────────────────────────────────

async function exchangeApple(code, redirectUri, env) {
  const clientSecret = await buildAppleClientSecret(env);

  const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     env.APPLE_CLIENT_ID,
      client_secret: clientSecret,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code'
    })
  });
  const tokens = await tokenRes.json();
  if (tokens.error) throw new Error(`Apple token error: ${tokens.error_description || tokens.error}`);

  // Decode Apple's id_token
  const [, payload] = tokens.id_token.split('.');
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
}

/**
 * Build Apple client_secret — a short-lived ES256 JWT signed with Apple's private key.
 * Apple requires this instead of a static client_secret.
 * https://developer.apple.com/documentation/sign_in_with_apple/generate_and_validate_tokens
 */
async function buildAppleClientSecret(env) {
  if (!env.APPLE_TEAM_ID || !env.APPLE_KEY_ID || !env.APPLE_CLIENT_ID || !env.APPLE_PRIVATE_KEY) {
    throw new Error('Apple OAuth secrets not configured (APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_CLIENT_ID, APPLE_PRIVATE_KEY)');
  }

  const now = Math.floor(Date.now() / 1000);
  const header  = { alg: 'ES256', kid: env.APPLE_KEY_ID };
  const payload = {
    iss: env.APPLE_TEAM_ID,
    iat: now,
    exp: now + 60 * 60, // 1 hour
    aud: 'https://appleid.apple.com',
    sub: env.APPLE_CLIENT_ID
  };

  const encode = obj => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signingInput = `${encode(header)}.${encode(payload)}`;

  // Import Apple's EC private key (.p8 file contents — PEM format)
  const pemKey = env.APPLE_PRIVATE_KEY
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const keyDer = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyDer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const sigBytes = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${signingInput}.${sigB64}`;
}

// ─── P2-SEC-011: Exchange one-time code for tokens ───────────

export async function handleOAuthExchange(request, env) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { code } = body;
  if (!code || typeof code !== 'string') {
    return Response.json({ error: 'Missing authorization code' }, { status: 400 });
  }

  if (!env.CACHE) {
    return Response.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }

  // Retrieve and immediately delete (one-time use)
  const kvKey = `oauth_code:${code}`;
  const raw = await env.CACHE.get(kvKey);
  if (!raw) {
    return Response.json({ error: 'Invalid or expired authorization code' }, { status: 400 });
  }
  // Delete immediately to prevent replay
  await env.CACHE.delete(kvKey);

  let payload;
  try { payload = JSON.parse(raw); } catch {
    return Response.json({ error: 'Corrupted authorization data' }, { status: 500 });
  }

  const { accessToken, refreshToken, isNewUser } = payload;

  // Return tokens securely — refresh token as HttpOnly cookie, access token in response body
  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', buildRefreshCookie(refreshToken));

  return new Response(JSON.stringify({
    ok: true,
    token: accessToken,
    new_user: !!isNewUser
  }), { status: 200, headers });
}

// ─── Helpers ─────────────────────────────────────────────────

function configError(secret) {
  console.error(`[oauth] Missing required secret: ${secret}`);
  return Response.json({ error: `OAuth not configured — missing ${secret}` }, { status: 503 });
}

function oauthErrorRedirect(frontendUrl, message) {
  const dest = new URL(`${frontendUrl}/`);
  dest.searchParams.set('oauth', 'error');
  dest.searchParams.set('msg', message);
  return Response.redirect(dest.toString(), 302);
}

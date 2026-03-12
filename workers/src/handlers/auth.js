/**
 * Auth Endpoints
 *
 *   POST /api/auth/register   – Create account, get JWT pair
 *   POST /api/auth/login      – Email-based login, get JWT pair
 *   POST /api/auth/refresh    – Rotate refresh token, get new JWT pair
 *   POST /api/auth/logout     – Revoke all refresh tokens for user
 *   GET  /api/auth/me         – Get current user info
 *
 * Uses HS256 JWTs with standard iss/aud claims (see lib/jwt.js).
 * Refresh tokens are stored (hashed) in the refresh_tokens table
 * and rotated on every use.  Re-use of a revoked token triggers
 * automatic revocation of the entire token family (theft detection).
 *
 * Passwords are hashed with PBKDF2 via Web Crypto API.
 */

import { signJWT, verifyHS256, sha256 } from '../lib/jwt.js';
import { sendWelcomeEmail1, sendPasswordResetEmail } from '../lib/email.js';

import { createQueryFn, QUERIES } from '../db/queries.js';

// JWT expiry durations
// Access token is short-lived so that a stolen in-memory token has a small
// exposure window.  The refresh token (stored in HttpOnly cookie) is long-lived.
const ACCESS_TOKEN_TTL  = 60 * 15;           // 15 minutes
const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30; // 30 days

/**
 * Build Set-Cookie header values for the token pair.
 * Both cookies are HttpOnly and Secure.  SameSite=None is required because
 * the API origin differs from the frontend origin.
 * CSRF protection is maintained via the short-lived access token sent in
 * the Authorization header — cross-origin forms cannot forge that header.
 */
function buildRefreshCookie(refreshToken) {
  return `ps_refresh=${refreshToken}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${REFRESH_TOKEN_TTL}`;
}

function clearRefreshCookie() {
  return 'ps_refresh=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

/**
 * Read the ps_refresh cookie value from the Cookie request header.
 * Returns null if absent.
 */
function getRefreshCookie(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)ps_refresh=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// ─── Route Dispatcher ────────────────────────────────────────

export async function handleAuth(request, env, path) {
  // Known auth paths
  const knownPaths = ['/api/auth/register', '/api/auth/login', '/api/auth/refresh', '/api/auth/logout', '/api/auth/me', '/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/account', '/api/auth/export'];
  
  // GET requests
  if (request.method === 'GET') {
    if (path === '/api/auth/me') return handleGetMe(request, env);
    if (path === '/api/auth/export') return handleExportData(request, env);
    // Known path but wrong method
    if (knownPaths.includes(path)) {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // DELETE requests
  if (request.method === 'DELETE') {
    if (path === '/api/auth/account') return handleDeleteAccount(request, env);
    if (knownPaths.includes(path)) {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // POST requests
  if (request.method === 'POST') {
    if (path === '/api/auth/register') return handleRegister(request, env);
    if (path === '/api/auth/login') return handleLogin(request, env);
    if (path === '/api/auth/refresh') return handleRefresh(request, env);
    if (path === '/api/auth/logout') return handleLogout(request, env);
    if (path === '/api/auth/forgot-password') return handleForgotPassword(request, env);
    if (path === '/api/auth/reset-password') return handleResetPassword(request, env);
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // Other methods
  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}

// ─── Get Current User ────────────────────────────────────────

/**
 * GET /api/auth/me
 * Returns the current authenticated user's information.
 * Requires authentication (middleware sets request._user).
 */
async function handleGetMe(request, env) {
  const userId = request._user?.sub;
  
  if (!userId) {
    return Response.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const result = await query(QUERIES.getUserById, [userId]);

  if (!result.rows || result.rows.length === 0) {
    return Response.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  const user = result.rows[0];

  // Remove sensitive fields
  delete user.password_hash;

  return Response.json({
    ok: true,
    user
  });
}

// ─── Register ────────────────────────────────────────────────

async function handleRegister(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }
  
  const { email, password, phone, birthDate, birthTime, birthTimezone, lat, lng } = body;

  if (!email || !password) {
    return Response.json(
      { error: 'Email and password are required' },
      { status: 400 }
    );
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return Response.json(
      { error: 'Invalid email format' },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return Response.json(
      { error: 'Password must be at least 8 characters' },
      { status: 400 }
    );
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Check if user already exists
    const existing = await query(QUERIES.getUserByEmail, [email.toLowerCase()]);
    if (existing.rows && existing.rows.length > 0) {
      return Response.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const result = await query(QUERIES.createUserWithPassword, [
      email.toLowerCase(),
      phone || null,
      passwordHash,
      birthDate || null,
      birthTime || null,
      birthTimezone || null,
      lat ? parseFloat(lat) : null,
      lng ? parseFloat(lng) : null
    ]);

    const userId = result.rows?.[0]?.id;
    if (!userId) {
      return Response.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    // Issue tokens
    const accessToken = await signJWT(
      { sub: userId, email: email.toLowerCase(), type: 'access' },
      env.JWT_SECRET,
      ACCESS_TOKEN_TTL
    );

    const familyId = crypto.randomUUID();
    const refreshToken = await signJWT(
      { sub: userId, type: 'refresh', fid: familyId },
      env.JWT_SECRET,
      REFRESH_TOKEN_TTL
    );

    // Store hashed refresh token in DB
    const tokenHash = await sha256(refreshToken);
    const expiresAtEpoch = Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL;
    await query(QUERIES.insertRefreshToken, [userId, tokenHash, familyId, expiresAtEpoch]);

    // Send welcome email (BL-ENG-007)
    // Fire and forget - don't block registration on email send
    if (env.RESEND_API_KEY) {
      sendWelcomeEmail1(
        email.toLowerCase(),
        email.split('@')[0], // Use email prefix as name fallback
        env.RESEND_API_KEY,
        env.FROM_EMAIL || 'Prime Self <hello@primeself.app>'
      ).catch(err => {
        console.error('Failed to send welcome email:', err);
        // Don't fail registration if email fails
      });
    }

    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append('Set-Cookie', buildRefreshCookie(refreshToken));

    return new Response(JSON.stringify({
      ok: true,
      user: { id: userId, email: email.toLowerCase() },
      accessToken,
      expiresIn: ACCESS_TOKEN_TTL
    }), { status: 201, headers });
  } catch (err) {
    console.error('[register] Error:', err.message);
    return Response.json({ error: 'Registration failed' }, { status: 500 });
  }
}

// ─── Login ───────────────────────────────────────────────────

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60; // 15 minutes in seconds

async function handleLogin(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }
  
  const { email, password } = body;

  if (!email || !password) {
    return Response.json(
      { error: 'Email and password are required' },
      { status: 400 }
    );
  }

  // Brute force protection via KV (COND-2)
  const lockoutKey = `login_attempts:${email.toLowerCase()}`;
  if (env.CACHE) {
    const attemptsRaw = await env.CACHE.get(lockoutKey);
    if (attemptsRaw) {
      const attempts = parseInt(attemptsRaw, 10);
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        return Response.json(
          { error: 'Too many failed login attempts. Please try again in 15 minutes, or reset your password.' },
          { status: 429, headers: { 'Retry-After': String(LOCKOUT_DURATION) } }
        );
      }
    }
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    const result = await query(QUERIES.getUserByEmail, [email.toLowerCase()]);
    const user = result.rows?.[0];

    if (!user) {
      // Track failed attempt
      if (env.CACHE) {
        const current = parseInt(await env.CACHE.get(lockoutKey) || '0', 10);
        await env.CACHE.put(lockoutKey, String(current + 1), { expirationTtl: LOCKOUT_DURATION });
      }
      return Response.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      // Track failed attempt
      if (env.CACHE) {
        const current = parseInt(await env.CACHE.get(lockoutKey) || '0', 10);
        await env.CACHE.put(lockoutKey, String(current + 1), { expirationTtl: LOCKOUT_DURATION });
      }
      return Response.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Successful login — clear failed attempts
    if (env.CACHE) {
      await env.CACHE.delete(lockoutKey);
    }

    // Issue tokens
    const accessToken = await signJWT(
      { sub: user.id, email: user.email, type: 'access' },
      env.JWT_SECRET,
      ACCESS_TOKEN_TTL
    );

    const familyId = crypto.randomUUID();
    const refreshToken = await signJWT(
      { sub: user.id, type: 'refresh', fid: familyId },
      env.JWT_SECRET,
      REFRESH_TOKEN_TTL
    );

    // Store hashed refresh token in DB
    const tokenHash = await sha256(refreshToken);
    const expiresAtEpoch = Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL;
    await query(QUERIES.insertRefreshToken, [user.id, tokenHash, familyId, expiresAtEpoch]);

    // BL-FIX: Update last_login_at for re-engagement tracking and cron accuracy
    await query(QUERIES.updateLastLogin, [user.id]).catch(err => {
      console.error('[auth] Failed to update last_login_at:', err.message);
    });

    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append('Set-Cookie', buildRefreshCookie(refreshToken));

    return new Response(JSON.stringify({
      ok: true,
      user: { id: user.id, email: user.email },
      accessToken,
      expiresIn: ACCESS_TOKEN_TTL
    }), { headers });
  } catch (err) {
    console.error('[login] Error:', err.message);
    return Response.json({ error: 'Login failed' }, { status: 500 });
  }
}

// ─── Refresh Token (with rotation & theft detection) ─────────

async function handleRefresh(request, env) {
  // Prefer the HttpOnly cookie; fall back to request body for backward compat
  let refreshToken = getRefreshCookie(request);

  if (!refreshToken) {
    // Body fallback (clients that haven't migrated yet)
    let body;
    try {
      body = await request.json();
    } catch {
      // Empty / non-JSON body is fine — just means no body token either
    }
    refreshToken = body?.refreshToken;
  }

  if (!refreshToken) {
    return Response.json(
      { error: 'Refresh token is required' },
      { status: 400 }
    );
  }

  // Verify JWT signature & standard claims (iss, aud, exp)
  const payload = await verifyHS256(refreshToken, env.JWT_SECRET);
  if (!payload || payload.type !== 'refresh') {
    return Response.json(
      { error: 'Invalid refresh token' },
      { status: 401 }
    );
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const tokenHash = await sha256(refreshToken);

  // Look up hashed token in DB
  const stored = await query(QUERIES.getRefreshTokenByHash, [tokenHash]);
  const row = stored.rows?.[0];

  if (!row) {
    // Token not found — may be a replay of a previously rotated token.
    // Revoke entire family as a precaution (theft detection).
    if (payload.fid) {
      await query(QUERIES.revokeRefreshTokenFamily, [payload.fid]);
    }
    return Response.json(
      { error: 'Refresh token not recognised — all sessions revoked' },
      { status: 401 }
    );
  }

  if (row.revoked_at) {
    // Already revoked — possible token theft. Revoke entire family.
    await query(QUERIES.revokeRefreshTokenFamily, [row.family_id]);
    return Response.json(
      { error: 'Refresh token reuse detected — all sessions revoked' },
      { status: 401 }
    );
  }

  // Revoke the current token (one-time-use)
  await query(QUERIES.revokeRefreshToken, [row.id]);

  // Look up user
  const result = await query(QUERIES.getUserById, [payload.sub]);
  const user = result.rows?.[0];

  if (!user) {
    return Response.json(
      { error: 'User not found' },
      { status: 401 }
    );
  }

  // Issue new token pair — same family
  const accessToken = await signJWT(
    { sub: user.id, email: user.email, type: 'access' },
    env.JWT_SECRET,
    ACCESS_TOKEN_TTL
  );

  const newRefreshToken = await signJWT(
    { sub: user.id, type: 'refresh', fid: row.family_id },
    env.JWT_SECRET,
    REFRESH_TOKEN_TTL
  );

  // Store new refresh token
  const newHash = await sha256(newRefreshToken);
  const expiresAtEpoch = Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL;
  await query(QUERIES.insertRefreshToken, [user.id, newHash, row.family_id, expiresAtEpoch]);

  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', buildRefreshCookie(newRefreshToken));

  return new Response(JSON.stringify({
    ok: true,
    accessToken,
    expiresIn: ACCESS_TOKEN_TTL
  }), { headers });
}

// ─── Logout (Revoke All Tokens) ─────────────────────────────

async function handleLogout(request, env) {
  const userId = request._user?.sub;

  if (!userId) {
    return Response.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    await query(QUERIES.revokeAllUserRefreshTokens, [userId]);
  } catch (err) {
    console.error('[logout] DB error (non-fatal):', err.message);
    // Still clear the cookie even if DB revoke fails
  }

  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', clearRefreshCookie());

  return new Response(JSON.stringify({ ok: true, message: 'All sessions revoked' }), { headers });
}

// ─── Password Hashing (PBKDF2 via Web Crypto) ───────────────

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  // Store as: salt:hash (both base64)
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return `${saltB64}:${hashB64}`;
}

async function verifyPassword(password, stored) {
  const [saltB64, expectedHashB64] = stored.split(':');
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  
  // Use constant-time comparison to prevent timing attacks
  const hashBytes = encoder.encode(hashB64);
  const expectedBytes = encoder.encode(expectedHashB64);
  
  // If lengths differ, still compare to avoid timing leak
  if (hashBytes.length !== expectedBytes.length) {
    return false;
  }
  
  // Constant-time byte-by-byte comparison
  let result = 0;
  for (let i = 0; i < hashBytes.length; i++) {
    result |= hashBytes[i] ^ expectedBytes[i];
  }
  
  return result === 0;
}

// ─── Forgot Password ─────────────────────────────────────────

const PASSWORD_RESET_TTL = 60 * 60; // 1 hour

/**
 * POST /api/auth/forgot-password
 * Sends a password reset email. Always returns 200 to prevent email enumeration.
 */
async function handleForgotPassword(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { email } = body;
  if (!email) {
    return Response.json({ error: 'Email is required' }, { status: 400 });
  }

  // Always respond with success to prevent email enumeration
  const successResponse = Response.json({
    ok: true,
    message: 'If an account with that email exists, a password reset link has been sent.'
  });

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const result = await query(QUERIES.getUserByEmail, [email.toLowerCase()]);
    const user = result.rows?.[0];

    if (!user) return successResponse;

    // Invalidate any existing reset tokens for this user
    await query(QUERIES.invalidatePasswordResetTokens, [user.id]);

    // Generate a cryptographically random token
    const rawToken = crypto.randomUUID() + '-' + crypto.randomUUID();
    const tokenHash = await sha256(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL * 1000).toISOString();

    await query(QUERIES.createPasswordResetToken, [user.id, tokenHash, expiresAt]);

    // Build reset URL
    const frontendUrl = env.FRONTEND_URL || 'https://selfprime.net';
    const resetUrl = `${frontendUrl}/?action=reset-password&token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email.toLowerCase())}`;

    // Send email (fire and forget — don't block response)
    if (env.RESEND_API_KEY) {
      sendPasswordResetEmail(
        email.toLowerCase(),
        resetUrl,
        env.RESEND_API_KEY,
        env.FROM_EMAIL || 'Prime Self <hello@primeself.app>'
      ).catch(err => {
        console.error('Failed to send password reset email:', err);
      });
    }
  } catch (err) {
    // Log but always return success — prevents email enumeration and masks DB errors
    console.error('[forgot-password] Error:', err.message);
  }

  return successResponse;
}

/**
 * POST /api/auth/reset-password
 * Validates token and updates password.
 */
async function handleResetPassword(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { token, password } = body;

  if (!token || !password) {
    return Response.json({ error: 'Token and new password are required' }, { status: 400 });
  }

  if (password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const tokenHash = await sha256(token);

  // Token lookup in its own try/catch: a DB failure here (e.g. migration not
  // applied) should return the same 400 as "token not found" — never a 500.
  let resetRow;
  try {
    const result = await query(QUERIES.getPasswordResetToken, [tokenHash]);
    resetRow = result.rows?.[0];
  } catch (err) {
    console.error('[reset-password] DB error on token lookup:', err.message);
    return Response.json(
      { error: 'Invalid or expired reset token. Please request a new one.' },
      { status: 400 }
    );
  }

  if (!resetRow) {
    return Response.json(
      { error: 'Invalid or expired reset token. Please request a new one.' },
      { status: 400 }
    );
  }

  try {
    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update password
    await query(QUERIES.updatePasswordHash, [resetRow.user_id, passwordHash]);

    // Mark token as used
    await query(QUERIES.markPasswordResetUsed, [resetRow.id]);

    // Revoke all refresh tokens (force re-login everywhere)
    await query(QUERIES.revokeAllUserRefreshTokens, [resetRow.user_id]);

    return Response.json({
      ok: true,
      message: 'Password has been reset successfully. Please sign in with your new password.'
    });
  } catch (err) {
    console.error('[reset-password] Error:', err.message);
    return Response.json({ error: 'Password reset failed. Please try again.' }, { status: 500 });
  }
}

// ─── Account Deletion ────────────────────────────────────────

async function handleDeleteAccount(request, env) {
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { password } = body;
  if (!password) {
    return Response.json({ error: 'Password is required to confirm account deletion' }, { status: 400 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  // Verify the user exists and password is correct
  const result = await query(QUERIES.getUserById, [userId]);
  const user = result.rows?.[0];
  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return Response.json({ error: 'Incorrect password' }, { status: 403 });
  }

  // Delete user and all associated data (cascading)
  await query(QUERIES.deleteUserAccount, [userId]);

  return Response.json({ ok: true, message: 'Your account and all associated data have been permanently deleted.' });
}

// ─── GDPR Data Export ────────────────────────────────────────

async function handleExportData(request, env) {
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  const [userData, charts, profiles, checkins, diary, subscription, alerts, sms] = await Promise.all([
    query(QUERIES.exportUserData, [userId]),
    query(QUERIES.exportUserCharts, [userId]),
    query(QUERIES.exportUserProfiles, [userId]),
    query(QUERIES.exportUserCheckins, [userId]),
    query(QUERIES.exportUserDiary, [userId]),
    query(QUERIES.exportUserSubscription, [userId]),
    query(QUERIES.exportUserAlerts, [userId]),
    query(QUERIES.exportUserSMS, [userId]),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    user: userData.rows?.[0] || null,
    charts: charts.rows || [],
    profiles: profiles.rows || [],
    checkins: checkins.rows || [],
    diary_entries: diary.rows || [],
    subscription: subscription.rows?.[0] || null,
    transit_alerts: alerts.rows || [],
    sms_messages: sms.rows || [],
  };

  return new Response(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="prime-self-data-export.json"',
    },
  });
}

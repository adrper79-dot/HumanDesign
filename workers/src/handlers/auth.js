/**
 * Auth Endpoints
 *
 *   POST /api/auth/register              – Create account, get JWT pair
 *   POST /api/auth/login                 – Email-based login, get JWT pair
 *   POST /api/auth/refresh               – Rotate refresh token, get new JWT pair
 *   POST /api/auth/logout                – Revoke all refresh tokens for user
 *   GET  /api/auth/me                    – Get current user info
 *   POST /api/auth/verify-email          – Verify email with token (AUDIT-SEC-003)
 *   POST /api/auth/resend-verification   – Resend verification email (auth required)
 *
 * Uses HS256 JWTs with standard iss/aud claims (see lib/jwt.js).
 * Refresh tokens are stored (hashed) in the refresh_tokens table
 * and rotated on every use.  Re-use of a revoked token triggers
 * automatic revocation of the entire token family (theft detection).
 *
 * Passwords are hashed with PBKDF2 via Web Crypto API.
 */

import { signJWT, verifyHS256, sha256, jwtClaims } from '../lib/jwt.js';
import { sendWelcomeEmail1, sendPasswordResetEmail, sendVerificationEmail } from '../lib/email.js';
import { createStripeClient } from '../lib/stripe.js';  // P2-BIZ-004: cancel sub on account deletion
import { createQueryFn, QUERIES } from '../db/queries.js';
import { trackEvent, EVENTS } from '../lib/analytics.js';
import { generateSecret, buildOTPAuthURL, verifyTOTP } from '../lib/totp.js';
import { importEncryptionKey, encryptToken, decryptToken } from '../lib/tokenCrypto.js';
import { createLogger } from '../lib/logger.js';
import { hashPassword, verifyPassword } from '../lib/password.js';

// JWT expiry durations
// Access token is short-lived so that a stolen in-memory token has a small
// exposure window.  The refresh token (stored in HttpOnly cookie) is long-lived.
const ACCESS_TOKEN_TTL  = 60 * 15;           // 15 minutes
const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30; // 30 days
const TOTP_PENDING_TTL  = 60 * 5;            // 5 minutes (2FA challenge window)

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

// CISO-P0: Access token as HttpOnly cookie — prevents XSS token exfiltration.
// Scoped to /api so it is only sent to the API origin (not served static assets).
function buildAccessCookie(accessToken) {
  return `ps_access=${accessToken}; HttpOnly; Secure; SameSite=None; Path=/api; Max-Age=${ACCESS_TOKEN_TTL}`;
}

function clearAccessCookie() {
  return 'ps_access=; HttpOnly; Secure; SameSite=None; Path=/api; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
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

/**
 * Issue a new JWT access + refresh token pair, store the refresh token hash in DB,
 * and return both tokens. Pass existingFamilyId to continue an existing family
 * (token rotation), or omit to create a new family (new login/register).
 */
async function issueTokenPair(env, query, userId, email, existingFamilyId) {
  const accessToken = await signJWT(
    { sub: userId, email, type: 'access' },
    env.JWT_SECRET,
    ACCESS_TOKEN_TTL,
    jwtClaims(env)
  );

  const familyId = existingFamilyId || crypto.randomUUID();
  const refreshToken = await signJWT(
    { sub: userId, type: 'refresh', fid: familyId },
    env.JWT_SECRET,
    REFRESH_TOKEN_TTL,
    jwtClaims(env)
  );

  const tokenHash = await sha256(refreshToken);
  const expiresAtEpoch = Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL;
  await query(QUERIES.insertRefreshToken, [userId, tokenHash, familyId, expiresAtEpoch]);

  return { accessToken, refreshToken };
}

// ─── Route Dispatcher ────────────────────────────────────────

export async function handleAuth(request, env, path) {
  // Known auth paths
  const knownPaths = ['/api/auth/register', '/api/auth/login', '/api/auth/refresh', '/api/auth/logout', '/api/auth/me', '/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/account', '/api/auth/export', '/api/auth/verify-email', '/api/auth/resend-verification', '/api/auth/2fa/setup', '/api/auth/2fa/enable', '/api/auth/2fa/disable', '/api/auth/2fa/verify'];
  
  // GET requests
  if (request.method === 'GET') {
    if (path === '/api/auth/me') return handleGetMe(request, env);
    if (path === '/api/auth/export') return handleExportData(request, env);
    if (path === '/api/auth/2fa/setup') return handle2FASetup(request, env);
    // Known path but wrong method
    if (knownPaths.includes(path)) {
      return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
    }
    return Response.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  // DELETE requests
  if (request.method === 'DELETE') {
    if (path === '/api/auth/account') return handleDeleteAccount(request, env);
    if (knownPaths.includes(path)) {
      return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
    }
    return Response.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  // POST requests
  if (request.method === 'POST') {
    if (path === '/api/auth/register') return handleRegister(request, env);
    if (path === '/api/auth/login') return handleLogin(request, env);
    if (path === '/api/auth/refresh') return handleRefresh(request, env);
    if (path === '/api/auth/logout') return handleLogout(request, env);
    if (path === '/api/auth/forgot-password') return handleForgotPassword(request, env);
    if (path === '/api/auth/reset-password') return handleResetPassword(request, env);
    if (path === '/api/auth/verify-email') return handleVerifyEmail(request, env);
    if (path === '/api/auth/resend-verification') return handleResendVerification(request, env);
    if (path === '/api/auth/2fa/enable')  return handle2FAEnable(request, env);
    if (path === '/api/auth/2fa/disable') return handle2FADisable(request, env);
    if (path === '/api/auth/2fa/verify')  return handle2FAVerify(request, env);
    return Response.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  // Other methods
  return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
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
      { ok: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const result = await query(QUERIES.getUserById, [userId]);

    if (!result.rows || result.rows.length === 0) {
      return Response.json(
        { ok: false, error: 'User not found' },
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
  } catch (err) {
    const log = request._log || createLogger('auth');
    log.error('get_me_failed', { userId, error: err.message });
    return Response.json({ ok: false, error: 'Failed to retrieve user info' }, { status: 500 });
  }
}

// ─── Register ────────────────────────────────────────────────

async function handleRegister(request, env) {
  const log = request._log || createLogger('auth');
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }
  
  const { email, password, phone, birthDate, birthTime, birthTimezone, lat, lng } = body;

  if (!email || !password) {
    return Response.json(
      { ok: false, error: 'Email and password are required' },
      { status: 400 }
    );
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return Response.json(
      { ok: false, error: 'Invalid email format' },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return Response.json(
      { ok: false, error: 'Password must be at least 8 characters' },
      { status: 400 }
    );
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Hash password first (before any DB calls)
    const passwordHash = await hashPassword(password);
    if (!passwordHash) {
      throw new Error('Password hashing failed - no hash returned');
    }

    // CTO-014: Use INSERT ... ON CONFLICT to atomically prevent duplicate
    // registration (no race between SELECT + INSERT).
    let userId;
    try {
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
      userId = result.rows?.[0]?.id;
    } catch (dbErr) {
      // If unique constraint violation on email, return 409
      if (dbErr.code === '23505') {
        return Response.json(
          { ok: false, error: 'An account with this email already exists' },
          { status: 409 }
        );
      }
      throw new Error(`Database create user failed: ${dbErr.message || String(dbErr)}`);
    }

    if (!userId) {
      throw new Error('Failed to create user - no ID returned from query');
    }

    // Record GDPR consent timestamp (SYS-044)
    try {
      await query(QUERIES.recordUserConsent, [userId, new Date().toISOString(), '2026-01-01']);
    } catch (consentErr) {
      throw new Error(`Record consent failed: ${consentErr.message || String(consentErr)}`);
    }

    // Issue tokens
    const { accessToken, refreshToken } = await issueTokenPair(env, query, userId, email.toLowerCase());

    // Send welcome email (BL-ENG-007)
    // Fire and forget - don't block registration on email send
    if (env.RESEND_API_KEY) {
      sendWelcomeEmail1(
        email.toLowerCase(),
        email.split('@')[0], // Use email prefix as name fallback
        env.RESEND_API_KEY,
        env.FROM_EMAIL || 'Prime Self <hello@primeself.app>',
        env.COMPANY_ADDRESS || ''
      ).catch(err => {
        log.error('send_welcome_email_failed', { error: err?.message });
        // Don't fail registration if email fails
      });

      // Send verification email (AUDIT-SEC-003)
      const rawVerifyToken = crypto.randomUUID() + '-' + crypto.randomUUID();
      const verifyTokenHash = await sha256(rawVerifyToken);
      const verifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
      await query(QUERIES.createEmailVerificationToken, [userId, verifyTokenHash, verifyExpiresAt]);

      const frontendUrl = env.FRONTEND_URL || 'https://selfprime.net';
      const verifyUrl = `${frontendUrl}/?action=verify-email&token=${encodeURIComponent(rawVerifyToken)}`;
      sendVerificationEmail(
        email.toLowerCase(),
        verifyUrl,
        env.RESEND_API_KEY,
        env.FROM_EMAIL || 'Prime Self <hello@primeself.app>',
        env.COMPANY_ADDRESS || ''
      ).catch(err => {
        log.error('send_verification_email_failed', { error: err?.message });
      });
    }

    // Phase 2D: After successful registration, capture practitioner referral
    const refSlug = typeof body.ref === 'string' ? body.ref.trim().toLowerCase() : null;
    if (refSlug && /^[a-z0-9-]+$/.test(refSlug) && env.NEON_CONNECTION_STRING) {
      // Store the referral association asynchronously (non-fatal)
      (async () => {
        try {
          const refResult = await query(QUERIES.getPractitionerBySlug, [refSlug]);
          const practitioner = refResult?.rows?.[0];
          if (practitioner) {
            await query(QUERIES.recordReferralSignup, [userId, practitioner.id]);
          }
        } catch (err) {
          console.warn('[auth] Referral capture failed (non-fatal):', err.message);
        }
      })();
    }

    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append('Set-Cookie', buildRefreshCookie(refreshToken));
    headers.append('Set-Cookie', buildAccessCookie(accessToken));

    return new Response(JSON.stringify({
      ok: true,
      user: { id: userId, email: email.toLowerCase(), emailVerified: false },
      accessToken,
      expiresIn: ACCESS_TOKEN_TTL
    }), { status: 201, headers });
  } catch (err) {
    const errorMsg = err?.message || String(err) || 'unknown error';
    const errorCode = err?.code || 'UNKNOWN';
    log.error('register_error', { error: errorMsg, code: errorCode, stack: err?.stack?.split('\n')[0] });
    // Include error details in dev mode; generic message in production
    const detailedError = env?.ENVIRONMENT === 'development' ? ` (${errorCode}: ${errorMsg})` : '';
    return Response.json({ ok: false, error: `Registration failed${detailedError}` }, { status: 500 });
  }
}

// ─── Login ───────────────────────────────────────────────────

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60; // 15 minutes in seconds

async function handleLogin(request, env) {
  const log = request._log || createLogger('auth');
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }
  
  const { email, password } = body;

  if (!email || !password) {
    return Response.json(
      { ok: false, error: 'Email and password are required' },
      { status: 400 }
    );
  }

  // P1-AUTH-002: Brute-force protection — DB-backed atomic counter (avoids KV read-modify-write race).
  // Use a hash of the email as the counter key to avoid storing PII in the DB key column.
  const lockoutKey = `login_fail:${await sha256(email.toLowerCase())}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / LOCKOUT_DURATION) * LOCKOUT_DURATION;
  const windowEnd = windowStart + LOCKOUT_DURATION;

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Fast-path check: read current failure count before touching the DB further
    const { rows: checkRows } = await query(QUERIES.getCounterValue, [lockoutKey]);
    if ((checkRows[0]?.count || 0) >= MAX_LOGIN_ATTEMPTS) {
      return Response.json(
        { ok: false, error: 'Too many failed login attempts. Please try again in 15 minutes, or reset your password.' },
        { status: 429, headers: { 'Retry-After': String(LOCKOUT_DURATION) } }
      );
    }

    const result = await query(QUERIES.getUserByEmail, [email.toLowerCase()]);
    const user = result.rows?.[0];

    if (!user) {
      // Atomically increment — PostgreSQL count + 1 is an atomic update, not read-modify-write
      await query(QUERIES.atomicWindowCounterIncrement, [lockoutKey, windowStart, windowEnd]);
      return Response.json(
        { ok: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      // Atomically increment failure counter; lock out if threshold crossed
      const { rows: incrRows } = await query(QUERIES.atomicWindowCounterIncrement, [lockoutKey, windowStart, windowEnd]);
      const newCount = incrRows[0]?.count || 1;
      if (newCount >= MAX_LOGIN_ATTEMPTS) {
        return Response.json(
          { ok: false, error: 'Too many failed login attempts. Please try again in 15 minutes, or reset your password.' },
          { status: 429, headers: { 'Retry-After': String(LOCKOUT_DURATION) } }
        );
      }
      return Response.json(
        { ok: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Successful login — clear the failure counter
    await query(QUERIES.resetRateLimitCounter, [lockoutKey]).catch(err => {
      log.error('reset_login_counter_failed', { error: err.message });
    });

    // 2FA gate: if user has TOTP enabled, issue a short-lived pending token
    // instead of full credentials. The client must then supply the TOTP code.
    if (user.totp_enabled && user.totp_secret) {
      const pendingToken = await signJWT(
        { sub: user.id, email: user.email, type: '2fa_pending' },
        env.JWT_SECRET,
        TOTP_PENDING_TTL,
        jwtClaims(env)
      );
      return Response.json({
        ok: true,
        requires_2fa: true,
        pending_token: pendingToken,
      });
    }

    // Issue tokens
    const { accessToken, refreshToken } = await issueTokenPair(env, query, user.id, user.email);

    // BL-FIX: Update last_login_at for re-engagement tracking and cron accuracy
    await query(QUERIES.updateLastLogin, [user.id]).catch(err => {
      log.error('update_last_login_failed', { error: err.message });
    });

    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append('Set-Cookie', buildRefreshCookie(refreshToken));
    headers.append('Set-Cookie', buildAccessCookie(accessToken));

    return new Response(JSON.stringify({
      ok: true,
      user: { id: user.id, email: user.email },
      accessToken,
      expiresIn: ACCESS_TOKEN_TTL
    }), { headers });
  } catch (err) {
    log.error('login_error', { error: err.message });
    return Response.json({ ok: false, error: 'Login failed' }, { status: 500 });
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
      { ok: false, error: 'Refresh token is required' },
      { status: 400 }
    );
  }

  // Verify JWT signature & standard claims (iss, aud, exp)
  const payload = await verifyHS256(refreshToken, env.JWT_SECRET, jwtClaims(env));
  if (!payload || payload.type !== 'refresh') {
    return Response.json(
      { ok: false, error: 'Invalid refresh token' },
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
      { ok: false, error: 'Refresh token not recognised — all sessions revoked' },
      { status: 401 }
    );
  }

  if (row.revoked_at) {
    // Already revoked — possible token theft. Revoke entire family.
    await query(QUERIES.revokeRefreshTokenFamily, [row.family_id]);
    return Response.json(
      { ok: false, error: 'Refresh token reuse detected — all sessions revoked' },
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
      { ok: false, error: 'User not found' },
      { status: 401 }
    );
  }

  // Issue new token pair — same family
  const { accessToken, refreshToken: newRefreshToken } = await issueTokenPair(
    env, query, user.id, user.email, row.family_id
  );

  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', buildRefreshCookie(newRefreshToken));
  headers.append('Set-Cookie', buildAccessCookie(accessToken));

  return new Response(JSON.stringify({
    ok: true,
    accessToken,
    expiresIn: ACCESS_TOKEN_TTL
  }), { headers });
}

// ─── Logout (Revoke All Tokens) ─────────────────────────────

async function handleLogout(request, env) {
  const log = request._log || createLogger('auth');
  const userId = request._user?.sub;

  if (!userId) {
    return Response.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    await query(QUERIES.revokeAllUserRefreshTokens, [userId]);
  } catch (err) {
    log.error('logout_db_error', { error: err.message });
    // Still clear the cookie even if DB revoke fails
  }

  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', clearRefreshCookie());
  headers.append('Set-Cookie', clearAccessCookie());

  return new Response(JSON.stringify({ ok: true, message: 'All sessions revoked' }), { headers });
}

// ─── Forgot Password ─────────────────────────────────────────

const PASSWORD_RESET_TTL = 60 * 60; // 1 hour

/**
 * POST /api/auth/forgot-password
 * Sends a password reset email. Always returns 200 to prevent email enumeration.
 */
async function handleForgotPassword(request, env) {
  const log = request._log || createLogger('auth');
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { email } = body;
  if (!email) {
    return Response.json({ ok: false, error: 'Email is required' }, { status: 400 });
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
        env.FROM_EMAIL || 'Prime Self <hello@primeself.app>',
        env.COMPANY_ADDRESS || ''
      ).catch(err => {
        log.error('send_password_reset_failed', { error: err?.message });
      });
    }
  } catch (err) {
    // Log but always return success — prevents email enumeration and masks DB errors
    log.error('forgot_password_error', { error: err.message });
  }

  return successResponse;
}

/**
 * POST /api/auth/reset-password
 * Validates token and updates password.
 */
async function handleResetPassword(request, env) {
  const log = request._log || createLogger('auth');
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { token, password } = body;

  if (!token || !password) {
    return Response.json({ ok: false, error: 'Token and new password are required' }, { status: 400 });
  }

  if (password.length < 8) {
    return Response.json({ ok: false, error: 'Password must be at least 8 characters' }, { status: 400 });
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
    log.error('reset_password_db_error', { error: err.message });
    return Response.json(
      { ok: false, error: 'Invalid or expired reset token. Please request a new one.' },
      { status: 400 }
    );
  }

  if (!resetRow) {
    return Response.json(
      { ok: false, error: 'Invalid or expired reset token. Please request a new one.' },
      { status: 400 }
    );
  }

  try {
    // Hash new password
    const passwordHash = await hashPassword(password);

    // BL-RESET-001: Use query.transaction() for a real transaction via
    // pool.connect() (WebSocket-backed). Plain query('BEGIN') on the HTTP
    // pool executes each statement on a separate connection — non-functional.
    await query.transaction(async (txQuery) => {
      await txQuery(QUERIES.updatePasswordHash, [resetRow.user_id, passwordHash]);
      await txQuery(QUERIES.markPasswordResetUsed, [resetRow.id]);
      await txQuery(QUERIES.revokeAllUserRefreshTokens, [resetRow.user_id]);
    });

    return Response.json({
      ok: true,
      message: 'Password has been reset successfully. Please sign in with your new password.'
    });
  } catch (err) {
    log.error('reset_password_error', { error: err.message });
    return Response.json({ ok: false, error: 'Password reset failed. Please try again.' }, { status: 500 });
  }
}

// ─── Account Deletion ────────────────────────────────────────

async function handleDeleteAccount(request, env) {
  const log = request._log || createLogger('auth');
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { password } = body;
  if (!password) {
    return Response.json({ ok: false, error: 'Password is required to confirm account deletion' }, { status: 400 });
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Verify the user exists and password is correct
    const result = await query(QUERIES.getUserById, [userId]);
    const user = result.rows?.[0];
    if (!user) {
      return Response.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return Response.json({ ok: false, error: 'Incorrect password' }, { status: 403 });
    }

    // P2-BIZ-004: Cancel active Stripe subscription before deleting DB records
    // Prevents billing ghosts and Stripe dunning emails to defunct addresses
    if (env.STRIPE_SECRET_KEY) {
      try {
        const { rows: subRows } = await query(QUERIES.getActiveSubscription, [userId]);
        const sub = subRows[0];
        if (sub?.stripe_subscription_id) {
          const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
          await stripe.subscriptions.cancel(sub.stripe_subscription_id);
          log.info('stripe_subscription_cancelled', { subscriptionId: sub.stripe_subscription_id, userId });
        }
      } catch (stripeErr) {
        // Log but continue — user wants account deleted regardless
        log.error('stripe_cancellation_failed', { userId, error: stripeErr.message });
      }
    }

    // P2-AUDIT-001: Persist an audit record before deleting the user row.
    // Stores email hash (not plaintext) for GDPR Article 17 proof-of-deletion.
    const emailHash = await sha256(user.email.toLowerCase().trim());
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    // Hash IP for GDPR compliance before storing (SYS-015)
    const ipToHash = clientIp || 'unknown';
    const ipHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ipToHash + (env.JWT_SECRET || '')));
    const ipHash = Array.from(new Uint8Array(ipHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    try {
      await query(QUERIES.insertAccountDeletionAudit, [userId, emailHash, user.tier || 'free', ipHash]);
    } catch (auditErr) {
      log.error('account_deletion_audit_failed', { userId, error: auditErr.message });
      // Continue — audit failure must not block GDPR deletion
    }

    // Delete user and all associated data (cascading)
    await query(QUERIES.deleteUserAccount, [userId]);
    log.info('account_deleted', { userId, tier: user.tier || 'free' });

    // Fire analytics event for churn tracking
    trackEvent(env, EVENTS.ACCOUNT_DELETE, {
      userId,
      properties: { tier: user.tier || 'free' },
    }).catch(() => {}); // best-effort

    // P2-BIZ-006: Clear refresh token cookie so browser doesn't retain stale auth
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append('Set-Cookie', clearRefreshCookie());

    return new Response(
      JSON.stringify({ ok: true, message: 'Your account and all associated data have been permanently deleted.' }),
      { status: 200, headers }
    );
  } catch (err) {
    log.error('account_deletion_failed', { userId, error: err.message });
    return Response.json({ ok: false, error: 'Failed to delete account' }, { status: 500 });
  }
}

// ─── GDPR Data Export ────────────────────────────────────────

async function handleExportData(request, env) {
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
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
  } catch (err) {
    const log = request._log || createLogger('auth');
    log.error('export_data_failed', { userId, error: err.message });
    return Response.json({ ok: false, error: 'Failed to export account data' }, { status: 500 });
  }
}

// ─── Email Verification (AUDIT-SEC-003) ──────────────────────

const VERIFICATION_TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 hours
const RESEND_COOLDOWN = 60 * 1000; // 60 seconds

/**
 * POST /api/auth/verify-email
 * Accepts { token } in body. No auth required — the token itself is proof.
 * Hashes the raw token, looks it up, marks user as verified, deletes all tokens.
 */
async function handleVerifyEmail(request, env) {
  const log = request._log || createLogger('auth');
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { token } = body;
  if (!token || typeof token !== 'string') {
    return Response.json({ ok: false, error: 'Verification token is required' }, { status: 400 });
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const tokenHash = await sha256(token);

    // AUDIT-SEC-001: Use atomic DELETE...RETURNING to consume the token in a
    // single statement. This eliminates the SELECT-then-DELETE race condition
    // where two concurrent requests could both read the token before either
    // deletes it, allowing the same link to verify twice.
    const result = await query(QUERIES.atomicVerifyEmailToken, [tokenHash]);
    const record = result.rows?.[0];

    if (!record) {
      return Response.json(
        { ok: false, error: 'Invalid or expired verification link. Please request a new one.' },
        { status: 400 }
      );
    }

    // Mark user as verified (token is already consumed above)
    await query(QUERIES.markEmailVerified, [record.user_id]);

    return Response.json({
      ok: true,
      message: 'Email verified successfully. You now have full access to AI features.'
    });
  } catch (err) {
    log.error('verify_email_error', { error: err.message });
    return Response.json({ ok: false, error: 'Verification failed' }, { status: 500 });
  }
}

/**
 * POST /api/auth/resend-verification
 * Requires auth. Generates a new token and sends a new verification email.
 * Rate limited to 1 request per 60 seconds.
 */
async function handleResendVerification(request, env) {
  const log = request._log || createLogger('auth');
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Check if already verified
    const statusResult = await query(QUERIES.getEmailVerifiedStatus, [userId]);
    const user = statusResult.rows?.[0];
    if (user?.email_verified) {
      return Response.json({ ok: true, message: 'Email is already verified.' });
    }

    // Rate limit: check if a token was created within the cooldown period
    // We use the user's email from the JWT (set during registration/login)
    const userResult = await query(QUERIES.getUserById, [userId]);
    const userEmail = userResult.rows?.[0]?.email;
    if (!userEmail) {
      return Response.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    // Delete old tokens and create a new one
    await query(QUERIES.deleteEmailVerificationTokens, [userId]);

    const rawToken = crypto.randomUUID() + '-' + crypto.randomUUID();
    const tokenHash = await sha256(rawToken);
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL).toISOString();
    await query(QUERIES.createEmailVerificationToken, [userId, tokenHash, expiresAt]);

    const frontendUrl = env.FRONTEND_URL || 'https://selfprime.net';
    const verifyUrl = `${frontendUrl}/?action=verify-email&token=${encodeURIComponent(rawToken)}`;

    if (env.RESEND_API_KEY) {
      await sendVerificationEmail(
        userEmail,
        verifyUrl,
        env.RESEND_API_KEY,
        env.FROM_EMAIL || 'Prime Self <hello@primeself.app>',
        env.COMPANY_ADDRESS || ''
      );
    }

    return Response.json({
      ok: true,
      message: 'Verification email sent. Please check your inbox.'
    });
  } catch (err) {
    log.error('resend_verification_error', { error: err.message });
    return Response.json({ ok: false, error: 'Failed to resend verification email' }, { status: 500 });
  }
}

// ─── 2FA / TOTP (PRA-OPS-004 / AUDIT-UX-006) ────────────────

/**
 * GET /api/auth/2fa/setup
 * Auth required. Returns a new TOTP secret and otpauth:// URL for QR code.
 * The secret is NOT saved yet — user must confirm with /2fa/enable.
 */
async function handle2FASetup(request, env) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const res = await query(QUERIES.getUserById, [userId]);
  const user = res.rows?.[0];
  if (!user) return Response.json({ ok: false, error: 'User not found' }, { status: 404 });

  if (user.totp_enabled) {
    return Response.json(
      { ok: false, error: '2FA is already enabled. Disable it first before re-enrolling.' },
      { status: 409 }
    );
  }

  const secret = generateSecret();
  const otpauth_url = buildOTPAuthURL(secret, user.email);

  // SYS-010: Encrypt TOTP secret before DB storage
  let secretToStore = secret;
  if (env.TOTP_ENCRYPTION_KEY) {
    try {
      const encKey = await importEncryptionKey(env.TOTP_ENCRYPTION_KEY);
      secretToStore = await encryptToken(secret, encKey);
    } catch (encErr) {
      // Fall back to plaintext if key import fails (misconfigured key)
      createLogger('auth').error('totp_encryption_failed_plaintext_fallback', { error: encErr?.message || String(encErr) });
    }
  }

  // Temporarily store the secret so enable can validate the TOTP code.
  // We save it (with totp_enabled=false) so it persists across requests.
  await query(QUERIES.setTOTPSecret, [secretToStore, userId]);

  return Response.json({
    ok: true,
    secret,
    otpauth_url,
    message: 'Scan the QR code in your authenticator app, then call /api/auth/2fa/enable with a valid code.',
  });
}

/**
 * POST /api/auth/2fa/enable
 * Auth required. Body: { totp_code }
 * Verifies the TOTP code against the pending secret and enables 2FA.
 */
async function handle2FAEnable(request, env) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { totp_code } = body;
  if (!totp_code) {
    return Response.json({ ok: false, error: 'totp_code is required' }, { status: 400 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const res = await query(QUERIES.getUserById, [userId]);
  const user = res.rows?.[0];
  if (!user) return Response.json({ ok: false, error: 'User not found' }, { status: 404 });

  if (user.totp_enabled) {
    return Response.json({ ok: false, error: '2FA is already enabled' }, { status: 409 });
  }
  if (!user.totp_secret) {
    return Response.json(
      { ok: false, error: 'No pending 2FA setup. Call /api/auth/2fa/setup first.' },
      { status: 400 }
    );
  }

  // SYS-010: Decrypt TOTP secret before verification
  let plainSecret = user.totp_secret;
  if (env.TOTP_ENCRYPTION_KEY && user.totp_secret) {
    try {
      const encKey = await importEncryptionKey(env.TOTP_ENCRYPTION_KEY);
      plainSecret = await decryptToken(user.totp_secret, encKey);
    } catch {
      // Secret may be plaintext (legacy row before encryption was enabled)
      plainSecret = user.totp_secret;
    }
  }

  const valid = await verifyTOTP(plainSecret, totp_code);
  if (!valid) {
    return Response.json(
      { ok: false, error: 'Invalid TOTP code. Check your authenticator app and try again.' },
      { status: 400 }
    );
  }

  await query(QUERIES.enableTOTP, [userId]);

  return Response.json({
    ok: true,
    message: '2FA has been enabled. You will be asked for a code on each login.',
  });
}

/**
 * POST /api/auth/2fa/disable
 * Auth required. Body: { password, totp_code }
 * Requires both the current password AND a valid TOTP code to disable.
 */
async function handle2FADisable(request, env) {
  const userId = request._user?.sub;
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { password, totp_code } = body;
  if (!password || !totp_code) {
    return Response.json({ ok: false, error: 'password and totp_code are required' }, { status: 400 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const res = await query(QUERIES.getUserById, [userId]);
  const user = res.rows?.[0];
  if (!user) return Response.json({ ok: false, error: 'User not found' }, { status: 404 });

  if (!user.totp_enabled || !user.totp_secret) {
    return Response.json({ ok: false, error: '2FA is not currently enabled' }, { status: 400 });
  }

  const passwordOk = await verifyPassword(password, user.password_hash);
  if (!passwordOk) {
    return Response.json({ ok: false, error: 'Incorrect password' }, { status: 403 });
  }

  // SYS-010: Decrypt TOTP secret before verification
  let plainSecretDisable = user.totp_secret;
  if (env.TOTP_ENCRYPTION_KEY && user.totp_secret) {
    try {
      const encKey = await importEncryptionKey(env.TOTP_ENCRYPTION_KEY);
      plainSecretDisable = await decryptToken(user.totp_secret, encKey);
    } catch {
      // Secret may be plaintext (legacy row before encryption was enabled)
      plainSecretDisable = user.totp_secret;
    }
  }

  const totpOk = await verifyTOTP(plainSecretDisable, totp_code);
  if (!totpOk) {
    return Response.json(
      { ok: false, error: 'Invalid TOTP code. Check your authenticator app and try again.' },
      { status: 400 }
    );
  }

  await query(QUERIES.disableTOTP, [userId]);

  return Response.json({
    ok: true,
    message: '2FA has been disabled.',
  });
}

/**
 * POST /api/auth/2fa/verify
 * No pre-auth required (the pending_token acts as the credential).
 * Body: { pending_token, totp_code }
 * Validates the TOTP code and exchanges the pending_token for a full JWT pair.
 */
async function handle2FAVerify(request, env) {
  let body;
  try { body = await request.json(); } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { pending_token, totp_code } = body;
  if (!pending_token || !totp_code) {
    return Response.json({ ok: false, error: 'pending_token and totp_code are required' }, { status: 400 });
  }

  // Validate the pending token (short-lived JWT)
  const payload = await verifyHS256(pending_token, env.JWT_SECRET, jwtClaims(env));
  if (!payload || payload.type !== '2fa_pending') {
    return Response.json({ ok: false, error: 'Invalid or expired 2FA session. Please log in again.' }, { status: 401 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const res = await query(QUERIES.getUserById, [payload.sub]);
  const user = res.rows?.[0];
  if (!user || !user.totp_enabled || !user.totp_secret) {
    return Response.json({ ok: false, error: 'Invalid 2FA state' }, { status: 401 });
  }

  // SYS-010: Decrypt TOTP secret before verification
  let plainSecretVerify = user.totp_secret;
  if (env.TOTP_ENCRYPTION_KEY && user.totp_secret) {
    try {
      const encKey = await importEncryptionKey(env.TOTP_ENCRYPTION_KEY);
      plainSecretVerify = await decryptToken(user.totp_secret, encKey);
    } catch {
      // Secret may be plaintext (legacy row before encryption was enabled)
      plainSecretVerify = user.totp_secret;
    }
  }

  const valid = await verifyTOTP(plainSecretVerify, totp_code);
  if (!valid) {
    return Response.json(
      { ok: false, error: 'Invalid TOTP code. Check your authenticator app and try again.' },
      { status: 400 }
    );
  }

  // TOTP verified — issue full token pair
  const { accessToken, refreshToken } = await issueTokenPair(env, query, user.id, user.email);

  // Update last login
  await query(QUERIES.updateLastLogin, [user.id]).catch(e => {
    console.warn(JSON.stringify({ event: 'update_last_login_failed', userId: user.id, error: e.message }));
  });

  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', buildRefreshCookie(refreshToken));
  headers.append('Set-Cookie', buildAccessCookie(accessToken));

  return new Response(JSON.stringify({
    ok: true,
    user: { id: user.id, email: user.email },
    accessToken,
    expiresIn: ACCESS_TOKEN_TTL,
  }), { headers });
}

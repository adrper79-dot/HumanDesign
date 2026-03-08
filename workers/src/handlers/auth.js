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
import { sendWelcomeEmail1 } from '../lib/email.js';

import { createQueryFn, QUERIES } from '../db/queries.js';

// JWT expiry durations
const ACCESS_TOKEN_TTL = 60 * 60 * 24;      // 24 hours
const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30; // 30 days

// ─── Route Dispatcher ────────────────────────────────────────

export async function handleAuth(request, env, path) {
  // Known auth paths
  const knownPaths = ['/api/auth/register', '/api/auth/login', '/api/auth/refresh', '/api/auth/logout', '/api/auth/me'];
  
  // GET requests
  if (request.method === 'GET') {
    if (path === '/api/auth/me') return handleGetMe(request, env);
    // Known path but wrong method
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
  delete user.refresh_token;

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

  return Response.json({
    ok: true,
    user: { id: userId, email: email.toLowerCase() },
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL
  }, { status: 201 });
}

// ─── Login ───────────────────────────────────────────────────

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

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  const result = await query(QUERIES.getUserByEmail, [email.toLowerCase()]);
  const user = result.rows?.[0];

  if (!user) {
    return Response.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    );
  }

  // Verify password
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return Response.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    );
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

  return Response.json({
    ok: true,
    user: { id: user.id, email: user.email },
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL
  });
}

// ─── Refresh Token (with rotation & theft detection) ─────────

async function handleRefresh(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }
  
  const { refreshToken } = body;

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

  return Response.json({
    ok: true,
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn: ACCESS_TOKEN_TTL
  });
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

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  await query(QUERIES.revokeAllUserRefreshTokens, [userId]);

  return Response.json({ ok: true, message: 'All sessions revoked' });
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

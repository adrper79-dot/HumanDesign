/**
 * Auth Endpoints
 *
 *   POST /api/auth/register   – Create account, get JWT
 *   POST /api/auth/login      – Email-based login, get JWT
 *   POST /api/auth/refresh    – Refresh token
 *   GET  /api/auth/me         – Get current user info
 *
 * Uses HS256 JWTs (matches auth.js middleware).
 * Passwords are hashed with PBKDF2 via Web Crypto API.
 */

import { signJWT, verifyHS256 } from '../lib/jwt.js';
import { sendWelcomeEmail1 } from '../lib/email.js';

import { createQueryFn, QUERIES } from '../db/queries.js';

// JWT expiry durations
const ACCESS_TOKEN_TTL = 60 * 60 * 24;      // 24 hours
const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30; // 30 days

// ─── Route Dispatcher ────────────────────────────────────────

export async function handleAuth(request, env, path) {
  // Known auth paths
  const knownPaths = ['/api/auth/register', '/api/auth/login', '/api/auth/refresh', '/api/auth/me'];
  
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

  const refreshToken = await signJWT(
    { sub: userId, type: 'refresh' },
    env.JWT_SECRET,
    REFRESH_TOKEN_TTL
  );

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

  const refreshToken = await signJWT(
    { sub: user.id, type: 'refresh' },
    env.JWT_SECRET,
    REFRESH_TOKEN_TTL
  );

  return Response.json({
    ok: true,
    user: { id: user.id, email: user.email },
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL
  });
}

// ─── Refresh Token ───────────────────────────────────────────

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

  // Verify refresh token
  const payload = await verifyHS256(refreshToken, env.JWT_SECRET);
  if (!payload || payload.type !== 'refresh') {
    return Response.json(
      { error: 'Invalid refresh token' },
      { status: 401 }
    );
  }

  // Check expiration
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    return Response.json(
      { error: 'Refresh token expired' },
      { status: 401 }
    );
  }

  // Look up user
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const result = await query(QUERIES.getUserById, [payload.sub]);
  const user = result.rows?.[0];

  if (!user) {
    return Response.json(
      { error: 'User not found' },
      { status: 401 }
    );
  }

  // Issue new access token
  const accessToken = await signJWT(
    { sub: user.id, email: user.email, type: 'access' },
    env.JWT_SECRET,
    ACCESS_TOKEN_TTL
  );

  return Response.json({
    ok: true,
    accessToken,
    expiresIn: ACCESS_TOKEN_TTL
  });
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

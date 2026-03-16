/**
 * JWT Authentication Middleware
 *
 * Validates Bearer tokens using shared secret (HS256).
 * verifyHS256 now checks signature, exp, iss, and aud in one call.
 */

import { verifyHS256, jwtClaims } from '../lib/jwt.js';
import { createQueryFn, QUERIES } from '../db/queries.js';

/**
 * Verify JWT and attach decoded payload to request context.
 * Returns null if valid, or a Response if unauthorized.
 */
export async function authenticate(request, env) {
  // BL-S-MW2: Guard against missing JWT_SECRET to prevent silent failures
  if (!env.JWT_SECRET) {
    console.error('[auth] CRITICAL: JWT_SECRET not set in environment');
    return Response.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('Authorization');
  let token;

  // CISO-P0: Prefer the HttpOnly ps_access cookie — it cannot be read or forged by JavaScript.
  // Fall back to Bearer header for non-browser API clients (curl, Postman, etc.).
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookieMatch = cookieHeader.match(/(?:^|;\s*)ps_access=([^;]+)/);
  if (cookieMatch) {
    token = decodeURIComponent(cookieMatch[1]);
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  if (!token) {
    return Response.json(
      { error: 'Missing or invalid Authorization header' },
      { status: 401 }
    );
  }

  try {
    const payload = await verifyHS256(token, env.JWT_SECRET, jwtClaims(env));

    if (!payload) {
      return Response.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Only accept access tokens in the Authorization header
    if (payload.type !== 'access') {
      return Response.json(
        { error: 'Invalid token type' },
        { status: 401 }
      );
    }

    // Attach user info to a header for downstream handlers
    request._user = payload;
    return null; // Authenticated
  } catch (err) {
    console.error('[auth] Token verification failed:', err.message); // BL-R-H2
    return Response.json(
      { error: 'Token verification failed' },
      { status: 401 }
    );
  }
}

/**
 * Resolve the authenticated user's full DB record from the JWT payload.
 *
 * Returns the full `users` row (minus password_hash) or null if the
 * request is unauthenticated / user doesn't exist.
 *
 * @param {Request} request — must have been processed by authenticate()
 * @param {object} env — Worker env bindings (needs NEON_CONNECTION_STRING)
 * @returns {Promise<object|null>}
 */
export async function getUserFromRequest(request, env) {
  const payload = request._user;
  if (!payload?.sub) return null;

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const result = await query(QUERIES.getUserById, [payload.sub]);

  if (!result.rows || result.rows.length === 0) return null;

  const user = result.rows[0];
  delete user.password_hash;
  return user;
}

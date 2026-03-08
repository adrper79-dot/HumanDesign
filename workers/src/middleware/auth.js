/**
 * JWT Authentication Middleware
 *
 * Validates Bearer tokens using shared secret (HS256).
 * verifyHS256 now checks signature, exp, iss, and aud in one call.
 */

import { verifyHS256 } from '../lib/jwt.js';
import { createQueryFn, QUERIES } from '../db/queries.js';

/**
 * Verify JWT and attach decoded payload to request context.
 * Returns null if valid, or a Response if unauthorized.
 */
export async function authenticate(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return Response.json(
      { error: 'Missing or invalid Authorization header' },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyHS256(token, env.JWT_SECRET);

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

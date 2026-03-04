/**
 * JWT Authentication Middleware
 *
 * Validates Bearer tokens using shared secret (HS256).
 * For production, swap to RS256 with JWKS endpoint.
 */

import { verifyHS256 } from '../lib/jwt.js';

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
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return Response.json(
        { error: 'Token expired' },
        { status: 401 }
      );
    }

    // Attach user info to a header for downstream handlers
    request._user = payload;
    return null; // Authenticated
  } catch (err) {
    return Response.json(
      { error: 'Token verification failed', message: err.message },
      { status: 401 }
    );
  }
}

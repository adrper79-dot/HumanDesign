/**
 * JWT Authentication Middleware
 *
 * Validates Bearer tokens using shared secret (HS256).
 * For production, swap to RS256 with JWKS endpoint.
 */

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

/**
 * Verify HMAC-SHA256 JWT.
 * Uses the Web Crypto API available in Workers runtime.
 */
async function verifyHS256(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;

  // Import secret key
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // Verify signature
  const signingInput = encoder.encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlDecode(signatureB64);

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    signingInput
  );

  if (!valid) return null;

  // Decode payload
  const payloadStr = new TextDecoder().decode(base64UrlDecode(payloadB64));
  return JSON.parse(payloadStr);
}

/**
 * Base64url decode (RFC 7515).
 */
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad === 2) base64 += '==';
  else if (pad === 3) base64 += '=';

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

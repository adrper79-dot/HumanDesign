/**
 * JWT Utilities (HS256)
 * Shared implementation for signing and verifying JWTs.
 *
 * Standard claims added to every token:
 *   iss  – issuer  ("primeself")
 *   aud  – audience ("primeself-api")
 */

const JWT_ISSUER   = 'primeself';
const JWT_AUDIENCE = 'primeself-api';

/**
 * Sign a JWT with HS256 algorithm.
 * @param {object} payload - JWT payload (claims)
 * @param {string} secret - Secret key for HMAC signing
 * @param {number} ttlSeconds - Time-to-live in seconds
 * @returns {Promise<string>} - JWT token
 */
export async function signJWT(payload, secret, ttlSeconds) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);

  const fullPayload = {
    ...payload,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: now,
    exp: now + ttlSeconds
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signingInput)
  );

  const signatureB64 = base64UrlEncode(
    String.fromCharCode(...new Uint8Array(signature))
  );

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/**
 * Verify a JWT with HS256 algorithm.
 * Checks signature, expiration, issuer and audience in one step.
 * @param {string} token - JWT token
 * @param {string} secret - Secret key for HMAC verification
 * @param {object} [opts] - { skipExp: false }
 * @returns {Promise<object|null>} - Decoded payload or null if invalid/expired
 */
export async function verifyHS256(token, secret, opts = {}) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signingInput = encoder.encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlDecode(signatureB64);

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    signingInput
  );

  if (!valid) return null;

  const payloadStr = new TextDecoder().decode(base64UrlDecode(payloadB64));
  const payload = JSON.parse(payloadStr);

  // Validate standard claims
  if (payload.iss && payload.iss !== JWT_ISSUER) return null;
  if (payload.aud && payload.aud !== JWT_AUDIENCE) return null;
  if (!opts.skipExp && payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}

/**
 * Base64url encode (RFC 7515).
 * @param {string} str - String to encode
 * @returns {string} - Base64url encoded string
 */
export function base64UrlEncode(str) {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Base64url decode (RFC 7515).
 * @param {string} str - Base64url encoded string
 * @returns {ArrayBuffer} - Decoded bytes
 */
export function base64UrlDecode(str) {
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

/**
 * SHA-256 hex digest of a string.
 * Used to hash refresh tokens before storing them in the DB.
 * @param {string} input
 * @returns {Promise<string>} - Hex-encoded SHA-256 hash
 */
export async function sha256(input) {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hashBuffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

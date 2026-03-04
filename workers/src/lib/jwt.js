/**
 * JWT Utilities (HS256)
 * Shared implementation for signing and verifying JWTs.
 */

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
 * @param {string} token - JWT token
 * @param {string} secret - Secret key for HMAC verification
 * @returns {Promise<object|null>} - Decoded payload or null if invalid
 */
export async function verifyHS256(token, secret) {
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
  return JSON.parse(payloadStr);
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

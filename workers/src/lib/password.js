/**
 * Password hashing and verification using PBKDF2-SHA256 via Web Crypto API.
 *
 * Format on disk: "<saltBase64>:<hashBase64>"
 * 100,000 iterations, 256-bit output — meets OWASP minimum.
 */

export async function hashPassword(password) {
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
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );

  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return `${saltB64}:${hashB64}`;
}

export async function verifyPassword(password, stored) {
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
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );

  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hash)));

  // Constant-time comparison to prevent timing attacks
  const hashBytes = encoder.encode(hashB64);
  const expectedBytes = encoder.encode(expectedHashB64);

  if (hashBytes.length !== expectedBytes.length) return false;

  let result = 0;
  for (let i = 0; i < hashBytes.length; i++) {
    result |= hashBytes[i] ^ expectedBytes[i];
  }

  return result === 0;
}

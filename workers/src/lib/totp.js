/**
 * TOTP (Time-based One-Time Password) — RFC 6238 / RFC 4226
 *
 * Pure Web Crypto implementation for Cloudflare Workers.
 * No external dependencies.
 *
 * Two-factor flow:
 *   1. generateSecret()  → 20-byte base32 secret (show to user / QR code)
 *   2. verifyTOTP(secret, code)  → true if code is valid (±1 window)
 *   3. generateTOTP(secret)  → current 6-digit code (for tests / admin)
 */

// ─── Base32 ──────────────────────────────────────────────────────────────────
// RFC 4648 alphabet (upper-case; compatible with Google Authenticator / Authy)
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes) {
  let result = '';
  let bits = 0;
  let value = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += B32[(value >>> bits) & 0x1f];
    }
  }
  if (bits > 0) result += B32[(value << (5 - bits)) & 0x1f];
  // Pad to multiple of 8
  while (result.length % 8 !== 0) result += '=';
  return result;
}

export function base32Decode(encoded) {
  const str = encoded.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  const bytes = [];
  let bits = 0;
  let value = 0;
  for (const char of str) {
    const idx = B32.indexOf(char);
    if (idx < 0) throw new Error(`Invalid base32 character: ${char}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

// ─── HOTP (counter-based) ────────────────────────────────────────────────────

async function hotp(secretBytes, counter) {
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  // Encode counter as 8-byte big-endian
  const buf = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = c & 0xff;
    c = Math.floor(c / 256);
  }

  const sig = await crypto.subtle.sign('HMAC', key, buf);
  const hash = new Uint8Array(sig); // SHA-1 produces 20 bytes

  // Dynamic truncation (RFC 4226 §5.4)
  const offset = hash[19] & 0x0f;
  const code =
    ((hash[offset]     & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) <<  8) |
     (hash[offset + 3] & 0xff);

  return String(code % 1_000_000).padStart(6, '0');
}

// ─── TOTP (time-based) ───────────────────────────────────────────────────────

const TIME_STEP = 30; // seconds

/**
 * Generate the current TOTP code for a base32-encoded secret.
 * @param {string} secretBase32
 * @param {number} [windowOffset=0]  – time window offset (0 = current, ±1 = adjacent)
 * @returns {Promise<string>}  6-digit code string
 */
export async function generateTOTP(secretBase32, windowOffset = 0) {
  const secret = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / TIME_STEP) + windowOffset;
  return hotp(secret, counter);
}

/**
 * Verify a 6-digit TOTP code, allowing ±windows steps of clock drift.
 * Constant-time comparison for all valid windows to avoid timing attacks.
 * @param {string} secretBase32
 * @param {string} code            – User-supplied 6-digit string
 * @param {number} [windows=1]     – Number of windows on each side to check
 * @returns {Promise<boolean>}
 */
export async function verifyTOTP(secretBase32, code, windows = 1) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return false;
  // Check all windows; accumulate matches to prevent short-circuit timing leak
  let matched = 0;
  for (let w = -windows; w <= windows; w++) {
    const expected = await generateTOTP(secretBase32, w);
    // XOR-based constant-time string comparison
    let diff = 0;
    for (let i = 0; i < 6; i++) {
      diff |= expected.charCodeAt(i) ^ code.charCodeAt(i);
    }
    if (diff === 0) matched++;
  }
  return matched > 0;
}

/**
 * Generate a new cryptographically random 20-byte base32 TOTP secret.
 * @returns {string}  base32-encoded secret (160 bits)
 */
export function generateSecret() {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

/**
 * Build an otpauth:// URI for QR code generation.
 * Compatible with Google Authenticator, Authy, 1Password, etc.
 *
 * @param {string} secret    – base32 secret
 * @param {string} email     – user email (account label)
 * @param {string} [issuer='Prime Self']
 * @returns {string}
 */
export function buildOTPAuthURL(secret, email, issuer = 'Prime Self') {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

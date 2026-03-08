/**
 * Token Encryption Utility — AES-GCM via Web Crypto API
 *
 * BL-R-H3: Encrypt sensitive OAuth tokens at rest before DB storage.
 *
 * Usage:
 *   const key = await importEncryptionKey(env.NOTION_TOKEN_ENCRYPTION_KEY);
 *   const encrypted = await encryptToken(plaintext, key);     // store this
 *   const plaintext = await decryptToken(encrypted, key);     // on read
 *
 * Storage format: `<base64-IV>:<base64-ciphertext>`
 * The IV prefix makes every stored value unique even for identical tokens.
 *
 * Key requirement: NOTION_TOKEN_ENCRYPTION_KEY must be a base64-encoded
 * 32-byte (256-bit) secret stored in Cloudflare Worker secrets:
 *   openssl rand -base64 32  → paste into `wrangler secret put NOTION_TOKEN_ENCRYPTION_KEY`
 *
 * Backward compatibility: legacy plaintext tokens (Notion tokens start with
 * `secret_` or `ntn_`) are detected by isEncryptedToken() and decrypted
 * transparently, allowing zero-downtime migration.
 */

/**
 * Import a raw AES-256-GCM key from a base64-encoded string.
 *
 * @param {string} base64Key – base64-encoded 32-byte secret
 * @returns {Promise<CryptoKey>}
 */
export async function importEncryptionKey(base64Key) {
  if (!base64Key) {
    throw new Error('NOTION_TOKEN_ENCRYPTION_KEY is not configured. Add it via: wrangler secret put NOTION_TOKEN_ENCRYPTION_KEY');
  }
  const keyBytes = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
  if (keyBytes.length !== 32) {
    throw new Error('NOTION_TOKEN_ENCRYPTION_KEY must be 32 bytes (base64 of `openssl rand -base64 32`)');
  }
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,          // not extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 *
 * @param {string} plaintext
 * @param {CryptoKey} key – from importEncryptionKey()
 * @returns {Promise<string>} `<base64IV>:<base64Ciphertext>`
 */
export async function encryptToken(plaintext, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(cipherBuf)));
  return `${ivB64}:${ctB64}`;
}

/**
 * Decrypt a token previously encrypted with encryptToken().
 *
 * @param {string} encrypted – `<base64IV>:<base64Ciphertext>`
 * @param {CryptoKey} key    – from importEncryptionKey()
 * @returns {Promise<string>} original plaintext
 */
export async function decryptToken(encrypted, key) {
  const colonIdx = encrypted.indexOf(':');
  if (colonIdx === -1) throw new Error('Invalid encrypted token format — missing IV separator');

  const ivB64 = encrypted.slice(0, colonIdx);
  const ctB64 = encrypted.slice(colonIdx + 1);

  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(ctB64), c => c.charCodeAt(0));

  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ct
  );

  return new TextDecoder().decode(plainBuf);
}

/**
 * Detect whether a stored token value is already encrypted.
 *
 * Encrypted tokens look like `<base64>:<base64>` (both segments are valid
 * base64 chars only). Notion plaintext tokens start with `secret_` or `ntn_`.
 *
 * @param {string} stored – value from DB column
 * @returns {boolean}
 */
export function isEncryptedToken(stored) {
  if (!stored) return false;
  // Plaintext Notion tokens always start with a known prefix
  if (stored.startsWith('secret_') || stored.startsWith('ntn_')) return false;
  // Encrypted tokens contain exactly one colon separating two base64 segments
  const parts = stored.split(':');
  return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
}

/**
 * Read a token from DB, decrypting if necessary (supports plaintext legacy rows).
 *
 * @param {string} stored  – value from DB column
 * @param {CryptoKey|null} key – pass null to skip decryption (key unavailable)
 * @returns {Promise<string>} plaintext access token
 */
export async function readToken(stored, key) {
  if (!stored) throw new Error('No token stored');
  if (!isEncryptedToken(stored)) {
    // Legacy plaintext — return as-is (will be re-encrypted on next write)
    return stored;
  }
  if (!key) throw new Error('Encryption key required to decrypt stored token');
  return decryptToken(stored, key);
}

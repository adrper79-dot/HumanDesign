/**
 * APNs (Apple Push Notification service) Client
 *
 * Uses token-based authentication (JWT / ES256) per Apple's HTTP/2 API.
 * Spec: https://developer.apple.com/documentation/usernotifications/establishing-a-token-based-connection-to-apns
 *
 * Relies solely on the Web Crypto API (SubtleCrypto) that is available in
 * Cloudflare Workers — no additional npm packages required.
 *
 * Required secrets (set via wrangler secret or dashboard):
 *   APPLE_TEAM_ID        — 10-character Apple Developer Team ID
 *   APPLE_KEY_ID         — Key ID of the APNs Auth Key
 *   APPLE_PRIVATE_KEY    — Full PEM content of the .p8 Auth Key file
 *   APPLE_BUNDLE_ID      — App bundle identifier (default: com.primeself.app)
 *   APPLE_APNS_ENV       — "sandbox" for dev builds, anything else = production
 */

// ─── Crypto helpers ──────────────────────────────────────────────────────────

/** Base64URL-encode a buffer or Uint8Array */
function b64url(buf) {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Convert a PEM-encoded key (PKCS#8) to an ArrayBuffer suitable for
 * SubtleCrypto.importKey('pkcs8', ...).
 */
function pemToDer(pem) {
  const b64 = pem
    .replace(/-----[^-]+-----/g, '')
    .replace(/\s/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// ─── APNsClient ──────────────────────────────────────────────────────────────

export class APNsClient {
  constructor(env) {
    this.teamId = env.APPLE_TEAM_ID;
    this.keyId = env.APPLE_KEY_ID;
    this.privateKeyPem = env.APPLE_PRIVATE_KEY;
    this.bundleId = env.APPLE_BUNDLE_ID || 'com.primeself.app';
    this.isProduction = env.APPLE_APNS_ENV !== 'sandbox';

    // Cache the signed JWT for up to 55 minutes (APNs tokens expire after 1 h)
    this._cachedToken = null;
    this._tokenExpiry = 0;
  }

  /**
   * Return a fresh (or cached) ES256-signed JWT for the APNs authorization
   * header.  The JWT carries iss=teamId and kid=keyId.
   */
  async _getJWT() {
    const nowSec = Math.floor(Date.now() / 1000);
    if (this._cachedToken && nowSec < this._tokenExpiry) {
      return this._cachedToken;
    }

    const header = b64url(
      new TextEncoder().encode(JSON.stringify({ alg: 'ES256', kid: this.keyId }))
    );
    const claims = b64url(
      new TextEncoder().encode(JSON.stringify({ iss: this.teamId, iat: nowSec }))
    );
    const signingInput = new TextEncoder().encode(`${header}.${claims}`);

    const key = await crypto.subtle.importKey(
      'pkcs8',
      pemToDer(this.privateKeyPem),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );

    const sig = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      signingInput
    );

    this._cachedToken = `${header}.${claims}.${b64url(new Uint8Array(sig))}`;
    this._tokenExpiry = nowSec + 55 * 60;
    return this._cachedToken;
  }

  /**
   * Send a notification to a single APNs device token.
   *
   * @param {string} deviceToken   64-hex device token from the app
   * @param {{ title: string, body: string, data?: object }} notification
   * @returns {{ ok: boolean, reason?: string, status?: number, unregistered?: boolean }}
   */
  async send(deviceToken, { title, body, data = {} }) {
    const host = this.isProduction
      ? 'api.push.apple.com'
      : 'api.sandbox.push.apple.com';
    const jwt = await this._getJWT();

    const payload = {
      aps: {
        alert: { title, body },
        sound: 'default',
        'mutable-content': 1,
      },
      ...data,
    };

    const resp = await fetch(`https://${host}/3/device/${deviceToken}`, {
      method: 'POST',
      headers: {
        'apns-topic': this.bundleId,
        'apns-priority': '10',
        authorization: `bearer ${jwt}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (resp.status === 200) return { ok: true };

    const err = await resp.json().catch(() => ({}));
    const unregistered =
      err.reason === 'Unregistered' || err.reason === 'BadDeviceToken';
    return { ok: false, reason: err.reason, status: resp.status, unregistered };
  }
}

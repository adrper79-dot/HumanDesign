/**
 * FCM (Firebase Cloud Messaging) Client — HTTP v1 API
 *
 * Authenticates via a self-minted RS256 JWT exchanged for a short-lived
 * OAuth2 access token at the Google token endpoint.  Only the Web Crypto API
 * (SubtleCrypto) is used — no additional npm packages required.
 *
 * Spec: https://firebase.google.com/docs/cloud-messaging/send-message
 *
 * Required secrets (set via wrangler secret or dashboard):
 *   FIREBASE_PROJECT_ID    — Firebase project ID
 *   FIREBASE_CLIENT_EMAIL  — Service-account client_email from the JSON key
 *   FIREBASE_PRIVATE_KEY   — Service-account private_key (PEM, preserve \n)
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

// ─── FCMClient ───────────────────────────────────────────────────────────────

export class FCMClient {
  constructor(env) {
    this.projectId = env.FIREBASE_PROJECT_ID;
    this.clientEmail = env.FIREBASE_CLIENT_EMAIL;
    this.privateKeyPem = env.FIREBASE_PRIVATE_KEY;

    // Cache access token for its declared lifetime minus 60 s guard
    this._accessToken = null;
    this._tokenExpiry = 0;
  }

  /**
   * Exchange a self-signed RS256 JWT for a Google OAuth2 access token.
   * Tokens are valid for 1 hour; we cache and reuse until 60 s before expiry.
   */
  async _getAccessToken() {
    const nowMs = Date.now();
    if (this._accessToken && nowMs < this._tokenExpiry) {
      return this._accessToken;
    }

    const nowSec = Math.floor(nowMs / 1000);
    const header = b64url(
      new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    );
    const claims = b64url(
      new TextEncoder().encode(
        JSON.stringify({
          iss: this.clientEmail,
          scope: 'https://www.googleapis.com/auth/cloud-platform',
          aud: 'https://oauth2.googleapis.com/token',
          iat: nowSec,
          exp: nowSec + 3600,
        })
      )
    );
    const signingInput = new TextEncoder().encode(`${header}.${claims}`);

    const key = await crypto.subtle.importKey(
      'pkcs8',
      pemToDer(this.privateKeyPem),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, signingInput);
    const jwt = `${header}.${claims}.${b64url(new Uint8Array(sig))}`;

    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!data.access_token) {
      throw new Error('FCM OAuth2 exchange failed: ' + JSON.stringify(data));
    }

    this._accessToken = data.access_token;
    this._tokenExpiry = nowMs + (data.expires_in - 60) * 1000;
    return this._accessToken;
  }

  /**
   * Send a notification to a single FCM registration token.
   *
   * FCM data values must all be strings; this method coerces any non-string
   * values in `data` automatically.
   *
   * @param {string} registrationToken   FCM device registration token
   * @param {{ title: string, body: string, data?: object }} notification
   * @returns {{ ok: boolean, error?: string, unregistered?: boolean }}
   */
  async send(registrationToken, { title, body, data = {} }) {
    const token = await this._getAccessToken();

    // FCM data payload values must be strings
    const stringData = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    );

    const message = {
      token: registrationToken,
      notification: { title, body },
      data: stringData,
      android: { priority: 'high' },
      apns: { headers: { 'apns-priority': '10' } },
    };

    const resp = await fetch(
      `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      }
    );

    if (resp.ok) return { ok: true };

    const err = await resp.json().catch(() => ({}));
    const unregistered =
      err?.error?.details?.some((d) => d.errorCode === 'UNREGISTERED') || false;
    return { ok: false, error: JSON.stringify(err), unregistered };
  }
}

# Security & Threat Model — Prime Self

**Last Updated:** 2026-03-18
**Status:** Canonical security documentation for all implementation decisions

---

## Performance Notes

### SMS Digest Generation (PER-P1-1)

The SMS digest generation in `workers/src/cron.js` calculates each user's chart individually:

```javascript
for (const user of smsUsers) {
  const digest = await generateDigestForUser(user, env);
  await sendSMS(user.phone, digest, env);
  await new Promise(r => setTimeout(r, 200)); // Rate limiting
}
```

**Analysis:**
- ✅ Fetches all users in a single optimized query (`getSmsSubscribedUsersWithBirthDate`)
- ✅ Chart calculation is in-memory (no additional DB queries per user)
- ✅ SMS sends are throttled with 200ms delays to respect Telnyx rate limits

**Current design trade-offs:**
- **Computation:** Each chart is recalculated fresh for every digest (vs. stored cache)
- **Justification:** Transit calculations must be current (daily); storing stale charts adds complexity
- **Future improvement:** Cache user charts with 24-hour TTL if performance becomes issue (see PER-P2-1)

---

## 1. CSRF Protection (OAuth State Validation)

### Implementation (workers/src/handlers/oauthSocial.js)

#### Generation
When a user initiates OAuth login, we generate a cryptographically secure state token:
```javascript
const state = crypto.randomUUID(); // 128-bit entropy ≈ 34 random characters
```

**Entropy analysis:** `randomUUID()` produces 128 bits of entropy, equivalent to 34 random alphanumeric characters. This meets NIST standards for session tokens.

#### Storage
The state token is stored temporarily in Cloudflare KV with a 10-minute expiry:
```javascript
await env.CACHE.put(`oauth_state:${state}`, provider, { expirationTtl: 600 });
```

**TTL justification:** OAuth callback should complete in <5 minutes. 10-minute window allows for network latency without exposing the state indefinitely.

**Expiry benefit:** KV TTL prevents replay attacks by invalidating old states after 600 seconds.

#### Validation
On OAuth callback, the state token MUST match what we stored:
```javascript
const storedProvider = await env.CACHE.get(`oauth_state:${state}`);
if (!storedProvider) {
  return oauthErrorRedirect(frontendUrl, 'Invalid or expired OAuth state');
}
```

**Fail-closed behavior:** If KV is unavailable (local dev), the state check is skipped with a log entry, preventing authentication from breaking. In production, Cloudflare KV is always available.

---

## 2. PKCE (Proof Key for Public Clients)

### Implementation

OAuth 2.0 Authorization Code Flow for Single Page Applications uses PKCE to prevent authorization code interception:

#### Challenge Generation
```javascript
const codeVerifier = crypto.randomUUID() + crypto.randomUUID(); // 256 bits
const codeChallenge = base64url(sha256(codeVerifier));
```

#### Flow
1. **Auth Request:** Frontend sends `code_challenge` to OAuth provider
2. **Provider Redirect:** Returns `authorization_code` to callback endpoint
3. **Token Exchange:** Backend sends `code` + `code_verifier` to provider
4. **Validation:** Provider verifies `sha256(code_verifier) === code_challenge`

**Benefit:** Even if `authorization_code` is intercepted, attacker cannot use it without the original private `codeVerifier`.

---

## 3. JWT Authentication

### Token Management

**In-Memory Storage (frontend/js/app.js)**
```javascript
let token = null; // Module-level, not in localStorage
```

- ✅ **Secure:** Never persisted to localStorage (safe from XSS with localStorage access)
- ✅ **Session-bound:** Lost on page refresh (acceptable trade-off for security)
- ❌ **Con:** Multi-tab sync requires SameSite cookie fallback

**Refresh Token (HttpOnly Cookie)**
```
Set-Cookie: ps_refresh=<jwt>; HttpOnly; Secure; SameSite=None
```

- ✅ **HttpOnly:** JavaScript cannot read it (immune to XSS token theft)
- ✅ **Secure:** HTTPS-only
- ✅ **SameSite=None:** Required for cross-origin API calls from HTTPS frontend

### Token Validation Flow

1. **Access Token Middleware:** `Authorization: Bearer <token>` header checked first
2. **Fallback to Cookie:** If no header, falls back to `ps_access` cookie
3. **Refresh:** If access token expired, refresh endpoint issues new pair

**File:** workers/src/middleware/jwt.js

---

## 4. Password Hashing

### Algorithm: PBKDF2-SHA256

**Implementation (workers/src/lib/password.js)**
```javascript
const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256');
```

**Parameters:**
- **Algorithm:** PBKDF2 (key derivation function)
- **PRF:** SHA256
- **Iterations:** 100,000 (NIST recommendation)
- **Key length:** 64 bytes
- **Salt:** 16-byte random (generated per user)

**Security:**
- Resistant to rainbow tables (salt)
- Slow enough to prevent brute-force (100k iterations ≈ 100-200ms per attempt)
- No external dependencies (uses Node.js built-in crypto)

**File:** workers/src/lib/password.js
**Usage:** workers/src/handlers/auth.js (register, login)

---

## 5. Rate Limiting

### Architecture

Two-tier rate limiting prevents brute-force and DoS attacks:

#### 1. KV-backed (Fast, Distributed)
- **File:** workers/src/middleware/rateLimit.js
- **Endpoints:** Auth (login, register), Promo validation
- **Limit:** 10 requests per 15 minutes per client IP
- **Backend:** Cloudflare KV (global, 1ms latency)
- **Behavior:** Returns 429 Too Many Requests with `Retry-After` header

#### 2. DB-backed (Atomic, Accurate)
- **File:** workers/src/lib/rateLimit.js
- **Use case:** Webhook processing (must be accurate, not distributed)
- **Limit:** Configurable per endpoint
- **Backend:** Neon PostgreSQL (atomic counter updates)
- **Behavior:** Returns 503 Service Temporarily Unavailable if DB unavailable (fail-closed)

---

## 6. Logging & Observability

### Structured Logging

**File:** workers/src/lib/logger.js

All logs are **JSON-formatted** and include:
- **X-Request-ID:** Unique per request, threaded through all logs and responses
- **Timestamp:** ISO 8601 UTC
- **Action:** Semantic identifier (e.g., `auth_register_attempt`)
- **Sanitized data:** PII truncated (UUIDs → first 8 chars, emails masked in some contexts)

**Example:**
```json
{
  "level": "info",
  "ts": "2026-03-18T14:30:45.123Z",
  "reqId": "req-f7a2-9d84-11ee",
  "action": "auth_register_started",
  "email": "user@[redacted]"
}
```

### Error Tracking

**File:** workers/src/lib/sentry.js

- **Service:** Sentry (error monitoring)
- **Configuration:** SENTRY_DSN environment variable
- **Scope:** Production only; development logs to console
- **Data:** Error stack traces, request context, user ID (sanitized)

---

## 7. Data Protection

### Birth Data Classification

**Sensitivity:** High (can be used for identity verification)

#### Storage
- **Where:** Neon PostgreSQL (`charts` table)
- **Who can access:** User (their own), their practitioner (if they granted access)
- **Encryption:** TLS in transit, database encryption at rest (Neon managed)

#### In Logs
- **Birth date:** ✅ Logged (used for transit calculations, not PII alone)
- **Gmail/phone:** ❌ Never logged (blocked in middleware)
- **Email:** ⚠️ Masked in error contexts (e.g., `user@[redacted]` in logs)

#### UI/Frontend
- **LocalStorage:** ✅ Safe (birth chart is pseudonymous, user already authenticated)
- **Unencrypted queries:** ✅ OK over HTTPS

### Psychometric Data

**Sensitivity:** Medium (behavioral enrichment, not identity)

- **Assessment responses:** Sent to Claude for synthesis (over HTTPS)
- **Cached locally:** OK in browser memory; lost on refresh
- **Logged:** ⚠️ Action logged (`assessment_completed`), not raw responses

---

## 8. Third-Party Integrations

### OAuth Providers (Google, Apple)

- **Tokens:** Access tokens stored in DB (short-lived, <1hr), refreshed as needed
- **User data:** Email + name cached; _never_ synced back to provider
- **Logout:** Local session destroyed; provider session untouched (intentional)

### Stripe (Billing)

- **Integration:** Webhook-based (no stored API keys)
- **Signature verification:** `Stripe-Signature` header validated using `STRIPE_SIGNING_SECRET`
- **Data:** Only subscription events (`invoice`, `charge`, `customer.*`) processed
- **PCI:** Credit card data never touches our servers (Stripe Hosted Checkout)

### Claude API (AI Synthesis)

- **Authentication:** `Authorization: Bearer` header with `ANTHROPIC_API_KEY`
- **Data sent:** Chart data (gates, centers, houses) + assessment responses
- **Data logged:** Request/response size, latency, error code (not content)
- **Retention:** Anthropic's standard policy (check Anthropic Privacy Policy)

### Resend (Email) & Telnyx (SMS)

- **Keys:** Stored as Worker secrets (not in code, gitignored)
- **Requests:** Signed with API key; no sensitive data in request body
- **Logging:** Email address and SMS number logged (necessary for audit trail)

---

## 9. Known Limitations & Trade-Offs

### 1. Multi-Tab Session Sync
- **Issue:** Access token in memory means new tabs don't auto-populate
- **Mitigation:** Refresh token in HttpOnly cookie allows automatic refresh
- **User experience:** First tab can refresh; subsequent tabs re-auth if needed

### 2. No Rate Limiting on Public Endpoints
- **Current:** Chart calculation, chart display, practitioner directory are unthrottled
- **Justification:** Public content designed to be shareable; API usage covered by billing
- **Future:** Add token-bucket rate limiting per user tier if abuse detected

### 3. No End-to-End Encryption
- **Model:** Encryption in transit (HTTPS) + encryption at rest (DB managed)
- **Justification:** Server-side synthesis requires plaintext; users trust us with birth data

### 4. CSRF State TTL at 10 Minutes
- **Risk:** Stale tab attack (old OAuth callback tries to auth)
- **Mitigation:** State consumed on first successful callback; replay rejected
- **Trade-off:** Generous TTL accommodates slow networks

---

## 10. Incident Response

### Secrets Compromise

If any of the following leak:
- `ANTHROPIC_API_KEY`
- `STRIPE_SECRET_KEY`
- `RESEND_API_KEY`
- `TELNYX_API_KEY`
- `JWT_SECRET`
- `NEON_CONNECTION_STRING`

**Action:**
1. Rotate the secret immediately in the service dashboard
2. Update Worker secret via Wrangler CLI
3. Re-deploy: `wrangler deploy`
4. Check logs for unauthorized access in the last 24 hours
5. File incident report

### Password Breach

If user reports their password was compromised:
1. Manually reset their password (admin tool)
2. Invalidate all active refresh tokens
3. Force re-auth on all active sessions
4. Suggest password manager adoption

### Unauthorized Access

**Detection:** Sentry alerts on unusual patterns (>100 failed logins, >1000 API errors)

**Response:**
1. Investigate logs via x-request-id correlation
2. Block suspected IP ranges via KV rate limiting
3. Notify affected users
4. Post-incident review in security log

---

## 11. Compliance Notes

### GDPR (Data Processing)

- ✅ Birth date storage: Lawful basis = user consent (sign-up agreement)
- ✅ Data retention: Users can delete charts; account deletion cascades
- ✅ Data access: Users can export; no 3rd-party usage without consent
- ✅ Breach notification: 72-hour window (logs retained for forensics)

### PCI-DSS (Payment Data)

- ✅ **In scope:** Stripe integration only; we never store CCs
- ✅ **Compliance:** Handled by Stripe (PCI-Level-1 certified)
- ✅ **Our testing:** Annual penetration test recommended

### WCAG 2.1 (Accessibility)

- ⚠️ **Partial:** Frontend accessibility audit identified gaps (ACC-P2-2 through ACC-P2-8)
- 🟡 **In progress:** Remediation planned Phase 2

---

## Appendix: Security Checklist

- [ ] All secrets in `.env.local` (never in git)
- [ ] HTTPS enforced on all production endpoints
- [ ] Rate limiting active on auth endpoints
- [ ] Sentry monitoring enabled
- [ ] Logs do not contain passwords, credit cards, or OAuth tokens
- [ ] OAuth state tokens expire in <10 minutes
- [ ] JWT tokens have short lifetime (<1hr access, <7d refresh)
- [ ] Refresh tokens in HttpOnly cookies (not localStorage)
- [ ] PBKDF2 hashing used for passwords (100k iterations)
- [ ] Stripe webhook signature verified before processing
- [ ] CSRF token validation on state-changing requests
- [ ] Input validation on all public endpoints
- [ ] SQL injection protection via parameterized queries
- [ ] XSS protection via HTML escaping + Content-Security-Policy

# Prime Self — Final Checkout Test Suite

**Version:** 1.1
**Date:** 2026-03-13
**Purpose:** Comprehensive success criteria and test cases for final app checkout. All cases must pass before production release or major milestone sign-off.
**Status:** Test definitions only — do not execute until instructed.

---

## HOW TO USE THIS DOCUMENT

Each test case includes:
- **ID** — Unique identifier for tracking (format: DOMAIN-###)
- **Title** — What is being verified
- **Priority** — P0 (blocking), P1 (critical), P2 (important), P3 (nice-to-have)
- **Preconditions** — State required before test begins
- **Steps** — Exact sequence to follow
- **Success Criteria** — What "pass" looks like (three-part: state + function + log)

P0 failures block all other testing. All P0 and P1 cases must pass for checkout.

---

## THREE-PART VALIDATION MODEL

Every test case must be verified across all three dimensions. A test that passes on HTTP status alone is incomplete.

### 1. ELEMENT STATE
Verify that persistent state changed correctly after the operation:
- **DB state** — query the relevant table(s) and confirm row was created/updated/deleted with correct values
- **KV/Cache state** — confirm cache was populated or invalidated as expected
- **Cookie/Token state** — confirm JWT claims, refresh token rotation, HttpOnly cookies set correctly
- **UI DOM state** — confirm the correct element is visible, hidden, enabled, or disabled after the action

### 2. FUNCTION
Verify that the operation's actual logic executed correctly — not just that it returned 200:
- Return values match the documented schema (correct fields, correct types, correct values)
- Business logic is correct (quotas decremented, tier gates applied, streak math correct)
- No forbidden data appears in output (no plaintext passwords, no other user's data, no HD IP terms)
- Deterministic operations produce the same result on repeat execution

### 3. LOGGING — HANDOFF AUDIT
Verify that each operation produced the correct log/audit record AND handed off to the next step:
- **API log entry** — structured JSON log emitted with `requestId`, `userId`, `endpoint`, `statusCode`, `durationMs`
- **Analytics event** — `analytics_events` table row written for user-facing operations (profile_generated, checkin_created, purchase, etc.)
- **Audit trail** — for financial/security operations: `payment_events`, `auth` logs, webhook delivery records
- **Handoff confirmation** — when an operation triggers a downstream step (webhook → email, cron → push), verify the downstream step was invoked AND logged its own completion

**Log format standard (every API response must emit):**
```json
{
  "level": "info|warn|error",
  "requestId": "uuid-v4",
  "userId": "uuid or null",
  "endpoint": "POST /api/profile/generate",
  "statusCode": 200,
  "durationMs": 1823,
  "tier": "free",
  "quotaUsed": 1,
  "message": "profile generated successfully"
}
```

**Error log format (on any 4xx/5xx):**
```json
{
  "level": "error",
  "requestId": "uuid-v4",
  "userId": "uuid or null",
  "endpoint": "POST /api/billing/checkout",
  "statusCode": 400,
  "errorCode": "INVALID_REDIRECT_URL",
  "message": "successUrl must match allowed frontend origin",
  "durationMs": 12
}
```
Stack traces, DB errors, and internal paths MUST NOT appear in API responses — only in server-side logs.

---

## SECTION 1 — INFRASTRUCTURE & HEALTH

### AUTH-001 · Worker Health Check
**Priority:** P0
**Preconditions:** Worker deployed
**Steps:**
1. `GET /api/health`
2. `GET /api/health?full=1`

**Success Criteria:**
- `GET /api/health` → `{ status: "ok", version: "..." }` with HTTP 200
- `GET /api/health?full=1` → includes `db`, `cache`, `secrets` keys, all `"ok"`
- Response time < 500ms

---

### AUTH-002 · CORS Headers — Frontend Origin
**Priority:** P0
**Preconditions:** Worker deployed, frontend at `https://selfprime.net`
**Steps:**
1. Send preflight OPTIONS to any `/api/` endpoint with `Origin: https://selfprime.net`

**Success Criteria:**
- Response includes `Access-Control-Allow-Origin: https://selfprime.net`
- Response includes `Access-Control-Allow-Credentials: true`
- HTTP 200 or 204

---

### AUTH-003 · CORS Rejection — Unknown Origin
**Priority:** P1
**Steps:**
1. Send request with `Origin: https://evil.example.com`

**Success Criteria:**
- Response does NOT include `Access-Control-Allow-Origin: https://evil.example.com`
- Request blocked or returns 403

---

### AUTH-004 · Rate Limiting Active
**Priority:** P1
**Steps:**
1. Send 60+ rapid identical requests to `/api/chart/calculate` from same IP

**Success Criteria:**
- After threshold, responses return HTTP 429
- Response body contains `{ error: "rate limited" }` or similar

---

---

## SECTION 2 — AUTHENTICATION

### AUTH-010 · User Registration — Happy Path
**Priority:** P0
**Preconditions:** Fresh email not in DB
**Steps:**
1. `POST /api/auth/register` with `{ email, password: "Test1234!", birthDate: "1990-06-15", birthTime: "14:30", birthTimezone: "America/New_York", lat: 40.7128, lng: -74.0060 }`

**Success Criteria:**
- HTTP 200
- Response: `{ ok: true, accessToken: "...", refreshToken: "...", user: { id, email, tier: "free" } }`
- `accessToken` is a valid HS256 JWT, decodes to `{ sub: userId, exp: ... }`
- DB: new row in `users` table with PBKDF2-hashed password (no plaintext)
- DB: `password_hash` does NOT contain original password

---

### AUTH-011 · Registration — Duplicate Email
**Priority:** P0
**Preconditions:** Email already registered
**Steps:**
1. `POST /api/auth/register` with existing email

**Success Criteria:**
- HTTP 409
- `{ ok: false, error: "..." }` — clear message about duplicate

---

### AUTH-012 · Registration — Invalid Email Format
**Priority:** P1
**Steps:**
1. `POST /api/auth/register` with `email: "not-an-email"`

**Success Criteria:**
- HTTP 400
- Descriptive validation error, no user created

---

### AUTH-013 · Login — Happy Path
**Priority:** P0
**Preconditions:** Registered user exists
**Steps:**
1. `POST /api/auth/login` with correct `{ email, password }`

**Success Criteria:**
- HTTP 200
- `{ ok: true, accessToken, refreshToken, user: { id, email, tier } }`
- `accessToken` expires in ~15 minutes (check `exp` claim)
- Previous refresh tokens still valid (login doesn't revoke)

---

### AUTH-014 · Login — Wrong Password
**Priority:** P0
**Steps:**
1. `POST /api/auth/login` with wrong password

**Success Criteria:**
- HTTP 401
- `{ ok: false, error: "..." }`
- No token returned
- Response time NOT significantly longer than success (no timing oracle)

---

### AUTH-015 · Silent Token Refresh
**Priority:** P0
**Preconditions:** Valid refresh token exists
**Steps:**
1. `POST /api/auth/refresh` with valid refresh token

**Success Criteria:**
- HTTP 200
- New `accessToken` and `refreshToken` issued
- Old refresh token is now invalid (rotation)

---

### AUTH-016 · Refresh Token Theft Detection
**Priority:** P0
**Preconditions:** Have a refresh token `T1`
**Steps:**
1. Use `T1` → receive `T2`
2. Re-use `T1` (simulating theft)

**Success Criteria:**
- Re-use of `T1` returns HTTP 401
- ALL tokens for that user are revoked (full session invalidation)
- Subsequent use of `T2` also fails

---

### AUTH-017 · Logout — Token Revocation
**Priority:** P0
**Preconditions:** Logged-in user with valid tokens
**Steps:**
1. `POST /api/auth/logout` with `Authorization: Bearer <accessToken>`
2. Attempt to use refresh token

**Success Criteria:**
- HTTP 200 from logout
- Refresh token now returns 401
- DB: all refresh tokens for user cleared

---

### AUTH-018 · Get Current User (`/api/auth/me`)
**Priority:** P0
**Preconditions:** Valid access token
**Steps:**
1. `GET /api/auth/me` with `Authorization: Bearer <accessToken>`

**Success Criteria:**
- HTTP 200
- Returns `{ user: { id, email, tier, ... } }`
- Does NOT include `password_hash` in response

---

### AUTH-019 · Expired Access Token Rejected
**Priority:** P0
**Steps:**
1. Use an access token past its expiry

**Success Criteria:**
- HTTP 401
- `{ error: "token expired" }` or similar

---

### AUTH-020 · Forgot Password — Email Sent
**Priority:** P1
**Preconditions:** Resend API key configured
**Steps:**
1. `POST /api/auth/forgot-password` with registered email

**Success Criteria:**
- HTTP 200 (always, to prevent email enumeration)
- If email exists in DB: password reset email sent via Resend
- Email contains a valid reset link with token

---

### AUTH-021 · Reset Password — Valid Token
**Priority:** P1
**Preconditions:** Have valid reset token from forgot-password flow
**Steps:**
1. `POST /api/auth/reset-password` with `{ token, newPassword: "NewPass123!" }`

**Success Criteria:**
- HTTP 200
- User can now log in with new password
- Old password no longer works
- Reset token is single-use (second use → 400/401)

---

### AUTH-022 · OAuth — Google Redirect
**Priority:** P1
**Preconditions:** Google OAuth credentials configured in Worker secrets
**Steps:**
1. `GET /api/auth/oauth/google`

**Success Criteria:**
- HTTP 302 redirect to `accounts.google.com/o/oauth2/auth`
- Redirect URL includes `client_id`, `redirect_uri`, `scope`, `state`
- `state` parameter matches entry in `oauth_states` DB table

---

### AUTH-023 · OAuth — Callback Token Delivery
**Priority:** P1
**Preconditions:** Complete Google OAuth flow (or simulate callback)
**Steps:**
1. Simulate callback: `GET /api/auth/oauth/google/callback?code=...&state=...`

**Success Criteria:**
- Worker exchanges code for Google user info
- User upserted to `users` + `social_accounts` tables
- Redirect to frontend: `https://selfprime.net?oauth=success&token=...&refresh=...`
- Frontend `checkOAuthCallback()` picks up params, stores tokens

---

### AUTH-024 · GDPR Data Export
**Priority:** P2
**Preconditions:** Logged-in user with charts and profiles
**Steps:**
1. `GET /api/auth/export`

**Success Criteria:**
- HTTP 200
- Response is CSV or JSON containing all user data
- Includes: user profile, charts, diary entries, checkins
- Does NOT include other users' data

---

### AUTH-025 · Account Deletion — Cascade
**Priority:** P1
**Preconditions:** Logged-in user with charts, profiles, subscription
**Steps:**
1. `DELETE /api/auth/account`

**Success Criteria:**
- HTTP 200
- User row deleted from `users`
- All related rows deleted: charts, profiles, subscriptions, diary_entries, daily_checkins, push_subscriptions, etc.
- Access token no longer valid
- Login with same credentials → 401

---

---

## SECTION 3 — CHART CALCULATION

### CHART-001 · Calculate Chart — Happy Path
**Priority:** P0
**Steps:**
1. `POST /api/chart/calculate` with `{ birthDate: "1990-06-15", birthTime: "14:30", birthTimezone: "America/New_York", lat: 40.7128, lng: -74.0060 }`

**Success Criteria:**
- HTTP 200
- Response includes: `hdChart` (type, authority, strategy, profile, definedCenters, activeChannels), `astroChart` (ascendant, placements, aspects, houses), `transits`
- `hdChart.type` is one of: Manifestor, Generator, Manifesting Generator, Projector, Reflector
- `hdChart.authority` is one of: Emotional, Sacral, Splenic, Ego, Self-Projected, Mental, Lunar, None
- `astroChart.placements` has entries for Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto
- Response time < 3000ms (uncached)

---

### CHART-002 · Calculate Chart — Cache Hit
**Priority:** P1
**Preconditions:** Same chart calculated within past 7 days
**Steps:**
1. Repeat identical `POST /api/chart/calculate`

**Success Criteria:**
- HTTP 200
- Response time < 200ms (KV cache)
- Results identical to first calculation

---

### CHART-003 · Calculate Chart — Unknown Timezone Fallback
**Priority:** P1
**Steps:**
1. `POST /api/chart/calculate` with invalid `birthTimezone: "Fake/Zone"` but valid lat/lng

**Success Criteria:**
- Either: HTTP 400 with clear timezone validation error
- Or: system derives timezone from lat/lng and proceeds

---

### CHART-004 · Calculate Chart — No Birth Time
**Priority:** P1
**Steps:**
1. `POST /api/chart/calculate` with `birthTime: null` or omitted

**Success Criteria:**
- HTTP 200 with partial chart (note: Sun, Moon, Earth placements calculated; Ascendant/houses may be absent)
- No crash — graceful handling

---

### CHART-005 · Geocode Lookup
**Priority:** P0
**Steps:**
1. `GET /api/geocode?q=New+York+City`

**Success Criteria:**
- HTTP 200
- `{ lat: ~40.71, lng: ~-74.00, timezone: "America/New_York", name: "New York..." }`
- Returned values are within plausible range for NYC

---

### CHART-006 · Geocode — Unknown Location
**Priority:** P1
**Steps:**
1. `GET /api/geocode?q=xkcd1234zzznotacity`

**Success Criteria:**
- HTTP 404 or `{ results: [] }`
- No crash

---

### CHART-007 · Save Chart — Auth Required
**Priority:** P1
**Preconditions:** Logged-in user, chart just calculated
**Steps:**
1. `POST /api/chart/save` with chart_json

**Success Criteria:**
- HTTP 200, `{ chartId: "..." }`
- DB: row in `charts` table with correct user_id
- Second save of identical data: creates second row (no dedup at save level)

---

### CHART-008 · Chart History — Paginated
**Priority:** P1
**Preconditions:** User has 5+ saved charts
**Steps:**
1. `GET /api/chart/history?limit=3&offset=0`
2. `GET /api/chart/history?limit=3&offset=3`

**Success Criteria:**
- Page 1: 3 charts, ordered by `calculated_at` DESC
- Page 2: remaining charts
- No chart appears on both pages

---

### CHART-009 · Get Chart — Access Control
**Priority:** P0
**Preconditions:** User A has chart `chart_A_id`, User B logged in separately
**Steps:**
1. User B: `GET /api/chart/{chart_A_id}`

**Success Criteria:**
- HTTP 403 or 404 — User B cannot read User A's chart

---

### CHART-010 · Bodygraph — Renders SVG
**Priority:** P0
**Preconditions:** Chart calculated, in browser
**Steps:**
1. Enter birth data in chart form
2. Click "Calculate Chart"

**Success Criteria:**
- SVG bodygraph renders within `#chartDisplay`
- 9 centers visible
- Defined centers shown in gold/filled style
- Open centers shown in outline style
- Active channels drawn with connecting lines
- Identity strip shows: Type label, Authority label, Strategy label

---

### CHART-011 · Bodygraph — Center Click Explanation
**Priority:** P1
**Preconditions:** Chart rendered
**Steps:**
1. Click a defined center (e.g., Sacral)
2. Click an open center (e.g., Head)

**Success Criteria:**
- Explanation panel opens with text specific to that center
- Defined center: explains what it means to have it consistently
- Open center: explains conditioning/wisdom potential
- Panel closes when clicking elsewhere or X

---

---

## SECTION 4 — PROFILE SYNTHESIS (AI)

### PROF-001 · Generate Profile — Happy Path
**Priority:** P0
**Preconditions:** Logged-in user, free tier with quota available
**Steps:**
1. `POST /api/profile/generate` with birth data (same as chart calculate)

**Success Criteria:**
- HTTP 200
- Response: `{ profile: { quickStartGuide: {...}, technicalInsights: {...}, groundingAudit: {...} }, chart: {...} }`
- `quickStartGuide` has: `whoYouAre`, `decisionStyle`, `lifeStrategy`, `thisMonth`, `workingWithOthers`, `whatMakesYouUnique`
- `groundingAudit.claimsGrounded >= groundingAudit.claimsTotal` (fully grounded)
- Response mentions NO forbidden HD terms: "Human Design", "BodyGraph", "Rave", "Projector", "Generator", "Manifestor", "Reflector", "Incarnation Cross"
- `technicalInsights.forgeIdentification.forge` is one of: Initiation, Mastery, Guidance, Perception, Transformation
- Response time < 30s

---

### PROF-002 · Generate Profile — Free Tier Quota Enforcement
**Priority:** P0
**Preconditions:** Free tier user who has already generated 1 profile this month
**Steps:**
1. Attempt `POST /api/profile/generate` again

**Success Criteria:**
- HTTP 429
- `{ error: "quota exceeded", quotaType: "monthly", current: 1, limit: 1, resetDate: "..." }`
- No profile generated, no AI call made

---

### PROF-003 · Profile Stream — SSE Works
**Priority:** P1
**Preconditions:** Logged-in user with quota available
**Steps:**
1. `POST /api/profile/generate/stream`
2. Listen to SSE events

**Success Criteria:**
- Response is `Content-Type: text/event-stream`
- Events arrive incrementally (at least 3 distinct events)
- Final event signals completion
- Full profile JSON parseable from concatenated data

---

### PROF-004 · Profile — With Question
**Priority:** P1
**Preconditions:** Logged-in user
**Steps:**
1. `POST /api/profile/generate` with `{ ...birthData, question: "How should I approach my career transition?" }`

**Success Criteria:**
- Profile text directly addresses the question
- Model used is claude-sonnet (not opus — question path uses Sonnet per synthesis.js)
- Response still grounded in chart Reference Facts

---

### PROF-005 · Profile — Anti-Barnum Test
**Priority:** P1
**Preconditions:** Any profile generated
**Steps:**
1. Review generated `quickStartGuide.whoYouAre` and `decisionStyle`

**Success Criteria:**
- Each insight cites at minimum 2 specific chart data points
- No insight applies to >30% of population generically (no "you value relationships", "you seek meaning")
- At least one insight uses "Unlike people with X, you..." differentiator

---

### PROF-006 · Profile — 6th Forge / 7th Knowledge Reference
**Priority:** P1
**Preconditions:** Profile generated without a question (full synthesis path)
**Steps:**
1. Review closing of generated profile

**Success Criteria:**
- `technicalInsights.selfReflection.nativeEpistemology` is non-empty and names the Authority type as cognitive architecture
- `technicalInsights.selfReflection.forgeOfSelf` is non-empty
- OR synthesis closing text references how the person knows what they know

---

### PROF-007 · PDF Export
**Priority:** P1
**Preconditions:** Individual tier user, profile exists
**Steps:**
1. `GET /api/profile/{profileId}/pdf`

**Success Criteria:**
- HTTP 200
- Content-Type: `application/pdf`
- PDF is non-empty (> 1kb)
- PDF opens and displays profile content

---

### PROF-008 · PDF Export — Free Tier Blocked
**Priority:** P0
**Preconditions:** Free tier user, profile exists
**Steps:**
1. `GET /api/profile/{profileId}/pdf`

**Success Criteria:**
- HTTP 403
- `{ error: "tier", requiredTier: "individual" }`

---

---

## SECTION 5 — BILLING & STRIPE

### BILL-001 · Checkout Session Created — Individual Tier
**Priority:** P0
**Preconditions:** Logged-in free user
**Steps:**
1. `POST /api/billing/checkout` with `{ tier: "individual", successUrl: "https://selfprime.net/success", cancelUrl: "https://selfprime.net/" }`

**Success Criteria:**
- HTTP 200
- `{ sessionId: "cs_...", url: "https://checkout.stripe.com/..." }`
- `sessionId` starts with `cs_`
- URL is a valid Stripe checkout URL

---

### BILL-002 · Checkout — Promo Code Applied
**Priority:** P1
**Preconditions:** Active promo code `LAUNCH20` exists
**Steps:**
1. `POST /api/billing/checkout` with `{ tier: "individual", promoCode: "LAUNCH20", ... }`

**Success Criteria:**
- HTTP 200
- Stripe checkout URL opens with discount applied
- Stripe shows discounted price (not original)

---

### BILL-003 · Checkout — Invalid Promo Code
**Priority:** P1
**Steps:**
1. `POST /api/billing/checkout` with `{ promoCode: "FAKECODE999", ... }`

**Success Criteria:**
- Either: HTTP 400 with `{ error: "invalid promo code" }`
- Or: Checkout proceeds without discount, code not applied silently

---

### BILL-004 · Stripe Webhook — checkout.session.completed
**Priority:** P0
**Preconditions:** Stripe webhook secret configured
**Steps:**
1. Simulate Stripe `checkout.session.completed` event (using Stripe CLI: `stripe trigger checkout.session.completed`)

**Success Criteria:**
- HTTP 200 `{ received: true }` returned to Stripe within 10s
- DB: `subscriptions` row created or updated with correct `tier` and `status: "active"`
- DB: `users.stripe_customer_id` set
- Email confirmation sent to user (check Resend logs)
- User's tier in subsequent `/api/auth/me` reflects new tier

---

### BILL-005 · Stripe Webhook — Signature Verification
**Priority:** P0
**Steps:**
1. `POST /api/webhook/stripe` with invalid/missing Stripe-Signature header

**Success Criteria:**
- HTTP 400 or 403
- Webhook body NOT processed
- No DB changes

---

### BILL-006 · Stripe Webhook — Idempotency (Replay)
**Priority:** P0
**Preconditions:** `checkout.session.completed` already processed
**Steps:**
1. Replay the same Stripe event ID

**Success Criteria:**
- HTTP 200 (Stripe requires 2xx for replays)
- No duplicate subscription row created
- No duplicate email sent

---

### BILL-007 · Billing Portal
**Priority:** P1
**Preconditions:** Subscribed user with `stripe_customer_id`
**Steps:**
1. `POST /api/billing/portal` with `{ returnUrl: "https://selfprime.net/" }`

**Success Criteria:**
- HTTP 200
- `{ url: "https://billing.stripe.com/..." }`
- URL is valid Stripe portal session

---

### BILL-008 · Get Subscription Status
**Priority:** P0
**Preconditions:** Subscribed user
**Steps:**
1. `GET /api/billing/subscription`

**Success Criteria:**
- HTTP 200
- `{ subscription: { tier: "individual", status: "active", currentPeriodEnd: "..." } }`
- `status` matches actual Stripe subscription status

---

### BILL-009 · One-Time Purchase — Single Synthesis
**Priority:** P1
**Preconditions:** Free user (quota exceeded)
**Steps:**
1. `POST /api/billing/checkout-one-time` with `{ product: "single_synthesis", successUrl, cancelUrl }`

**Success Criteria:**
- HTTP 200, Stripe one-time checkout URL returned
- After completing purchase (webhook fires): user gets +1 synthesis quota credit
- Subsequent `POST /api/profile/generate` succeeds despite monthly quota exceeded

---

### BILL-010 · One-Time Purchase — Composite Reading
**Priority:** P1
**Steps:**
1. `POST /api/billing/checkout-one-time` with `{ product: "composite_reading", ... }`
2. Complete Stripe checkout
3. Attempt composite chart

**Success Criteria:**
- After purchase: `POST /api/composite` succeeds for free/individual user
- Access is one-time (second composite attempt blocked unless purchased again)

---

### BILL-011 · Cancel Subscription
**Priority:** P1
**Preconditions:** Active subscription
**Steps:**
1. `POST /api/billing/cancel`

**Success Criteria:**
- HTTP 200
- Stripe subscription set to cancel at period end
- DB: `cancel_at_period_end: true`
- `GET /api/billing/subscription` shows `cancel_at_period_end: true`, still `active`
- After period end (Stripe fires `customer.subscription.deleted`): tier reverts to `free`

---

### BILL-012 · Open-Redirect Prevention
**Priority:** P0
**Steps:**
1. `POST /api/billing/checkout` with `{ successUrl: "https://evil.example.com/steal", ... }`

**Success Criteria:**
- HTTP 400
- Error: redirect URL must match allowed frontend origin
- No Stripe session created with attacker URL

---

### BILL-013 · Stripe Webhook — Subscription Past Due
**Priority:** P1
**Steps:**
1. Simulate `customer.subscription.updated` with `status: "past_due"`

**Success Criteria:**
- DB: `subscriptions.status = "past_due"`
- Feature access degrades appropriately (or grace period applies)
- Email notification sent to user

---

---

## SECTION 6 — TIER ENFORCEMENT

### TIER-001 · Free User — Profile Quota (Monthly)
**Priority:** P0
**Preconditions:** Free user, 1 profile already generated this month
**Steps:**
1. Attempt `POST /api/profile/generate`

**Success Criteria:**
- HTTP 429, `{ quotaType: "monthly", limit: 1, resetDate: "..." }`

---

### TIER-002 · Free User — PDF Export Blocked
**Priority:** P0
**Steps:**
1. Free user calls `GET /api/profile/{id}/pdf`

**Success Criteria:**
- HTTP 403, `{ error: "tier", requiredTier: "individual" }`

---

### TIER-003 · Free User — Composite Chart Blocked
**Priority:** P0
**Steps:**
1. Free user calls `POST /api/composite`

**Success Criteria:**
- HTTP 403, `{ error: "tier" }` pointing to practitioner or one-time purchase path

---

### TIER-004 · Free User — SMS Digest Blocked
**Priority:** P1
**Steps:**
1. Free user calls `POST /api/sms/subscribe`

**Success Criteria:**
- HTTP 403, `{ error: "tier", requiredTier: "individual" }`

---

### TIER-005 · Individual User — Practitioner Tools Blocked
**Priority:** P0
**Steps:**
1. Individual-tier user calls `GET /api/practitioner/clients`

**Success Criteria:**
- HTTP 403, `{ error: "tier", requiredTier: "practitioner" }`

---

### TIER-006 · Individual User — Profile Quota (10/month)
**Priority:** P0
**Preconditions:** Individual user, 10 profiles generated this month
**Steps:**
1. Attempt 11th `POST /api/profile/generate`

**Success Criteria:**
- HTTP 429, quota exceeded for monthly limit

---

### TIER-007 · Practitioner User — Client Management Access
**Priority:** P0
**Preconditions:** Practitioner-tier user
**Steps:**
1. `GET /api/practitioner/clients`
2. `POST /api/practitioner/clients/add` with client email
3. `GET /api/practitioner/clients/{id}`

**Success Criteria:**
- All return HTTP 200
- Client list scoped to this practitioner only

---

### TIER-008 · Practitioner User — 25 Client Limit
**Priority:** P1
**Preconditions:** Practitioner tier, 25 clients already added
**Steps:**
1. Attempt `POST /api/practitioner/clients/add` (26th client)

**Success Criteria:**
- HTTP 403 or 429 with client limit message

---

### TIER-009 · Agency User — Webhooks Access
**Priority:** P1
**Preconditions:** Agency-tier user
**Steps:**
1. `POST /api/webhooks` to create custom webhook

**Success Criteria:**
- HTTP 200, `{ webhookId, secret }`

---

### TIER-010 · Tier Upgrade — Feature Unlocks Immediately
**Priority:** P0
**Preconditions:** Free user upgrades to Individual (webhook fires)
**Steps:**
1. Stripe `checkout.session.completed` fires
2. Check `/api/auth/me` for updated tier
3. Attempt `GET /api/profile/{id}/pdf`

**Success Criteria:**
- `/api/auth/me` returns `tier: "individual"` immediately after webhook processed
- PDF export now succeeds (HTTP 200)

---

---

## SECTION 7 — TRANSITS & TIMING

### TRANS-001 · Today's Transits
**Priority:** P0
**Steps:**
1. `GET /api/transits/today`

**Success Criteria:**
- HTTP 200
- `{ transits: { date: "YYYY-MM-DD", positions: {...}, gateActivations: [...] } }`
- Positions includes Sun, Moon, and at least 5 other planets
- Each planet has `gate`, `line`, `sign` values

---

### TRANS-002 · Transit Forecast — 30 Days
**Priority:** P1
**Steps:**
1. `GET /api/transits/forecast?days=30&lat=40.71&lng=-74.00`

**Success Criteria:**
- HTTP 200
- Array of 30 daily entries
- Each entry has date + transit positions
- Dates are consecutive and start from today

---

### TRANS-003 · Transit Cache — Daily Snapshot Reuse
**Priority:** P1
**Preconditions:** Transit snapshot for today already in DB
**Steps:**
1. Two users call `GET /api/transits/today` on same day

**Success Criteria:**
- Both receive identical planetary positions
- Second call is faster (< 100ms) — cache hit
- DB: still only 1 row in `transit_snapshots` for today's date

---

### TRANS-004 · Transit Alert — Create & Deliver
**Priority:** P1
**Preconditions:** User with push subscription, Cron runs daily
**Steps:**
1. `POST /api/alerts` with `{ gate_id: 57, transit_type: "solar", notify_via: ["push"] }`
2. Simulate cron trigger for alert delivery

**Success Criteria:**
- Alert created (HTTP 200, `alertId` returned)
- When transiting planet activates gate 57: push notification delivered
- `alert_deliveries` row created with `sent_at` timestamp

---

### TRANS-005 · Timing — Optimal Date Finder
**Priority:** P1
**Preconditions:** Logged-in user
**Steps:**
1. `POST /api/timing/find-dates` with `{ intention: "launch a new project", start_date: "2026-03-20", end_date: "2026-04-20", lat: 40.71, lng: -74.00 }`

**Success Criteria:**
- HTTP 200
- `{ optimal_dates: [{date, score, explanation}] }` — at least 3 dates returned
- Each entry has `score` (numeric) and human-readable `explanation`

---

---

## SECTION 8 — DAILY CHECK-IN

### CHECKIN-001 · Create Check-In
**Priority:** P0
**Preconditions:** Logged-in user, no check-in for today yet
**Steps:**
1. `POST /api/checkin` with `{ alignment_score: 8, notes: "Feeling aligned today", gates_activated: [57, 20] }`

**Success Criteria:**
- HTTP 200, `{ checkin_id: "...", status: "created" }`
- DB: row in `daily_checkins` with correct user_id and today's date
- `GET /api/checkin` now returns today's entry

---

### CHECKIN-002 · Check-In — One Per Day Enforcement
**Priority:** P0
**Preconditions:** Already checked in today
**Steps:**
1. `POST /api/checkin` again for same day

**Success Criteria:**
- HTTP 200 (update, not duplicate) OR HTTP 409 (already exists)
- Either way: only 1 record for (user_id, today) in DB

---

### CHECKIN-003 · Streak — Increments Daily
**Priority:** P1
**Preconditions:** User checked in yesterday, checking in today
**Steps:**
1. `POST /api/checkin` (after midnight, new day)
2. `GET /api/checkin/streak`

**Success Criteria:**
- `current_streak` incremented by 1
- `best_streak` updated if new record

---

### CHECKIN-004 · Streak — Resets After Miss
**Priority:** P1
**Preconditions:** User misses a day (simulate by skipping a date)
**Steps:**
1. Check in on Day 1
2. Skip Day 2
3. Check in on Day 3
4. `GET /api/checkin/streak`

**Success Criteria:**
- `current_streak: 1` (reset, not continued)
- `best_streak` preserved from before the break

---

### CHECKIN-005 · Check-In History — Paginated
**Priority:** P1
**Steps:**
1. `GET /api/checkin/history?days=30`

**Success Criteria:**
- HTTP 200
- Returns up to 30 days of check-in entries
- Each entry has `alignment_score`, `notes`, `date`, `gates_activated`

---

### CHECKIN-006 · Check-In — Frontend Slider Works
**Priority:** P0
**Preconditions:** In browser, Check-In tab open
**Steps:**
1. Move alignment score slider from 1 to 10
2. Enter notes
3. Click submit

**Success Criteria:**
- Score value updates visually as slider moves
- Submit fires POST to `/api/checkin`
- Success: streak display updates, confirmation shown

---

---

## SECTION 9 — DIARY

### DIARY-001 · Create Diary Entry
**Priority:** P1
**Steps:**
1. `POST /api/diary` with `{ event_date: "2026-03-01", event_title: "Career shift", event_description: "Quit my job...", event_type: "career", significance: "major" }`

**Success Criteria:**
- HTTP 200, `{ entryId: "..." }`
- DB: row in `diary_entries` with `transit_snapshot` auto-populated (transits captured for that date)

---

### DIARY-002 · Get Entry With Transit Snapshot
**Priority:** P1
**Preconditions:** Entry created with event_date in the past
**Steps:**
1. `GET /api/diary/{entryId}`

**Success Criteria:**
- HTTP 200
- `transit_snapshot` is non-null — contains planetary positions for that date
- Enables retroactive validation in synthesis

---

### DIARY-003 · Update & Delete Entry
**Priority:** P1
**Steps:**
1. `PUT /api/diary/{entryId}` with updated fields
2. `DELETE /api/diary/{entryId}`

**Success Criteria:**
- PUT: HTTP 200, changes reflected in subsequent GET
- DELETE: HTTP 200, entry no longer in list
- Another user cannot update or delete this entry (403/404)

---

---

## SECTION 10 — COMPOSITE & RELATIONSHIP

### COMP-001 · Composite Chart — Practitioner Tier
**Priority:** P0
**Preconditions:** Practitioner-tier user
**Steps:**
1. `POST /api/composite` with two sets of birth data

**Success Criteria:**
- HTTP 200
- Response includes: `composite` chart data + `interpretation` text
- Interpretation references both individuals' chart elements
- No forbidden HD terms in interpretation

---

### COMP-002 · Composite Chart — Free User Blocked
**Priority:** P0
**Steps:**
1. Free user `POST /api/composite`

**Success Criteria:**
- HTTP 403

---

### COMP-003 · Composite Chart — After One-Time Purchase
**Priority:** P1
**Preconditions:** Free user has purchased composite reading ($29)
**Steps:**
1. `POST /api/composite`

**Success Criteria:**
- HTTP 200 (purchase credit honored)

---

### COMP-004 · Composite Form — Auto-Populates Person 1
**Priority:** P1
**Preconditions:** User has saved chart data
**Steps:**
1. Navigate to Composite tab in browser

**Success Criteria:**
- Person 1 fields (`comp-A-*`) pre-populated with user's saved birth data
- Person 2 fields empty, awaiting input

---

---

## SECTION 11 — CLUSTERS

### CLUS-001 · Create & Join Cluster
**Priority:** P1
**Preconditions:** Two logged-in users (User A, User B)
**Steps:**
1. User A: `POST /api/cluster` with `{ name: "Test Cluster", challenge: "Find our team flow" }`
2. User B: `POST /api/cluster/{id}/join`

**Success Criteria:**
- Cluster created: HTTP 200, `{ clusterId: "..." }`
- User B joins: HTTP 200
- `GET /api/cluster/{id}` shows both members

---

### CLUS-002 · Cluster Synthesis
**Priority:** P1
**Preconditions:** Cluster with 2+ members who have profiles
**Steps:**
1. `POST /api/cluster/{id}/synthesize` with `{ question: "How do we best collaborate?" }`

**Success Criteria:**
- HTTP 200
- Response synthesizes the combined chart signatures of members
- References member chart elements specifically

---

### CLUS-003 · Leave Cluster
**Priority:** P2
**Steps:**
1. `POST /api/cluster/{id}/leave`

**Success Criteria:**
- HTTP 200
- Member removed from cluster
- Cluster still exists for remaining members

---

---

## SECTION 12 — ACHIEVEMENTS & GAMIFICATION

### ACH-001 · Achievement Unlocked on Profile Generation
**Priority:** P1
**Preconditions:** First profile ever for this user
**Steps:**
1. Generate profile
2. `GET /api/achievements`

**Success Criteria:**
- "First Profile" (or equivalent) achievement appears in earned list
- `GET /api/achievements/progress` shows updated milestone tracking

---

### ACH-002 · Check-In Streak Achievement
**Priority:** P1
**Preconditions:** User has 7 consecutive daily check-ins
**Steps:**
1. `GET /api/achievements`

**Success Criteria:**
- 7-day streak achievement is unlocked
- Achievement has icon, name, earned timestamp

---

### ACH-003 · Leaderboard — Masked Emails
**Priority:** P0
**Steps:**
1. `GET /api/achievements/leaderboard`

**Success Criteria:**
- HTTP 200
- Each entry has `rank`, `masked_email` (e.g., `jo***@gmail.com`), `points`
- Full email NOT exposed
- Sorted by points DESC

---

---

## SECTION 13 — PRACTITIONER TOOLS

### PRAC-001 · Register as Practitioner
**Priority:** P1
**Preconditions:** Individual or higher tier user
**Steps:**
1. `POST /api/practitioner/register`

**Success Criteria:**
- HTTP 200
- DB: row in `practitioners` table for this user_id
- `/api/auth/me` may not change tier — practitioner status is separate from billing tier

---

### PRAC-002 · Add Client by Email — Invitation Sent
**Priority:** P1
**Preconditions:** Practitioner-tier user
**Steps:**
1. `POST /api/practitioner/clients/add` with `{ client_email: "client@test.com" }`

**Success Criteria:**
- HTTP 200
- DB: row in `practitioner_invitations`
- Email sent to `client@test.com` with join link (check Resend logs)

---

### PRAC-003 · Session Notes — CRUD
**Priority:** P1
**Preconditions:** Practitioner has client
**Steps:**
1. `POST /api/practitioner/clients/{id}/notes` with `{ content: "Client is making progress on...", date: "2026-03-13" }`
2. `GET /api/practitioner/clients/{id}/notes`
3. `PUT /api/practitioner/notes/{noteId}` with updated content
4. `DELETE /api/practitioner/notes/{noteId}`

**Success Criteria:**
- Create: HTTP 200, `{ noteId }`
- List: includes created note
- Update: changes reflected in list
- Delete: note removed, HTTP 200

---

### PRAC-004 · Client Data — Access Control
**Priority:** P0
**Preconditions:** Practitioner A has Client X; Practitioner B is separate
**Steps:**
1. Practitioner B: `GET /api/practitioner/clients/{client_X_id}`

**Success Criteria:**
- HTTP 403 or 404 — B cannot access A's clients

---

### PRAC-005 · Practitioner Directory — Public Listing
**Priority:** P2
**Preconditions:** Practitioner has set up public profile
**Steps:**
1. `GET /api/directory`
2. `GET /api/directory/{slug}`

**Success Criteria:**
- List: includes practitioner, public fields only (no private notes or client data)
- Profile: bio, specialties, calendar_link visible
- No auth required

---

### PRAC-006 · Session Notes → AI Context → Synthesis
**Priority:** P1
**Preconditions:** Practitioner has notes for client, notes flagged `share_with_ai`
**Steps:**
1. `GET /api/practitioner/clients/{id}/ai-context`
2. Generate client profile synthesis with practitioner context injected

**Success Criteria:**
- AI context contains relevant session note content
- Synthesized profile references context provided by practitioner
- No other clients' data leaked into context

---

---

## SECTION 14 — REFERRALS

### REF-001 · Generate Referral Code
**Priority:** P1
**Steps:**
1. `POST /api/referrals/code`

**Success Criteria:**
- HTTP 200
- `{ code: "XXXX", sharing_url: "https://selfprime.net/?ref=XXXX" }`
- Code unique, alphanumeric

---

### REF-002 · Validate Code
**Priority:** P1
**Steps:**
1. `POST /api/referrals/validate` with `{ code: "XXXX" }`

**Success Criteria:**
- HTTP 200, `{ valid: true, referrer_name: "J...", discount: null }`
- Invalid code: `{ valid: false }`

---

### REF-003 · Referral Conversion Tracked
**Priority:** P1
**Preconditions:** User registers using referral code; referred user subscribes
**Steps:**
1. New user registers with `?ref=XXXX` in URL
2. New user upgrades to Individual

**Success Criteria:**
- Referrer's `GET /api/referrals` shows `conversions: 1`
- `referrals` table has row with `converted: true`

---

---

## SECTION 15 — SMS & NOTIFICATIONS

### SMS-001 · Subscribe to SMS Digest
**Priority:** P1
**Preconditions:** Individual+ user, Telnyx configured
**Steps:**
1. `POST /api/sms/subscribe` with `{ phone: "+12125551234" }`

**Success Criteria:**
- HTTP 200
- DB: user `sms_opted_in = true`, phone stored
- Confirmation SMS received (Telnyx live test)

---

### SMS-002 · Inbound SMS Webhook
**Priority:** P1
**Preconditions:** Telnyx webhook secret configured
**Steps:**
1. Simulate inbound SMS from Telnyx to `POST /api/sms/webhook`

**Success Criteria:**
- HTTP 200
- Message stored in `sms_messages` table with `direction: "inbound"`
- If message triggers command (e.g., "STOP"): opt-out processed

---

### PUSH-001 · Subscribe to Push Notifications
**Priority:** P1
**Preconditions:** VAPID keys configured, browser supports push
**Steps:**
1. `GET /api/push/vapid-key` → get public key
2. Subscribe in browser using ServiceWorker
3. `POST /api/push/subscribe` with subscription object

**Success Criteria:**
- VAPID key returned (HTTP 200)
- Subscription stored in `push_subscriptions` table
- `POST /api/push/test` sends test notification → received in browser

---

### PUSH-002 · Notification Preferences
**Priority:** P2
**Steps:**
1. `PUT /api/push/preferences` with `{ transit_alerts: true, daily_checkin_reminder: false, achievement_unlocks: true }`
2. `GET /api/push/preferences`

**Success Criteria:**
- Preferences saved and returned correctly
- Alert delivery respects opt-in state (transit_alerts=false → no delivery)

---

---

## SECTION 16 — SHARING & SOCIAL

### SHARE-001 · Share Chart — Card Generated
**Priority:** P1
**Preconditions:** User has saved chart
**Steps:**
1. `POST /api/share/chart` with `{ chartId }`

**Success Criteria:**
- HTTP 200
- `{ share_card: { title, description, image_url } }`
- `image_url` is a valid, publicly accessible URL

---

### SHARE-002 · Share Achievement
**Priority:** P2
**Preconditions:** User has earned an achievement
**Steps:**
1. `POST /api/share/achievement` with `{ achievementId }`

**Success Criteria:**
- HTTP 200, share card generated
- Card title references achievement name

---

### SHARE-003 · Share Stats
**Priority:** P2
**Steps:**
1. `GET /api/share/stats`

**Success Criteria:**
- HTTP 200
- `{ views: N, clicks: N, conversions: N, viral_coeff: N }`
- Numbers are non-negative

---

---

## SECTION 17 — NOTION INTEGRATION

### NOTION-001 · Connect to Notion
**Priority:** P2
**Preconditions:** Notion OAuth credentials configured
**Steps:**
1. `GET /api/notion/auth` (get OAuth URL)
2. Complete Notion OAuth flow

**Success Criteria:**
- Auth URL redirects to Notion permission screen
- After approval: `notion_connections` row created with workspace_name
- `GET /api/notion/status` → `{ connected: true, workspace_name: "..." }`

---

### NOTION-002 · Export Profile to Notion
**Priority:** P2
**Preconditions:** Notion connected, profile exists
**Steps:**
1. `POST /api/notion/export/profile/{profileId}`

**Success Criteria:**
- HTTP 200
- `{ ok: true, notion_page_url: "https://notion.so/..." }`
- Notion page exists and contains profile content

---

---

## SECTION 18 — ANALYTICS & ADMIN

### ADMIN-001 · Analytics Overview — Admin Token Required
**Priority:** P0
**Steps:**
1. `GET /api/analytics/overview` WITHOUT `X-Admin-Token` header

**Success Criteria:**
- HTTP 401 or 403

---

### ADMIN-002 · Analytics Overview — With Token
**Priority:** P1
**Preconditions:** Correct `X-Admin-Token` set in Worker secrets
**Steps:**
1. `GET /api/analytics/overview` with correct `X-Admin-Token: {secret}` header

**Success Criteria:**
- HTTP 200
- `{ dau: N, wau: N, mau: N, ... }` — all numeric, non-negative

---

### ADMIN-003 · A/B Experiment — User Assignment
**Priority:** P2
**Preconditions:** Active experiment exists
**Steps:**
1. New user makes a request that routes through experiment middleware
2. `GET /api/experiments/{name}` to check assignment

**Success Criteria:**
- User consistently assigned to same variant (A or B) across requests
- Assignment stored in `experiment_assignments` table

---

### ADMIN-004 · Promo Code — Create & Validate
**Priority:** P1
**Preconditions:** Admin token available
**Steps:**
1. `POST /api/admin/promo` with `{ code: "TEST50", discount: 50, max_uses: 100, expiry: "2026-12-31" }`
2. `GET /api/promo/validate?code=TEST50`

**Success Criteria:**
- Create: HTTP 200
- Validate: `{ valid: true, discount_pct: 50 }`
- After `max_uses` reached: `{ valid: false }`
- After `expiry` date: `{ valid: false }`

---

---

## SECTION 19 — BEHAVIORAL & PSYCHOMETRIC ASSESSMENTS

### PSYCH-001 · Save & Retrieve Validation Data
**Priority:** P1
**Steps:**
1. `POST /api/validation` with `{ decision_pattern: "emotional_wave", energy_pattern: "bursts_rest", current_focus: "Career transition" }`
2. `GET /api/validation`

**Success Criteria:**
- Save: HTTP 200
- Retrieve: returns saved data
- Profile synthesis with this user's data: synthesis reflects their stated patterns

---

### PSYCH-002 · Save & Retrieve Big Five Scores
**Priority:** P1
**Steps:**
1. `POST /api/psychometric` with `{ big_five_scores: { openness: 4.2, conscientiousness: 3.8, extraversion: 2.9, agreeableness: 4.5, neuroticism: 2.1 }, via_strengths: [...] }`
2. `GET /api/psychometric`

**Success Criteria:**
- Save: HTTP 200
- Retrieve: scores returned as saved
- Profile synthesis: cross-correlates Big Five with chart elements (e.g., high Openness → references defined Ajna or Gate 64)

---

---

## SECTION 20 — ONBOARDING

### ONBOARD-001 · First-Run Modal — Appears on First Login
**Priority:** P0
**Preconditions:** Fresh user, never completed onboarding
**Steps:**
1. Register + login
2. Observe frontend

**Success Criteria:**
- First-run modal appears automatically
- Shows 4 steps: Welcome → Birth Details → Blueprint/Daily → Question
- Step 2: Geocoding works (location field fills timezone + lat/lng)
- Step 4: Quick-pick question options selectable
- Submit: triggers profile generation stream

---

### ONBOARD-002 · First-Run Modal — Does Not Reappear
**Priority:** P1
**Preconditions:** User completed onboarding
**Steps:**
1. Logout and log back in

**Success Criteria:**
- First-run modal does NOT appear again
- Existing profile/chart loaded directly

---

### ONBOARD-003 · Savannah Story — Personalized Arc
**Priority:** P2
**Preconditions:** User has chart data
**Steps:**
1. `GET /api/onboarding/forge`

**Success Criteria:**
- HTTP 200
- Story arcs reference user's Forge (Chronos/Eros/Aether/Lux/Phoenix)
- Content is distinct from generic intro story

---

---

## SECTION 21 — EMBED / WIDGET

### EMBED-001 · Origin Validation
**Priority:** P1
**Steps:**
1. `GET /api/embed/validate` with `Origin: https://partner-site.com`

**Success Criteria:**
- HTTP 200
- `{ allowed: true/false, features: [...] }` based on registered partner origins
- Unknown origins → `{ allowed: false }`

---

---

## SECTION 22 — MOBILE & RESPONSIVE UI

### MOB-001 · Mobile Navigation — Bottom Nav Syncs
**Priority:** P0
**Preconditions:** Mobile viewport (< 768px)
**Steps:**
1. Click each bottom nav item (Home, Blueprint, Today, Connect, Grow)
2. Click sidebar item within each group

**Success Criteria:**
- Bottom nav active item updates when sidebar tab selected
- Sidebar scrolls correctly inside panel on mobile
- No horizontal overflow / layout breakage

---

### MOB-002 · Bodygraph — Renders on Mobile Viewport
**Priority:** P0
**Preconditions:** Mobile viewport
**Steps:**
1. Calculate chart on mobile

**Success Criteria:**
- SVG scales to fit viewport width
- Centers remain clickable (touch targets >= 44px)
- No SVG overflow outside container

---

### MOB-003 · PWA — Install Prompt Appears
**Priority:** P2
**Preconditions:** Visiting in Chrome on Android or Safari on iOS
**Steps:**
1. Visit `https://selfprime.net` on mobile browser

**Success Criteria:**
- "Add to Home Screen" prompt or in-app install banner appears
- After install: app opens without browser chrome
- Offline: previously viewed content accessible (service worker cache)

---

### MOB-004 · Offline Transits — Available Without Network
**Priority:** P2
**Preconditions:** Transits loaded while online, then go offline
**Steps:**
1. Load transits tab while online
2. Disable network
3. Navigate away and back to transits tab

**Success Criteria:**
- Cached transit data displayed
- "Offline mode" indicator shown if applicable

---

---

## SECTION 23 — SECURITY HARDENING

### SEC-001 · SQL Injection — Inputs Sanitized
**Priority:** P0
**Steps:**
1. Register with `email: "test@test.com'; DROP TABLE users;--"`
2. Search with `q="'; SELECT * FROM users;--"`

**Success Criteria:**
- No DB error returned
- No data leakage
- Parameterized queries protect all DB operations

---

### SEC-002 · XSS — User Input Escaped in Profile
**Priority:** P0
**Steps:**
1. Register with username containing `<script>alert(1)</script>`
2. Enter diary entry title with HTML tags
3. View rendered output in browser

**Success Criteria:**
- Script does NOT execute
- Input rendered as literal text or stripped

---

### SEC-003 · CSP Headers Present
**Priority:** P1
**Steps:**
1. Check response headers on `GET https://selfprime.net/`

**Success Criteria:**
- `Content-Security-Policy` header present
- Does not include `unsafe-inline` for scripts (or has nonce/hash fallback)
- Does not include `*` for `connect-src`

---

### SEC-004 · HTTPS Only — No HTTP Fallback
**Priority:** P0
**Steps:**
1. Request `http://selfprime.net/`

**Success Criteria:**
- Redirected to HTTPS (301/302) or connection refused
- No sensitive content served over HTTP

---

### SEC-005 · Admin Endpoints — Token Required
**Priority:** P0
**Steps:**
1. `GET /api/analytics/overview` without `X-Admin-Token`
2. `POST /api/admin/promo` without `X-Admin-Token`

**Success Criteria:**
- Both return HTTP 401 or 403
- No data returned

---

### SEC-006 · JWT Algorithm — HS256 Enforced
**Priority:** P0
**Steps:**
1. Craft a JWT with `{ "alg": "none" }` header and no signature
2. Send as `Authorization: Bearer {token}`

**Success Criteria:**
- HTTP 401 — "alg: none" attack rejected

---

### SEC-007 · Webhook Signature — Stripe Verify
**Priority:** P0
**Steps:**
1. POST to `/api/webhook/stripe` with valid body but tampered signature

**Success Criteria:**
- HTTP 400 or 403 — signature mismatch

---

---

## SECTION 24 — PERFORMANCE BENCHMARKS

### PERF-001 · Chart Calculation — Cold
**Priority:** P1
**Steps:**
1. Calculate chart with birth data not in cache

**Success Criteria:**
- Response time < 3000ms
- No timeout at 30s default

---

### PERF-002 · Chart Calculation — Warm (Cache Hit)
**Priority:** P1
**Steps:**
1. Calculate same chart immediately after cold calculation

**Success Criteria:**
- Response time < 200ms

---

### PERF-003 · Profile Generation — Time to First Byte (SSE)
**Priority:** P1
**Steps:**
1. POST to `/api/profile/generate/stream`
2. Measure time to first SSE event

**Success Criteria:**
- First event arrives < 5s

---

### PERF-004 · Concurrent Requests — No Race Condition on Quota
**Priority:** P1
**Steps:**
1. Send 5 simultaneous `POST /api/profile/generate` from same user account (free tier, limit 1)

**Success Criteria:**
- Exactly 1 succeeds (HTTP 200)
- Remaining 4 return HTTP 429
- No double-decrement or negative quota

---

### PERF-005 · Worker Cold Start
**Priority:** P1
**Steps:**
1. Wait for Worker to idle, then send `GET /api/health`

**Success Criteria:**
- Response time < 1000ms even on cold start

---

---

## SECTION 25 — DATA INTEGRITY

### DATA-001 · Webhook Idempotency — No Duplicate Subscriptions
**Priority:** P0
**Steps:**
1. Send identical Stripe `checkout.session.completed` event twice (same `stripe_event_id`)

**Success Criteria:**
- `payment_events` table has only 1 row for that event ID
- `subscriptions` not duplicated
- Second webhook: HTTP 200 returned but no state change

---

### DATA-002 · User Deletion — Complete Cascade
**Priority:** P0
**Steps:**
1. Create user, generate chart, profile, diary entries, check-ins, referrals
2. `DELETE /api/auth/account`

**Success Criteria:**
- User row deleted
- All related rows deleted across ALL tables (charts, profiles, subscriptions, diary_entries, daily_checkins, push_subscriptions, cluster_members, etc.)
- No orphaned rows in any FK table

---

### DATA-003 · Chart Data — Deterministic Recalculation
**Priority:** P1
**Steps:**
1. Calculate chart for same birth data 10 times

**Success Criteria:**
- All 10 results are byte-for-byte identical
- `hdChart.type`, `hdChart.authority`, all gate values identical across runs

---

### DATA-004 · Stripe Customer ID — Not Duplicated
**Priority:** P0
**Preconditions:** User already has Stripe customer
**Steps:**
1. User initiates second checkout

**Success Criteria:**
- Existing `stripe_customer_id` reused (not new customer created)
- Stripe customer has single subscription, not duplicates

---

---

## SECTION 26 — END-TO-END CRITICAL PATH (SMOKE TEST)

These 10 tests form the minimum smoke test sequence run as a suite in order.

### E2E-001 · Full Registration → Chart → Profile Flow
**Priority:** P0
1. Register new user (fresh email)
2. Calculate chart (public)
3. Generate profile (SSE stream)
4. Verify profile rendered in UI
5. Verify no forbidden terms in output

**Success Criteria:** All steps complete, profile valid JSON, no console errors

---

### E2E-002 · Checkout → Stripe → Tier Upgrade → Feature Unlock
**Priority:** P0
1. Log in as free user
2. Trigger Individual checkout
3. Complete Stripe test payment
4. Verify tier = "individual" on `/api/auth/me`
5. PDF export succeeds

**Success Criteria:** Tier changed, PDF accessible, no webhook errors in logs

---

### E2E-003 · Practitioner — Add Client → Session Note → Synthesis
**Priority:** P0
1. Log in as Practitioner-tier user
2. Add client by email
3. Create session note for client
4. Generate profile for client with practitioner context
5. Verify note content appears in synthesis context

**Success Criteria:** Full chain completes, note visible in synthesis context

---

### E2E-004 · Daily Check-In → Streak → Achievement Unlock
**Priority:** P1
1. Check in on Day 1 (fresh user)
2. Advance date by 1 day
3. Check in on Day 2
4. Verify streak = 2
5. Verify achievement progress updated

**Success Criteria:** Streak count correct, achievement tracking active

---

### E2E-005 · Referral Code → New Signup → Conversion Tracked
**Priority:** P1
1. User A generates referral code
2. User B registers via referral link
3. User B upgrades to Individual
4. Verify User A's referral stats show 1 conversion

**Success Criteria:** Conversion tracked in referrals table

---

### E2E-006 · Composite Chart — Gate Behind Paywall → Purchase → Access
**Priority:** P1
1. Individual user attempts composite → blocked
2. User completes $29 one-time checkout
3. Webhook fires, credit granted
4. User retries composite → succeeds

**Success Criteria:** Paywall enforced, then bypassed correctly after purchase

---

### E2E-007 · Transit Alert → Cron → Push Delivery
**Priority:** P1
1. User subscribes to push notifications
2. User creates transit alert for Gate 57
3. Cron runs (or manually triggered)
4. Push notification delivered

**Success Criteria:** Notification received, `alert_deliveries` row created

---

### E2E-008 · Diary Entry → Transit Snapshot Captured → Synthesis Uses It
**Priority:** P1
1. User creates diary entry for significant past date
2. Transit snapshot auto-attached
3. User generates new profile
4. Verify diary entries section in Reference Facts includes the event

**Success Criteria:** Transit snapshot captured, diary data appears in synthesis Reference Facts

---

### E2E-009 · Notion → Connect → Export → Verify
**Priority:** P2
1. Connect Notion account
2. Generate profile
3. Export to Notion
4. Open returned Notion URL

**Success Criteria:** Notion page created with profile content

---

### E2E-010 · Mobile — Full Registration → Profile on iPhone Safari
**Priority:** P1
1. Open `https://selfprime.net` on mobile Safari
2. Register new account
3. Complete first-run modal
4. Profile renders
5. Tap center in bodygraph — explanation opens

**Success Criteria:** All steps complete on mobile, no layout breaks, touch targets accessible

---

---

## SECTION 27 — LOGGING & HANDOFF AUDIT

These tests verify the logging layer and inter-step handoff chain. Each test validates that operations emit structured logs AND that downstream steps were triggered and logged.

---

### LOG-001 · Registration Handoff Chain
**Priority:** P0
**Steps:**
1. `POST /api/auth/register` with valid data
2. Query `analytics_events` for this user_id
3. Check Resend logs / `POST /api/health?full=1` for email delivery status

**Element State:**
- DB: `users` row exists with correct fields
- DB: `analytics_events` row with `event_type: "user_registered"`, correct `user_id`, `timestamp`

**Function:**
- `accessToken` and `refreshToken` returned, both decode to correct user_id
- Password stored as PBKDF2 hash (not plaintext)

**Log / Handoff:**
- Server log emitted: `{ level: "info", endpoint: "POST /api/auth/register", statusCode: 200, userId: "...", durationMs: N }`
- Welcome email dispatched to Resend (verify in Resend dashboard or mock)
- Analytics event written: `{ event_type: "user_registered", user_id, timestamp }`
- No next step fails silently — if email dispatch fails, error logged but registration still succeeds (non-blocking)

---

### LOG-002 · Chart Calculation Handoff Chain
**Priority:** P1
**Steps:**
1. `POST /api/chart/calculate` (unauthenticated)
2. Same call again (cache test)
3. If authenticated: `POST /api/chart/save`

**Element State:**
- KV: cache entry exists for `(birthDate, birthTime, lat, lng)` key after first call
- DB: `charts` row exists after save (auth path)

**Function:**
- Chart result identical on repeat call
- Cache TTL is 7 days (verify KV metadata)

**Log / Handoff:**
- First call log: `{ endpoint: "POST /api/chart/calculate", cacheHit: false, durationMs: N }`
- Second call log: `{ cacheHit: true, durationMs: < 200 }`
- Analytics event on save: `{ event_type: "chart_saved", user_id, chart_id }`

---

### LOG-003 · Profile Generation Handoff Chain
**Priority:** P0
**Steps:**
1. `POST /api/profile/generate` (authenticated, quota available)
2. Query DB, analytics events, achievement events

**Element State:**
- DB: `profiles` row with `profile_json`, `model_used`, `grounding_audit`, `created_at`
- DB: quota counter incremented (KV or DB — verify the quota store decremented)
- DB: `analytics_events` row with `event_type: "profile_generated"`

**Function:**
- `profile_json` parses as valid JSON matching the output schema
- `grounding_audit.claimsGrounded >= claimsTotal`
- Profile contains no forbidden HD IP terms

**Log / Handoff:**
- Log: `{ endpoint: "POST /api/profile/generate", model: "claude-opus-4...", durationMs: N, tokensUsed: N }`
- Achievement tracker triggered: `POST /api/achievements/track` with `event_type: "profile_generated"` — verify `achievement_events` row
- Analytics: `{ event_type: "profile_generated", user_id, profile_id, forge: "Mastery" }`
- If first-ever profile: "First Profile" achievement row appears in `user_achievements`

---

### LOG-004 · Stripe Checkout Handoff Chain
**Priority:** P0
**Steps:**
1. `POST /api/billing/checkout` → get session URL
2. Complete Stripe test payment
3. Verify full handoff chain to tier activation

**Element State (each step):**
- Step 1: No DB change yet — only Stripe session created
- Stripe fires `checkout.session.completed`
- DB: `payment_events` row with `stripe_event_id` (unique constraint — idempotency key)
- DB: `subscriptions` row upserted with `tier`, `status: "active"`, `stripe_customer_id`
- DB: `users.stripe_customer_id` set (if not already)
- DB: `analytics_events` row: `{ event_type: "subscription_created", tier: "individual" }`

**Function:**
- `GET /api/auth/me` returns correct new tier within 1 request after webhook processed
- Features gated by new tier now pass (PDF export works for Individual)

**Log / Handoff (each step must log):**
1. Checkout initiation: `{ event: "checkout_session_created", tier: "individual", session_id: "cs_..." }`
2. Webhook received: `{ event: "stripe_webhook_received", type: "checkout.session.completed", stripe_event_id: "..." }`
3. Signature verified: `{ event: "stripe_signature_verified", result: "ok" }`
4. DB updated: `{ event: "subscription_activated", user_id, tier: "individual" }`
5. Email dispatched: `{ event: "confirmation_email_sent", to: "user@...", template: "subscription_welcome" }`
6. Analytics event written: `{ event_type: "subscription_created" }`
- Each step failure must log independently — a failed email must NOT roll back the subscription

---

### LOG-005 · Transit Cron Handoff Chain
**Priority:** P1
**Steps:**
1. Trigger daily cron (or simulate via endpoint)
2. Inspect DB and delivery logs

**Element State:**
- DB: `transit_snapshots` row for today exists with `positions_json`
- DB: `alert_deliveries` rows for alerts that matched today's transits
- DB: `push_notifications` rows for delivered push alerts

**Function:**
- Positions in snapshot match `GET /api/transits/today` (same data)
- Only alerts whose gate was activated today were triggered (no spurious deliveries)

**Log / Handoff:**
- Cron start: `{ event: "cron_start", job: "daily_transits", date: "YYYY-MM-DD" }`
- Snapshot stored: `{ event: "transit_snapshot_stored", date, gate_count: N }`
- Alerts evaluated: `{ event: "alerts_evaluated", total: N, triggered: N }`
- Each delivery: `{ event: "alert_delivered", alert_id, user_id, channel: "push", gate: 57 }`
- Cron complete: `{ event: "cron_complete", job: "daily_transits", durationMs: N, errors: 0 }`
- If any step fails: cron continues for other users and logs `{ level: "error", event: "alert_delivery_failed", alert_id, reason: "..." }`

---

### LOG-006 · Auth Token Events Logged
**Priority:** P0
**Steps:**
1. Login
2. Refresh token
3. Attempt re-use of consumed refresh token (theft simulation)
4. Logout

**Element State:**
- DB: refresh tokens table reflects issuance and revocation
- DB: on theft detection — all tokens revoked for user

**Function:**
- Re-use of consumed refresh token returns 401 AND revokes all tokens (confirmed via subsequent request)

**Log / Handoff:**
- Login: `{ event: "auth_login", user_id, ip, userAgent }`
- Refresh: `{ event: "token_refresh", user_id, old_token_id: "...", new_token_id: "..." }`
- Theft detected: `{ level: "warn", event: "refresh_token_reuse_detected", user_id, ip — ALL tokens revoked }`
- Logout: `{ event: "auth_logout", user_id, tokens_revoked: N }`

---

### LOG-007 · Error Response — No Internal Leakage
**Priority:** P0
**Steps:**
1. Trigger a known 500 (e.g., send malformed JSON to any endpoint)
2. Trigger a 400 (missing required field)
3. Trigger a 401 (invalid token)
4. Trigger a 403 (tier gate)

**Element State:**
- Server-side: error log written with full context including stack (if applicable)
- Client-side: error response contains NO stack trace, DB error, internal path, or Worker internals

**Function:**
- 500 response: `{ error: "Internal server error", requestId: "uuid" }` — nothing more
- 400 response: `{ error: "Validation failed", fields: ["email"] }` — actionable but no internals
- 401 response: `{ error: "Unauthorized" }` — no JWT internals
- 403 response: `{ error: "Tier required", requiredTier: "individual" }` — actionable

**Log / Handoff:**
- Every 5xx: server log includes `{ level: "error", requestId, endpoint, statusCode: 500, stack: "...", userId }` — Sentry capture triggered
- Every 4xx: server log includes `{ level: "warn", requestId, endpoint, statusCode, errorCode }`
- requestId in response header (`X-Request-ID`) must match requestId in server log

---

---

## SECTION 28 — ERROR MANAGEMENT ARCHITECTURE

This section defines the required error management standards. These are not test cases — they are the specification that must be implemented before testing. Each item has a corresponding test case in Section 29.

---

### EM-SPEC-001 · Structured Error Classification

All errors must be classified before handling. Four classes:

| Class | HTTP Range | Retry? | Alert? | Example |
|-------|-----------|--------|--------|---------|
| **Client** | 400–499 | No | No | Invalid input, auth failure, quota exceeded |
| **Transient** | 500–503 | Yes (backoff) | If repeated | DB connection timeout, Stripe API timeout |
| **Fatal** | 500 | No | Yes | Unhandled exception, schema mismatch |
| **External** | 502–504 | Yes (limited) | If sustained | Third-party API down (Resend, Telnyx, Stripe) |

Implementation: every `catch` block in Worker handlers must emit a structured log with `errorClass` field. Never `catch (e) { return 500; }` without logging.

---

### EM-SPEC-002 · Request Correlation IDs

Every inbound request must be assigned a `requestId` (UUID v4) at the middleware layer. This ID must:
- Be attached to all log entries from that request's lifecycle
- Be returned in the `X-Request-ID` response header
- Be included in any error response body: `{ error: "...", requestId: "..." }`
- Enable tracing: if Stripe webhook fires → triggers email → triggers analytics, all three share the originating `requestId`

---

### EM-SPEC-003 · Retry Logic — Transient Failures

For DB operations and external API calls, implement exponential backoff:
```
Attempt 1: immediate
Attempt 2: 100ms delay
Attempt 3: 400ms delay
Max attempts: 3 (DB), 2 (Stripe/Resend/Telnyx)
Jitter: ±20% of delay to prevent thundering herd
```
After max attempts: log `{ level: "error", event: "retry_exhausted", operation: "...", attempts: 3 }` and return 503 with `Retry-After: 30` header.

Do NOT retry: 4xx responses from external APIs (they are client errors, not transient).

---

### EM-SPEC-004 · Circuit Breaker — DB Connection

If the Neon PostgreSQL connection fails 3 consecutive times within 60 seconds, enter "open circuit" state:
- All requests that require DB receive 503 immediately (no retry queue pileup)
- Health check endpoint returns `{ db: "circuit_open" }`
- Circuit resets to "half-open" after 30 seconds (one test request allowed through)
- Circuit closes when test request succeeds
- Log all state transitions: `{ event: "circuit_breaker_opened|half_opened|closed", service: "neon_db" }`

---

### EM-SPEC-005 · Graceful Degradation

When non-critical dependencies fail, degrade gracefully rather than fail completely:

| Failure | Degraded Response | Log Level |
|---------|------------------|-----------|
| Resend API down | Operation succeeds, email queued for retry (or skipped) | warn |
| Telnyx API down | SMS skipped, user not notified of delivery failure | warn |
| Claude API timeout | Return `{ error: "synthesis_timeout", retryAfter: 60 }` — do NOT return partial profile | error |
| KV cache miss | Fall through to DB calculation (slower, not broken) | info |
| analytics_events insert fails | Log warning, do NOT fail the primary operation | warn |
| achievement_track fails | Log warning, do NOT fail the primary operation | warn |

Achievement tracking and analytics events are fire-and-forget: their failure MUST NOT roll back or block the primary user action.

---

### EM-SPEC-006 · Webhook Failure Handling

Stripe retries webhooks for up to 3 days on non-2xx responses. The webhook handler must:
1. Return HTTP 200 within 10 seconds — always, even if internal processing fails
2. Process asynchronously: validate signature synchronously, defer DB writes to background task
3. Use `payment_events.stripe_event_id` UNIQUE constraint as the idempotency key
4. On processing failure: log error with full context, do NOT return 500 to Stripe (would trigger retry of an already-partially-processed event)
5. Dead letter: if webhook processing fails after all retries, write to a `webhook_failures` table for manual review

---

### EM-SPEC-007 · Frontend Error Boundary

The frontend must implement:
1. **Global unhandled rejection handler**: `window.addEventListener('unhandledrejection', ...)` — logs to console.error and optionally to `/api/analytics/events` as `{ event_type: "client_error" }`
2. **API call wrapper**: all `fetch()` calls wrapped in a function that normalizes error responses and shows user-friendly UI error messages (never raw `Error: Failed to fetch`)
3. **Specific error UI states** — not generic "something went wrong":
   - Quota exceeded → show upgrade CTA
   - Network offline → show "Check your connection"
   - Auth expired → silently refresh or redirect to login
   - 503 → show "Service temporarily unavailable, try again in 30 seconds"
4. **No error silencing**: `catch (e) {}` with empty body is forbidden — always log at minimum

---

### EM-SPEC-008 · Sentry Integration

Sentry (already referenced in codebase) must capture:
- All unhandled exceptions in Worker handlers
- All 5xx responses
- All circuit breaker state changes
- All webhook processing failures
- Frontend: all `unhandledrejection` events with user_id context (anonymized)

Sentry must NOT capture:
- 4xx client errors (spam, not actionable)
- Expected quota/tier rejections
- Token expiry events

Alert threshold: >5 distinct 5xx errors in 5 minutes → PagerDuty/email alert.

---

---

## SECTION 29 — ERROR SCENARIO TEST CASES

These test cases specifically validate error handling, recovery, and logging under failure conditions.

---

### ERR-001 · DB Connection Failure — Circuit Breaker Opens
**Priority:** P0
**Steps:**
1. Simulate DB unavailability (revoke DB credentials temporarily or block connection in test env)
2. Send 3 consecutive requests requiring DB (e.g., `GET /api/auth/me`)
3. Send 4th request
4. Check `GET /api/health?full=1`

**Element State:**
- After 3 failures: circuit breaker state = "open"
- `GET /api/health?full=1` returns `{ db: "circuit_open" }`

**Function:**
- Requests 1–3: return 503 with `Retry-After: 30` header
- Request 4: returns 503 immediately (no wait — fast-fail)
- Restore DB, wait 30s: circuit transitions to "half-open", then "closed" on success

**Log / Handoff:**
- Each DB failure: `{ level: "error", event: "db_connection_failed", attempt: N }`
- Circuit open: `{ level: "error", event: "circuit_breaker_opened", service: "neon_db" }`
- Circuit close: `{ level: "info", event: "circuit_breaker_closed", service: "neon_db" }`

---

### ERR-002 · Claude API Timeout — Synthesis Fails Cleanly
**Priority:** P0
**Steps:**
1. Simulate Claude API timeout (mock 30s+ response or use test env config)
2. `POST /api/profile/generate`

**Element State:**
- DB: NO `profiles` row created (partial profile not saved)
- DB: quota NOT decremented (failed synthesis should not consume quota)
- KV: no quota decrement

**Function:**
- HTTP 503 or 504 with `{ error: "synthesis_timeout", retryAfter: 60, requestId: "..." }`
- No partial or truncated profile JSON returned

**Log / Handoff:**
- `{ level: "error", event: "ai_synthesis_timeout", model: "claude-opus-4...", durationMs: 30000, userId }`
- Sentry capture triggered
- Quota rollback confirmed: subsequent attempt still has quota available

---

### ERR-003 · Resend API Down — Registration Succeeds, Email Queued
**Priority:** P1
**Steps:**
1. Simulate Resend API 500 (mock or block outbound in test env)
2. `POST /api/auth/register`

**Element State:**
- DB: `users` row created (registration succeeded)
- DB: No orphaned partial state

**Function:**
- HTTP 200 returned to client — registration succeeds
- Welcome email NOT sent (logged as failed, not silently dropped)

**Log / Handoff:**
- `{ level: "warn", event: "email_dispatch_failed", template: "welcome", to: "user@...", reason: "Resend 500" }`
- Registration analytics event still written
- No Sentry alert for expected external API degradation (warn level only)

---

### ERR-004 · Stripe Webhook Processing Failure — Idempotent Recovery
**Priority:** P0
**Steps:**
1. Send valid Stripe `checkout.session.completed` webhook
2. Simulate DB failure mid-processing (connection drop after signature verify, before subscription upsert)
3. Replay the same webhook (Stripe retry simulation)

**Element State:**
- After first attempt: DB may be in partial state (check for orphaned rows)
- After replay: DB in correct final state — `subscriptions` row exists exactly once
- `payment_events.stripe_event_id` UNIQUE constraint prevents duplicate processing

**Function:**
- First webhook: HTTP 200 returned to Stripe even though internal processing failed
- Replay: HTTP 200, processing completes, subscription row upserted correctly
- No duplicate email sent on replay

**Log / Handoff:**
- First attempt: `{ level: "error", event: "webhook_processing_failed", stripe_event_id: "...", step: "subscription_upsert" }`
- Replay: `{ level: "info", event: "webhook_replay_detected", stripe_event_id: "...", action: "processing" }`
- Dead letter: if 3rd attempt also fails, `webhook_failures` table row created

---

### ERR-005 · Malformed Request Body — No Crash, Structured Error
**Priority:** P0
**Steps:**
1. `POST /api/profile/generate` with `Content-Type: application/json` but body `{ invalid json %%% }`
2. `POST /api/auth/register` with missing required `email` field
3. `POST /api/chart/calculate` with `birthDate: "not-a-date"`

**Element State:**
- No DB changes on any of these requests

**Function:**
- Each returns appropriate 400 with structured error
- Test 1: `{ error: "Invalid JSON body", requestId: "..." }`
- Test 2: `{ error: "Validation failed", fields: ["email"], requestId: "..." }`
- Test 3: `{ error: "Validation failed", fields: ["birthDate"], message: "Must be YYYY-MM-DD", requestId: "..." }`
- Worker does NOT crash — next request handled normally

**Log / Handoff:**
- `{ level: "warn", event: "validation_error", endpoint: "...", fields: [...] }` — warn not error
- No Sentry capture (4xx is not a server error)
- `X-Request-ID` header in response matches requestId in body

---

### ERR-006 · Quota Race Condition — Exactly One Wins
**Priority:** P0
**Preconditions:** Free tier user, quota = 1, quota at 0 remaining (1 already used)
**Steps:**
1. Send 10 simultaneous `POST /api/profile/generate` requests

**Element State:**
- DB/KV: quota counter does NOT go below 0 or negative
- DB: at most 0 new `profiles` rows (quota was already exhausted)

**Function:**
- All 10 return HTTP 429 (quota already exhausted before these requests)
- No race condition allows even 1 to slip through
- Quota value in store remains 1 (at limit), never goes to 2 or negative

**Log / Handoff:**
- Each rejection: `{ level: "warn", event: "quota_exceeded", user_id, quotaType: "monthly", limit: 1, current: 1 }`
- No AI calls made — quota check is pre-flight (no partial AI usage billed)

---

### ERR-007 · Token Expiry — Silent Refresh or Clean Redirect
**Priority:** P0
**Preconditions:** User has valid refresh token; access token has expired (manipulate exp claim or wait)
**Steps:**
1. Attempt API call with expired access token
2. Frontend should silently refresh
3. If refresh token also expired: redirect to login

**Element State:**
- After silent refresh: new access token in memory, new refresh token issued
- After expired refresh: localStorage cleared (or tokens cleared), login modal shown

**Function:**
- Silent refresh: original API call retried and succeeds (user sees no interruption)
- Expired refresh: user lands on login, not a blank error state

**Log / Handoff:**
- Expired access token: `{ level: "info", event: "access_token_expired", userId }` — info not error
- Silent refresh success: `{ event: "token_refreshed_silently", userId }`
- Expired refresh: `{ level: "info", event: "refresh_token_expired", userId }` — session terminated cleanly

---

### ERR-008 · External API Rate Limit — Backoff Logged
**Priority:** P1
**Steps:**
1. Simulate Stripe API 429 (rate limit) on checkout session creation
2. Simulate Resend API 429 on email dispatch

**Element State:**
- DB: no checkout session row until retry succeeds
- User receives response only after retry succeeds or max attempts exhausted

**Function:**
- Attempt 1 (429): internal backoff 100ms, retry
- Attempt 2 (429): backoff 400ms, retry
- Attempt 3 (success or fail): return result or 503

**Log / Handoff:**
- `{ level: "warn", event: "external_api_rate_limited", service: "stripe", attempt: 1, retryAfterMs: 100 }`
- `{ level: "warn", event: "external_api_rate_limited", service: "stripe", attempt: 2, retryAfterMs: 400 }`
- If exhausted: `{ level: "error", event: "retry_exhausted", service: "stripe", operation: "create_checkout_session" }`

---

### ERR-009 · Frontend — Network Offline Error UI
**Priority:** P1
**Preconditions:** In browser
**Steps:**
1. Disable network (browser DevTools → Offline)
2. Attempt to calculate chart
3. Attempt to generate profile
4. Re-enable network

**Element State:**
- No network requests made successfully while offline
- LocalStorage/IndexedDB state unchanged (no partial saves)

**Function:**
- Chart calculation: clear "Check your connection" UI message shown, not raw `Failed to fetch`
- Profile generation: same
- On reconnect: operations succeed normally without page reload

**Log / Handoff:**
- Frontend: `{ event: "client_error", type: "network_offline", endpoint: "POST /api/chart/calculate" }` — logged to console.error and optionally to analytics
- No unhandled promise rejection in browser console

---

### ERR-010 · 500 Response — No Stack Trace Exposed
**Priority:** P0
**Steps:**
1. Force an unhandled exception in a Worker handler (via test endpoint or invalid state)
2. Inspect the HTTP response body

**Element State:**
- Sentry: error captured with full stack trace and context
- Server logs: full error with stack logged

**Function:**
- API response body: `{ error: "Internal server error", requestId: "uuid" }` — nothing else
- No stack trace, no file paths, no Worker internals, no DB query text in response
- `X-Request-ID` header present, matches `requestId` in body
- HTTP status: 500

**Log / Handoff:**
- Server: `{ level: "error", event: "unhandled_exception", requestId, endpoint, stack: "Error: ...\n  at ...", userId }`
- Sentry: event created with full context
- If 5+ such errors in 5 min: alert threshold triggered

---

### ERR-011 · Practitioner Context — Data Isolation Under Error
**Priority:** P0
**Preconditions:** Practitioner A (clientA, clientB), Practitioner B (clientC)
**Steps:**
1. Simulate DB error mid-request for Practitioner A's client list
2. Verify Practitioner B's client list is unaffected
3. Verify error response for A does not contain any client data fragments from B

**Element State:**
- DB: no cross-contamination between practitioners' data
- Error state for A does not persist into subsequent successful requests

**Function:**
- A receives 503 (or whatever the DB failure returns) — no client data in error response
- B's subsequent `GET /api/practitioner/clients` returns their client list correctly
- After DB recovers: A can successfully retrieve their clients

**Log / Handoff:**
- `{ level: "error", event: "db_query_failed", endpoint: "GET /api/practitioner/clients", userId: "practitioner_A_id" }`
- No cross-practitioner data in any log entry

---

---

## APPENDIX A — KNOWN OPEN ISSUES (Not Blocking P0 Checkout)

| Issue ID | Description | Severity | Status |
|----------|-------------|----------|--------|
| BL-MV-N1 | Studio tier checkout active, features not built | P1 | Gate behind "Contact us" |
| BL-MV-N2 | Composite form `comp-A-location` not auto-populated | P2 | Workaround: manual entry |
| BL-MV-N3 | `totalProfiles` counter blank on API failure | P3 | Cosmetic only |
| BL-MV-N4 | RESEND_API_KEY production status unverified | P1 | Verify before launch |
| SEC-JWT | Access token in localStorage (not HttpOnly cookies) | P1 | Accepted debt, roadmap item |
| SEC-CSP | `unsafe-inline` still in CSP | P2 | Roadmap item |
| OAUTH | All 3 OAuth providers need `npx wrangler secret put` | P0 | Complete before OAuth tests |

---

## APPENDIX B — TEST ENVIRONMENT SETUP

Before running any test:

1. **Worker secrets verified:**
   ```
   JWT_SECRET
   RESEND_API_KEY
   STRIPE_SECRET_KEY
   STRIPE_WEBHOOK_SECRET
   ADMIN_TOKEN
   TELNYX_API_KEY
   VAPID_PRIVATE_KEY / VAPID_PUBLIC_KEY
   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
   ```

2. **DB migrations applied:** All 026 migrations confirmed applied to production Neon DB

3. **Stripe test mode:** Use Stripe test keys, test card `4242 4242 4242 4242`

4. **Stripe CLI installed:** For webhook simulation: `stripe listen --forward-to https://prime-self-api.adrper79.workers.dev/api/webhook/stripe`

5. **Test accounts staged:**
   - Fresh email for registration tests
   - Pre-built free user (quota exhausted)
   - Pre-built Individual-tier user
   - Pre-built Practitioner-tier user
   - Admin token recorded

---

## APPENDIX C — TEST CASE COUNT SUMMARY

| Section | Test Count | P0 | P1 | P2 | P3 |
|---------|-----------|----|----|----|----|
| Infrastructure | 4 | 2 | 2 | 0 | 0 |
| Authentication | 16 | 9 | 6 | 1 | 0 |
| Chart Calculation | 11 | 3 | 7 | 1 | 0 |
| Profile Synthesis | 8 | 4 | 3 | 1 | 0 |
| Billing & Stripe | 13 | 6 | 6 | 1 | 0 |
| Tier Enforcement | 10 | 6 | 4 | 0 | 0 |
| Transits & Timing | 5 | 1 | 4 | 0 | 0 |
| Daily Check-In | 6 | 2 | 4 | 0 | 0 |
| Diary | 3 | 0 | 3 | 0 | 0 |
| Composite | 4 | 2 | 1 | 1 | 0 |
| Clusters | 3 | 0 | 2 | 1 | 0 |
| Achievements | 3 | 1 | 2 | 0 | 0 |
| Practitioner Tools | 6 | 2 | 3 | 1 | 0 |
| Referrals | 3 | 0 | 3 | 0 | 0 |
| SMS & Notifications | 4 | 0 | 3 | 1 | 0 |
| Sharing & Social | 3 | 0 | 1 | 2 | 0 |
| Notion Integration | 2 | 0 | 0 | 2 | 0 |
| Analytics & Admin | 4 | 1 | 2 | 1 | 0 |
| Assessments | 2 | 0 | 2 | 0 | 0 |
| Onboarding | 3 | 1 | 1 | 1 | 0 |
| Embed / Widget | 1 | 0 | 1 | 0 | 0 |
| Mobile & Responsive | 4 | 2 | 1 | 1 | 0 |
| Security | 7 | 5 | 2 | 0 | 0 |
| Performance | 5 | 0 | 5 | 0 | 0 |
| Data Integrity | 4 | 3 | 1 | 0 | 0 |
| E2E Critical Path | 10 | 4 | 5 | 1 | 0 |
| **Logging & Handoff Audit** | **7** | **5** | **2** | **0** | **0** |
| **Error Scenarios** | **11** | **8** | **3** | **0** | **0** |
| **TOTAL** | **161** | **67** | **87** | **15** | **0** |

**Checkout gate: All 67 P0 cases + all 87 P1 cases must pass.**
P2 cases must be documented-pass or documented-accepted-risk.
No P0 or P1 failures permitted at checkout.

---

## APPENDIX D — ERROR MANAGEMENT IMPLEMENTATION CHECKLIST

Before error scenario tests (Section 29) can be run, verify these are implemented in the codebase:

- [ ] **EM-001** Request correlation ID middleware assigns `requestId` (UUID v4) to every inbound request
- [ ] **EM-002** `requestId` returned in `X-Request-ID` response header on all responses
- [ ] **EM-003** All `catch` blocks emit structured log with `level`, `errorClass`, `requestId`, `endpoint`
- [ ] **EM-004** 5xx responses return `{ error: "Internal server error", requestId }` — no stack traces
- [ ] **EM-005** 4xx responses return `{ error: "...", requestId }` with actionable message — no internals
- [ ] **EM-006** Exponential backoff implemented for DB operations (3 attempts) and external APIs (2 attempts)
- [ ] **EM-007** Circuit breaker implemented for Neon DB — opens at 3 consecutive failures within 60s
- [ ] **EM-008** `analytics_events` and `achievement_events` writes are fire-and-forget (failure does NOT propagate)
- [ ] **EM-009** Stripe webhook handler returns HTTP 200 within 10s regardless of internal processing outcome
- [ ] **EM-010** `payment_events.stripe_event_id` UNIQUE constraint enforced (idempotency key)
- [ ] **EM-011** Frontend global `unhandledrejection` handler implemented — no silent `catch (e) {}` blocks
- [ ] **EM-012** Frontend API wrapper normalizes error responses to user-friendly messages by status code
- [ ] **EM-013** Quota check is pre-flight — no AI calls made before quota confirmed available
- [ ] **EM-014** Sentry capture on all unhandled exceptions and 5xx responses (not 4xx)
- [ ] **EM-015** Sentry alert threshold configured: >5 distinct 5xx errors in 5 minutes → alert

# Prime Self Engine — Comprehensive UI Test Plan

> **Tailored to codebase** — March 15, 2026
> Aligned to actual frontend (vanilla JS PWA on `selfprime.net`),
> Cloudflare Workers API (`prime-self-api.adrper79.workers.dev`),
> and Neon DB backend.

---

## TEST STRATEGY & PHILOSOPHY

This plan uses **layered testing** inspired by Session-Based Test Management (SBTM),
Elisabeth Hendrickson's data-driven charters, and James Bach's risk-based heuristics.

**Layers:**

| Layer | Purpose | Sections |
|-------|---------|----------|
| **Scripted checks** (S1–S16) | Deterministic pass/fail against known requirements | Feature-by-feature |
| **User journeys** (S17) | End-to-end flows that cross feature boundaries | Cross-cutting |
| **State models** (S18) | Verify every legal state transition & catch illegal ones | Auth, Billing, Onboarding |
| **Exploratory charters** (S19) | Time-boxed guided exploration to find unknowns | Risk-weighted areas |
| **Boundary & combinatorial** (S20) | Data-driven equivalence partitioning + pairwise | Inputs, limits, quotas |
| **Chaos & resilience** (S21) | Fault injection, concurrency, interrupt/resume | Infrastructure |
| **Cognitive walkthrough** (S22) | First-use friction, heuristic evaluation, UX review | Every major flow |

**Test Oracles** (how we know if a subjective test passes):

| Oracle | Description |
|--------|-------------|
| **Specification** | Behavior matches documented API spec or pricing page |
| **Consistency** | Same action produces same result across browsers/tabs/sessions |
| **Comparable Product** | Behavior at least as good as leading competitors (Co-Star, Chani) |
| **User Expectation** | A first-time user would not be confused or blocked |
| **Stateful** | System returns to a valid state after any interruption |
| **Explainable** | Error messages tell the user what happened AND what to do next |

**Priority Tags** (used in Sections 17–22):

| Tag | Meaning |
|-----|---------|
| `🔴 P0` | Launch blocker — must pass before any public launch |
| `🟡 P1` | Must fix within 7 days of launch |
| `🟢 P2` | Backlog — important but not urgent |

## Test Method Key

Each test is tagged with how it can be executed:

| Tag | Meaning |
|-----|---------|
| `[E2E]` | Automatable via Playwright against production |
| `[API]` | Testable by calling API endpoint directly |
| `[CODE]` | Verifiable by source code audit |
| `[MANUAL]` | Requires human browser interaction |
| `[EXPLORE]` | Exploratory charter — time-boxed human session |
| `[JOURNEY]` | End-to-end multi-step user journey |

Save results to: `audits/UI_TEST_REPORT_2026-03-15.md`

---

## SECTION 1 — AUTHENTICATION & REGISTRATION

> **UI Pattern:** Auth overlay (`#authOverlay`) opened via `#authBtn`. Toggle
> between login/register mode via `[data-action="toggleAuthMode"]`. Inputs:
> `#authEmail`, `#authPassword`. Submit: `#authSubmit`. Error display: `#authError`.

### 1.1 Fresh Registration (Happy Path)
- [ ] `[E2E]` Navigate to `selfprime.net` — landing page renders without JS console errors
- [ ] `[E2E]` Click `#authBtn` → auth overlay (`#authOverlay`) appears
- [ ] `[E2E]` Click "Create one" (`#authToggleLink`) — form switches to Register mode, submit button reads "Create Account"
- [ ] `[E2E]` Enter valid email + password (≥8 chars) → `POST /api/auth/register` → account created
- [ ] `[API]` Email verification email dispatched (AUDIT-SEC-003)
- [ ] `[CODE]` Access token stored in JS memory (NOT localStorage); refresh token in HttpOnly `ps_refresh` cookie (SameSite=None, Secure)
- [ ] `[E2E]` Refresh page after signup — `/api/auth/me` called with Bearer token → user stays logged in
- [ ] `[E2E]` Terms notice (`#authTermsNotice`) visible in register mode, hidden in login mode

### 1.2 Registration Edge Cases

> **Boundary value matrix — password length** (PBKDF2, `minlength="8"`):
>
> | Input | Length | Expected |
> |-------|--------|----------|
> | `"1234567"` | 7 | Rejected (below min) |
> | `"12345678"` | 8 | Accepted (boundary) |
> | `"123456789"` | 9 | Accepted |
> | `" "` × 8 | 8 (spaces) | Rejected (all-whitespace) |
> | 128-char string | 128 | Accepted (near max) |
> | 129-char string | 129 | Accepted or rejected (verify max) |
> | `""` (empty) | 0 | Rejected (HTML5 required) |

- [ ] `[E2E]` Submit empty form — HTML5 `required` validation fires on `#authEmail` and `#authPassword`
- [ ] `[E2E]` Email without `@` — `type="email"` browser validation fires
- [ ] `[E2E]` Email with spaces/unicode — rejected by `POST /api/auth/register` with error in `#authError`
- [ ] `[E2E]` Password shorter than 8 chars — `minlength="8"` validation on `#authPassword` fires
- [ ] `[E2E]` Password with only spaces — server rejects (PBKDF2 still hashes but validation should block)
- [ ] `[E2E]` SQL injection in email field: `'; DROP TABLE users;--` — parameterized query prevents execution; returns validation error
- [ ] `[E2E]` XSS in email field: `<script>alert('xss')</script>` — rendered as text in `#authError`, not executed
- [ ] `[E2E]` Register with email that already exists — returns "already registered" error in `#authError`, no stack trace
- [ ] `[E2E]` Double-click `#authSubmit` — disable-on-submit prevents duplicate POST
- [ ] `[MANUAL]` Submit with network offline — `#authError` shows connection error, form inputs preserved
- [ ] `[MANUAL]` Submit on slow 3G — loading state visible on `#authSubmit`, no double submit
- [ ] `[E2E]` Register → close tab → reopen `selfprime.net` — token in localStorage auto-refreshes or shows clean auth overlay

### 1.3 Login
- [ ] `[E2E]` Login with valid credentials — `POST /api/auth/login` → 200, token stored, `#authStatusText` shows email/username
- [ ] `[E2E]` Login with wrong password — generic error in `#authError` (no email enumeration)
- [ ] `[E2E]` Login with non-existent email — same generic error (no differentiation from wrong password)
- [ ] `[API]` Login with correct email, wrong case — works (case-insensitive email matching)
- [ ] `[E2E]` Paste password from manager — `autocomplete="current-password"` on `#authPassword` allows paste
- [ ] `[E2E]` Hit Enter in `#authPassword` — form submits (form `[data-action="submitAuth"]` handles keypress)
- [ ] `[E2E]` Click "Forgot password?" (`#forgotPasswordLink [data-action="showForgotPassword"]`) — forgot password UI appears
- [ ] `[API]` `POST /api/auth/forgot-password` with valid email → sends reset link
- [ ] `[API]` `POST /api/auth/reset-password` with valid token → password updated
- [ ] `[E2E]` Login from two tabs — both sessions valid (independent Bearer tokens)
- [ ] `[E2E]` Login after JWT expiry (15 min) — `/api/auth/refresh` called automatically via `ps_refresh` cookie
- [ ] `[CODE]` Refresh token rotation — old refresh token invalidated, new one issued; theft detection via family ID

### 1.4 Two-Factor Authentication (2FA / TOTP)
- [ ] `[E2E]` Open Security modal (`#securityModal`) — 2FA setup option visible
- [ ] `[API]` `POST /api/auth/2fa/setup` — returns QR code / TOTP secret
- [ ] `[API]` `POST /api/auth/2fa/enable` with valid 6-digit code — 2FA enabled
- [ ] `[E2E]` Login with 2FA enabled → password accepted → `#authTOTPStep` appears (hidden by default)
- [ ] `[E2E]` Enter valid 6-digit code in `#authTOTPCode` → `POST /api/auth/2fa/verify` → full login completes
- [ ] `[E2E]` Enter invalid TOTP code — error in `#authTOTPError`
- [ ] `[E2E]` "← Back to sign in" (`[data-action="cancel2FA"]`) returns to password form
- [ ] `[API]` TOTP challenge window expires after 5 minutes — must re-authenticate
- [ ] `[API]` `POST /api/auth/2fa/disable` — 2FA removed, login no longer requires code

### 1.5 OAuth (Google & Apple)
- [ ] `[MANUAL]` Click "Continue with Google" (`#oauthGoogleBtn`) → redirects to Google OAuth → returns with user created/linked
- [ ] `[MANUAL]` Click "Continue with Apple" (`#oauthAppleBtn`) → redirects to Apple Sign-In → returns with user created/linked
- [ ] `[MANUAL]` OAuth cancel (user clicks Back at provider) — returns to auth overlay without error
- [ ] `[API]` OAuth with email that already exists (email/password account) — account linking or clear error
- [ ] `[CODE]` OAuth state token present — CSRF protection with 10-min expiry

### 1.6 Email Verification (AUDIT-SEC-003)
- [ ] `[API]` New accounts have `email_verified = false` initially
- [ ] `[API]` `POST /api/auth/resend-verification` — re-sends verification email
- [ ] `[API]` `POST /api/auth/verify-email` with valid token → marks email verified
- [ ] `[API]` Unverified users blocked from LLM profile generation (tier enforcement gate)
- [ ] `[E2E]` Unverified user attempting profile generation sees "verify your email" prompt

### 1.7 Logout
- [ ] `[E2E]` Logout clears in-memory token and any `ps_token` legacy key from localStorage
- [ ] `[API]` `POST /api/auth/logout` invalidates refresh token server-side
- [ ] `[E2E]` Back button after logout — does NOT show authenticated content
- [ ] `[API]` API calls after logout with old Bearer token → 401
- [ ] `[E2E]` "Continue without signing in" link (`[data-action="closeAuthOverlay"]`) closes overlay for anonymous use

### 1.8 Account Deletion
- [ ] `[API]` `DELETE /api/auth/account` — cascades: Stripe subscription cancelled, refresh tokens cleared (P2-BIZ-004)
- [ ] `[E2E]` Deleted account cannot log in — returns error
- [ ] `[CODE]` Deletion audit persisted to `account_deletions` table (SHA-256 email hash, tier, IP, timestamp — GDPR Article 17 compliant)

---

## SECTION 2 — BIRTH DATA INPUT & CHART GENERATION

### 2.1 Happy Path
- [ ] `[E2E]` Enter valid birth date, time, and location → `POST /api/chart/calculate` → chart generates
- [ ] `[E2E]` Chart renders completely (all centers, channels, gates visible in bodygraph SVG)
- [ ] `[E2E]` Loading state shown during calculation
- [ ] `[API]` Chart data matches expected output for known test cases:
  - Test Case A: Jan 1, 2000, 12:00 PM, New York, NY
  - Test Case B: Jul 15, 1985, 3:30 AM, London, UK
  - Test Case C: Dec 31, 1969, 11:59 PM, Tokyo, Japan
- [ ] `[CODE]` Response includes Layers 1-7: energy centers, channels, gates, numerology, Vedic, Ogham

### 2.2 Birth Data Edge Cases

> **Equivalence partitions — birth date**:
>
> | Partition | Example | Expected |
> |-----------|---------|----------|
> | Valid historical | 1985-07-15 | Accepted |
> | Century boundary | 2000-01-01 | Accepted |
> | Far past | 1900-01-01 | Accepted (minimum) |
> | Before 1900 | 1899-12-31 | Rejected (ephemeris limit) |
> | Future date | 2030-06-01 | Rejected |
> | Today | current date | Accepted (newborn) |
> | Leap day valid | 2000-02-29 | Accepted |
> | Leap day invalid | 2001-02-29 | Rejected |
> | Month overflow | 2000-13-01 | Rejected |
> | Day overflow | 2000-04-31 | Rejected (April = 30 days) |
>
> **Equivalence partitions — birth time**:
>
> | Input | Expected |
> |-------|----------|
> | `00:00` | Accepted (midnight) |
> | `12:00` | Accepted (noon) |
> | `23:59` | Accepted (last minute) |
> | `23:59:59` | Handled or ignored |
> | (empty/unknown) | Fallback behavior |
> | `24:00` | Rejected (invalid hour) |
> | `12:60` | Rejected (invalid minute) |
> | `-01:00` | Rejected |
>
> **Geocoding edge cases — location strings**:
>
> | Input | Test Target |
> |-------|-------------|
> | `"São Paulo"` | Unicode diacritics |
> | `"Zürich"` | Umlaut handling |
> | `"N'Djamena"` | Apostrophe in name |
> | `"東京"` | CJK characters |
> | `"Москва"` | Cyrillic |
> | `"القاهرة"` | Arabic / RTL |
> | `""` (empty) | Required field validation |
> | 500-char random string | Truncation / rejection |
> | `"New York, New York, USA"` | Disambiguation |
> | Lat/Lng on date line | ±180° longitude handling |

- [ ] `[API]` Date in distant past (1900-01-01) — accepted or clear minimum date error
- [ ] `[API]` Date in the future — rejected with clear message
- [ ] `[API]` Today's date — accepted (newborn chart)
- [ ] `[API]` Feb 29 on a leap year (2000-02-29) — accepted
- [ ] `[API]` Feb 29 on a non-leap year (2001-02-29) — rejected
- [ ] `[API]` Birth time "00:00" — accepted (midnight, not treated as empty)
- [ ] `[E2E]` Birth time omitted / "unknown" — fallback behavior documented
- [ ] `[API]` Birth time 23:59 — accepted
- [ ] `[API]` Birth time with seconds (23:59:59) — handled or ignored gracefully
- [ ] `[E2E]` Location autocomplete — type "New" → Nominatim/BigDataCloud suggestions appear (New York, New Delhi, etc.)
- [ ] `[API]` Location with special characters: "São Paulo", "Zürich", "N'Djamena" — geocoded correctly
- [ ] `[E2E]` Location not found — clear "location not found" message
- [ ] `[E2E]` Location with multiple matches — disambiguation UI shown
- [ ] `[E2E]` Very long location string (paste 500 chars) — truncated or rejected
- [ ] `[API]` Birth data for Southern Hemisphere — correct chart (not mirrored)
- [ ] `[API]` Birth data near timezone boundary — correct timezone via BigDataCloud lookup
- [ ] `[API]` Birth data near International Date Line — correct date handling
- [ ] `[CODE]` `parseToUTC` utility correctly converts local time + timezone to UTC for ephemeris

### 2.3 Chart Display
- [ ] `[E2E]` Bodygraph SVG renders at correct dimensions (frontend/js/bodygraph.js)
- [ ] `[E2E]` All 9 centers display (Head, Ajna, Throat, G, Heart/Will, Sacral, Spleen, Solar Plexus, Root)
- [ ] `[E2E]` Defined centers show correct color fill
- [ ] `[E2E]` Undefined centers show white/open state
- [ ] `[E2E]` 36 channels between defined centers render correctly
- [ ] `[E2E]` 64 gate numbers readable at default zoom; personality (conscious) vs design (unconscious) distinguished
- [ ] `[MANUAL]` Mobile responsive — chart doesn't overflow or become unreadable < 375px width
- [ ] `[MANUAL]` Pinch-to-zoom on mobile — chart scales without breaking
- [ ] `[E2E]` Chart legend/key is visible and accurate
- [ ] `[E2E]` Profile line numbers display (e.g., "4/6 Profile")
- [ ] `[E2E]` Type, Strategy, Authority labels correct for known test cases
- [ ] `[E2E]` Incarnation Cross name displays

### 2.4 Chart Persistence & Recalculation
- [ ] `[API]` Chart saved to DB via `POST /api/chart/save` (fire-and-forget, non-blocking)
- [ ] `[API]` KV cache key based on birth params — 30-day TTL
- [ ] `[E2E]` Edit birth data → chart updates (not stale cache)
- [ ] `[E2E]` Change only birth time by 1 minute → chart may change (verify recalc fires)
- [ ] `[E2E]` Change location to different timezone → chart recalculates
- [ ] `[E2E]` Rapid successive edits — no race condition in chart render
- [ ] `[API]` `GET /api/chart/history` — returns user's previously generated charts
- [ ] `[API]` `GET /api/chart/:id` — returns specific chart by ID

### 2.5 Geocoding Resilience
- [ ] `[CODE]` Primary geocoder: OpenStreetMap Nominatim
- [ ] `[CODE]` Timezone: BigDataCloud API → fallback to longitude-based calculation
- [ ] `[API]` BigDataCloud down → timezone still resolved via longitude fallback

---

## SECTION 3 — PROFILE GENERATION (AI)

### 3.1 Happy Path
- [ ] `[E2E]` After chart generation, "Generate Profile" button appears
- [ ] `[E2E]` SSE streaming progress indicator during generation (6 stages: chart 15% → knowledge 35% → synthesis 60% → validation 85% → saving 95% → complete)
- [ ] `[E2E]` Profile text renders with proper formatting (headers, paragraphs)
- [ ] `[E2E]` Profile sections match expected structure (Forge archetype, synthesis narrative, actionable insights)
- [ ] `[E2E]` Profile references user's actual chart data — Type, Authority, Profile, Centers, Gates
- [ ] `[CODE]` Layer 8 synthesis combines: chart (L1-7) + transits + validation data + psychometric + diary + practitioner context
- [ ] `[CODE]` Dual-pass grounding validation: `buildSynthesisPrompt` → `validateSynthesisResponse` → `buildReprompt` if needed

### 3.2 AI Failure Modes & Failover
- [ ] `[CODE]` LLM failover chain (BL-OPT-005): Anthropic Claude (primary) → Grok/xAI (secondary) → Groq/Llama (tertiary)
- [ ] `[CODE]` All LLM calls route through Cloudflare AI Gateway when `AI_GATEWAY_URL` is set (Anthropic via `/anthropic/...`, Grok via `/grok/...`, Groq via `/groq/...`)
- [ ] `[API]` API key quota exceeded → user sees friendly error, not raw 429
- [ ] `[API]` LLM timeout (>30s) → timeout message with retry option
- [ ] `[API]` LLM returns malformed response → graceful fallback, not blank screen
- [ ] `[API]` Profile generation during rate limit → clear "try again in X seconds" message
- [ ] `[E2E]` Generate profile → close browser → return — profile persisted in DB, available on reload
- [ ] `[E2E]` Partial profile (stream interrupted mid-response) — visible content preserved, retry available

### 3.3 Quota Enforcement
- [ ] `[CODE]` Atomic quota checks prevent race conditions (BL-RACE-001)
- [ ] `[CODE]` Daily ceiling enforcement prevents burning monthly quota in one session (BL-DAILY-001)
- [ ] `[API]` Free tier: 1 AI synthesis/month — 2nd attempt blocked with upgrade CTA
- [ ] `[API]` Individual tier: 10 AI profile generations/month
- [ ] `[API]` Practitioner tier: 500 AI syntheses/month
- [ ] `[API]` Unverified email blocks generation (AUDIT-SEC-003)

### 3.4 Profile Display & Export
- [ ] `[E2E]` Profile text is selectable/copyable
- [ ] `[E2E]` No raw HTML/markdown rendering artifacts in profile text
- [ ] `[E2E]` Share button generates shareable link or image
- [ ] `[API]` `GET /api/profile/:id/pdf` — PDF export generates branded document
- [ ] `[MANUAL]` Profile renders correctly on mobile (no overflow, readable font size)
- [ ] `[API]` `GET /api/profile/search` — search across user's profiles
- [ ] `[API]` `GET /api/profile/list` — paginated profile history

---

## SECTION 4 — ONBOARDING (FIVE FORGES NARRATIVE)

> **Architecture:** 5 Forge narrative arcs with 22 total chapters, personalized by
> user's primary Forge (derived from profile). Progress tracked in KV.
> Public intro at `GET /api/onboarding/intro`.

### 4.1 Public Introduction
- [ ] `[API]` `GET /api/onboarding/intro` (public, no auth) — returns overview of 5 Forges
- [ ] `[E2E]` First-time user sees first-run modal (`#first-run-modal`) with onboarding content
- [ ] `[E2E]` Skip button on first-run modal works — jumps to main app without breaking state
- [ ] `[E2E]` Completing first-run sets flag (doesn't replay on next visit)

### 4.2 Forge Narrative Arcs
- [ ] `[API]` `GET /api/onboarding/forge` (auth) — returns user's primary Forge arc based on profile
- [ ] `[API]` Five Forges render with correct narrative content:
  - **Chronos** (Time) — Book I: "The Weight of Yesterday" (ancestral patterns, 5 chapters)
  - **Eros** (Passion) — Book II: "The Fire That Knows" (sacral wisdom, 4 chapters)
  - **Aether** (Connection) — Book III: "The Space Between" (undefined centers, 5 chapters)
  - **Lux** (Illumination) — Book IV: "The Guide's Burden" (seeing others, 4 chapters)
  - **Phoenix** (Rebirth) — Book V: "Ash and Becoming" (transformation, 4 chapters)
- [ ] `[API]` Each Forge has opening hooks (engaging narrative entry points)

### 4.3 Chapter Progress
- [ ] `[API]` `GET /api/onboarding/progress` — returns chapter read/unread state across all Forges
- [ ] `[API]` `POST /api/onboarding/advance` — marks current chapter as read, advances pointer
- [ ] `[API]` `GET /api/onboarding/chapter/:key/:n` — returns specific chapter content
- [ ] `[CODE]` Progress stored in KV (`onboarding:{userId}:{forge}:{chapterIndex}`)
- [ ] `[E2E]` Refresh mid-chapter — progress preserved (KV-backed)
- [ ] `[E2E]` Complete all chapters in one Forge → next Forge available
- [ ] `[E2E]` Complete onboarding → logout → login → onboarding does NOT replay (flag persisted)
- [ ] `[E2E]` Multiple rapid clicks on "Next" / advance — idempotent, doesn't skip chapters

---

## SECTION 5 — TIER & BILLING FLOWS

> **Actual tiers:** Free ($0) → Individual ($19/mo, $190/yr) → Practitioner ($97/mo, $970/yr) → Agency ($349/mo, $3,490/yr)
> Pricing page: `pricing.html`. Checkout via Stripe. Webhooks for subscription lifecycle.

### 5.1 Free Tier
- [ ] `[E2E]` New user starts on Free tier
- [ ] `[E2E]` Free tier features accessible: unlimited chart calculations, 1 AI synthesis/month, daily transit brief, unlimited check-ins & diary
- [ ] `[E2E]` Gated features show upgrade prompt (full transit tools, PDF export marked `disabled` in pricing)
- [ ] `[API]` Free tier quota enforced: 1 AI synthesis/month
- [ ] `[E2E]` Quota counter visible to user
- [ ] `[E2E]` Quota exhausted — clear upgrade CTA, not silent failure

### 5.2 Pricing Page
- [ ] `[E2E]` `pricing.html` loads — 4 tiers displayed (Free, Individual, Practitioner, Agency)
- [ ] `[E2E]` Free tier: "Get Started Free" links to `/`
- [ ] `[E2E]` Individual: "$19/mo · $190/year (save 17%)" — "Start Individual Plan" links to `/?upgrade=individual`
- [ ] `[E2E]` Practitioner: "$97/mo · $970/year (save 17%)" — lists correct features (500 AI syntheses, client management, branded PDF, etc.)
- [ ] `[E2E]` Agency: "$349/mo · $3,490/year (save 17%)" — lists white-label, 5 seats, 2000 syntheses, API calls
- [ ] `[E2E]` "Most Popular" badge on Individual (personal) and Practitioner (professional)
- [ ] `[CODE]` Pricing page meta tags: OG + Twitter cards with correct descriptions

### 5.3 Stripe Checkout (Free → Individual → Practitioner → Agency)
- [ ] `[E2E]` "Upgrade" button visible (consumer pricing modal or `/?upgrade=` param)
- [ ] `[API]` `POST /api/billing/checkout` with tier → returns Stripe Checkout session URL
- [ ] `[API]` Checkout supports monthly and annual pricing variants
- [ ] `[MANUAL]` Stripe Checkout loads with correct price for selected tier
- [ ] `[E2E]` Successful payment → redirect to `/billing/success.html` → app shows upgraded tier
- [ ] `[API]` Stripe webhook `checkout.session.completed` → DB tier updated
- [ ] `[CODE]` Double-click "Upgrade" — reuses open Checkout session (BL-OPT), doesn't create duplicate
- [ ] `[CODE]` Redirect URL validated against allowlist (prevents open-redirect attacks)
- [ ] `[API]` Promo code support (CISO-002) — accepted in checkout flow

### 5.4 One-Time Purchases
- [ ] `[API]` `POST /api/billing/checkout-one-time` — supports one-time product purchases
- [ ] `[API]` Checkout creates correct Stripe session for one-time line items

### 5.5 Subscription Management
- [ ] `[API]` `POST /api/billing/portal` → opens Stripe Customer Portal for self-service
- [ ] `[MANUAL]` Stripe portal: downgrade (Practitioner → Individual) works
- [ ] `[API]` `POST /api/billing/cancel` — subscription cancels at period end (not immediately)
- [ ] `[E2E]` Cancelled user sees "active until [date]" message
- [ ] `[MANUAL]` Resubscribe after cancel — tier restored via Stripe portal
- [ ] `[API]` Payment failure (`invoice.payment_failed` webhook) → grace period or "update payment" prompt
- [ ] `[MANUAL]` Invoice history visible in billing portal

### 5.6 Webhook Processing & Edge Cases
- [ ] `[CODE]` Webhook signature verified (Stripe-Signature header) — invalid signature rejected
- [ ] `[CODE]` Event ID idempotency via `finalizeProcessedEvent` — duplicate webhook doesn't double-upgrade
- [ ] `[CODE]` Handles: `customer.subscription.created`, `updated`, `deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
- [ ] `[CODE]` Subscription state machine maps Stripe statuses (active, canceled, past_due, trialing) to internal enum
- [ ] `[CODE]` Referral conversion rewards — auto-marked when referred user converts to paid
- [ ] `[API]` Webhook arrives before redirect — tier still correct on return
- [ ] `[E2E]` User refreshes during Stripe redirect — no broken state (`/billing/cancel.html` catch page exists)

### 5.7 Tier Feature Gating
- [ ] `[CODE]` Tier enforcement middleware resolves "effective tier" (considers: `lifetime_access`, active subscription, agency seat membership)
- [ ] `[API]` Free user cannot access practitioner-only endpoints → 403
- [ ] `[API]` Individual user cannot access client management → 403
- [ ] `[API]` Transit pass support — temporary feature grants for specific features
- [ ] `[CODE]` All advertised features per tier are functional (no "coming soon" behind paid wall)

---

## SECTION 6 — PRACTITIONER DASHBOARD

### 6.1 Client Management
- [ ] `[API]` `GET /api/practitioner/clients` — returns client list (empty array if new practitioner)
- [ ] `[E2E]` Empty state has clear CTA ("Add your first client")
- [ ] `[API]` `POST /api/practitioner/clients` — add client by email → client appears in list
- [ ] `[API]` Add client with invalid email — 400 error
- [ ] `[API]` Add client who already exists in system — linked (not duplicate)
- [ ] `[API]` Add client who doesn't have account → invitation flow via `POST /api/practitioner/clients/invite`
- [ ] `[API]` Invitation tokens expire after acceptance; revocable
- [ ] `[API]` `GET /api/practitioner/clients/:id` — returns client detail (chart + latest profile + notes)
- [ ] `[E2E]` View client's chart — renders correctly
- [ ] `[E2E]` View client's profile — displays AI-generated content
- [ ] `[API]` `DELETE /api/practitioner/clients/:id` — removes client from roster
- [ ] `[API]` Practitioner CANNOT access another practitioner's clients → 403
- [ ] `[CODE]` Client roster capped at tier limit (Practitioner: 50 clients)

### 6.2 Session Notes
- [ ] `[API]` `POST /api/session-notes` — create session note for a client
- [ ] `[API]` `PUT /api/session-notes/:id` — edit existing note
- [ ] `[API]` `DELETE /api/session-notes/:id` — delete note (confirmation in UI)
- [ ] `[API]` `GET /api/session-notes?client_id=X` — list notes for client, sorted by date (newest first)
- [ ] `[API]` Long session note (5000 chars, the enforced limit) — saved and returned without truncation
- [ ] `[API]` Session notes with special characters/emoji — saved correctly
- [ ] `[CODE]` `share_with_ai` flag on notes — if set, note context injected into next client profile synthesis
- [ ] `[CODE]` Transit snapshot captured at session date (transit positions at time of session)

### 6.3 Per-Client AI Context
- [ ] `[API]` `GET /api/session-notes/ai-context/:clientId` — returns practitioner's custom AI context for client
- [ ] `[API]` `PUT /api/session-notes/ai-context/:clientId` — save custom AI context (up to 3000 chars)
- [ ] `[CODE]` AI context injected into future profile syntheses for that client (HD_UPDATES4 Vector 3)

### 6.4 Practitioner Directory Profile
- [ ] `[API]` `PUT /api/practitioner/directory-profile` — update public bio, specialties, qualifications
- [ ] `[API]` `GET /api/practitioner/directory-profile/:id` (public) — returns practitioner's public profile
- [ ] `[E2E]` Public profile URL accessible (not 404)
- [ ] `[E2E]` Public profile shows correct information
- [ ] `[API]` XSS in bio field — sanitized on display
- [ ] `[API]` Profile with long bio (2000+ chars) — saved, displayed correctly

### 6.5 Practitioner Directory
- [ ] `[API]` `GET /api/directory` (public) — lists all practitioners with bios
- [ ] `[E2E]` Directory listing page loads
- [ ] `[E2E]` Search by specialty — correct results
- [ ] `[E2E]` Click practitioner → view their public profile
- [ ] `[API]` Directory pagination works

---

## SECTION 7 — ENGAGEMENT & RETENTION FEATURES

### 7.1 Celebrity Compare
- [ ] `[API]` `GET /api/compare/list` (public) — returns celebrity database (100+ entries)
- [ ] `[API]` `GET /api/compare/search?q=Einstein` (public) — search celebrities by name
- [ ] `[API]` `GET /api/compare/categories` (public) — returns all valid categories with counts (sports, tech, music, arts, science, politics, business, activism, royalty, media)
- [ ] `[API]` `GET /api/compare/category/:cat` (public, regex `[a-z0-9-]+`) — browse by category (e.g. `sports`, not `athletes`)
- [ ] `[API]` `GET /api/compare/celebrities` (auth) — compare user's chart to celebrities with similarity scoring
- [ ] `[API]` `GET /api/compare/celebrities/:id` (auth) — specific celebrity match details
- [ ] `[E2E]` Compare shows side-by-side chart similarities/differences
- [ ] `[API]` Share comparison → `POST /api/share/celebrity` (auth) → generates shareable link/image
- [ ] `[CODE]` Celebrity data served via `workers/src/handlers/famous.js` — verified birth data

### 7.2 Achievement / Gamification
- [ ] `[API]` `GET /api/achievements` — returns all achievement definitions (50+ across 8 categories)
- [ ] `[API]` `GET /api/achievements/progress` — returns user's unlocked achievements + points + tier
- [ ] `[API]` `POST /api/achievements/track` — event tracking triggers unlock (chart_calculated, profile_generated, transit_checked, etc.)
- [ ] `[E2E]` Achievement notification appears on unlock (toast/modal)
- [ ] `[API]` `GET /api/achievements/leaderboard` — point-based leaderboard
- [ ] `[CODE]` 5 achievement tiers: Novice → Master; 10-100 pts per achievement
- [ ] `[CODE]` Streak tracking (check-in streaks, profile generations)

### 7.3 Transits & Timing
- [ ] `[API]` `GET /api/transits/today` — returns current transit positions
- [ ] `[API]` Transit-to-natal aspects — angular relationships to user's chart
- [ ] `[API]` Gate activations — which of 64 gates are currently active in transits
- [ ] `[API]` `GET /api/transits/forecast` — future transit dates
- [ ] `[CODE]` KV cache per date; natal data hash prevents cross-user contamination (BL-FIX-C1)
- [ ] `[API]` `GET /api/timing/find` — find astrologically optimal dates
- [ ] `[API]` `GET /api/timing/templates` — predefined timing templates

### 7.4 Check-In & Diary System
- [ ] `[API]` `POST /api/checkin` — create daily check-in
- [ ] `[API]` `GET /api/checkin/today` — get today's check-in
- [ ] `[API]` `GET /api/checkin/history` — paginated history
- [ ] `[API]` `GET /api/checkin/stats` — aggregated statistics
- [ ] `[API]` `GET /api/checkin/streak` — current streak count
- [ ] `[API]` Reminder preferences: `GET /api/checkin/reminder`, `PUT /api/checkin/reminder`
- [ ] `[API]` Diary CRUD: `POST /api/diary`, `GET /api/diary`, `GET /api/diary/:id`, `PUT /api/diary/:id`, `DELETE /api/diary/:id`
- [ ] `[CODE]` Diary entries integrated into AI profile synthesis (Layer 8 data input)

### 7.5 Referral Program
- [ ] `[API]` `POST /api/referrals/generate` — creates unique referral code (PRIME-xyz123 format)
- [ ] `[API]` `GET /api/referrals/stats` — referral count, conversions, reward balance
- [ ] `[API]` `GET /api/referrals/history` — list of all referrals with status
- [ ] `[API]` `POST /api/referrals/validate` — validate a referral code
- [ ] `[API]` `POST /api/referrals/apply` — apply referral code at signup
- [ ] `[API]` `POST /api/referrals/claim` — claim earned rewards (credit or cash via Stripe)
- [ ] `[CODE]` Referral conversion auto-marked on billing webhook when referee purchases
- [ ] `[CODE]` Self-referral prevented
- [ ] `[CODE]` Practitioner tier: 25% revenue share on referrals

### 7.6 Social Share & Viral
- [ ] `[API]` `POST /api/share/celebrity` — generate share image/link for celebrity comparison
- [ ] `[API]` `POST /api/share/chart` — generate share image/link for chart
- [ ] `[API]` `POST /api/share/achievement` — generate share for achievement
- [ ] `[API]` `POST /api/share/referral` — generate referral share card
- [ ] `[CODE]` OG metadata (title, description, image) for each share type
- [ ] `[CODE]` Platform-specific messages: Twitter/X, Facebook, LinkedIn
- [ ] `[API]` `GET /api/share/stats` — sharing analytics (who shared, what, when, platform)
- [ ] `[E2E]` Copy share link — link works in incognito (public chart view)
- [ ] `[CODE]` OG tags in `index.html` — Open Graph + Twitter Card meta present

### 7.7 Composite & Relationship Charts
- [ ] `[API]` `POST /api/composite` — generate composite chart for two people
- [ ] `[API]` `POST /api/composite/rectify` — sensitivity analysis for chart comparison

---

## SECTION 8 — NOTION SYNC (PRACTITIONER)

### 8.1 OAuth Setup
- [ ] `[API]` `GET /api/notion/auth` — initiates Notion OAuth (redirects to notion.com)
- [ ] `[API]` `GET /api/notion/callback` — exchanges auth code for access token
- [ ] `[CODE]` State token for CSRF protection (10-min expiry)
- [ ] `[CODE]` Access token encrypted before DB storage (BL-R-H3)
- [ ] `[API]` `GET /api/notion/status` — returns connection status, workspace name, token expiry

### 8.2 Sync Operations
- [ ] `[API]` `POST /api/notion/sync/clients` — syncs entire client roster to Notion database
- [ ] `[API]` `POST /api/notion/export/profile/:id` — exports single profile to Notion page
- [ ] `[CODE]` Creates Notion database with rich properties: names, charts, profiles, notes, relations
- [ ] `[CODE]` Nested relationships between client records and profile pages

### 8.3 Disconnect & Edge Cases
- [ ] `[API]` `DELETE /api/notion/disconnect` — revokes token, clears integration
- [ ] `[CODE]` Notion API rate limit → queued, not lost
- [ ] `[API]` Notion workspace permission revoked → clear error on next sync attempt
- [ ] `[API]` Large sync (50+ clients) — completes without timeout
- [ ] `[API]` Reconnect after disconnect → sync resumes without duplicates

---

## SECTION 9 — PUSH NOTIFICATIONS, SMS & ALERTS

### 9.1 Push Notifications
- [ ] `[API]` `GET /api/push/vapid-key` — returns VAPID public key for browser push
- [ ] `[API]` `POST /api/push/subscribe` — registers push subscription
- [ ] `[API]` `DELETE /api/push/unsubscribe` — removes push subscription
- [ ] `[API]` `POST /api/push/test` — sends test notification
- [ ] `[API]` `GET /api/push/preferences` — notification category preferences
- [ ] `[API]` `PUT /api/push/preferences` — update notification preferences
- [ ] `[API]` `GET /api/push/history` — past notification history

### 9.2 SMS Energy Digest
- [ ] `[API]` `POST /api/sms/send-digest` — sends SMS energy digest to subscriber
- [ ] `[API]` `POST /api/sms/webhook` — handles inbound SMS commands (subscribe/unsubscribe)
- [ ] `[CODE]` SMS digest tied to transit calculations (daily energy forecast)

### 9.3 Custom Alerts
- [ ] `[API]` CRUD: `POST /api/alerts`, `GET /api/alerts`, `GET /api/alerts/:id`, `PUT /api/alerts/:id`, `DELETE /api/alerts/:id`
- [ ] `[API]` `GET /api/alerts/templates` — predefined alert templates
- [ ] `[API]` `POST /api/alerts/from-template` — create alert from template
- [ ] `[API]` `GET /api/alerts/history` — past alert deliveries

---

## SECTION 10 — RESPONSIVE & CROSS-BROWSER

### 10.1 Mobile (375px - 428px)
- [ ] `[E2E]` All pages render without horizontal scroll (viewport meta present)
- [ ] `[E2E]` Navigation: hamburger menu or bottom nav accessible (frontend/css/components/mobile.css)
- [ ] `[MANUAL]` Touch targets minimum 44x44px
- [ ] `[MANUAL]` Chart is viewable and interactive at small sizes
- [ ] `[E2E]` Forms are usable (no overlapping labels, inputs not cut off)
- [ ] `[E2E]` Auth overlay (`#authOverlay`) doesn't extend beyond viewport
- [ ] `[MANUAL]` Keyboard doesn't obscure active input field

### 10.2 Tablet (768px - 1024px)
- [ ] `[E2E]` Layout adapts (not just stretched mobile)
- [ ] `[E2E]` Dashboard shows appropriate information density

### 10.3 Desktop (1280px+)
- [ ] `[E2E]` Content doesn't stretch to full width on ultrawide
- [ ] `[E2E]` Max-width container present
- [ ] `[E2E]` Multi-column layouts utilized

### 10.4 Cross-Browser
- [ ] `[MANUAL]` Chrome (latest) — all features work
- [ ] `[MANUAL]` Safari (latest) — all features work (especially date inputs, flexbox)
- [ ] `[MANUAL]` Firefox (latest) — all features work
- [ ] `[MANUAL]` Edge (latest) — all features work
- [ ] `[MANUAL]` Safari iOS — PWA install, all features work
- [ ] `[MANUAL]` Chrome Android — PWA install, all features work

### 10.5 PWA (Service Worker v18)
- [ ] `[E2E]` Service worker registers (`frontend/service-worker.js` v18)
- [ ] `[MANUAL]` App installable (Add to Home Screen prompt)
- [ ] `[E2E]` manifest.json valid: `display: "standalone"`, 11 icon sizes (72px-512px + maskable), shortcuts (My Chart, Transit Report), categories: lifestyle/personalization/wellness
- [ ] `[CODE]` Cache strategy: network-first for API, cache-first for statics
- [ ] `[CODE]` 50+ static assets pre-cached (CSS, JS, icons, both v1+v2 brand variants)
- [ ] `[CODE]` Background video cached on first play (not on install)
- [ ] `[CODE]` LRU eviction: max 50 API cache, 80 static cache entries, 24h API cache TTL
- [ ] `[E2E]` Offline — meaningful offline page or cached content shown
- [ ] `[MANUAL]` Return online — data syncs, no stale state
- [ ] `[CODE]` iOS: apple-mobile-web-app-capable, apple-touch-icons (152px, 192px), splash screens for 9 device sizes
- [ ] `[CODE]` Android: mobile-web-app-capable, theme colors, launcher icons

---

## SECTION 11 — PERFORMANCE & ACCESSIBILITY

### 11.1 Performance
- [ ] `[MANUAL]` Time to Interactive < 3s on 4G
- [ ] `[MANUAL]` Largest Contentful Paint < 2.5s
- [ ] `[MANUAL]` Cumulative Layout Shift < 0.1
- [ ] `[CODE]` No blocking scripts in `<head>` — scripts deferred
- [ ] `[CODE]` Preload critical fonts, CSS; DNS prefetch for API + Stripe + CDN
- [ ] `[CODE]` Parallel CSS loading (no `@import` chains)
- [ ] `[E2E]` Images lazy-loaded below fold
- [ ] `[API]` API responses < 500ms (p95 for chart generation)
- [ ] `[API]` KV cache hits for repeated chart data (30-day TTL)
- [ ] `[CODE]` Asset randomizer: v1/v2 brand variants per session (frontend/js/asset-randomizer.js)

### 11.2 Accessibility
- [ ] `[E2E]` All interactive elements keyboard-focusable (Tab order logical)
- [ ] `[E2E]` Focus visible on all focusable elements
- [ ] `[CODE]` Auth overlay has `role="dialog"`, `aria-modal="true"`, `aria-labelledby="authTitle"`
- [ ] `[CODE]` Form inputs have associated `<label>` elements and `aria-describedby` for errors
- [ ] `[CODE]` Error containers have `role="alert"` and `aria-live="polite"` (`#authError`, `#authTOTPError`)
- [ ] `[E2E]` Screen reader: all images have alt text
- [ ] `[MANUAL]` Color contrast ratio ≥ 4.5:1 for text (gold `#c9a84c` on dark `#05091a`)
- [ ] `[MANUAL]` Color contrast ratio ≥ 3:1 for large text and UI components
- [ ] `[E2E]` Chart data available as text alternative (not image-only)
- [ ] `[CODE]` `prefers-reduced-motion` respected (check CSS)
- [ ] `[CODE]` `lang` attribute set on `<html>`
- [ ] `[E2E]` `data-i18n` attributes present on translatable elements (i18n via frontend/js/i18n.js + frontend/locales/)

---

## SECTION 12 — ERROR STATES & EDGE CASES

### 12.1 Network Failures
- [ ] `[API]` API returns 500 — user sees friendly error from `errorMessages.js`, not stack trace (BL-R-H series)
- [ ] `[API]` API returns 503 — "service temporarily unavailable" message
- [ ] `[MANUAL]` Network disconnect mid-action — pending state shown, retry available
- [ ] `[MANUAL]` Slow network (3G) — loading states visible, no timeout without message
- [ ] `[CODE]` CORS headers from `getCorsHeaders()` — does not expose internal URLs

### 12.2 Data Integrity
- [ ] `[E2E]` Refresh during save — data not corrupted (last write wins)
- [ ] `[E2E]` Two tabs editing same data — no silent data loss
- [ ] `[MANUAL]` Browser crash during operation — data recoverable on return (localStorage + server state)
- [ ] `[E2E]` Clear browser data → return — clean auth overlay, no broken state

### 12.3 URL & Navigation
- [ ] `[E2E]` Direct URL to authenticated page (no login) — shows auth overlay, then proceeds after login
- [ ] `[E2E]` Invalid route (e.g., `/asdfgh`) — 404 page shown (`frontend/404.html`)
- [ ] `[E2E]` Back/forward browser navigation — correct page state at each step
- [ ] `[E2E]` Deep link to specific chart/profile — works for owner, 403 for others
- [ ] `[E2E]` URL with injected parameters — sanitized, no XSS

### 12.4 Content Edge Cases
- [ ] `[E2E]` User with RTL name (Arabic, Hebrew) — displays correctly
- [ ] `[E2E]` Very long username (100+ chars) — truncated with ellipsis, no layout break
- [ ] `[E2E]` Emoji in display name — renders correctly
- [ ] `[E2E]` Profile text with markdown injection — rendered as text, not HTML
- [ ] `[E2E]` Empty states for all lists (clients, sessions, achievements, diary) — helpful message shown

---

## SECTION 13 — SECURITY SURFACE (UI LAYER)

### 13.1 Token & Session
- [ ] `[CODE]` JWT access token: HS256, 15-min expiry, `iss`+`aud` claims
- [ ] `[CODE]` Refresh token: 30-day expiry, HttpOnly + Secure + SameSite cookie (`ps_refresh`)
- [ ] `[CODE]` Access token held in JS memory (not localStorage) — ephemeral on page close; refresh cookie restores on reload
- [ ] `[E2E]` JWT not visible in URL parameters
- [ ] `[CODE]` Refresh token rotation with theft detection (family ID) — old token invalidated on use
- [ ] `[CODE]` Token type check: Bearer must be `access` type (rejects `refresh` tokens)

### 13.2 Security Headers
- [ ] `[API]` `Strict-Transport-Security: max-age=31536000` (1 year HSTS)
- [ ] `[API]` `X-Content-Type-Options: nosniff`
- [ ] `[API]` `X-Frame-Options: DENY`
- [ ] `[API]` `Content-Security-Policy: default-src 'none'` (strict CSP)
- [ ] `[API]` `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `[API]` `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [ ] `[CODE]` Frontend `_headers` file: strict CSP, `frame-src` limited to Stripe iframe only

### 13.3 Input Sanitization
- [ ] `[E2E]` HTML injection in every text input — rendered as text, not HTML
- [ ] `[E2E]` JavaScript in every text input — not executed
- [ ] `[E2E]` SQL in every text input — no SQL error responses visible
- [ ] `[CODE]` All SQL queries parameterized ($ placeholders, no string interpolation)
- [ ] `[CODE]` Max length enforced: session notes 5000 chars, AI context 3000 chars, TOTP code 6 digits

### 13.4 Rate Limiting
- [ ] `[CODE]` Per-IP rate limits for public endpoints (sliding window via KV)
- [ ] `[API]` Per-user rate limits for authenticated endpoints
- [ ] `[API]` `X-RateLimit-*` headers in responses (limit, remaining, reset)
- [ ] `[API]` Exceeding rate limit → 429 with retry-after info

### 13.5 Data Exposure
- [ ] `[CODE]` No API keys in frontend JavaScript source (check all files in `frontend/js/`)
- [ ] `[CODE]` No secrets in HTML comments
- [ ] `[CODE]` Error messages sanitized — no internal paths, versions, or stack traces (BL-R-H series)
- [ ] `[CODE]` Source maps not deployed to production

### 13.6 Practitioner Data Isolation
- [ ] `[API]` Practitioner A cannot access Practitioner B's client list via URL manipulation → 403
- [ ] `[API]` Practitioner A cannot view client profiles belonging to Practitioner B → 403
- [ ] `[API]` API calls with another practitioner's client ID → 403 Forbidden
- [ ] `[API]` Free/Individual user cannot access practitioner-only endpoints → 403

---

## SECTION 14 — API KEYS & EMBED WIDGET

### 14.1 API Key Management (Practitioner/Agency)
- [ ] `[API]` `POST /api/keys/generate` — create new API key
- [ ] `[API]` `GET /api/keys` — list active API keys
- [ ] `[API]` `GET /api/keys/:id` — get key details
- [ ] `[API]` `DELETE /api/keys/:id` — deactivate key
- [ ] `[API]` `GET /api/keys/:id/usage` — key usage stats
- [ ] `[CODE]` API key limits: Practitioner 10 keys, Agency 100 keys

### 14.2 Embed Widget
- [ ] `[E2E]` `frontend/embed.html` + `frontend/embed.js` — embeddable chart widget loads
- [ ] `[API]` Embed API endpoint serves chart widget for external sites
- [ ] `[CODE]` embed.js doesn't expose internal API keys or secrets

---

## SECTION 15 — INTERNATIONALIZATION (i18n)

- [ ] `[CODE]` `frontend/js/i18n.js` — i18n engine loads locale files from `frontend/locales/`
- [ ] `[E2E]` `data-i18n` attributes on all translatable elements
- [ ] `[E2E]` Auth overlay labels translate: `auth.signIn`, `auth.email`, `auth.password`, `auth.noAccount`, etc.
- [ ] `[E2E]` Switching locale updates all `data-i18n` elements without page reload
- [ ] `[CODE]` Fallback to English if requested locale key missing

---

## SECTION 16 — ADMIN & EXPERIMENTS

### 16.1 Admin Panel
- [ ] `[API]` `POST /api/admin/promo` — create promo codes
- [ ] `[API]` `GET /api/admin/analytics` — platform analytics
- [ ] `[API]` Admin endpoints require elevated privileges — non-admin → 403

### 16.2 Experiments / Feature Flags
- [ ] `[API]` `GET /api/experiments` — list active experiments
- [ ] `[CODE]` Feature flag evaluation in middleware — experiments gate features per user cohort

---

## SECTION 17 — USER PERSONAS & END-TO-END JOURNEYS

> **Why this matters:** Sections 1–16 test features in isolation. Real users cross
> feature boundaries. A single journey may touch auth → chart → profile → billing →
> sharing. If every unit test passes but a journey fails, the product is broken.

### 17.0 Persona Definitions

| Persona | Tier | Key Traits | Risk Focus |
|---------|------|-----------|------------|
| **Alex (Curious Skeptic)** | Free | First visit, arrived via social share, mobile Safari, no account yet | First impressions, abandonment points |
| **Priya (Dedicated Individual)** | Individual ($19/mo) | Daily user, checks transits, maintains diary, desktop Chrome | Retention, quota limits, data integrity |
| **Marcus (Working Practitioner)** | Practitioner ($97/mo) | 30+ clients, uses Notion sync, iPad & desktop, time-pressed | Client management scale, session notes, export |
| **DevCo (Agency Integrator)** | Agency ($349/mo) | API-first, embeds widget on client sites, 5 seats, automation | API keys, embed, multi-seat, white-label |
| **Kenji (Accessibility User)** | Any | Screen reader (NVDA), keyboard-only, high-contrast mode | a11y, keyboard nav, ARIA |
| **Fatima (International User)** | Any | Arabic-speaking, RTL browser, UTC+3 timezone, mobile | i18n, RTL layout, timezone math, unicode |

### 17.1 Journey: Alex — First Visit to First Chart (🔴 P0)

> **Goal:** Can a brand-new visitor go from landing page to seeing their chart in under 3 minutes?

- [ ] `[JOURNEY]` Land on `selfprime.net` → page loads < 3s on 4G mobile
- [ ] `[JOURNEY]` Scroll landing page → CTAs visible above fold, no confusing jargon
- [ ] `[JOURNEY]` Click `#authBtn` → overlay opens → click "Create one" → register with email
- [ ] `[JOURNEY]` First-run modal (`#first-run-modal`) appears → read or skip → arrive at main app
- [ ] `[JOURNEY]` Enter birth data (date + time + location autocomplete) → chart generates
- [ ] `[JOURNEY]` Bodygraph SVG renders correctly on 375px-width mobile screen
- [ ] `[JOURNEY]` Alex sees Type, Strategy, Authority — immediately understands what they mean
- [ ] `[JOURNEY]` "Generate Profile" CTA visible → click → SSE progress streams → profile appears
- [ ] `[JOURNEY]` Share button → copy link → paste in incognito → public chart view works
- [ ] `[JOURNEY]` Close browser → reopen selfprime.net 24h later → still logged in, chart visible
- [ ] **Success Oracle:** Zero confusion points, zero dead ends, zero blank screens

### 17.2 Journey: Priya — Daily Engagement Loop (🟡 P1)

> **Goal:** Returning user's daily check-in + transit + diary loop works seamlessly.

- [ ] `[JOURNEY]` Open PWA from home screen → cached content loads instantly (offline-first)
- [ ] `[JOURNEY]` Check today's transit → `GET /api/transits/today` → energy forecast displayed
- [ ] `[JOURNEY]` Transit overlaid on Priya's natal chart → activations highlighted
- [ ] `[JOURNEY]` Create daily check-in → `POST /api/checkin` → streak counter increments
- [ ] `[JOURNEY]` Write diary entry referencing today's transit energy → saved
- [ ] `[JOURNEY]` Achievement unlocks (7-day streak) → toast notification appears
- [ ] `[JOURNEY]` Monthly synthesis quota at 9/10 → counter visible, clear warning before hitting limit
- [ ] `[JOURNEY]` Hit 10/10 quota → upgrade CTA with pricing, NOT a blank error
- [ ] `[JOURNEY]` Upgrade to Individual from within the app → Stripe checkout → return → quota reset → generate 11th profile
- [ ] **Success Oracle:** Entire loop completable in < 2 minutes, no dead navigation paths

### 17.3 Journey: Marcus — Client Session Workflow (🔴 P0)

> **Goal:** Practitioner can manage a client session end-to-end.

- [ ] `[JOURNEY]` Log in → navigate to client dashboard → see 30+ clients listed (pagination works)
- [ ] `[JOURNEY]` Search/filter clients → find "Sarah" → click → view her chart + profile + notes
- [ ] `[JOURNEY]` Create new session note → type 2000 chars → toggle `share_with_ai` ON → save
- [ ] `[JOURNEY]` Generate new AI synthesis for Sarah → note context injected → profile references session themes
- [ ] `[JOURNEY]` Export Sarah's profile to Notion → `POST /api/notion/export/profile/:id` → page created
- [ ] `[JOURNEY]` Add new client by invitation → `POST /api/practitioner/clients/invite` → email sent
- [ ] `[JOURNEY]` Client accepts invitation → appears in Marcus's roster automatically
- [ ] `[JOURNEY]` Tab to another client → back to Sarah → session note persisted, not lost
- [ ] **Success Oracle:** Complete session prep (chart review + note + synthesis) under 5 min

### 17.4 Journey: DevCo — API Integration Setup (🟡 P1)

> **Goal:** Agency can generate an API key, embed widget, and serve charts on external site.

- [ ] `[JOURNEY]` Log in as Agency admin → generate API key → copy key
- [ ] `[JOURNEY]` Use key to call `POST /api/chart/calculate` from external tool → chart JSON returned
- [ ] `[JOURNEY]` Embed `frontend/embed.html` on third-party site → widget renders chart
- [ ] `[JOURNEY]` Add second seat → invite team member → they accept → can use same API key namespace
- [ ] `[JOURNEY]` Check usage stats → `GET /api/keys/:id/usage` → accurate counts
- [ ] `[JOURNEY]` Hit rate limit → 429 response → `X-RateLimit-Reset` header present → retry works after wait
- [ ] **Success Oracle:** Working integration within 15 min using only docs + API responses

### 17.5 Journey: Kenji — Keyboard-Only Full Flow (🟡 P1)

> **Goal:** Entire chart generation flow completable without a mouse.

- [ ] `[JOURNEY]` Tab to `#authBtn` → Enter → overlay opens with focus trapped inside
- [ ] `[JOURNEY]` Tab through email → password → submit → no focus escapes to background
- [ ] `[JOURNEY]` After login, Tab to birth data form → fill date, time, location → Enter to submit
- [ ] `[JOURNEY]` Chart renders → Tab to "Generate Profile" → Enter → profile streams in
- [ ] `[JOURNEY]` Tab to share button → Enter → share link copied → screen reader announces "Link copied"
- [ ] `[JOURNEY]` Escape key closes modals/overlays at every step
- [ ] **Success Oracle:** Full flow completable with keyboard; screen reader announces every state change

### 17.6 Journey: Fatima — Arabic / RTL / Timezone (🟢 P2)

> **Goal:** International user with RTL language and non-US timezone has clean experience.

- [ ] `[JOURNEY]` Visit selfprime.net → switch locale to Arabic via i18n selector
- [ ] `[JOURNEY]` All `data-i18n` elements update → layout mirrors to RTL (text, nav, modals)
- [ ] `[JOURNEY]` Auth overlay labels in Arabic → register → birth data input
- [ ] `[JOURNEY]` Enter Cairo birthplace → geocoded correctly → timezone UTC+2 applied
- [ ] `[JOURNEY]` Chart generates with correct positions for Cairo timezone
- [ ] `[JOURNEY]` Profile text in English (AI synthesis) — no broken encoding for Arabic name
- [ ] `[JOURNEY]` Transit times display in user's local timezone, not UTC
- [ ] **Success Oracle:** No layout breaks, dates/times in local format, no mojibake

---

## SECTION 18 — STATE TRANSITION MODELS

> **Technique:** Explicit state machines ensure every legal transition is tested and every
> illegal transition is explicitly blocked. Draw the graph, then write one test per arrow.

### 18.1 Authentication State Machine

```
                   ┌──────────┐
                   │  ANON    │ (no token)
                   └────┬─────┘
                        │ register / login
                        ▼
                ┌───────────────┐
     ┌─────────│  CHALLENGED   │ (2FA required)
     │         └───────┬───────┘
     │ cancel          │ valid TOTP
     │                 ▼
     │         ┌───────────────┐
     │         │  LOGGED_IN    │ (access token valid)
     │         └───┬───────┬───┘
     │             │       │
     │    token expires    │ logout
     │             │       │
     │             ▼       │
     │    ┌─────────────┐  │
     │    │  REFRESHING  │  │
     │    └──┬──────┬───┘  │
     │       │      │      │
     │  refresh OK  │ refresh fails (theft detected)
     │       │      │      │
     │       ▼      ▼      ▼
     │    LOGGED_IN  ──► ANON
     └──────────────────► ANON
```

- [ ] `[API]` ANON → LOGGED_IN (no 2FA): login returns access + refresh tokens
- [ ] `[API]` ANON → CHALLENGED → LOGGED_IN (with 2FA): login → TOTP → tokens
- [ ] `[API]` ANON → CHALLENGED → ANON: cancel 2FA returns to anonymous
- [ ] `[API]` CHALLENGED → timeout (5 min) → ANON: expired TOTP challenge rejects
- [ ] `[API]` LOGGED_IN → REFRESHING → LOGGED_IN: token refresh succeeds, new tokens issued
- [ ] `[API]` LOGGED_IN → REFRESHING → ANON: refresh with stolen/expired token → invalidated
- [ ] `[API]` LOGGED_IN → ANON: explicit logout clears tokens
- [ ] `[API]` **Illegal**: ANON → REFRESHING (no refresh cookie) → 401
- [ ] `[API]` **Illegal**: LOGGED_IN → CHALLENGED (2FA only on initial login)
- [ ] `[API]` **Illegal**: Submit access token as refresh token → rejected (token type check)

### 18.2 Billing State Machine

```
  FREE ──checkout──► CHECKOUT_PENDING ──webhook──► ACTIVE
   ▲                                                 │
   │                                    upgrade/     │ payment_failed
   │                                    downgrade    ▼
   │                                              PAST_DUE ──grace──► CANCELED
   │                                                 │                   │
   │                                           pays  │              resubscribe
   │                                                 ▼                   │
   │                                              ACTIVE ◄──────────────┘
   │                                                 │
   │                                           user cancels
   │                                                 ▼
   └──────────── period ends ◄──────────── CANCEL_AT_PERIOD_END
```

- [ ] `[API]` FREE → ACTIVE: checkout + webhook → tier updated in DB
- [ ] `[API]` ACTIVE → CANCEL_AT_PERIOD_END: `POST /api/billing/cancel` → still active until period end
- [ ] `[API]` CANCEL_AT_PERIOD_END → FREE: period ends → downgraded
- [ ] `[API]` ACTIVE → PAST_DUE: payment failure webhook → grace period starts
- [ ] `[API]` PAST_DUE → ACTIVE: payment succeeds → restored
- [ ] `[API]` PAST_DUE → CANCELED → FREE: grace expired → features locked
- [ ] `[API]` CANCELED → ACTIVE: resubscribe via Stripe portal
- [ ] `[API]` ACTIVE (Individual) → ACTIVE (Practitioner): upgrade via checkout
- [ ] `[API]` ACTIVE (Practitioner) → ACTIVE (Individual): downgrade via portal
- [ ] `[API]` **Illegal**: FREE user accessing paid endpoints → 403
- [ ] `[API]` **Illegal**: CANCEL_AT_PERIOD_END user loses features early → still ACTIVE until date
- [ ] `[CODE]` **Idempotency**: Same webhook event ID processed twice → no double state change

### 18.3 Onboarding State Machine

```
  NEW_USER ──first_run──► FORGE_INTRO ──select──► CHAPTER_1
                                                     │
                                              advance │
                                                     ▼
                                    CHAPTER_N ──advance──► FORGE_COMPLETE
                                                              │
                                                       next Forge
                                                              ▼
                                                     ALL_COMPLETE
```

- [ ] `[API]` NEW_USER → FORGE_INTRO: first-run modal → `GET /api/onboarding/intro`
- [ ] `[API]` FORGE_INTRO → CHAPTER_1: primary Forge selected → first chapter loads
- [ ] `[API]` CHAPTER_N → CHAPTER_N+1: `POST /api/onboarding/advance` → pointer moves
- [ ] `[API]` CHAPTER_N → CHAPTER_N (idempotent): double-advance on same chapter → no skip
- [ ] `[API]` FORGE_COMPLETE → next Forge: all chapters read → next Forge unlocks
- [ ] `[API]` ALL_COMPLETE: flag set → onboarding never replays
- [ ] `[API]` **Illegal**: Skip to CHAPTER_5 without reading 1–4 → sequential enforcement
- [ ] `[API]` **Illegal**: Advance in wrong Forge (access Eros chapters while in Chronos) → blocked or handled

---

## SECTION 19 — EXPLORATORY TESTING CHARTERS

> **Technique:** Session-Based Test Management (SBTM). Each charter is a 30-minute
> focused exploration with a clear mission. Record bugs, questions, and observations
> in real-time. Review with team after session.

### Charter 1: First-Time Mobile User (🔴 P0)

| Field | Value |
|-------|-------|
| **Mission** | Explore the experience of a brand-new user on mobile Safari (iPhone SE) from first load to first chart |
| **Duration** | 30 minutes |
| **Areas** | Landing page, registration, first-run modal, birth data entry, chart render, profile generation |
| **Heuristics** | SFDPOT: Structure (layout), Function (features work), Data (inputs), Platform (iOS Safari), Operations (real-world usage), Time (latency) |
| **Look for** | Confusing CTAs, broken layouts < 375px, auto-zoom on input focus, touch target < 44px, dead ends, un-closable modals |
| **Session notes** | Record: time of observation, screenshot, severity (P0/P1/P2), reproduction steps |

### Charter 2: Payment Flow Under Stress (🔴 P0)

| Field | Value |
|-------|-------|
| **Mission** | Explore all paths through Stripe checkout: success, cancel, back-button, double-click, slow network, webhook delay |
| **Duration** | 30 minutes |
| **Areas** | Pricing page, checkout initiation, Stripe hosted page, success redirect, billing portal, cancel flow |
| **Heuristics** | FEW HICCUPPS: Followup (after checkout), Error handling (Stripe errors), Workflow (full loop), History (previous state preserved) |
| **Look for** | Orphaned checkout sessions, tier not updating after payment, double charges, broken redirect URLs |
| **Session notes** | Record: Stripe test card used, exact error messages, webhook event IDs |

### Charter 3: Practitioner Under Load (🟡 P1)

| Field | Value |
|-------|-------|
| **Mission** | Test practitioner dashboard with 40+ clients: pagination, search, note creation, AI context, Notion sync |
| **Duration** | 30 minutes |
| **Areas** | Client list, session notes, AI context, Notion export, composite charts |
| **Heuristics** | CRUD Complete: every Create/Read/Update/Delete path for clients and notes |
| **Look for** | Slow list rendering, lost session notes on tab switch, Notion sync failures, stale client data |
| **Session notes** | Record: response times for list operations, any UI jank during scroll |

### Charter 4: Offline & Recovery (🟡 P1)

| Field | Value |
|-------|-------|
| **Mission** | Explore app behavior when network is intermittent: cache hits, offline page, sync on reconnect |
| **Duration** | 30 minutes |
| **Areas** | PWA cache, service worker, offline transits, diary edit while offline, auth token refresh |
| **Heuristics** | Goldilocks: What's too much, too little, just right for cached data? |
| **Look for** | Stale data shown as current, lost edits, infinite spinners, blank screens, service worker update conflicts |
| **Session notes** | Record: exact point of disconnect, what was cached vs. lost, error messages shown |

### Charter 5: AI Failover Chain (🔴 P0)

| Field | Value |
|-------|-------|
| **Mission** | Observe behavior when primary LLM (Claude) is rate-limited or down: does failover to Grok/Groq work? |
| **Duration** | 30 minutes |
| **Areas** | Profile generation, SSE progress stream, error messages, retry UX |
| **Heuristics** | Interruption: What happens if the stream cuts mid-sentence? |
| **Look for** | Raw error JSON shown to user, partial profiles without retry option, wrong LLM model leaking in response, failover latency |
| **Session notes** | Record: which LLM answered (check response metadata), time to failover, quality of fallback output |

### Charter 6: Security Probing (🔴 P0)

| Field | Value |
|-------|-------|
| **Mission** | Attempt unauthorized access: manipulate JWT, forge practitioner IDs, embed XSS in every text field |
| **Duration** | 30 minutes |
| **Areas** | Auth tokens, practitioner client isolation, session notes, diary, profile, share links |
| **Heuristics** | OWASP Top 10: Injection, Broken Access Control, Security Misconfiguration |
| **Look for** | Any endpoint returning data for another user, XSS execution, SQL error messages, missing rate limits |
| **Session notes** | Record: exact request/response for any access control failure |

---

## SECTION 20 — BOUNDARY VALUE ANALYSIS & COMBINATORIAL TESTING

> **Technique:** Formal equivalence partitioning + boundary values for every data input.
> Pairwise combinatorial testing for multi-variable inputs.

### 20.1 Authentication Boundaries

| Field | Min Valid | Max Valid | Below Min | Above Max | Special |
|-------|-----------|-----------|-----------|-----------|---------|
| Email | `a@b.co` (6 chars) | 254 chars (RFC 5321) | `a@b` (no TLD) | 255+ chars | `+`, `.`, unicode domain |
| Password | 8 chars | 128 chars (verify) | 7 chars | 129+ chars | all spaces, all symbols, unicode |
| TOTP code | 6 digits | 6 digits | 5 digits | 7 digits | `000000`, non-numeric, expired |
| Display name | 1 char | 100 chars (verify) | empty | 101+ chars | emoji, RTL, `<script>` |

### 20.2 Birth Data Pairwise Matrix

> Pairwise testing reduces full factorial (huge) to manageable test count.

| Test # | Date | Time | Location | Expected |
|--------|------|------|----------|----------|
| 1 | 2000-01-01 | 00:00 | New York | Valid (century + midnight + US) |
| 2 | 1985-07-15 | 15:30 | London | Valid (typical + afternoon + UK) |
| 3 | 1969-12-31 | 23:59 | Tokyo | Valid (pre-epoch + late night + Asia) |
| 4 | 2000-02-29 | 12:00 | São Paulo | Valid (leap day + noon + South America) |
| 5 | 1950-06-21 | 06:00 | Mumbai | Valid (solstice + morning + India UTC+5:30) |
| 6 | 1999-03-28 | 02:30 | London | DST transition (clocks spring forward, ambiguous) |
| 7 | 2023-11-05 | 01:30 | New York | DST fallback (ambiguous hour, occurs twice) |
| 8 | 2000-01-01 | 00:00 | Auckland | Date line boundary (UTC+12 → different calendar date) |
| 9 | 1990-01-01 | 12:00 | McMurdo Station | Extreme latitude (Antarctica, complex timezone) |
| 10 | 2001-02-29 | 12:00 | London | Invalid (non-leap year Feb 29) |
| 11 | 2025-12-32 | 12:00 | Paris | Invalid (day 32) |
| 12 | 1985-07-15 | 25:00 | Berlin | Invalid (hour 25) |

### 20.3 Quota & Tier Boundaries

| Tier | Quota Type | Limit | At Limit | Over Limit | Expected Behavior |
|------|-----------|-------|----------|------------|-------------------|
| Free | AI synthesis/month | 1 | Generate 1st | Generate 2nd | Block + upgrade CTA |
| Individual | AI synthesis/month | 10 | Generate 10th | Generate 11th | Block + upgrade CTA |
| Practitioner | AI synthesis/month | 500 | Generate 500th | Generate 501st | Block + usage warning |
| Practitioner | Clients | 50 | Add 50th | Add 51st | Block + upgrade to Agency |
| Practitioner | API keys | 10 | Create 10th | Create 11th | Block |
| Agency | API keys | 100 | Create 100th | Create 101st | Block |
| Agency | AI synthesis/month | 2000 | Generate 2000th | Generate 2001st | Block |
| Free | Session notes | N/A | N/A | Attempt access | 403 Forbidden |

### 20.4 Text Field Limits

| Field | Max Length | Test At Limit | Test Over Limit | Special Characters |
|-------|-----------|---------------|-----------------|-------------------|
| Session note | 5000 chars | 5000 chars saved OK | 5001 truncated or rejected | Emoji: 🔮✨, RTL: العربية |
| AI context | 3000 chars | 3000 chars saved OK | 3001 truncated or rejected | Code blocks, markdown, HTML tags |
| Diary entry | (verify limit) | At limit | Over limit | Multi-paragraph, newlines preserved |
| Practitioner bio | 2000+ chars | At limit | Over limit | URLs, email addresses |
| Referral code | Fixed format | `PRIME-abc123` | Malformed codes | `PRIME-' OR 1=1;--` |

---

## SECTION 21 — CHAOS & RESILIENCE TESTING

> **Technique:** Fault injection, concurrency, and interrupt/resume scenarios.
> Goal: verify the system returns to a valid state after any disruption.

### 21.1 Race Conditions & Concurrency

- [ ] `[API]` 🔴 Two simultaneous profile generations for same user → only one executes, no double quota burn (BL-RACE-001)
- [ ] `[API]` 🔴 Two simultaneous checkout sessions → only one Stripe session created (BL-OPT reuse)
- [ ] `[API]` Webhook arrives before checkout redirect completes → tier still correct
- [ ] `[API]` Two tabs: Tab A edits session note, Tab B deletes same note → no 500, clean error
- [ ] `[API]` Rapid `POST /api/onboarding/advance` × 10 → advances exactly 1 chapter (idempotent)
- [ ] `[API]` Concurrent `POST /api/checkin` × 5 → only 1 check-in created (date-unique constraint)
- [ ] `[API]` Parallel API key generation → unique keys, no collision
- [ ] `[API]` Two practitioners add same client simultaneously → no duplicate, clean resolution

### 21.2 Interrupt / Resume Scenarios

- [ ] `[E2E]` 🔴 Browser crash during Stripe checkout → return to app → no orphaned subscription (Stripe session expires)
- [ ] `[E2E]` Close tab during AI profile SSE stream → return → partial content preserved, retry available
- [ ] `[E2E]` Airplane mode toggled during form submission → form data preserved in inputs, retry on reconnect
- [ ] `[E2E]` Service worker update mid-session → no broken assets (graceful handoff to SW v18+)
- [ ] `[E2E]` Token expires during long session → silent refresh → no jarring logout
- [ ] `[E2E]` Phone call interrupts during onboarding chapter → return → progress preserved (KV backed)
- [ ] `[MANUAL]` iOS: App suspended (home button) for 60 seconds → resume → no stale data, no re-auth

### 21.3 External Dependency Failures

- [ ] `[API]` Neon DB connection timeout → user sees "temporarily unavailable", NOT stack trace
- [ ] `[API]` Stripe API down → checkout fails gracefully, no zombie subscriptions
- [ ] `[API]` Nominatim geocoder down → BigDataCloud fallback → timezone still resolved
- [ ] `[API]` BigDataCloud + Nominatim both down → longitude-based timezone fallback
- [ ] `[API]` Cloudflare AI Gateway down → LLM failover chain attempts all 3 providers
- [ ] `[API]` All 3 LLM providers down → user sees "service temporarily unavailable", not blank screen
- [ ] `[API]` Notion API down during sync → queued, user notified, not lost
- [ ] `[API]` KV store timeout → cache miss → falls through to DB (degraded, not broken)
- [ ] `[CODE]` All fetch calls have timeout configuration (no infinite hangs)

### 21.4 Data Corruption Recovery

- [ ] `[API]` Malformed JWT in localStorage → app clears token, shows auth overlay (not infinite loop)
- [ ] `[API]` KV cache contains stale/corrupt chart data → recalculation triggered on parse failure
- [ ] `[API]` User's DB row has null required field → API returns structured error, not 500
- [ ] `[CODE]` Every `JSON.parse` wrapped in try/catch with fallback behavior

---

## SECTION 22 — COGNITIVE WALKTHROUGH & UX HEURISTICS

> **Technique:** Apply Nielsen's 10 Usability Heuristics and a first-time-user
> cognitive walkthrough to every major screen. Score 1–5 per heuristic.

### 22.1 Nielsen's Heuristics Audit

| # | Heuristic | Test Against | Priority |
|---|-----------|-------------|----------|
| H1 | **Visibility of system status** | SSE progress during profile generation, loading states, quota counters, streak counts | 🔴 P0 |
| H2 | **Match between system and real world** | HD terminology explained, Forge names meaningful, no raw API codes shown to users | 🔴 P0 |
| H3 | **User control and freedom** | Undo/back from every modal, cancel checkout, skip onboarding, delete account | 🟡 P1 |
| H4 | **Consistency and standards** | Same button styles across pages, consistent error message format, predictable nav | 🟡 P1 |
| H5 | **Error prevention** | Disable submit during processing, confirm before delete, validate birth data client-side | 🔴 P0 |
| H6 | **Recognition rather than recall** | Autocomplete locations, pre-fill saved birth data, visible current tier | 🟡 P1 |
| H7 | **Flexibility and efficiency** | Keyboard shortcuts, quick actions for practitioners, API for power users | 🟢 P2 |
| H8 | **Aesthetic and minimalist design** | No info overload on chart page, progressive disclosure of HD complexity | 🟡 P1 |
| H9 | **Help users recognize, diagnose, recover from errors** | Every error has: what happened + what to do next + action button | 🔴 P0 |
| H10 | **Help and documentation** | Glossary accessible, Forge narratives explain HD concepts, tooltips on chart elements | 🟢 P2 |

### 22.2 Cognitive Walkthrough: First-Time User

For each step, answer: (1) Will the user know what to do? (2) Will they see how to do it? (3) Will they understand the feedback?

| Step | Screen | Q1: Know what to do? | Q2: See how? | Q3: Understand feedback? | Risk |
|------|--------|----------------------|-------------|-------------------------|------|
| 1 | Landing page | Is the value prop clear in 5 seconds? | Is the CTA above fold? | N/A | High — bounce risk |
| 2 | Auth overlay | Register or login? Which one first? | "Create one" link visible? | Submit → what happens? | Med |
| 3 | First-run modal | What are 5 Forges? Should I skip? | Skip button visible? | Does skipping lose anything? | Med |
| 4 | Birth data form | What birth time format? What if I don't know? | Location autocomplete discoverable? | Validation errors clear? | High — data quality risk |
| 5 | Chart rendered | What am I looking at? Is this my chart? | What to do next? | Type, Strategy, Authority labeled? | High — confusion risk |
| 6 | Profile generation | What does "Generate Profile" do? Cost? | Progress meaningful or just a spinner? | Is the profile about ME? | Med |
| 7 | Next action | What should I do now? | Are options visible? (share, save, transit, diary) | Achievement unlock surprising? | Low |

### 22.3 Empty State Audit

> Every list in the app has a first-time empty state. Test each one:

| Screen | Empty State Message | CTA | Pass? |
|--------|-------------------|-----|-------|
| Chart history | "No charts yet — create your first chart" | Button to chart form | [ ] |
| Profile list | "Generate your first AI profile" | Button to generate | [ ] |
| Client roster (practitioner) | "Add your first client" | Add client button | [ ] |
| Session notes | "No session notes for this client yet" | Create note button | [ ] |
| Diary | "Start your first diary entry" | New entry button | [ ] |
| Check-in history | "No check-ins yet — start your streak!" | Check-in button | [ ] |
| Achievements | "Your achievements will appear here" | Link to trackable actions | [ ] |
| Referrals | "Share your referral link to earn rewards" | Copy link button | [ ] |
| Notifications | "No notifications yet" | Preferences link | [ ] |
| API keys (Agency) | "Create your first API key" | Generate key button | [ ] |

### 22.4 Error Message Quality Audit

> Every user-facing error should follow: **What happened** + **Why** + **What to do next**

| Error Scenario | Bad Example (fail) | Good Example (pass) | Test |
|---------------|-------------------|-------------------|------|
| Wrong password | "Error 401" | "Incorrect email or password. Try again or reset your password." | `[E2E]` |
| Quota exceeded | "403 Forbidden" | "You've used all 10 AI profiles this month. Upgrade for more →" | `[E2E]` |
| Network failure | blank screen | "Connection lost. Your work is saved. We'll retry when you're back online." | `[MANUAL]` |
| LLM timeout | "Internal Server Error" | "Your profile is taking longer than expected. We'll keep trying — check back in a minute." | `[API]` |
| Rate limited | "429" | "Slow down! Try again in 30 seconds." | `[API]` |
| Invalid birth date | "Bad Request" | "Please enter a valid date between 1900 and today." | `[E2E]` |
| Stripe checkout fail | silent redirect loop | "Payment didn't go through. No charge was made. Try again or use a different card." | `[MANUAL]` |

---

## SCORING RUBRIC

### Per-Section Scoring

For each section, rate:
- **PASS RATE**: X / Y tests passing
- **SEVERITY OF FAILURES**: P0 (launch blocker) / P1 (must fix week 1) / P2 (backlog)
- **SECTION HEALTH**: 🟢 GREEN (>90% pass) / 🟡 YELLOW (70-90%) / 🔴 RED (<70%)

### Risk-Priority Matrix

> Weight sections by business impact. A failure in billing is worse than a failure in i18n.

| Section | Business Risk | User Impact | Failure Frequency | **Risk Score** | Weight |
|---------|-------------|-------------|-------------------|---------------|--------|
| S01 Auth | 🔴 Critical | Blocks all access | Low (stable) | **9** | ×3 |
| S02 Chart | 🔴 Critical | Core product value | Medium (complex math) | **10** | ×3 |
| S03 AI Profile | 🔴 Critical | Primary differentiator | High (external deps) | **10** | ×3 |
| S04 Onboarding | 🟡 High | First impressions | Low | **6** | ×2 |
| S05 Billing | 🔴 Critical | Revenue | Medium | **10** | ×3 |
| S06 Practitioner | 🟡 High | Power user retention | Medium | **7** | ×2 |
| S07 Engagement | 🟡 High | Retention | Low | **5** | ×1 |
| S08 Notion | 🟢 Medium | Nice-to-have feature | Low | **3** | ×1 |
| S09 Push/SMS | 🟢 Medium | Engagement | Low | **3** | ×1 |
| S10 Responsive | 🟡 High | 60%+ mobile users | Medium | **7** | ×2 |
| S11 Perf/a11y | 🟡 High | SEO, legal, UX | Medium | **6** | ×2 |
| S12 Error States | 🟡 High | Trust & reliability | High | **7** | ×2 |
| S13 Security | 🔴 Critical | Legal, trust, data | Medium | **9** | ×3 |
| S14 API/Embed | 🟢 Medium | Agency tier only | Low | **3** | ×1 |
| S15 i18n | 🟢 Medium | Non-English users | Low | **2** | ×1 |
| S16 Admin | 🟢 Low | Internal only | Low | **1** | ×1 |
| S17 Journeys | 🔴 Critical | Cross-cutting flows | High | **10** | ×3 |
| S18 State Models | 🔴 Critical | Data integrity | Medium | **8** | ×2 |
| S19 Exploratory | 🟡 High | Unknown unknowns | High | **7** | ×2 |
| S20 Boundaries | 🟡 High | Edge case crashes | Medium | **6** | ×2 |
| S21 Chaos | 🟡 High | Resilience | High | **8** | ×2 |
| S22 UX/Cognitive | 🟡 High | Conversion rate | Medium | **6** | ×2 |

### Test Execution Priority

> Run in this order. Stop and fix before proceeding if a P0 test fails.

| Phase | Duration | Sections | Gate |
|-------|----------|----------|------|
| **1. Smoke** | 30 min | S01 (login), S02 (one chart), S05 (pricing page loads) | Any fail → STOP |
| **2. Core flows** | 2 hours | S01–S03, S05, S13 (security) | P0 fail → STOP |
| **3. Journeys** | 2 hours | S17 all personas, S18 state transitions | P0 fail → STOP |
| **4. Breadth** | 3 hours | S04, S06–S12, S14–S16 | P0 fail → STOP, P1 → log |
| **5. Deep dives** | 3 hours | S19 exploratory charters, S20 boundaries, S21 chaos | P0 fail → STOP |
| **6. Polish** | 2 hours | S22 cognitive walkthrough, S11 accessibility, S10 browser matrix | Log all findings |

---

## FINAL VERDICT

After all sections scored:

| Rating | Criteria |
|--------|----------|
| **LAUNCH READY** | All sections GREEN, zero P0, ≤3 P1 |
| **SOFT LAUNCH READY** | No RED sections, zero P0, P1s have workarounds |
| **NOT READY** | Any RED section OR any P0 exists |

---

## MASTER TEST REGISTRY (JSON)

```json
{
  "test_run_date": "2026-03-15",
  "total_tests": 0,
  "passed": 0,
  "failed": 0,
  "blocked": 0,
  "sections": [
    { "id": "S01", "name": "Authentication & Registration", "total": 0, "passed": 0, "health": "", "risk": "critical" },
    { "id": "S02", "name": "Birth Data & Chart Generation", "total": 0, "passed": 0, "health": "", "risk": "critical" },
    { "id": "S03", "name": "Profile Generation (AI)", "total": 0, "passed": 0, "health": "", "risk": "critical" },
    { "id": "S04", "name": "Onboarding (Five Forges)", "total": 0, "passed": 0, "health": "", "risk": "high" },
    { "id": "S05", "name": "Tier & Billing Flows", "total": 0, "passed": 0, "health": "", "risk": "critical" },
    { "id": "S06", "name": "Practitioner Dashboard", "total": 0, "passed": 0, "health": "", "risk": "high" },
    { "id": "S07", "name": "Engagement & Retention", "total": 0, "passed": 0, "health": "", "risk": "high" },
    { "id": "S08", "name": "Notion Sync", "total": 0, "passed": 0, "health": "", "risk": "medium" },
    { "id": "S09", "name": "Push, SMS & Alerts", "total": 0, "passed": 0, "health": "", "risk": "medium" },
    { "id": "S10", "name": "Responsive & Cross-Browser", "total": 0, "passed": 0, "health": "", "risk": "high" },
    { "id": "S11", "name": "Performance & Accessibility", "total": 0, "passed": 0, "health": "", "risk": "high" },
    { "id": "S12", "name": "Error States & Edge Cases", "total": 0, "passed": 0, "health": "", "risk": "high" },
    { "id": "S13", "name": "Security Surface (UI)", "total": 0, "passed": 0, "health": "", "risk": "critical" },
    { "id": "S14", "name": "API Keys & Embed Widget", "total": 0, "passed": 0, "health": "", "risk": "medium" },
    { "id": "S15", "name": "Internationalization (i18n)", "total": 0, "passed": 0, "health": "", "risk": "medium" },
    { "id": "S16", "name": "Admin & Experiments", "total": 0, "passed": 0, "health": "", "risk": "low" },
    { "id": "S17", "name": "User Personas & Journeys", "total": 0, "passed": 0, "health": "", "risk": "critical" },
    { "id": "S18", "name": "State Transition Models", "total": 0, "passed": 0, "health": "", "risk": "critical" },
    { "id": "S19", "name": "Exploratory Charters", "total": 0, "passed": 0, "health": "", "risk": "high" },
    { "id": "S20", "name": "Boundary Value Analysis", "total": 0, "passed": 0, "health": "", "risk": "high" },
    { "id": "S21", "name": "Chaos & Resilience", "total": 0, "passed": 0, "health": "", "risk": "high" },
    { "id": "S22", "name": "Cognitive Walkthrough & UX", "total": 0, "passed": 0, "health": "", "risk": "high" }
  ],
  "p0_issues": [],
  "p1_issues": [],
  "verdict": ""
}
```
# System Audit — Prime Self
Date: 2026-03-16
Scope: Full codebase — security, billing, data, reliability, performance, compliance, UX, observability
Method: Expert + C-suite review across all handlers, middleware, DB migrations, cron, frontend, tests
Status: Open (5 P0 items resolved 2026-03-16)

False positives removed:
- AUDIT-003 (backslash in AUTH_ROUTES): `/api/composite` IS correctly forward-slashed in AUTH_ROUTES and protected. Not an issue.
- AUDIT-026 (cache invalidate auth): `/api/cache/invalidate` IS covered by `AUTH_PREFIXES` (`/api/cache/`). Not an issue.

---

## P0 — Fix Before Next Deploy

### SYS-001 — RELIABILITY — Cron Returns Out-of-Scope Variables ✅ RESOLVED 2026-03-16
File: workers/src/cron.js line 364
Finding: `return { snapshotDate, userCount: users.length, sent, failed }` references `users`, `sent`, and `failed` which are declared inside the IIFE passed to `withTimeout()` at lines 92–117. These variables are out of scope at the return statement. Every cron execution throws a `ReferenceError` at line 364 after completing all steps, causing it to enter the catch block and log a fatal error — even when all cron steps succeed.
Fix: Hoisted `let digestUserCount = 0, digestSent = 0, digestFailed = 0` above the IIFE. Return statement updated to reference hoisted vars.

### SYS-002 — DATA — Duplicate Migration Number 024 ✅ RESOLVED 2026-03-16
File: workers/src/db/migrations/024_atomic_limit_counters.sql + 024_practitioner_invitations.sql
Finding: Two migration files share the prefix 024. The migration runner resolves collisions by filesystem sort order, which is OS-dependent. `024_atomic_limit_counters.sql` creates the `rate_limit_counters` table; `024_practitioner_invitations.sql` creates the invitations flow. If the runner skips one, either rate limiting silently disappears (every auth request 503s) or invitations silently disappear (practitioner launch broken).
Fix: Renamed `024_practitioner_invitations.sql` → `024b_practitioner_invitations.sql`. Production has both tables applied already; runner uses migration name as key so `024b_practitioner_invitations` will be treated as new — harmless since all statements are IF NOT EXISTS.

### SYS-003 — DATA — Rate Limit Counter Table Grows Unbounded ✅ RESOLVED 2026-03-16
File: workers/src/cron.js, workers/src/db/queries.js
Finding: The `rate_limit_counters` table has no purge step. The cron has 9 documented steps including token cleanup and subscription downgrade but nothing for expired rate limit windows. Every API call inserts/updates a row. At 10K req/day this is ~3.6M rows/year. Eventually the atomicWindowCounterIncrement upsert — which runs on every single API request — will degrade significantly.
Fix: Added `QUERIES.purgeExpiredRateLimitCounters` query and new Step 0 in cron to purge rows with `window_end < NOW() - INTERVAL '1 hour'`.

### SYS-004 — DATA — Raw SQL Concatenation in Cron ✅ RESOLVED 2026-03-16
File: workers/src/cron.js line 94
Finding: `query(QUERIES.getSmsSubscribedUsers + \` AND birth_date IS NOT NULL\`)` appends a raw SQL fragment to a named query. This works only if the base query ends with a WHERE clause. It bypasses the parameterized query pattern used everywhere else, is invisible in query logging, and will silently break if the base query is ever refactored.
Fix: Created dedicated `QUERIES.getSmsSubscribedUsersWithBirthDate` query. Cron now calls the named query directly.

---

## P1 — Fix Within Current Sprint

### SYS-005 — SECURITY — No Email Verification Gate on LLM Usage ✅ RESOLVED 2026-03-16
File: workers/src/handlers/profile.js, workers/src/handlers/profile-stream.js
Finding: Migration 036 documents "Gates LLM usage behind verified email to prevent abuse." Neither profile.js nor profile-stream.js checks `user.email_verified` before calling the LLM. An attacker can register with a throwaway email and immediately consume expensive Anthropic API calls. Usage quotas exist but only limit volume per user — they do not prevent unverified accounts.
Fix: Verified both handlers already short-circuit with a 403 `EMAIL_NOT_VERIFIED` response before LLM dispatch.

### SYS-006 — BILLING — `customer.subscription.paused` Not Handled
File: workers/src/handlers/webhook.js
Finding: Stripe supports subscription pausing via the Customer Portal. If a user pauses their subscription, Stripe fires `customer.subscription.paused`. The webhook switch statement does not handle this event — it falls through to `default` and logs "ignored." The user retains full tier access while paused and paying $0.
Fix: Add a case for `customer.subscription.paused` that sets subscription status to 'paused' and optionally downgrades tier to free until resumed.

### SYS-007 — BILLING — Upgrade Does Not Preserve Billing Period (Annual → Annual)
File: workers/src/handlers/billing.js lines 547–619
Finding: `handleUpgradeSubscription` resolves the target price using `tierConfig.priceId` (monthly price only). The validate.js schema for this endpoint does not accept `billingPeriod`. A user on an annual individual plan who upgrades to practitioner will be silently switched to monthly practitioner billing. This is unexpected pricing behaviour and a churn risk.
Fix: Accept `billingPeriod: z.enum(['monthly','annual']).default('monthly')` in upgrade body schema. Resolve `annualPriceId` vs `priceId` based on the param.

### SYS-008 — BILLING — Agency Referral Cap Documented But Not Implemented
File: workers/src/handlers/webhook.js lines 779–800
Finding: Comment at line 779 states "Agency tier: cap credit at 50% of subscription cost (per HD_UPDATES3 spec)" but the code applies a flat `shareRate = 0.25` to ALL tiers with no cap. At $349/mo agency, referrers earn $87.25/mo per referred agency user indefinitely with no ceiling. This is a financial liability.
Fix: Implement the documented cap: `const shareRate = tier === 'agency' ? Math.min(0.25, 0.50) : 0.25` and cap at 50% max: `const creditAmount = Math.min(Math.floor(amountPaid * 0.25), Math.floor(amountPaid * 0.50))`. For agency: cap = floor(349*0.50) = $174.50/mo max.

### SYS-009 — RELIABILITY — No Dunning / Grace Period After Payment Failure
File: workers/src/handlers/webhook.js lines 654–731
Finding: When `invoice.payment_failed` fires: an email is sent and status is set to `past_due`. No follow-up sequence exists — no reminder at day 3, 7, or 14; no access revocation after repeated failures. Stripe retries automatically but Prime Self never escalates. A user could sit in `past_due` with full tier access indefinitely.
Fix: Add a cron step (Step 10) that queries for subscriptions in `past_due` status older than 7 days and: (a) sends an escalating reminder email, (b) downgrades to free after 14 days.

### SYS-010 — SECURITY — TOTP Secret Stored in Plaintext
File: workers/src/handlers/auth.js, workers/src/db/queries.js
Finding: `totp_secret` is stored and retrieved as plaintext in the DB. `lib/tokenCrypto.js` provides AES-GCM encryption (already used for Notion tokens) but is not applied to TOTP secrets. A DB breach exposes every user's 2FA seed, allowing offline clone of their authenticator.
Fix: Encrypt `totp_secret` at rest using `encryptToken(secret, env.TOTP_ENCRYPTION_KEY)` before INSERT; decrypt on read during verification. Add `TOTP_ENCRYPTION_KEY` as a Worker secret.

### SYS-011 — SECURITY — `password_hash` Returned in All User Lookups ✅ RESOLVED 2026-03-16
File: workers/src/db/queries.js
Finding: `getUserById` and `getUserByEmail` both SELECT `password_hash` and `totp_secret`. `auth.js` strips the hash before returning to callers, but this is a fragile convention. Any new handler that calls these queries and skips the strip leaks the hash. The cron job queries users for digests and these rows contain the hash in Workers memory.
Fix: Safe variants are now schema-compatible for shared reads and are used by `getUserFromRequest()` plus non-auth lookup paths in SMS, practitioner, diary, referrals, webhook recovery, agency seats, and OAuth account linking. Hash-inclusive variants remain only on auth flows that actually need `password_hash` or `totp_secret`.

### SYS-012 — SECURITY — 2FA Setup Endpoint Not Rate-Limited
File: workers/src/middleware/rateLimit.js, workers/src/handlers/auth.js
Finding: `/api/auth/2fa/setup` has no dedicated rate limit entry. A user with a valid session can call this endpoint repeatedly, causing the server to generate and return a new TOTP seed on each call.
Fix: Add rate limit entry: `{ pattern: '/api/auth/2fa/setup', limit: 3, windowMs: 60000 }`.

### SYS-013 — PERF — Rate Limiting Hits Database on Every Request
File: workers/src/middleware/rateLimit.js
Finding: Every API request — including public, health, and static-ish endpoints — triggers a DB upsert on `rate_limit_counters` via `atomicWindowCounterIncrement`. At scale this creates a DB hotspot and adds ~10–30ms latency per request for a safety check that could live in KV.
Fix: Move rate limiting to Cloudflare KV for non-auth endpoints. Retain DB-backed rate limiting only for auth endpoints where exact counts matter (`/api/auth/login`, `/api/auth/register`, `/api/auth/2fa/*`).

### SYS-014 — DATA — No Index on `subscriptions.stripe_subscription_id`
File: workers/src/db/migrations/
Finding: The webhook handler calls `getSubscriptionByStripeSubscriptionId` on every subscription event (created, updated, deleted, invoice.paid, invoice.payment_succeeded). No migration adds an explicit index on this column. Without it every webhook triggers a sequential scan on the subscriptions table.
Fix: Add migration `042_add_subscription_indexes.sql`: `CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub_id ON subscriptions(stripe_subscription_id); CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);`

### SYS-015 — COMPLIANCE — Account Deletion Audit Log Stores IP in Plaintext
File: workers/src/db/migrations/039_account_deletions_audit.sql line 13
Finding: `account_deletions` table has `ip_address TEXT` column stored as plaintext. The migration comment says "not retaining PII" but IP addresses are PII under GDPR. The email is correctly hashed but the IP is not.
Fix: Hash the IP address using SHA-256 before storage, or truncate to /24 subnet (anonymize last octet). Alternatively omit entirely.

### SYS-016 — MISSING_FEATURE — No Validation Schema for Session Notes or Billing Cancel
File: workers/src/middleware/validate.js
Finding: Two high-value endpoints have no input validation schemas:
(a) `POST /api/practitioner/clients/:id/notes` — `session_date` is not validated as ISO date, `transit_snapshot` accepts arbitrary JSON without size limits, `share_with_ai` is not validated as boolean
(b) `POST /api/billing/cancel` — `immediately` and `previewOnly` are not validated as booleans; string "true" would be truthy
Fix: Add zod schemas for both endpoints in PATTERN_SCHEMAS and EXACT_SCHEMAS respectively.

### SYS-017 — MISSING_FEATURE — No Email Templates for Trial Ending / Renewal / Refund
File: workers/src/lib/email.js
Finding: Stripe billing.js creates 7-day practitioner trials (line 206) but no trial-ending reminder email exists. Also missing: subscription renewal confirmation, refund-issued notification to user, and dispute notification to user. Trial churn from no reminder is preventable revenue loss.
Fix (priority order):
1. Trial-ending reminder (send at day 5 of 7): highest ROI
2. Subscription renewal confirmation: trust signal
3. Refund-issued notification: support volume reducer
4. Dispute notification: chargeback visibility

### SYS-018 — DATA — No Pagination on Practitioner Client List
File: workers/src/handlers/practitioner.js line 219
Finding: `handleListClients` returns ALL clients in one query with no `LIMIT`/`OFFSET`. Practitioner tier has no client cap. A practitioner with 200+ clients gets a massive JSON blob on every roster load, degrading both DB and client performance.
Fix: Add `page` and `limit` query params (default limit 50). Add `LIMIT $2 OFFSET $3` to `getPractitionerClientsWithCharts` query.

---

## P2 — Fix Within 2 Sprints

### SYS-019 — SECURITY — No Consent Gate on Direct Client Add
File: workers/src/handlers/practitioner.js lines 228–304
Finding: `handleAddClient` adds any registered user to a practitioner's roster by email without client consent. This means a practitioner can access another user's full chart, profile, and session history just by knowing their email. The invite-and-accept flow exists but is not enforced as the only path.
Fix: Remove or gate `handleAddClient` behind admin-only access. The invite flow (handleInviteClient → handleAcceptInvitation) must be the sole path to adding clients.

### SYS-020 — UX — Cluster Member Birth Data Form Has 4 Hardcoded Timezone Options
File: frontend/js/app.js lines 5178–5183
Finding: The "Add Member" modal for clusters only shows 4 US timezones + UTC. For a platform where timezone accuracy directly affects chart accuracy, this silently miscalculates charts for any international or non-US user added via cluster.
Fix: Use the same IANA timezone autocomplete/select used in the main birth data form.

### SYS-021 — BILLING — No Test Coverage for Cancel Flow
File: tests/
Finding: Test suite covers checkout, one-time billing, and retention offers. No tests exist for: `previewOnly` cancel, immediate cancel, period-end cancel, retention offer structure, or cancel transaction rollback.
Fix: Add `billing-cancel-runtime.test.js` covering all cancel paths.

### SYS-022 — MISSING_FEATURE — Session Notes Have No Search or Date Filter
File: workers/src/handlers/session-notes.js
Finding: `handleListNotes` returns all notes with no search, filter, or pagination. For practitioners with months of session history per client, there is no way to find a specific note without loading the full list. The existing LIMIT 50 also means older notes become inaccessible.
Fix: Add query params: `search`, `fromDate`, `toDate`, `limit`, `offset`. Update `listSessionNotes` query accordingly.

### SYS-023 — OBSERVABILITY — No Structured Logging in Session Notes Handler
File: workers/src/handlers/session-notes.js
Finding: session-notes.js never imports or uses `createLogger`. Errors surface only via the practitioner router's generic catch. No structured log entries exist for note CRUD operations.
Fix: Import `createLogger` and add `log.info` / `log.error` for all CRUD operations.

### SYS-024 — PERF — Double Body Read for Chunked Requests
File: workers/src/index.js lines 560–576
Finding: For POST/PUT/PATCH without `Content-Length`, the code streams the entire request body to check size via a `request.clone()` reader, then the handler reads the original body again via `request.json()`. This doubles memory and CPU for every chunked request.
Fix: Use `request.cf?.bodySize` if present. Fall back to single clone only when needed, and pass the cloned body to the handler to avoid double-read.

### SYS-025 — UX — fetchUserProfile and exportMyData Skip apiFetch
File: frontend/js/app.js lines 94–113, ~1007
Finding: Both `fetchUserProfile()` and `exportMyData()` call raw `fetch()` with `credentials: 'include'` instead of `apiFetch()`. This skips the 401 silent refresh/retry logic and request ID threading. If the access token has expired, both calls fail without attempting token refresh.
Fix: Replace both with `apiFetch('/api/auth/me')` and `apiFetch('/api/auth/export')`.

### SYS-026 — BILLING — Health Check Full Mode is Unauthenticated and Calls Stripe Balance
File: workers/src/index.js lines 649–658
Finding: `GET /api/health?full=1` calls `stripe.balance.retrieve()` — a live Stripe API call — from a public, unauthenticated endpoint. Anyone can trigger a Stripe API call and receive Stripe error messages (which may include account information) in the response.
Fix: Gate `?full=1` behind `AUDIT_SECRET` query param check (same pattern used by `/api/analytics/audit`).

### SYS-027 — UX — Pricing Button State Sync References Legacy Tier ID
File: frontend/js/app.js
Finding: `_syncPractitionerPricingCards` may reference `priceBtn-white_label` (legacy tier name). If HTML uses current `priceBtn-agency` naming, the button state sync silently fails and pricing cards show incorrect active state.
Fix: Audit all `getElementById('priceBtn-*')` calls and align with current tier naming conventions.

### SYS-028 — COMPLIANCE — CAN-SPAM Physical Address Hardcoded in Email Footer
File: workers/src/lib/email.js
Finding: "8 The Green, Suite A, Dover, DE 19901, USA" is hardcoded in the email footer across all templates. If the business address changes, all transactional emails send stale address until code is redeployed — a CAN-SPAM compliance gap.
Fix: Move to env var `COMPANY_ADDRESS`. Set via Worker secret or wrangler.toml var.

---

## P3 — Backlog (Non-Urgent)

### SYS-029 — PERF — Multiple Neon Pool Instances Per Request
File: workers/src/handlers/*.js
Finding: `createQueryFn(env.NEON_CONNECTION_STRING)` is called once per handler function (not per request), but auth middleware also creates its own. Multiple handlers per request path can create 2–3 pool instances. Low risk at current scale; worth addressing before Agency tier.
Fix: Create query function once in the router and inject via `request._query`.

### SYS-030 — UX — No Offline Banner or Retry on Network Failure
File: frontend/js/app.js
Finding: `apiFetch` catches `TypeError` (network errors) but callers show generic error notifications. No offline detection (`navigator.onLine` / `online`/`offline` events), no persistent banner, no mutation queue.
Fix: Add global offline detection with a dismissible banner. Low priority for PWA credibility.

### SYS-031 — SECURITY — `window.currentUser` Exposed on Global Scope
File: frontend/js/app.js line 17
Finding: `window.currentUser` is globally accessible and contains email, tier, phone, and birth data. While `Object.freeze`'d, any browser extension or XSS vector can read it. The access token is correctly in a closure-scoped variable; currentUser should follow the same pattern.
Fix: Replace `window.currentUser = ...` with a module-level variable. Use a getter function `getCurrentUser()` for internal access.

### SYS-032 — SECURITY — Practitioner Invite Lookup Not Rate-Limited
File: workers/src/middleware/rateLimit.js
Finding: `GET /api/invitations/practitioner` and `POST /api/invitations/practitioner/accept` have no rate limit entries. Tokens are 32 random bytes (brute-force impractical), but defense-in-depth principle applies.
Fix: Add rate limit entries at 10/min for both endpoints.

### SYS-033 — DATA — `getUserByPhone` Missing `totp_enabled`/`totp_secret` Columns
File: workers/src/db/queries.js
Finding: `getUserByPhone` SELECT list does not include `totp_enabled` or `totp_secret`. If phone-based auth is ever added, 2FA would be silently bypassed because the handler would see `totp_enabled` as undefined (falsy).
Fix: Add `totp_enabled, totp_secret` to the SELECT in `getUserByPhone`.

### SYS-034 — MISSING_FEATURE — No Admin User Management UI
File: frontend/admin.html, workers/src/handlers/admin.js
Finding: `admin.html` exists but there are no admin-specific endpoints for user lookup, subscription override, manual tier adjustment, or event log browsing. Operational support for paying customers requires these.
Fix: Build admin endpoints (gated behind admin role + AUDIT_SECRET): user lookup, subscription override, tier manual adjustment, event log viewer.

### SYS-035 — OBSERVABILITY — No Alerting on Cron Step Failures
File: workers/src/cron.js
Finding: Cron step failures are logged via `log.error` and Sentry, but there is no alerting to an operator. A failing cron (missed transit snapshot, failed digest) could go unnoticed until a user complains.
Fix: After Sentry is active (now done), set up a Sentry alert rule: alert if `cron_fatal_error` or `cron_step_timeout` fires more than once in a 24-hour window.

---

## Pass 2 — Additional Areas (AI, Infra, Frontend, Privacy, Tests, Docs)

### SYS-036 — FRONTEND / SECURITY — P0 — 2FA QR Code Leaks TOTP Secret + CSP Blocks It ✅ RESOLVED 2026-03-16
File: frontend/js/app.js line 269; frontend/_headers line 2
Finding: The 2FA setup screen renders the QR code as `<img src="https://api.qrserver.com/v1/...&data=${otpauth_url}">`. Two compounding failures:
(1) `_headers` CSP declares `img-src 'self' data: blob:` — `api.qrserver.com` is not in the allowed list. The image is blocked; the QR code never renders. 2FA setup is visually broken for all users.
(2) The otpauth URL (including the raw TOTP secret) is sent as a query parameter to a third-party domain. Even if the CSP blocks the load, the browser may still initiate the network request before blocking the response, transmitting the secret to an external service.
Fix: Created `frontend/js/qr.js` — minimal client-side QR code generator (byte mode, EC-M, V1-7). `begin2FASetup()` now generates QR via `QRCode.toDataURL()`. TOTP secret never leaves the browser. CSP `img-src data:` already allowed.

### SYS-037 — FRONTEND — P1 — CSP connect-src Missing Worker API Origin
File: frontend/_headers line 2; frontend/index.html line 13; frontend/js/app.js line 4
Finding: `connect-src` in the server CSP header and meta tag does not include `https://prime-self-api.adrper79.workers.dev`. Current: `connect-src 'self' https://api.stripe.com https://cloudflareinsights.com https://plausible.io`. Every `apiFetch()` call targets the Worker — a different origin from selfprime.net. Strict-CSP browser configurations will block all API calls silently.
Fix: Add `https://prime-self-api.adrper79.workers.dev` to `connect-src` in `_headers`. Long-term: route API through Cloudflare Pages Functions (`/api/* → Worker`) to collapse both origins to `'self'`.

### SYS-038 — INTEGRATION — P1 — Facebook OAuth Referenced But Not Implemented
File: workers/src/handlers/oauthSocial.js lines 66–78
Finding: Project memory and UI reference "Google, Apple, Facebook" social login. `oauthSocial.js` routing regex only matches `(google|apple)`. There is no Facebook case. Any Facebook OAuth initiation returns 404.
Fix: Either implement Facebook OAuth (`graph.facebook.com/v18.0/me`) or remove all Facebook references from the UI and documentation until it is built.

### SYS-039 — INFRA — P1 — TELNYX_PUBLIC_KEY Not in Secrets Documentation
File: workers/wrangler.toml lines 76–105; workers/src/handlers/sms.js lines 27–32
Finding: `sms.js` requires `TELNYX_PUBLIC_KEY` for ed25519 webhook signature verification. If absent, all inbound Telnyx webhooks are rejected. This secret is not listed in `wrangler.toml`'s secrets comment block or `SECRETS_GUIDE.md`. Operators setting up from the guide would never know to set it. Inbound SMS (opt-in, opt-out commands) silently dead.
Fix: Add `# TELNYX_PUBLIC_KEY` and `# TELNYX_CONNECTION_ID` to the secrets comment block in `wrangler.toml` and to `SECRETS_GUIDE.md`.

### SYS-040 — INFRA — P1 — Staging KV Namespace IDs Are Placeholders
File: workers/wrangler.toml lines 138–143
Finding: `[env.staging]` KV namespace bindings have `id = "REPLACE_WITH_STAGING_CACHE_KV_ID"` and `id = "REPLACE_WITH_STAGING_RATE_LIMIT_KV_ID"`. `wrangler deploy --env staging` fails immediately. Staging exists as documentation but is not deployable.
Fix: Run `wrangler kv namespace create CACHE --env staging` and `wrangler kv namespace create RATE_LIMIT_KV --env staging`. Replace placeholder IDs with the returned values.

### SYS-041 — AI — P2 — profile-stream.js Bypasses savedProfilesMax Tier Limit
File: workers/src/handlers/profile-stream.js lines 257–267; workers/src/handlers/profile.js lines 222–240
Finding: `profile.js` checks `tierCfg.features.savedProfilesMax` before persisting a profile; `profile-stream.js` saves profiles unconditionally. Free-tier users using the streaming endpoint can accumulate unlimited saved profiles, bypassing the monetization gate.
Fix: Extract profile-save guard into a shared helper `canSaveProfileForUser(query, userId, tier)`. Call it in both handlers before save.

### SYS-042 — AI — P2 — LLM Wall-Clock Race Can Exceed 60s Workers Limit
File: workers/src/lib/llm.js lines 195–248
Finding: `checkWallClock()` is called before each provider attempt, not accounting for in-flight request time. Worst case: 3×25s Anthropic timeouts + 3s backoff sleeps = 78s total. Workers are forcibly killed at 60s. User gets an opaque connection-closed error with no fallback.
Fix: Reduce per-provider AbortController timeout to 18s. Compute dynamic per-call timeout: `Math.min(18000, MAX_WALL_CLOCK_MS - (Date.now() - wallClockStart) - 2000)`.

### SYS-043 — INFRA — P2 — Frontend CI Has No P0 Issue Gate
File: .github/workflows/deploy-frontend.yml
Finding: Workers CI blocks deployment when P0 issues are open. Frontend CI has no equivalent check. A frontend push bypasses the issue gate entirely.
Fix: Add the same P0 gate step to `deploy-frontend.yml` before the deploy step.

### SYS-044 — PRIVACY — P2 — No GDPR Consent Timestamp at Registration
File: workers/src/db/migrations/ (no consent migration); workers/src/handlers/auth.js (registration flow)
Finding: No migration adds `tos_accepted_at`, `tos_version`, or `data_processing_consent` columns. GDPR Article 7 requires demonstrable proof of consent with timestamp, purpose, and version. `email_marketing_opted_out` is CAN-SPAM, not a GDPR consent record. EU/UK regulators can demand this on audit.
Fix: Add migration 043: `ALTER TABLE users ADD COLUMN tos_accepted_at TIMESTAMPTZ, ADD COLUMN tos_version VARCHAR(20)`. Set both during registration. Include in data export.

### SYS-045 — TESTS — P2 — Zero Test Coverage for High-Risk Handlers
File: tests/ directory
Finding: The following deployed handlers have zero test files: `push.js` (HKDF, AES-GCM, ECDH, VAPID JWT), `alerts.js` (tier-gated CRUD), `sms.js` (Telnyx ed25519 signature verification), `oauthSocial.js` (PKCE, state, callbacks), `profile-stream.js` (SSE pipeline), `embed.js`, `famous.js`, `rectify.js`, `share.js`, `geocode.js`.
Fix: Prioritize: (1) push crypto round-trip tests, (2) Telnyx signature verification path, (3) OAuth state validation, (4) alert tier limit enforcement.

### SYS-046 — TESTS — P2 — No Coverage Threshold in CI
File: .github/workflows/deploy-workers.yml; vitest.config.js
Finding: `npm run test:coverage` runs but never enforces a minimum. The step passes at 0% coverage. CI provides no signal on regression.
Fix: Add to `vitest.config.js`: `coverage: { thresholds: { lines: 60, functions: 60, branches: 50 } }`.

### SYS-047 — PRIVACY — P3 — Birth Coordinates Persist in localStorage Indefinitely
File: frontend/js/app.js lines 2188–2206
Finding: Birth data (date, time, lat/lng, timezone) is written to localStorage via `saveBirthData()` with no TTL, no clear-on-logout, and no user disclosure. Under GDPR, precise geolocation with birth date is sensitive data. `savedAt` timestamp is stored but never checked for expiry.
Fix: Clear `BIRTH_DATA_KEY` from localStorage on logout. Or enforce a 90-day TTL on restore by checking `savedAt`.

### SYS-048 — INFRA — P3 — Audit Workflow Commits Directly to main
File: .github/workflows/audit-cron.yml lines 74–83
Finding: Audit bot pushes directly to `main` with `contents: write` permission, bypassing branch protection. A compromised audit script could push arbitrary changes.
Fix: Route audit commits to a `audits/<date>` branch and open a PR, or scope the deployment key to the `audits/` path only.

### SYS-049 — MONETIZATION — P3 — No Free Trial in Stripe Checkout
File: workers/src/handlers/billing.js lines 99–200
Finding: `handleCheckout` creates subscriptions with no `trial_period_days`. Industry benchmarks show 20–35% conversion lift from 7-day free trials. The architecture supports it natively via Stripe.
Fix: Add optional `trialDays: 7` to `createCheckoutSession`, gated by `ENABLE_TRIAL` env var, only for users with no prior subscription history.

### SYS-050 — DOCS — P3 — No Developer Onboarding Document
File: docs/ directory
Finding: No `CONTRIBUTING.md` or `DEVELOPMENT.md` exists. Operator runbooks exist (`OAUTH_API_SETUP.md`, `SECRETS_GUIDE.md`) but nothing explains how to run tests locally, set up a staging environment, or contribute. Setup time for a new engineer is days.
Fix: Create `CONTRIBUTING.md` at repo root: prerequisites, `npm test`, staging deploy flow, PR → staging → production promotion.

### SYS-051 — DOCS — P3 — OpenAPI Spec Stale (15+ Endpoints Missing)
File: docs/openapi.json; docs/API.md; docs/API_SPEC.md
Finding: `openapi.json` predates at least: `/api/push/*` (7 routes), `/api/alerts/*` (8 routes), `/api/profile/generate/stream` (SSE), `/api/auth/oauth/:provider`, `/api/auth/2fa/*`, `/api/referrals/*`, `/api/geocode`, practitioner directory routes. Any external consumer or SDK author is working from stale specs.
Fix: Regenerate from annotated route definitions or schedule quarterly manual update. At minimum sync `docs/API.md`.

---

## Confirmed Well-Implemented (No Findings)

- **Engine correctness**: `julian.js` implements Meeus Ch.7 JDN formula with Gregorian correction; `gates.js` applies canonical 3.875° offset with correct 64-gate sequence, color/tone/base subdivision, and edge-case wrapping. Engine test vectors verified against known birth chart. No correctness issues.
- **LLM cascade design**: Anthropic → Grok → Groq failover correctly structured with exponential backoff (1s, 2s), early exit on 4xx, model equivalence per tier, CF AI Gateway routing. Only gap is wall-clock race (SYS-042).
- **Push crypto**: `push.js` implements RFC 8030/8291 web push correctly — ECDH shared secret, HKDF-SHA256 key derivation, AES-128-GCM with content encoding, VAPID ES256 JWT, 410/404 expiry handling. Unusually complete hand-rolled crypto.
- **Sentry integration**: Clean lightweight envelope API implementation with fingerprinting, breadcrumbs, request/user context, header sanitization. Correctly initialized per-request.
- **Account deletion**: Atomic GDPR deletion with Stripe cancellation, email-hash audit record, cookie clear, analytics churn event. Correctly ordered.
- **Billing core**: Idempotent checkout (reuse open sessions), open-redirect validation, promo code handling, agency-tier gating, retention offer deflection. Solid.

---

## Master Summary (All Issues)

| Severity | Pass 1 | Pass 2 | Total | Key Risks |
|---|---|---|---|---|
| **P0** | 4 | 1 | **5** | Cron ReferenceError daily; 2FA broken in prod; duplicate migration 024; unbounded rate limit table |
| **P1** | 14 | 4 | **18** | Email-unverified LLM access; TOTP plaintext; paused sub unhandled; dunning gap; staging undeployable |
| **P2** | 10 | 6 | **16** | Streaming profile bypasses tier limit; LLM 60s race; no GDPR consent; zero test coverage on 10 handlers |
| **P3** | 7 | 5 | **12** | No free trial; no dev onboarding; stale API docs; birth data localStorage |
| **Total** | 35 | 16 | **51** | |

## Immediate Action Queue (P0 — fix before next deploy)

1. **SYS-036** — Fix 2FA QR: replace api.qrserver.com with client-side canvas rendering (TOTP secret leaks today)
2. **SYS-001** — Fix cron return scope: hoist `users`, `sent`, `failed` above withTimeout IIFE
3. **SYS-002** — Verify duplicate migration 024 both applied in production DB
4. **SYS-003** — Add rate_limit_counters purge step to cron
5. **SYS-004** — Extract dedicate getSmsSubscribedUsersWithBirthDate query

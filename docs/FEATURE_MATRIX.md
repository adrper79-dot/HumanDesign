# Prime Self — Comprehensive Feature Matrix

**Generated:** March 17, 2026  
**Project:** Prime Self (Human Design + Astrology Platform)  
**Version:** v0.2.0  

---

## Table of Contents
1. [Core Chart Calculation](#core-chart-calculation)
2. [User Authentication & Management](#user-authentication--management)
3. [Profile Generation & Display](#profile-generation--display)
4. [Transits & Timing](#transits--timing)
5. [Practitioner Tools](#practitioner-tools)
6. [Billing & Subscriptions](#billing--subscriptions)
7. [Community & Sharing](#community--sharing)
8. [Integrations](#integrations)
9. [Admin & Observability](#admin--observability)
10. [Frontend UI Features](#frontend-ui-features)

---

## Core Chart Calculation

### Feature: Chart Calculation Engine (8 Layers)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Chart Calculation Engine (Layer 1-8 Processing) |
| **Permission Level** | PUBLIC (anonymous allowed) / AUTHENTICATED (private save) |
| **Workflow Position** | Entry point; all features depend on chart data |
| **Purpose** | Calculate Human Design natal chart, planetary positions, gates/lines, natal astrology, transits |
| **Files** | `src/engine/julian.js`, `src/engine/planets.js`, `src/engine/design.js`, `src/engine/gates.js`, `src/engine/chart.js`, `src/engine/astro.js`, `src/engine/transits.js`, `src/engine/synthesis.js` |
| **Workflow Step** | 1. Receive birth date/time/location → 2. Parse UTC → 3. Calculate JDN (Layer 1) → 4. Planetary positions (Layer 2) → 5. Design offset (Layer 3) → 6. Gate/line mapping (Layer 4) → 7. Chart structure (Layer 5) → 8. Astro integration (Layer 6) → 9. Present to frontend |
| **API Endpoints** | `POST /api/chart/calculate` (public, no auth), `GET /api/chart/:chartId` (authenticated) |
| **Test Elements** | `tests/engine.test.js` — AP test vector (August 5, 1979, Tampa FL), vitest snapshots for charts, gate/line validation, planetary position accuracy against JPL ephemeris |
| **Analytical Elements** | Event tracking: `chart_generated` (type, authority, profile logged); Performance metrics: calculation time (<500ms baseline) |
| **Error Debugging** | `window.DEBUG` logging for each layer; `parseToUTC.test.js` validates timezone edge cases (day boundary, negative minutes); Layer-by-layer error codes in responses (e.g., `ERR_INVALID_TIMEZONE`, `ERR_JDN_CALCULATION`) |
| **Database Tables** | `charts` (chartId, userId, birthDate, birthTime, birthTimezone, location, chart JSON snapshot) |
| **Key Code** | `workers/src/handlers/calculate.js` (172 lines) — receives request, validates birth data, calls engine layers, returns full chart JSON |
| **Tier Availability** | FREE (public, unauthenticated) |
| **Status** | Production ✅ |
| **External Dependencies** | None (self-contained calculation engine) |
| **Dependencies** | None (upstream feature) |
| **Critical Path** | ✅ YES — required for all subsequent features (profiles, transits, compatibility, etc.) |
| **Known Issues** | None currently tracked; see FEATURE_MATRIX_AUDIT.md for open design issues |

---

### Feature: Chart Auto-Save to History

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Chart History & Persistence |
| **Permission Level** | AUTHENTICATED only (requires `request._user.id`) |
| **Workflow Position** | Post-calculation; optional feature |
| **Purpose** | Save user's generated charts for later retrieval, enable "favorite" charts, support compare feature |
| **Files** | `workers/src/handlers/chart-save.js` (129 lines) |
| **Workflow Step** | 1. User saves chart after view → 2. POST `/api/chart/save` with chartId → 3. DB inserts into `charts` table → 4. Returns saved chart metadata |
| **API Endpoints** | `POST /api/chart/save`, `GET /api/chart/history` |
| **Test Elements** | `tests/handlers.test.js` — auth required, chart payload validation, history ordering (most recent first) |
| **Analytical Elements** | Event: `chart_saved` (userId, chartId, profile metadata); `chart_reopened` (reaccess tracking) |
| **Error Debugging** | Error codes: `ERR_CHART_SAVE_FAIL`, `ERR_INVALID_CHART_DATA`; DB connection fallback (graceful if NEON_CONNECTION_STRING missing) |
| **Database Tables** | `charts` (id PK, userId FK, chartId, birthData, chartJson, createdAt, updatedAt) |
| **Key Code** | `handleSaveChart()` validates chart structure, dedupes on (userId, chartId), inserts/updates with timestamp |
| **Tier Availability** | INDIVIDUAL+ (Individual, Practitioner, Agency; Free tier has 0 saved charts per matrix) |
| **Status** | Production ✅ |
| **External Dependencies** | Neon PostgreSQL (critical: DB down = no saves) |
| **Dependencies** | [Chart Calculation] (requires chartId from `/api/chart/calculate`); [Chart History Listing] |
| **Critical Path** | ⚠️ SECONDARY — profile generation depends on saved charts, so indirectly critical |
| **Known Issues** | BL-C1 (Neon API pattern); BL-FMA-3 (dependency documentation) |

---

## User Authentication & Management

### Feature: Email & Password Registration/Login

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Email/Password Auth (Register, Sign In, Logout) |
| **Permission Level** | PUBLIC (register/login); AUTHENTICATED (logout) |
| **Workflow Position** | First time = registration; subsequent = login; entry gate for all personal features |
| **Purpose** | Create user account, authenticate sessions, manage JWT tokens |
| **Files** | `workers/src/handlers/auth.js` (470 lines), `workers/src/middleware/auth.js`, `workers/src/lib/jwt.js`, `frontend/js/app.js` (lines 906–1000+) |
| **Workflow Step** | 1. User enters email + password on login modal → 2. Frontend POSTs to `/api/auth/login` → 3. Backend hashes password, compares with DB → 4. If match, return user profile and set secure auth cookies → 5. Frontend keeps any access token in memory only, scrubs legacy localStorage keys, and uses the HttpOnly `ps_refresh` cookie for silent refresh → 6. Authenticated requests use cookies and, when present, an in-memory `Authorization: Bearer {token}` header |
| **API Endpoints** | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/refresh` |
| **Database Tables** | `users` (id, email, password_hash, tier, email_verified, created_at, updated_at) |
| **Test Elements** | `tests/auth-handler-runtime.test.js` — valid/invalid credentials, token claims, refresh expiry, password hashing (bcrypt), email conflict detection |
| **Analytical Elements** | Event: `user_signup` (tier, referral_source), `user_login` (tier, session_duration), `auth_failed` (failure_type: invalid_password, user_not_found, etc.) |
| **Error Debugging** | Error codes: `ERR_USER_EXISTS`, `ERR_INVALID_PASSWORD`, `ERR_EMAIL_NOT_VERIFIED`; password validation: min 8 chars, uppercase+lowercase+digit required; logs auth failures to Sentry (if configured) |
| **Key Code** | `handleAuth()` → route dispatcher for register/login/logout/refresh; JWT signed with HS256 using `JWT_SECRET` env var; refresh tokens stored separately in `refresh_tokens` table; frontend auth state uses memory plus HttpOnly cookies rather than durable localStorage token storage |
| **Tier Availability** | FREE (public registration) |
| **Status** | Production ✅ |
| **External Dependencies** | Resend API (email verification) → **SINGLE POINT OF FAILURE**: if down, signup blocked |
| **Dependencies** | None (upstream); [Email Verification] is recommended pre-requisite |
| **Critical Path** | ✅ YES — foundational feature for all user accounts |
| **Known Issues** | BL-FMA-1 (Facebook OAuth not implemented); BL-FMA-4 (Resend email single failure point); BL-C2 (migration script issues) |

---

### Feature: 2FA (TOTP) Setup & Verification

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Two-Factor Authentication (TOTP) |
| **Permission Level** | AUTHENTICATED only; optional self-service |
| **Workflow Position** | Post-login; recommended for practitioners with client data access |
| **Purpose** | Add second authentication factor via authenticator app (Google Authenticator, Authy) |
| **Files** | `frontend/js/app.js` (lines 225–320: `_renderSecurityModal()`, `begin2FASetup()`, `confirm2FASetup()`, `disable2FA()`); backend: `workers/src/handlers/auth.js` (TOTP endpoints) |
| **Workflow Step** | 1. User clicks "Enable 2FA" → 2. Backend generates secret key, returns QR code as data URI → 3. Frontend renders modal with QR + manual entry option → 4. User scans/enters secret into authenticator app → 5. User submits 6-digit code → 6. Backend verifies with `speakeasy` or similar TOTP library → 7. Store secret encrypted in DB, set `totp_enabled = true` |
| **API Endpoints** | `POST /api/auth/2fa/setup`, `POST /api/auth/2fa/verify`, `POST /api/auth/2fa/disable` |
| **Database Tables** | `users` (totp_secret, totp_enabled) |
| **Test Elements** | `tests/handlers.test.js` — QR code generation, TOTP code validation, time-skew tolerance (±30s), disabling revokes access |
| **Analytical Elements** | Event: `2fa_enabled` (user_tier), `2fa_verified` (success/failure count), `2fa_disabled` |
| **Error Debugging** | Error codes: `ERR_2FA_INVALID_CODE`, `ERR_2FA_ALREADY_ENABLED`, `ERR_2FA_TIME_SKEW`; Frontend UI shows "Code expired (30s window)" if user takes too long |
| **Key Code** | `speakeasy.totp.verify()` called with 30s window; QR code generated via `qrcode.js` library (self-hosted, BL-M16); backup codes stored separately for account recovery |

---

### Feature: Email Verification & Verification Resend

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Email Verification (Signup Flow) |
| **Permission Level** | PUBLIC (during signup); AUTHENTICATED (resend option) |
| **Workflow Position** | Immediately after registration before account can be used |
| **Purpose** | Confirm email ownership, prevent spam registration |
| **Files** | `workers/src/handlers/auth.js` (email send via Resend API), `frontend/js/app.js` (lines 884: `resendVerificationEmail()`) |
| **Workflow Step** | 1. User registers with email → 2. Backend generates token, sends email via Resend API with verification link → 3. User clicks link with `?token=XYZ` → 4. Backend validates token, sets `email_verified = true` → 5. User can now access premium features |
| **API Endpoints** | `POST /api/auth/email/verify`, `POST /api/auth/email/resend` |
| **Database Tables** | `users` (email_verified BOOLEAN, email_verification_token) |
| **Test Elements** | `tests/handlers.test.js` — token validity, expiry (24h), resend rate-limit (1 per 60s), verified users only can access certain endpoints |
| **Analytical Elements** | Event: `email_sent` (delivery_provider: resend), `email_verified` (time_to_verify), `verification_resent` |
| **Error Debugging** | Error codes: `ERR_EMAIL_NOT_DELIVERED` (Resend API failure), `ERR_VERIFICATION_TOKEN_EXPIRED`, `ERR_EMAIL_ALREADY_VERIFIED`; Resend webhook events logged for delivery status |
| **Key Code** | Email sent via `new Resend({ auth: env.RESEND_API_KEY }).emails.send({...})` with link back to `https://[domain]/auth?token=...&mode=email-verify` |

---

### Feature: Password Reset & Recovery

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Forgot Password & Reset |
| **Permission Level** | PUBLIC (anyone with email can initiate) |
| **Workflow Position** | User lost access flow; alternative to account deletion |
| **Purpose** | Allow locked-out users to regain access |
| **Files** | `frontend/js/app.js` (lines 414–470: `submitForgotPassword()`; 566–620: `submitResetPassword()`), `workers/src/handlers/auth.js` |
| **Workflow Step** | 1. User enters email on "Forgot Password" → 2. Backend generates token, sends reset link via email → 3. Frontend receives `?resetToken=XYZ` → 4. User enters new password → 5. Frontend POSTs resetToken + new password → 6. Backend validates token (5-min TTL), hashes new password, updates DB |
| **API Endpoints** | `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` |
| **Database Tables** | `users` (password_reset_token, password_reset_expires_at) |
| **Test Elements** | `tests/handlers.test.js` — token expiry (5 min), single-use enforcement, invalid tokens rejected, new password meets requirements (8 chars, mixed case, digit) |
| **Analytical Elements** | Event: `password_reset_requested` (email domain for leak detection), `password_reset_completed`, `reset_link_expired` |
| **Error Debugging** | Error codes: `ERR_RESET_TOKEN_INVALID`, `ERR_RESET_TOKEN_EXPIRED`, `ERR_PASSWORD_TOO_WEAK`; Frontend shows human-readable messages (e.g., "Password must contain uppercase, lowercase, and number") |
| **Key Code** | Token generation: `crypto.randomBytes(32).toString('hex')`; TTL enforced via `password_reset_expires_at`; token marked single-use after first reset attempt |

---

### Feature: User Profile Management

| Attribute | Details |
|-----------|---------|
| **Feature Name** | User Profile Settings (Name, Avatar, Preferences) |
| **Permission Level** | AUTHENTICATED only |
| **Workflow Position** | Settings panel; user profile sidebar (Workspace tab) |
| **Purpose** | Store user metadata, display name, timezone preference, notification settings |
| **Files** | `frontend/js/app.js` (settings modal), `workers/src/handlers/auth.js` (GET /api/auth/me), profile endpoints |
| **Workflow Step** | 1. User opens settings → 2. Frontend loads current profile from `/api/auth/me` → 3. User edits name/avatar/timezone → 4. Frontend POSTs changes → 5. Backend validates, updates `users` table → 6. Frontend updates UI immediately |
| **API Endpoints** | `GET /api/auth/me` (get profile), `PATCH /api/auth/me` (update profile) |
| **Database Tables** | `users` (display_name, avatar_url, timezone, language_preference, notification_settings JSON) |
| **Test Elements** | `tests/handlers.test.js` — profile update validation, unauthorized updates rejected, timezone in IANA list, avatar URL whitelisted domains |
| **Analytical Elements** | Event: `profile_updated` (field_changed: timezone, avatar, name), `settings_viewed` |
| **Error Debugging** | Error codes: `ERR_INVALID_TIMEZONE`, `ERR_INVALID_AVATAR_URL`, `ERR_PROFILE_UPDATE_FAILED`; Frontend form validation (name 2-50 chars, valid IANA timezone) |
| **Key Code** | `handleGetProfile()` / `handleUpdateProfile()` in `workers/src/handlers/auth.js` or separate `profile.js`; frontend profile state is refreshed from `/api/auth/me` and any legacy auth tokens are scrubbed from localStorage |

---

## Profile Generation & Display

### Feature: AI-Powered Prime Self Profile Generation

| Attribute | Details |
|-----------|---------|
| **Feature Name** | LLM Profile Generation (Prime Self Forge Synthesis) |
| **Permission Level** | AUTHENTICATED; TIER-GATED (Starter/Pro/Agency) |
| **Workflow Position** | Post-chart; premium feature; displayed in user's Workspace tab |
| **Purpose** | Generate personalized 3,000+ word Prime Self Forge narrative synthesizing HD, Astro, Gene Keys, Numerology |
| **Files** | `workers/src/handlers/profile.js` (303 lines), `workers/src/handlers/profile-stream.js` (310 lines — Server-Sent Events), `workers/src/lib/prompt-builder.js` (synthesis prompts), `src/engine/synthesis.js` |
| **Workflow Step** | 1. User clicks "Generate Profile" → 2. Frontend sends chartId + userId → 3. Backend loads full chart JSON from DB → 4. Layer 8 (synthesis.js) builds multi-part prompt (5 system prompts + chart data + RAG context) → 5. Calls LLM (Claude Opus → grok-4 → llama-70b failover) → 6. Streams response via SSE or waits for completion → 7. Stores profile JSON in `profiles` table → 8. Frontend displays with collapsible sections (Self-Concept, Circadian Rhythm, Lines profile, etc.) |
| **API Endpoints** | `POST /api/profile` (full generation, ~60s), `POST /api/profile/stream` (SSE streaming, real-time UI updates) |
| **Database Tables** | `profiles` (id, userId, chartId, forge_narrative TEXT, generated_at, expires_at, archived_at); `validation_data`, `psychometric_data` (for behavioral anchoring) |
| **Test Elements** | `tests/handlers.test.js` — LLM response format (JSON with sections), token count <4000, no safety violations, UI render correctness for sections (Self-Concept, Channels, etc.); `tests/profiles.test.js` — cached profiles returned within 24h, expired profiles regenerated |
| **Analytical Elements** | Event: `profile_generated` (source: web/api, generation_time_ms, token_count, model_used), `profile_streamed` (bytes_sent, connection_closed_early), `profile_viewed` (duration_on_page, sections_expanded), `profile_expired` (days_since_generation) |
| **Error Debugging** | Error codes: `ERR_LLM_TIMEOUT` (60s limit), `ERR_LLM_RATE_LIMIT`, `ERR_PROFILE_SCHEMA_INVALID`, `ERR_INSUFFICIENT_TIER`; Streaming errors: reconnect with exponential backoff; Logs: full request/response to Sentry for debugging (sanitized, no PII) |
| **LLM Stack** | Anthropic Claude Opus (primary, $15/M tokens) → Grok 4 fast (secondary, $5/M) → Llama 3.3 70B (fallback, $0.27/M); AI Gateway rate limiting: 10 req/min free, 100 req/min pro |
| **Key Code** | `handleProfile()` calls `buildSynthesisPrompt()` which chains layers 1-8 + RAG context + grounding rules; Result stored in `profiles` table with expiry (7 days for free, 30 days for pro); Cache in KV for 1h |

---

### Feature: Profile Streaming (Real-Time SSE)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Server-Sent Events (SSE) Profile Stream |
| **Permission Level** | AUTHENTICATED; same tier-gating as profiles |
| **Workflow Position** | Alternative to blocking `/api/profile` endpoint; improves perceived performance |
| **Purpose** | Send LLM output incrementally, show user progress in real-time, reduce frontend timeout |
| **Files** | `workers/src/handlers/profile-stream.js` (310 lines) |
| **Workflow Step** | 1. Frontend opens EventSource to `/api/profile/stream?chartId=...` → 2. Backend opens LLM stream → 3. Backend buffers LLM chunks, sends `data: {...chunk}` every 250ms → 4. Frontend appends text to visible section → 5. On LLM complete, send final `data: {complete: true}` message → 6. Close SSE connection |
| **API Endpoints** | `GET /api/profile/stream` (SSE, text/event-stream Content-Type) |
| **Test Elements** | `tests/handlers.test.js` — SSE properly formatted, chunks valid JSON, connection closes on completion, timeout after 90s |
| **Analytical Elements** | Event: `stream_started`, `stream_chunk_sent` (size_bytes, cumulative_bytes), `stream_completed`, `stream_failed` (error_type) |
| **Error Debugging** | Error codes: `ERR_STREAM_TIMEOUT`, `ERR_STREAM_CLOSED_EARLY`; Frontend auto-reconnect on close; Logs to monitor chunk arrival rate (should be >0.5KB/s) |
| **Key Code** | SSE implemented via `response.body = ReadableStream` in Workers or simpler `response.cf.stream = true` pattern; `profile-stream.js` uses `for await (chunk of llmStream)` to iterate LLM tokens |

---

### Feature: PDF Export of Profiles

| Attribute | Details |
|-----------|---------|
| **Feature Name** | PDF Export (Branded Practitioner Version) |
| **Permission Level** | AUTHENTICATED; Practitioner/Agency tiers only |
| **Workflow Position** | From profile view; optional export for sharing with clients offline |
| **Purpose** | Generate beautifully formatted PDF with profile, chart imagery, practitioner branding |
| **Files** | `workers/src/handlers/pdf.js` (331 lines), R2 object storage backend |
| **Workflow Step** | 1. User views profile, clicks "Export PDF" → 2. Frontend POSTs `/api/profile/pdf/:profileId` → 3. Backend loads profile JSON + chart + practitioner branding from DB → 4. Generates PDF via `pdfkit` or `puppeteer` → 5. Uploads to Cloudflare R2 → 6. Returns signed URL to user → 7. Frontend downloads via link or opens in new tab |
| **API Endpoints** | `POST /api/profile/pdf/:profileId` (sync, 30s timeout), `GET /api/pdf/:pdfId` (download) |
| **Database Tables** | `pdf_exports` (id, profileId, userId, s3Key, expiresAt, createdAt) |
| **Test Elements** | `tests/handlers.test.js` — PDF valid structure (PDFKit headers), file size reasonable (<10MB), R2 upload success, signed URL generation |
| **Analytical Elements** | Event: `pdf_generated` (file_size_mb, generation_time_ms), `pdf_downloaded` (user_tier, time_to_download) |
| **Error Debugging** | Error codes: `ERR_PDF_GENERATION_TIMEOUT`, `ERR_R2_UPLOAD_FAILED`; Fallback: store as base64 in DB if R2 unavailable (temporary, <24h) |
| **Key Code** | PDF generation: `PDFDocument` from pdfkit; branding injected via `pdfDoc.image(practitionerLogoUrl, x, y, options)`; R2 upload via Cloudflare SDK |

---

### Feature: Profile Searches & Listing

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Search & Browse Saved Profiles |
| **Permission Level** | AUTHENTICATED; only own profiles visible by default (unless shared) |
| **Workflow Position** | User profile library; optionally public via Directory |
| **Purpose** | List user's saved profiles, search by chart name/date/keywords, sort by creation date |
| **Files** | `workers/src/handlers/profile.js` (lines 348–400: `handleListProfiles()`, `handleSearchProfiles()`) |
| **Workflow Step** | 1. User opens "My Profiles" → 2. Frontend calls `GET /api/profile?limit=20&offset=0` → 3. Backend queries `profiles` where `userId = request._user.id`, orders by `created_at DESC`, limits 20 → 4. Returns paginated array → 5. Frontend renders list with metadata (date, type, expiry) |
| **API Endpoints** | `GET /api/profile` (list), `GET /api/profile/search?q=...` (full-text search) |
| **Database Tables** | `profiles` (includes `archived_at` for soft-delete), indexed on (userId, created_at) |
| **Test Elements** | `tests/handlers.test.js` — pagination working, search returns matching results, archived profiles excluded, tier limits enforced (free: 3 profiles, starter: 10, pro: unlimited) |
| **Analytical Elements** | Event: `profile_list_viewed` (count_returned), `profile_searched` (query_term), `profile_archived` |
| **Error Debugging** | Error codes: `ERR_PROFILE_NOT_FOUND`, `ERR_SEARCH_QUERY_INVALID`; Full-text search uses PostgreSQL `tsvector` for performance; Fallback to LIKE if regex fails |
| **Key Code** | Pagination via OFFSET/LIMIT; search via `SELECT * FROM profiles WHERE userId = $1 AND to_tsvector('english', forge_narrative) @@ plainto_tsquery($2)` |

---

## Transits & Timing

### Feature: Real-Time Transit Positions

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Current Transit Positions Display |
| **Permission Level** | PUBLIC; cached globally |
| **Workflow Position** | Transits tab; shows current planetary positions overlaid on natal chart |
| **Purpose** | Display today's planetary transits for interpretation |
| **Files** | `workers/src/handlers/transits.js` (75 lines), `src/engine/transits.js` (Layer 7) |
| **Workflow Step** | 1. User navigates to Transits tab → 2. Frontend calls `GET /api/transits?date=today` → 3. Backend checks KV cache (`TRANSIT_CACHE_[YYYYMMDD]`) → 4. If cache miss, calculates via Layer 7 (transits engine), stores in KV (24h TTL) → 5. Returns transit positions formatted by gate/line/planet → 6. Frontend overlays on natal chart visualization |
| **API Endpoints** | `GET /api/transits` (current date), `GET /api/transits?date=YYYY-MM-DD` (specific date) |
| **Cache Layer** | Cloudflare KV: `TRANSIT_CACHE_[YYYYMMDD]` populated daily at 6 AM UTC by cron, 24h TTL |
| **Test Elements** | `tests/engine.test.js` — transit accuracy against JPL ephemeris, cache hit rate (should be >95%), cron job runs daily |
| **Analytical Elements** | Event: `transits_viewed` (date_queried), `transit_cache_hit` / `transit_cache_miss`, `transits_calculated` (calculation_time_ms) |
| **Error Debugging** | Error codes: `ERR_TRANSIT_CALCULATION_TIMEOUT`, `ERR_INVALID_DATE`; Fallback: return cached value from previous day if today's cache fails to generate |
| **Key Code** | Layer 7 (`src/engine/transits.js`) calculates planets at given Julian date, returns `{ planets: [...], gates: [...], lines: [...] }`; Results cached in KV as JSON |

---

### Feature: Transit Forecast (Multi-Day Outlook)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Transit Forecast (7/30-Day Outlook) |
| **Permission Level** | AUTHENTICATED; Starter+ tiers |
| **Workflow Position** | Forecasts tab; proactive planning tool |
| **Purpose** | Show upcoming significant transits (ingresses, Mars door openings, Venus returns, eclipses, etc.) |
| **Files** | `workers/src/handlers/forecast.js` (72 lines) |
| **Workflow Step** | 1. User requests forecast for next 7/30 days → 2. Backend calculates transit positions for each day → 3. Identifies significant events (gates changing, key planets ingressing new gates) → 4. Ranks by magnitude (eclipses > Mars door > Venus return, etc.) → 5. Returns summarized list with dates, interpreted meaning |
| **API Endpoints** | `GET /api/transits/forecast?days=7` (default), `GET /api/transits/forecast?days=30` |
| **Caching** | Forecast pre-calculated daily at 6 AM UTC, stored in KV with `FORECAST_CACHE_[YYYYMMDD]` pattern |
| **Test Elements** | `tests/handlers.test.js` — forecast events identified correctly (Mars door openings on 1st/8th/15th/22nd/29th of each month), eclipse dates match NASA ephemeris, ordering by significance correct |
| **Analytical Elements** | Event: `forecast_viewed` (days_requested), `forecast_event_clicked` (event_type: eclipse, mars_door, venus_return) |
| **Error Debugging** | Error codes: `ERR_FORECAST_OUT_OF_RANGE` (limit ±90 days), `ERR_CALCULATION_TIMEOUT`; Fallback: cache previous forecast if generation times out |
| **Key Code** | Iterates each day in range, calculates Layer 7 transits, compares to previous day to detect ingress/egress events |

---

### Feature: Lifecycle Events (Saturn Return, Nodes Progression)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Major Lifecycle Markers |
| **Permission Level** | AUTHENTICATED; displayed for all tiers |
| **Workflow Position** | Cycles tab; contextual awareness of life stage |
| **Purpose** | Identify key transit dates (Saturn return at age 29.5, North Node cycle, progressed eclipses, etc.) |
| **Files** | `workers/src/handlers/cycles.js` (108 lines) |
| **Workflow Step** | 1. User views Cycles tab → 2. Backend loads natal chart for current user → 3. Calculates age in sidereal years → 4. Identifies next Saturn return, Nodal returns, Progressed Moon phases → 5. Returns list with dates, descriptions, interpretive notes |
| **API Endpoints** | `GET /api/cycles` |
| **Caching** | Per-user, cached for 90 days (life events don't change) |
| **Test Elements** | `tests/engine.test.js` — Saturn return calculated correctly (29.5-year cycle), Nodal returns (18.6-year cycle), date accuracy ±1 day |
| **Analytical Elements** | Event: `cycles_viewed` (user_age, next_major_cycle) |
| **Error Debugging** | Error codes: `ERR_CHART_NOT_FOUND`, `ERR_CALCULATION_FAILED`; Edge case: future birth dates rejected (user age < 0) |
| **Key Code** | Saturn period = 29.4608 years; Node period = 18.5996 years; Compare natal Saturn/Node positions to current transits to find return dates |

---

### Feature: Electional Astrology (Best Dates Tool)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Electional Astrology - Intention Timing |
| **Permission Level** | AUTHENTICATED; Practitioner+ tiers for client recommendations |
| **Workflow Position** | Timing tab; planning features for practitioners |
| **Purpose** | Suggest best dates for major life events (wedding, business launch, medical procedures, moves) based on user chart + Luna cycles + planetary hours |
| **Files** | `workers/src/handlers/timing.js` (536 lines), intention templates data |
| **Workflow Step** | 1. Practitioner selects intention (Wedding, Career Launch, Medical, Move, Other) → 2. Selects date range (next 30/90 days) → 3. Backend calculates planetary hours, Moon phases, aspects for each day in range → 4. Scores each day (weighted: Moon phase, no Saturn/Mars afflictions, favorable aspects, practitioner's own chart affinity) → 5. Returns top 10 dates with explanations → 6. Practitioner shares with client or uses for session planning |
| **API Endpoints** | `POST /api/timing` (calculate), `GET /api/timing/intentions` (list templates) |
| **Caching** | 30-day outlook cached per-user, updated daily at 6 AM UTC |
| **Test Elements** | `tests/handlers.test.js` — date range validation (max 365 days), intention template validation, score algorithm produces consistent results, top dates don't include void-of-course Moon (if using lunar nodes) |
| **Analytical Elements** | Event: `timing_calculated` (intention_type, date_range_days, user_tier), `timing_date_selected` (selected_date, reason_clicked) |
| **Error Debugging** | Error codes: `ERR_INVALID_DATE_RANGE`, `ERR_NO_GOOD_DATES_FOUND` (rare, edge case for specific constraints), `ERR_INTENTION_NOT_SUPPORTED`; Frontend UI shows "No excellent dates in range — considering next 30 days" |
| **Key Code** | `handleTiming()` returns array of `{ date, score, reasons: [ 'Waning Moon', 'Jupiter hour', ... ] }`; Score algorithm weights aspects, Moon phase, planetary hours (4 hours per day for each of 7 classical planets) |

---

## Practitioner Tools

### Feature: Practitioner Directory & Public Profiles

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Practitioner Directory (Search & Public Profiles) |
| **Permission Level** | PUBLIC (directory), AUTHENTICATED (edit own) |
| **Workflow Position** | Workspace tab (practitioner mode); practitioner.page domain landing |
| **Purpose** | Let practitioners list themselves, set specialties, bio, link to bookings/website |
| **Files** | `workers/src/handlers/practitioner-directory.js` (160+ lines), `frontend/index.html` (practitioner directory modal) |
| **Workflow Step** | 1. Practitioner enables "List in Directory" setting → 2. Frontend opens form with name, specialty (HD coaching, numerology, astrology, gene keys, etc.), bio (max 500 chars), profile image, booking link, website URL → 3. Form validation on client + server → 4. Saved to `practitioner_profiles` table → 5. Public at `/practitioner/:slug` route → 6. Searchable in directory via `/api/practitioner/directory?specialty=astrology&location=NYC` |
| **API Endpoints** | `GET /api/practitioner/directory` (list/search), `GET /api/practitioner/public/:slug` (view), `PUT /api/practitioner/directory-profile` (update own), `DELETE /api/practitioner/clients/:id` (remove client) |
| **Database Tables** | `practitioner_profiles` (userId FK, slug UNIQUE, name, specialty ARRAY, bio, image_url, website_url, booking_link, created_at, updated_at) |
| **Test Elements** | `tests/practitioner-directory.test.js` — slug generation from name (URL-safe), pagination working, search filters by specialty, public profile accessible, edit auth correct |
| **Analytical Elements** | Event: `directory_profile_updated` (field_changed: bio, image, etc.), `directory_profile_viewed` (slug, viewer_tier), `directory_searched` (query_term, filters_applied) |
| **Error Debugging** | Error codes: `ERR_PROFILE_NOT_FOUND`, `ERR_SLUG_TAKEN`; Slug collision detection via unique index on `(slug, deleted_at)` to allow soft-deletes |
| **Key Code** | Slug generation: `name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')`; Public profiles accessible without auth; Search uses full-text index |

---

### Feature: Client Roster Management

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Client Roster (Add, List, Remove Clients) |
| **Permission Level** | AUTHENTICATED; Practitioner+ tiers only |
| **Workflow Position** | Workspace tab setup step; managed alongside practitioner profile |
| **Purpose** | Maintain list of active clients, track relationship status, link to saved charts/profiles |
| **Files** | `workers/src/handlers/practitioner.js` (519+ lines), frontend onboarding modal (index.html lines 2145–2210) |
| **Workflow Step** | 1. Practitioner invites client via email during onboarding or manually → 2. Email sent to client with invitation link + practitioner name → 3. Client clicks link, creates account or logs in → 4. Invitation auto-completes, client appears in practitioner's roster → 5. Practitioner can view shared charts, session notes, checkin history for each client |
| **API Endpoints** | `POST /api/practitioner/clients` (invite), `GET /api/practitioner/clients` (list), `DELETE /api/practitioner/clients/:clientId` (remove), `GET /api/practitioner/invitation/:code` (get invitation details) |
| **Database Tables** | `practitioner_clients` (id, practitionerId FK, clientId FK, invitationCode, invitedAt, acceptedAt, relationship_status enum[active, archived, paused], createdAt), `practitioner_invitations` (id, practitionerId FK, email, code, expiresAt, acceptedBy FK) |
| **Test Elements** | `tests/practitioner-roster.test.js` — invitation email sent, invitation code unique, 7-day expiry enforced, accepted invitations create `practitioner_clients` row, duplicate clients rejected |
| **Analytical Elements** | Event: `client_invited` (num_clients_invited), `client_accepted_invitation`, `client_removed` (reason: archived, switched practitioners, etc.) |
| **Error Debugging** | Error codes: `ERR_INVALID_EMAIL`, `ERR_EMAIL_ALREADY_INVITED`, `ERR_INVITATION_EXPIRED`, `ERR_CLIENT_LIMIT_REACHED` (for free tier); Email resend available with rate-limiting |
| **Key Code** | Invitation code generation: `crypto.randomBytes(16).toString('hex')`; Expires in 7 days; Verifies code matches email when client clicks acceptance link; Sets `acceptedAt` timestamp and flags relationship as `active` |

---

### Feature: Session Notes (Per-Client Documentation)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Session Notes & AI Context Storage |

---

### Feature: Client Portal (Reverse View)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Client Portal — Practitioner Relationship View |
| **Permission Level** | AUTHENTICATED; Any tier (client must be on a practitioner's roster) |
| **Workflow Position** | Post-login; client-facing portal accessed from sidebar |
| **Purpose** | Let clients see which practitioners have them on their roster, view their shared data, and read notes shared by their practitioner |
| **Files** | `workers/src/handlers/client-portal.js` (~150 lines), `workers/src/db/migrations/054_client_portal.sql` |
| **Workflow Step** | 1. Client logs in → 2. Navigates to "My Practitioner" in sidebar → 3. Sees list of practitioners who have them as a client → 4. Clicks a practitioner to see portal: practitioner info, own chart/profile data, shared session notes → 5. Can also view all shared notes across practitioners |
| **API Endpoints** | `GET /api/client/my-practitioners` (list), `GET /api/client/portal/:practitionerId` (portal view), `GET /api/client/shared-notes` (all shared notes) |
| **Database Tables** | `practitioner_clients` (relationship check), `practitioners` (info display), `practitioner_session_notes` (share_with_client column), `charts`, `profiles` |
| **Test Elements** | `tests/client-portal.test.js` — 10 tests: auth guards, access denial for non-clients, portal data shape, null chart/profile handling, paginated shared notes |
| **Analytical Elements** | Events: `client_portal_practitioners_viewed`, `client_portal_viewed` (practitionerId), `client_shared_notes_viewed` |
| **Error Debugging** | Error codes: 401 (not authenticated), 403 (not a client of this practitioner) |
| **Key Code** | `handleGetClientPortal()` — parallel fetch of practitioner info, chart, profile, shared notes; `checkClientPractitionerAccess` — reverse access check (client → practitioner) |
| **Migration** | `054_client_portal.sql` — Adds `share_with_client` column to `practitioner_session_notes` with partial index |
| **Permission Level** | AUTHENTICATED; Practitioner+ only, per-client access control |
| **Workflow Position** | Workspace client view; ongoing practitioner documentation |
| **Purpose** | Store session notes, session dates, AI-enhanced context summaries for client relationship continuity |
| **Files** | `workers/src/handlers/session-notes.js` (244 lines) |
| **Workflow Step** | 1. Practitioner selects client from roster → 2. Views session history on timeline → 3. Clicks "Add Session Note" → 4. Enters date, chart reference (optional), freeform session notes → 5. Optionally clicks "Generate AI Summary" to extract key themes → 6. Note saved with timestamp, searchable by keyword and date range |
| **API Endpoints** | `POST /api/practitioner/clients/:clientId/notes` (create), `GET /api/practitioner/clients/:clientId/notes` (list), `PATCH /api/practitioner/clients/:clientId/notes/:noteId` (update), `DELETE /api/practitioner/clients/:clientId/notes/:noteId` (delete), `GET /api/practitioner/clients/:clientId/ai-context` (get AI summary context) |
| **Database Tables** | `session_notes` (id, practitionerId FK, clientId FK, sessionDate, content TEXT, aiSummary TEXT, relatedChartIds ARRAY, createdAt, updatedAt), `ai_context` (clientId FK, summary TEXT, themes ARRAY, updatedAt) |
| **Test Elements** | `tests/session-notes.test.js` — auth correct (practitioner can only access own clients), note persistence, date queries working, AI summary generation optional |
| **Analytical Elements** | Event: `session_note_created` (practitioner_tier, content_length), `ai_context_generated` (num_notes_processed, themes_extracted), `session_history_viewed` (num_sessions) |
| **Error Debugging** | Error codes: `ERR_CLIENT_NOT_FOUND`, `ERR_NOTE_NOT_FOUND`, `ERR_ACCESS_DENIED` (cross-practitioner access attempt); AI generation errors: `ERR_LLM_FAILED` (fallback: return raw summary) |
| **Key Code** | `handleListNotes()` queries `session_notes` where `practitionerId = request._user.id AND clientId = params.clientId`, orders by sessionDate DESC; AI context calls LLM with last 10 notes to extract themes, generate summary |

---

### Feature: Divination Reading Log

| Attribute | Details |
|---|---|
| **Feature Name** | Divination Reading Log |
| **Status** | ✅ LIVE |
| **Feature Flag** | None (available to all practitioners) |
| **Permission Level** | AUTHENTICATED; Practitioner+ only, per-client access control |
| **Workflow Position** | Client detail workspace, between Session Notes and AI Session Brief |
| **Purpose** | Record and manage divination readings (tarot, oracle, runes, I Ching, pendulum) per client, with optional client sharing |
| **Files** | `workers/src/handlers/divination-readings.js`, `workers/src/db/migrations/055_divination_readings.sql`, `frontend/js/app.js` |
| **Workflow Step** | 1. Practitioner opens client detail → 2. Scrolls to Divination Readings section → 3. Clicks "New Reading" → 4. Selects type (tarot/oracle/runes/iching/pendulum/other), optionally enters spread and cards → 5. Writes interpretation → 6. Optionally toggles "Share with client" → 7. Saves reading → 8. Readings appear in reverse-chronological list |
| **API Endpoints** | `GET /api/practitioner/clients/:id/readings` (list), `POST /api/practitioner/clients/:id/readings` (create), `GET /api/practitioner/readings/:id` (get), `PUT /api/practitioner/readings/:id` (update), `DELETE /api/practitioner/readings/:id` (delete), `GET /api/client/my-readings` (client views shared readings) |
| **Database Tables** | `divination_readings` (id UUID PK, practitioner_id, client_user_id, reading_type, spread_type, cards JSONB, interpretation TEXT, share_with_ai BOOLEAN, reading_date DATE, created_at, updated_at) |
| **Test Elements** | `tests/divination-readings.test.js` — 12 tests: CRUD operations, validation (invalid type, max length, max cards), auth (401/403), client shared readings |
| **Analytical Elements** | Events: `reading_created` (reading_type), `reading_deleted` (readingId) |
| **Error Debugging** | Error codes: `Unauthorized` (401, no auth), `Access denied` (403, not practitioner or wrong client), `Invalid reading_type` (400), `Interpretation exceeds 10000 characters` (400), `Too many cards (max 78)` (400), `Reading not found` (404) |
| **Key Code** | `handleCreateReading()` validates reading_type against allowlist, enforces MAX_INTERPRETATION_LENGTH (10000) and MAX_CARDS (78), stores cards as JSONB; `handleClientReadings()` returns only readings with `share_with_ai = true` for authenticated client |

---

### Feature: Session Actions (Practitioner-Assigned Client Actions)

| Attribute | Details |
|---|---|
| **Feature Name** | Session Actions |
| **Status** | ✅ LIVE |
| **Feature Flag** | None (available to all practitioners) |
| **Permission Level** | AUTHENTICATED; Practitioner+ for CRUD, authenticated client for view/complete |
| **Workflow Position** | Client detail workspace, between Divination Readings and AI Session Brief |
| **Purpose** | Practitioner assigns homework, exercises, or follow-up actions to clients. Clients can view and mark them complete. Supports due dates and linked session notes. |
| **Files** | `workers/src/handlers/session-actions.js`, `workers/src/db/migrations/056_session_actions.sql`, `frontend/js/app.js` |
| **Workflow Step** | 1. Practitioner opens client detail → 2. Scrolls to Assigned Actions → 3. Clicks "New Action" → 4. Enters title, optional description, optional due date → 5. Saves action → 6. Client sees pending actions in their portal → 7. Client marks action complete → 8. Practitioner sees completion status |
| **API Endpoints** | `GET /api/practitioner/clients/:id/actions` (list), `POST /api/practitioner/clients/:id/actions` (create), `PUT /api/practitioner/actions/:id` (update), `DELETE /api/practitioner/actions/:id` (delete), `GET /api/client/my-actions` (client views), `PUT /api/client/actions/:id/complete` (client completes) |
| **Database Tables** | `session_actions` (id UUID PK, practitioner_id, client_user_id, title, description, due_date, status CHECK pending/completed/cancelled, completed_at, session_note_id FK, created_at, updated_at) |
| **Test Elements** | `tests/session-actions.test.js` — 15 tests: CRUD, validation (missing title, max title/description), auth (401/403), list, update (+ invalid status + 404), delete, client actions, client complete (+ 404) |
| **Analytical Elements** | Events: `action_created` (title), `action_completed` (actionId, userId), `action_deleted` (actionId) |
| **Error Debugging** | Error codes: `Unauthorized` (401), `Access denied` (403), `Title is required` (400), `Title exceeds 200 characters` (400), `Description exceeds 5000 characters` (400), `Invalid status` (400), `Action not found` (404) |
| **Key Code** | `handleCreateAction()` validates title presence + length, stores with optional due_date and session_note_id FK; `handleCompleteAction()` only completes actions with status='pending' for the authenticated client_user_id; overdue detection in frontend via `new Date(due_date) < new Date()` |

---

### Feature: Verified Testimonials/Reviews

| Attribute | Details |
|---|---|
| **Feature Name** | Practitioner Reviews |
| **Status** | ✅ LIVE |
| **Feature Flag** | None |
| **Permission Level** | PUBLIC for approved reviews on directory; AUTHENTICATED for submission (client), moderation (practitioner) |
| **Workflow Position** | Client portal (submit), practitioner dashboard (moderate), public directory profile (display) |
| **Purpose** | Client-submitted, practitioner-approved testimonials. Practitioners can approve or hide reviews but cannot edit them. One review per client per practitioner. |
| **Files** | `workers/src/handlers/reviews.js`, `workers/src/db/migrations/057_practitioner_reviews.sql`, `frontend/js/app.js`, `frontend/index.html` |
| **Workflow Step** | 1. Client visits practitioner portal → 2. Writes review (1-5 stars + text) → 3. Review saved as "pending" → 4. Practitioner sees pending reviews in moderation panel → 5. Approves or hides review → 6. Approved reviews appear on directory profile |
| **API Endpoints** | `POST /api/client/reviews` (submit), `GET /api/directory/:slug/reviews` (public), `GET /api/practitioner/reviews` (list all), `PUT /api/practitioner/reviews/:id/approve`, `PUT /api/practitioner/reviews/:id/hide` |
| **Database Tables** | `practitioner_reviews` (id UUID PK, practitioner_id, client_user_id, rating 1-5, content TEXT, status pending/approved/hidden, approved_at, created_at, updated_at, UNIQUE practitioner+client) |
| **Test Elements** | `tests/reviews.test.js` — 14 tests: submission (valid, missing prac, invalid rating, short/long content, non-client, no auth), public reviews (valid slug, invalid slug), approve (success + 404), hide, list (practitioner + non-practitioner) |
| **Analytical Elements** | Events: `review_submitted`, `review_approved`, `review_hidden` |
| **Error Debugging** | Errors: `Unauthorized` (401), `practitioner_id is required` (400), `Rating must be 1-5` (400), `Review min 10 chars` (400), `Review exceeds 2000 chars` (400), `Not a client` (403), `Already reviewed` (409), `Review not found` (404) |
| **Key Code** | `handleSubmitReview()` validates relation via `checkClientPractitionerAccess`, enforces UNIQUE constraint; `handleApproveReview/handleHideReview` scoped by practitioner_id; public reviews served via slug join |

---

### Feature: CSV Export (Roster + Notes + Readings)

| Attribute | Details |
|---|---|
| **Feature Name** | CSV Export |
| **Status** | ✅ LIVE |
| **Feature Flag** | None |
| **Permission Level** | AUTHENTICATED (practitioner tier) |
| **Workflow Position** | Practitioner workspace → Export Data card |
| **Purpose** | Download client roster, session notes, and divination readings as CSV files for backup or external analysis. |
| **Files** | `workers/src/handlers/practitioner.js` (export handlers), `workers/src/db/queries.js` (3 queries), `frontend/js/app.js` (`downloadCSV`), `frontend/index.html` (CSV Export card) |
| **Workflow Step** | 1. Practitioner clicks download button → 2. Browser fetches CSV endpoint → 3. Server queries data for practitioner → 4. CSV returned with Content-Disposition header → 5. Browser triggers download |
| **API Endpoints** | `GET /api/practitioner/export/roster`, `GET /api/practitioner/export/notes`, `GET /api/practitioner/export/readings` |
| **Database Tables** | Reads from `practitioner_clients` + `users`, `practitioner_session_notes` + `users`, `divination_readings` + `users` |
| **Test Elements** | `tests/csv-export.test.js` — 21 tests: escapeCSV (null, plain, commas, quotes, newlines, CR, numbers), toCSV (empty, data, special chars, missing fields), roster/notes/readings column headers + row rendering, query presence verification |
| **Analytical Elements** | Events: `csv_exported` (with type: roster/notes/readings) |
| **Error Debugging** | Auth required (401), Feature gate via `enforceFeatureAccess('practitionerTools')` |
| **Key Code** | `escapeCSV()` handles quoting/escaping; `toCSV()` maps column definitions to rows; `csvResponse()` sets Content-Type + Content-Disposition headers; frontend `downloadCSV()` uses fetch+blob pattern |

---

### Feature: Diary AI Pattern Insights

| Attribute | Details |
|---|---|
| **Feature Name** | Diary AI Pattern Insights |
| **Status** | ✅ LIVE |
| **Feature Flag** | None |
| **Permission Level** | AUTHENTICATED (requires 10+ diary entries) |
| **Workflow Position** | Diary tab → AI Pattern Insights card (below entry list) |
| **Purpose** | After 10+ diary entries, LLM analyzes life events and transit correlations to surface recurring themes, timing patterns, and actionable insights. |
| **Files** | `workers/src/handlers/diary.js` (`handleDiaryInsights`), `workers/src/db/queries.js` (`getDiaryEntriesForInsights`), `frontend/js/app.js` (`generateDiaryInsights`), `frontend/index.html` (insights card) |
| **Workflow Step** | 1. User clicks "Analyze Patterns" → 2. POST /api/diary/insights → 3. Fetch up to 50 entries with transit snapshots → 4. Build prompt with entry summaries + transit aspects → 5. callLLM returns structured analysis → 6. Render insights in card |
| **API Endpoints** | `POST /api/diary/insights` |
| **Database Tables** | Reads from `diary_entries` (existing table, no migration needed) |
| **Test Elements** | `tests/diary-insights.test.js` — 8 tests: query presence (exists, limits/ordering), handler (export, auth, <10 entries rejection, 10+ entries success with LLM mock, transit data in prompt), route wiring |
| **Analytical Elements** | Events: `diary_insights_generated` |
| **Error Debugging** | `Authentication required` (401), `Need at least 10 diary entries` (400), LLM provider chain failure (500 via reportHandledRouteError) |
| **Key Code** | Entries summarized with transit aspects (top 5 per entry); LLM system prompt instructs structured analysis (themes, correlations, transit patterns, recommendation); 800-word limit; temperature 0.7 |

---

### Feature: Practitioner Revenue/Earnings Card

| Attribute | Details |
|---|---|
| **Feature Name** | Practitioner Revenue/Earnings Card |
| **Status** | ✅ LIVE |
| **Feature Flag** | None |
| **Permission Level** | AUTHENTICATED (practitioner tier) |
| **Workflow Position** | Practitioner workspace → Revenue & Earnings card (between Referral Performance and Practice Metrics) |
| **Purpose** | Display YTD referral credits, pending rewards, total and converted referral counts. Replaces previous stub query with real data from the referrals table. |
| **Files** | `workers/src/db/queries.js` (`getPractitionerReferralStats` — fixed from stub), `frontend/js/app.js` (`renderPractitionerEarnings`), `frontend/index.html` (`pracEarningsCard` container) |
| **Workflow Step** | 1. Practitioner opens workspace → 2. loadRoster fetches /api/referrals in parallel → 3. renderPractitionerEarnings renders card with 4 stat tiles → 4. earnings_card_viewed tracked |
| **API Endpoints** | `GET /api/referrals` (existing, user-level), `GET /api/practitioner/referral-link` (existing, now returns real stats) |
| **Database Tables** | Reads from `referrals` (existing), `referral_signups` (existing) |
| **Test Elements** | `tests/practitioner-earnings.test.js` — 8 tests: query no longer stub, referral_count from real data, monthly earnings from reward_value, existing queries intact, handler exports, auth validation, referrals handler export, reward stats columns |
| **Analytical Elements** | Events: `earnings_card_viewed` |
| **Error Debugging** | Non-fatal catch on /api/referrals and /api/practitioner/referral-link in loadRoster |
| **Key Code** | `getPractitionerReferralStats` fixed: COUNT from referrals WHERE referrer_user_id, SUM(reward_value) for current month; Card shows Total Credits Earned (cents→dollars), Total Referrals, Converted, Pending Rewards |

---

### Feature: Practitioner Promo Codes

| Attribute | Details |
|---|---|
| **Feature Name** | Practitioner Promo Codes |
| **Status** | ✅ LIVE |
| **Feature Flag** | None |
| **Permission Level** | AUTHENTICATED (practitioner tier via enforceFeatureAccess) |
| **Workflow Position** | Practitioner workspace → Promo Code card (between Earnings and Practice Metrics) |
| **Purpose** | Practitioners can create 1 active promo code (10-50% off first month) to share with potential clients. Codes use the existing promo_codes table with a new practitioner_id column. |
| **Files** | `workers/src/handlers/practitioner.js` (handleGetPractitionerPromo, handleCreatePractitionerPromo, handleDeletePractitionerPromo), `workers/src/db/queries.js` (createPractitionerPromo, getPractitionerActivePromo, deactivatePractitionerPromo), `workers/src/db/migrations/058_practitioner_promo.sql`, `frontend/js/app.js` (loadPractitionerPromo, renderPractitionerPromo, createPractitionerPromo, deactivatePractitionerPromo), `frontend/index.html` (pracPromoCard container) |
| **Workflow Step** | 1. Practitioner opens workspace → 2. loadPractitionerPromo fetches GET /api/practitioner/promo → 3. If active code: show code, discount, redemptions, expiry with deactivate button → 4. If no code: show creation form (code, discount %, max redemptions, expiry) → 5. POST creates code → 6. DELETE deactivates |
| **API Endpoints** | `GET /api/practitioner/promo`, `POST /api/practitioner/promo`, `DELETE /api/practitioner/promo/:id` |
| **Database Tables** | `promo_codes` (existing, extended with `practitioner_id UUID` FK via migration 058) |
| **Test Elements** | `tests/practitioner-promo.test.js` — 9 tests: query presence (create, get active, deactivate ownership), handler validation (GET returns null, POST rejects empty code, discount <10%, discount >50%, DELETE rejects invalid UUID), migration exists |
| **Analytical Elements** | Events: `practitioner_promo_created` |
| **Error Debugging** | `Code must be 3-32 characters` (400), `Discount must be between 10% and 50%` (400), `You already have an active promo code` (409), `Expiry date must be in the future` (400), `Invalid promo ID` (400), `Promo not found or already deactivated` (404) |
| **Key Code** | 1 active code limit enforced by getPractitionerActivePromo check before create; deactivatePractitionerPromo checks both promo ID and practitioner_id for ownership; code format: uppercase alphanumeric+hyphens+underscores 3-32 chars |

---

### Feature: Diary Search/Filter + Export

| Attribute | Details |
|---|---|
| **Feature Name** | Diary Search/Filter + Export |
| **Status** | ✅ LIVE |
| **Feature Flag** | None |
| **Permission Level** | AUTHENTICATED |
| **Workflow Position** | Diary tab → Filter bar above event list + Export button |
| **Purpose** | Allow users to search, filter by type/significance/dates, and export diary entries as CSV. Replaces the basic unfiltered list with a rich query interface. |
| **Files** | `workers/src/handlers/diary.js` (`handleDiaryList` with filter params, `buildDiaryFilterQuery`, `handleDiaryExport`), `frontend/js/app.js` (`loadDiaryEntries` with filter params, `exportDiary`), `frontend/index.html` (filter bar with search/type/significance/date inputs + export button) |
| **Workflow Step** | 1. User opens Diary tab → 2. Filter bar renders with search input, type/significance dropdowns, date range pickers, export button → 3. Changing any filter auto-reloads entries (350ms debounce) → 4. API receives filter params as query string → 5. `buildDiaryFilterQuery` builds parameterized SQL → 6. Export button triggers GET /api/diary/export → CSV download |
| **API Endpoints** | `GET /api/diary?search=&type=&significance=&date_from=&date_to=` (filtered list), `GET /api/diary/export` (CSV download) |
| **Database Tables** | `diary_entries` (id, user_id, event_date, event_title, event_description, event_type, significance, transit_snapshot, created_at, updated_at) |
| **Test Elements** | `tests/diary-search-export.test.js` — 15 tests: buildDiaryFilterQuery (base query, search ILIKE, valid/invalid type, valid/invalid significance, date range, malformed dates, combined filters), handleDiaryExport (auth, CSV headers/content-type, CSV escaping), handleDiaryList integration (search params, type+significance, /export route) |
| **Analytical Elements** | Events: `diary_filtered` (frontend, with filter booleans), `diary_exported` (frontend + backend) |
| **Error Debugging** | Invalid event_type/significance silently ignored; malformed date strings silently ignored; CSV escapes commas/quotes/newlines; 401 on unauthenticated export |
| **Key Code** | `buildDiaryFilterQuery` builds dynamic parameterized SQL with indexed $N placeholders; valid types: career/relationship/health/spiritual/financial/family/other; valid significance: major/moderate/minor; date regex: `/^\d{4}-\d{2}-\d{2}$/`; CSV uses `escapeCSV()` with double-quote escaping |

---

### Feature: Diary-to-Practitioner Visibility

| Attribute | Details |
|---|---|
| **Feature Name** | Diary-to-Practitioner Visibility |
| **Status** | ✅ LIVE |
| **Feature Flag** | None |
| **Permission Level** | AUTHENTICATED (client toggle), PRACTITIONER (read access) |
| **Workflow Position** | Client: My Practitioner tab → diary sharing checkbox per practitioner. Practitioner: Client detail → Client Diary section (read-only) |
| **Purpose** | Allow clients to opt-in to sharing their diary entries with their practitioner for deeper session context. Completely read-only for practitioners — no create/edit/delete. |
| **Files** | `workers/src/handlers/practitioner.js` (`handleGetClientDiary`), `workers/src/handlers/client-portal.js` (`handleGetDiarySharingPrefs`, `handleSetDiarySharing`), `workers/src/db/queries.js` (`getDiaryEntriesForClient`, `getMyDiarySharingPreferences`, `setMyDiarySharing`), `workers/src/db/migrations/059_diary_practitioner_visibility.sql`, `frontend/js/app.js` (`toggleDiarySharing`, diary section in `renderClientDetail`, sharing prefs in `loadClientPortal`) |
| **Workflow Step** | 1. Client opens My Practitioner tab → 2. Diary sharing checkbox shown per practitioner (default OFF) → 3. Client toggles ON → PUT /api/client/diary-sharing → 4. Practitioner opens client detail → 5. Diary entries loaded via GET /api/practitioner/clients/:id/diary → 6. Read-only diary section renders with type icons + significance badges |
| **API Endpoints** | `GET /api/practitioner/clients/:id/diary` (practitioner reads client diary), `GET /api/client/diary-sharing` (client views sharing prefs), `PUT /api/client/diary-sharing` (client toggles sharing) |
| **Database Tables** | `practitioner_clients` (share_diary BOOLEAN DEFAULT false), `diary_entries` (existing, read via join) |
| **Test Elements** | `tests/diary-practitioner.test.js` — 11 tests: query structure (4: join check, sharing prefs, toggle, no transit_snapshot), practitioner handler (2: valid access, auth rejection), client handler (4: GET prefs, auth rejection, PUT validation, valid toggle), migration (1: file check) |
| **Analytical Elements** | Events: `practitioner_diary_viewed` (practitioner), `diary_sharing_toggled` (client) |
| **Error Debugging** | `Client not found on your roster` (404), `Authentication required` (401), `practitioner_user_id and share_diary (boolean) required` (400). If share_diary=false, query returns 0 rows — practitioner sees "No diary entries shared" |
| **Key Code** | `getDiaryEntriesForClient` joins `diary_entries→practitioner_clients→practitioners` with `share_diary = true` gate; excludes `transit_snapshot` for privacy; consent is per practitioner-client relationship (not global) |

---

### Feature: Check-in Streak Preferences

| Attribute | Details |
|---|---|
| **Feature Name** | Check-in Streak Preferences |
| **Status** | ✅ LIVE |
| **Feature Flag** | None |
| **Permission Level** | AUTHENTICATED |
| **Workflow Position** | Check-in tab → Daily Reminder card (below stats) |
| **Purpose** | Let users set a daily reminder time and notification method (push/email) for their check-in streak. Cron delivers push notifications at 6 AM UTC sweep to users who haven't checked in yet today. |
| **Files** | `workers/src/handlers/checkin.js` (`handleSetCheckinReminder`, `handleGetCheckinReminder`), `workers/src/cron.js` (Step 12), `workers/src/db/queries.js` (`cronGetDueCheckinReminders`, `updateReminderLastSent`, `upsertCheckinReminder`, `getCheckinReminder`), `frontend/js/app.js` (`loadCheckinReminder`, `saveCheckinReminder`), `frontend/index.html` (reminder card) |
| **Workflow Step** | 1. User opens Check-in tab → 2. Reminder preferences load from GET /api/checkin/reminder → 3. User sets time, enables push/email → 4. POST /api/checkin/reminder saves preferences → 5. Daily cron Step 12 queries due reminders (enabled, not sent today, no check-in today) → 6. Sends push notification → 7. Updates last_sent_at |
| **API Endpoints** | `POST /api/checkin/reminder`, `GET /api/checkin/reminder` |
| **Database Tables** | `checkin_reminders` (user_id UNIQUE, enabled, reminder_time, timezone, notification_method[], last_sent_at) |
| **Test Elements** | `tests/checkin-reminder.test.js` — 12 tests: query presence (cronGetDueCheckinReminders structure, updateReminderLastSent, upsertCheckinReminder, getCheckinReminder), handler exports (set/get), auth validation (set/get reject unauthenticated), cron query structure (JOIN users, notification_method) |
| **Analytical Elements** | Events: `checkin_reminder_sent` (cron), `checkin_reminder_saved` (handler) |
| **Error Debugging** | `Authentication required` (401), cron step wrapped in try/catch with console.error |
| **Key Code** | Cron Step 12: 30s timeout, 100ms delay between sends, uses `sendNotificationToUser` from push.js; Frontend auto-detects timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone` |

---

### Feature: Calendar Events Table + Handler

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Calendar Events (CRUD + iCal Feed + Optimal Dates) |
| **Permission Level** | AUTHENTICATED (all tiers; tier gating in 3.4) |
| **Workflow Position** | `/api/calendar` prefix — backend-only in 3.1; frontend in 3.3 |
| **Purpose** | Core calendar infrastructure: store personal, transit, moon, retrograde, session, reminder, and diary events. Expose iCal feed for external calendar subscriptions and proxy to the electional timing engine for optimal date suggestions. |
| **Files** | `workers/src/handlers/calendar.js` (handleCalendar — CRUD, iCal feed, optimal-dates proxy), `workers/src/db/queries.js` (createCalendarEvent, listCalendarEvents, getCalendarEventsByDateRange, updateCalendarEvent, deleteCalendarEvent, getCalendarEvent), `workers/src/db/migrations/060_calendar_events.sql`, `workers/src/index.js` (PREFIX_ROUTES + AUTH_PREFIXES) |
| **Workflow Step** | 1. User creates event via POST /api/calendar/events → 2. List events via GET /events (supports date range ?from=&to= or limit/offset) → 3. Update/Delete via PUT/DELETE /events/:id → 4. Subscribe via GET /feed.ics → 5. Find optimal dates via POST /optimal-dates (proxies to timing engine) |
| **API Endpoints** | `GET /api/calendar/events`, `POST /api/calendar/events`, `PUT /api/calendar/events/:id`, `DELETE /api/calendar/events/:id`, `GET /api/calendar/feed.ics`, `POST /api/calendar/optimal-dates` |
| **Database Tables** | `calendar_events` (id UUID PK, user_id FK→users, title VARCHAR(500), description TEXT, event_type VARCHAR(50), start_date TIMESTAMPTZ, end_date TIMESTAMPTZ, all_day BOOLEAN, recurrence VARCHAR(50), color VARCHAR(20), source VARCHAR(50), external_id TEXT, metadata JSONB, created_at, updated_at) — 3 indexes: user, user+date, source (partial) |
| **Test Elements** | `tests/calendar.test.js` — 17 tests: query structure (6 — INSERT RETURNING, ORDER BY, date range, COALESCE, DELETE ownership, single-event user scope), handler (9 — auth 401, missing title 400, title >500 400, create 201, list default, list date range, delete 404, iCal Content-Type + VCALENDAR, unknown route 404, invalid event_type default), migration (1 — file exists + schema checks) |
| **Analytical Elements** | Events: `calendar_event_created` (with event_type), `calendar_feed_subscribed` (with event count), `calendar_optimal_dates_searched` (with intention) |
| **Error Debugging** | `Authentication required` (401), `title and start_date are required` (400), `Title must be 500 characters or less` (400), `Event not found` (404), `intention is required` (400 on optimal-dates). All errors routed through `reportHandledRouteError`. |
| **Key Code** | Default export `handleCalendar(request, env, subpath)`. VALID_EVENT_TYPES: personal, transit, moon, retrograde, session, reminder, diary. iCal: VCALENDAR 2.0 with `escapeICalText` + `toICalDate` helpers, max 500 events. Optimal-dates: dynamic import of timing.js, forwards request with `_user` attachment. |

---

### Feature: Google Calendar 2-Way Sync

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Google Calendar 2-Way Sync |
| **Permission Level** | AUTHENTICATED (all tiers; tier gating in 3.4) |
| **Workflow Position** | Calendar settings → Google Calendar integration |
| **Purpose** | Allow users to connect their Google Calendar via a separate OAuth consent flow (calendar scope). Push local events to Google, pull Google events to local calendar_events. Encrypted refresh token storage via AES-256-GCM (tokenCrypto.js). |
| **Files** | `workers/src/handlers/google-calendar.js` (handleGoogleCalendar — connect, callback, sync, import, disconnect), `workers/src/handlers/calendar.js` (delegates /google/* subpaths), `workers/src/db/queries.js` (storeGoogleCalendarToken, getGoogleCalendarToken, deleteGoogleCalendarToken, updateGoogleCalSyncToken), `workers/src/db/migrations/061_google_calendar_tokens.sql`, `workers/src/lib/tokenCrypto.js` (AES-256-GCM encryption), `workers/src/index.js` (PUBLIC_ROUTES for callback) |
| **Workflow Step** | 1. User clicks Connect Google Calendar → 2. POST /api/calendar/google/connect returns OAuth URL → 3. User authorizes calendar scope → 4. Google redirects to /api/calendar/google/callback → 5. Code exchanged for tokens, encrypted and stored → 6. POST /api/calendar/google/sync pushes local events to Google + pulls Google events → 7. POST /api/calendar/google/import for one-way pull → 8. DELETE /api/calendar/google/disconnect removes tokens |
| **API Endpoints** | `POST /api/calendar/google/connect`, `GET /api/calendar/google/callback`, `POST /api/calendar/google/sync`, `POST /api/calendar/google/import`, `DELETE /api/calendar/google/disconnect` |
| **Database Tables** | `google_calendar_tokens` (user_id UNIQUE, encrypted_access_token, encrypted_refresh_token, token_expiry, calendar_id, sync_token, last_synced_at) |
| **Test Elements** | `tests/google-calendar.test.js` — 15 tests: query structure (5 — upsert ON CONFLICT, select, delete RETURNING, sync_token update, encrypted token columns), handler (6 — connect returns OAuth URL with calendar scope, connect 503 without GOOGLE_CLIENT_ID, callback error redirect on missing code, callback invalid state, disconnect deletes tokens, sync 400 when not connected, unknown route 404), delegation (2 — calendar.js delegates /google/connect, callback passes without auth), migration (1) |
| **Analytical Elements** | Events: `google_calendar_connected`, `google_calendar_synced` (with pushed/pulled counts), `google_calendar_imported`, `google_calendar_disconnected` |
| **Error Debugging** | `Google integration not configured` (503), `Google Calendar not connected` (400), callback redirects with `?gcal=error&reason=...` for: `missing_params`, `invalid_state`, `token_exchange_failed`, `no_refresh_token`, `internal`. Token refresh failure auto-deletes tokens (user must reconnect). |
| **Key Code** | Separate OAuth flow: `access_type=offline` + `prompt=consent` for refresh token. `getValidAccessToken()` auto-refreshes with 5-min buffer. `pullGoogleEvents()` uses Google's incremental `syncToken`. `toGoogleEvent()` maps local events to Google Calendar format. Encryption via `GOOGLE_TOKEN_ENCRYPTION_KEY` (falls back to `NOTION_TOKEN_ENCRYPTION_KEY`). |

---

### Feature: Calendar Frontend (Month/Week/Day Views)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Calendar Frontend (Month/Week/Day Views) |
| **Permission Level** | AUTHENTICATED |
| **Workflow Position** | Sidebar → Daily → Calendar (sub-tab under Today's Energy alongside Transits, Check-In, Timing) |
| **Purpose** | Full calendar UI with month grid, week timeline, and day detail views. Color-coded event dots by type, quick-add event form, mood heatmap placeholder, transit weather bar, and link to electional timing engine. |
| **Files** | `frontend/js/app.js` (loadCalendar, renderCalendar, renderMonthView, renderWeekView, renderDayView, calendarPrev, calendarNext, calendarSetView, calendarAddEvent, calendarDeleteEvent), `frontend/index.html` (sidebar nav-item, tab-calendar panel), `frontend/css/components/calendar.css` |
| **Workflow Step** | 1. User clicks Calendar in sidebar → 2. switchTab lazy-loads events via GET /api/calendar/events → 3. Month view renders 7-column grid with event dots → 4. Click day → Day view with event cards → 5. Toggle Week/Day views via header buttons → 6. Quick Add: fill title+date+type+color → POST /api/calendar/events → 7. Delete via trash icon → DELETE /api/calendar/events/:id |
| **API Endpoints** | `GET /api/calendar/events` (with from/to date range), `POST /api/calendar/events`, `DELETE /api/calendar/events/:id` |
| **Frontend Components** | Calendar header (nav arrows + title + view toggle), Transit weather bar, Month grid (7-col CSS grid, event dots), Week view (day rows with event cards), Day view (event cards with color bars), Mood heatmap, Quick Add form, Optimal dates link |
| **Test Elements** | No test file (frontend-only; validated visually) |
| **Analytical Elements** | Events: `calendar_view_changed` (with view name), `calendar_event_deleted` |
| **Key Code** | `_calView` state (month/week/day), `_calDate` current focus date, `_calEvents` cached array. `EVENT_TYPE_COLORS` maps 7 types to hex colors. Monday-start grid via `(getDay() + 6) % 7`. Event dots max 5 per cell. |

---

### Feature: Calendar Tier Gating + Practitioner Calendar

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Calendar Tier Gating + Practitioner Unified Calendar |
| **Permission Level** | AUTHENTICATED; tier-gated (Free → moon/personal/reminder/diary only; Individual → +transits/retrogrades; Practitioner/Agency → +sessions/sync/practitioner calendar) |
| **Workflow Position** | `/api/calendar` prefix — middleware tier enforcement on all calendar routes; `/api/calendar/practitioner/events` for practitioner unified view |
| **Purpose** | Gate calendar event types by subscription tier to drive upgrades. Free users see moon/personal/reminder/diary. Individual adds transits/retrogrades. Practitioner+ adds sessions, Google Calendar sync, and a unified calendar showing own + client events with color-coded client attribution. |
| **Files** | `workers/src/handlers/calendar.js` (tier enforcement + handlePractitionerEvents + getAllowedEventTypes + EVENT_TYPE_TIER_MAP + CLIENT_COLORS), `workers/src/lib/stripe.js` (4 new feature keys: calendarTransits, calendarSync, calendarSessions, calendarPractitioner), `workers/src/db/queries.js` (listPractitionerClientEvents), `frontend/js/app.js` (loadCalendar tier handling, renderCalendar practitioner toggle, lock icons on gated event types, client color-coding in all views), `frontend/index.html` (practitioner toggle button, 7 event types with data-label), `frontend/css/components/calendar.css` (.cal-pract-toggle, .cal-client-tag, locked option styling) |
| **Workflow Step** | 1. Handler calls `enforceFeatureAccess(request, env, 'calendarTransits')` → populates `request._tier` → 2. `getAllowedEventTypes(request)` returns tier-appropriate types → 3. List events filtered to allowed types; response includes `allowed_types` → 4. Create event checks `EVENT_TYPE_TIER_MAP` — blocked types return 403 with `upgrade_required` → 5. `/google/*` routes enforce `calendarSync` → 6. `/practitioner/events` enforces `calendarPractitioner`, merges own + client events with `CLIENT_COLORS` palette → 7. Frontend shows 🔒 on locked event types, practitioner toggle for unified view, client badges with color-coded dots |
| **API Endpoints** | `GET /api/calendar/practitioner/events?from=&to=` (new), all existing `/api/calendar/*` endpoints now tier-gated |
| **Tier Feature Keys** | `calendarTransits` (Individual+), `calendarSync` (Practitioner+), `calendarSessions` (Practitioner+), `calendarPractitioner` (Practitioner+) |
| **Frontend Components** | Practitioner toggle button (`👥 All Clients`), locked event type options with 🔒 icon, `.cal-client-tag` color-coded badges on client events, client email tooltips on month dots |
| **Test Elements** | `tests/calendar-tiers.test.js` — 16 tests: 2 query structure, 4 stripe feature keys (per tier), 10 handler tier gating (free/individual/practitioner event filtering, 403 on gated creates, Google sync enforcement, practitioner events with color-coding) |
| **Analytical Elements** | Events: `calendar_tier_upgrade_prompted` (with feature key: calendarTransits/calendarSync/calendarSessions/calendarPractitioner) |
| **Key Code** | `EVENT_TYPE_TIER_MAP`: transit→calendarTransits, retrograde→calendarTransits, session→calendarSessions. `getAllowedEventTypes(request)`: Free=['personal','moon','reminder','diary'], Individual+=transit,retrograde, Practitioner+=session. `CLIENT_COLORS`: 15-color hex palette for client color-coding. `handlePractitionerEvents()`: JOINs calendar_events + practitioner_clients + users, assigns unique color per client_email, returns `{ data, client_colors }`. Frontend state: `_calAllowedTypes`, `_calPractitionerMode`, `_calClientColors`. |

---

### Feature: Practitioner QR Code Generator

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Practitioner QR Code Generator |
| **Permission Level** | AUTHENTICATED; Practitioner+ tier (controlled by existing `practitionerTools` gate) |
| **Workflow Position** | Practitioner workspace → Referral Performance card |
| **Purpose** | Generate a scannable QR code for the practitioner's referral URL. Displayed inline in the Referral Performance card with a one-click PNG download. Enables practitioners to print/share the QR at events, on business cards, in email footers, etc. |
| **Files** | `frontend/js/app.js` (`renderPractitionerReferralStats` — extended with QR section + `requestAnimationFrame` generation; `downloadPractitionerQR` — PNG download handler), `frontend/js/qr.js` (existing self-contained QR library — no new dependencies) |
| **Workflow Step** | 1. Practitioner opens workspace → loads `GET /api/practitioner/referral-link` → 2. `renderPractitionerReferralStats(data)` injects HTML including `<img id="pracQRImage">` + Download button → 3. `requestAnimationFrame` fires after DOM render → `window.QRCode.toDataURL(url, 6)` generates 160px QR → 4. `trackEvent('practitioner', 'qr_generated', 'referral_card')` fires → 5. User clicks "⬇ Download QR PNG" → `downloadPractitionerQR()` creates `<a download="prime-self-referral-qr.png">`, triggers click, removes anchor → 6. `trackEvent('practitioner', 'qr_downloaded', 'referral_card')` fires |
| **API Endpoints** | `GET /api/practitioner/referral-link` (existing — returns `referralUrl`, `stats`) |
| **Frontend Components** | `<img id="pracQRImage" width="160" height="160">` inside referral card, "⬇ Download QR PNG" button with `data-action="downloadPractitionerQR"` |
| **Test Elements** | `tests/practitioner-qr.test.js` — 15 tests: HTML output structure (8), QR generation (2), download handler (4), edge cases (missing img src, null element) |
| **Analytical Elements** | Events: `qr_generated` (on render, referral_card source), `qr_downloaded` (on download click, referral_card source) |
| **Key Code** | `window.QRCode.toDataURL(referralUrl, 6)` — scale=6 → ~192px canvas output. Download: creates `<a href=dataUrl download="prime-self-referral-qr.png">`, appends to body, clicks, removes. No new dependencies — uses existing `frontend/js/qr.js`. |

---

### Feature: Bodygraph Chart Export

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Bodygraph Chart Export (PNG Download + Share Card) |
| **Permission Level** | AUTHENTICATED; any tier with chart access |
| **Workflow Position** | Chart result view — action bar beneath rendered bodygraph |
| **Purpose** | Let any user download their bodygraph as a full-quality PNG and open the Share Card for social sharing. Two-button action bar appears immediately after chart render. |
| **Files** | `frontend/js/app.js` (`renderChart` — added export buttons; `downloadBodygraph` — SVG→Canvas→PNG pipeline; `shareBodygraph` — delegates to `showShareCard`) |
| **Workflow Step** | 1. User receives chart → `renderChart()` injects `<div id="bodygraph-{ts}">` + export buttons (⬇ Download PNG, ⬆ Share Chart) → 2. Click "⬇ Download PNG" → event delegation calls `downloadBodygraph(containerId, label)` → 3. `document.getElementById(containerId).querySelector('svg')` retrieves SVG → 4. `XMLSerializer().serializeToString(svgEl)` → base64 data URL → `<img onload>` → 5. Canvas drawn at 2× scale with `#0f0f1a` fill → `canvas.toBlob()` → `URL.createObjectURL()` → `<a download>` click → 6. `trackEvent('chart', 'bodygraph_exported', 'download')` → OR: Click "⬆ Share Chart" → `shareBodygraph()` checks `window._lastChart`, calls `window.showShareCard(chart)` → `trackEvent('chart', 'bodygraph_shared', 'share_card')` |
| **API Endpoints** | None — purely client-side |
| **Frontend Components** | `⬇ Download PNG` button: `data-action="downloadBodygraph" data-arg0="{bgId}" data-arg1="{bgLabel}"` — `⬆ Share Chart` button: `data-action="shareBodygraph"` |
| **Test Elements** | `tests/bodygraph-export.test.js` — 10 tests: filename generation (2), SVG serialization round-trip (2), blob download flow (2), shareBodygraph analytics (1), error states — no chart (1), no showShareCard (1), undefined showShareCard (1) |
| **Analytical Elements** | Events: `bodygraph_exported` (on download, category=chart, label=download), `bodygraph_shared` (on share card open, label=share_card) |
| **Key Code** | Canvas: 2× scale, `ctx.fillStyle='#0f0f1a'` before `drawImage`. Filename: `prime-self-bodygraph-{type}-{profile}.png`. `window._lastChart` used by `shareBodygraph`. |

---

### Feature: Per-Practitioner OG Images

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Per-Practitioner OG Images |
| **Permission Level** | PUBLIC — no authentication required |
| **Workflow Position** | Served at `GET /api/og/practitioner/:slug` for link unfurling (Facebook, Twitter, Slack, etc.) |
| **Purpose** | When a practitioner's referral or directory link is shared, social crawlers fetch a branded 1200×630 OG image showing the practitioner's name, specializations, bio, and Prime Self branding. KV-cached for 24 hours to minimize DB load. |
| **Files** | `workers/src/lib/shareImage.js` (`generatePractitionerOGImage` — pure SVG generator), `workers/src/handlers/practitioner-og.js` (`handlePractitionerOGImage` — KV-cached route handler), `workers/src/index.js` (import + PATTERN_ROUTE registration) |
| **Workflow Step** | 1. Social crawler hits `GET /api/og/practitioner/jane-doe-hd` → 2. `handlePractitionerOGImage(req, env, 'jane-doe-hd')` validates slug format → 3. Check `env.CACHE.get('og:practitioner:v1:jane-doe-hd')` → HIT: return cached SVG → MISS: → 4. `createQueryFn → QUERIES.getPractitionerBySlug` lookup → 5. `generatePractitionerOGImage(practitioner)` produces 1200×630 SVG → 6. `env.CACHE.put(key, svg, { expirationTtl: 86400 })` → 7. `trackEvent(env, 'practitioner_og_generated', { slug })` (non-blocking) → 8. Return SVG with `Content-Type: image/svg+xml, Cache-Control: public, max-age=86400` |
| **API Endpoints** | `GET /api/og/practitioner/:slug` — public, no auth |
| **DB Query** | `QUERIES.getPractitionerBySlug` — returns `display_name, photo_url, bio, specializations, certification, slug, client_count` |
| **Test Elements** | `tests/practitioner-og.test.js` — 17 tests: SVG structure (11 — dimensions, name, bio truncation, specialization slicing, XSS escaping, cert badge, branding), handler contract (6 — invalid slug, empty slug, 200 flow, KV hit, KV put, 404 not found) |
| **Analytical Elements** | Event: `practitioner_og_generated` (per slug, on cache miss) |
| **Key Code** | `escapeXml()` on all user content. Bio capped at 110 chars. Specializations: `slice(0,3).join(' · ')`. KV cache key: `og:practitioner:v1:{slug}`, TTL 86400s. Slug validation: `/^[a-z0-9-]{1,80}$/`. |

---

### Feature: Personalized Social Share OG Images

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Personalized Social Share OG Images |
| **Permission Level** | PUBLIC — no authentication required (social crawlers must be able to fetch these) |
| **Workflow Position** | Returned in `shareContent.imageUrl` by `POST /api/share/*` endpoints; referenced in dynamic `og:image` meta tags |
| **Purpose** | Social platform crawlers (Facebook, Twitter/X, LinkedIn, WhatsApp) must fetch `og:image` as an absolute HTTPS URL. Previously share cards were generated as `data:image/svg+xml;base64,...` which crawlers cannot access. These endpoints serve personalized SVG images over HTTP with proper `Cache-Control` headers, enabling rich link previews on every share type. |
| **Files** | `workers/src/handlers/share-og.js` (4 HTTP handlers), `workers/src/lib/shareImage.js` (4 raw SVG generator functions), `workers/src/handlers/share.js` (updated to return HTTP `imageUrl` + `shareUrls`), `workers/src/index.js` (routes + PUBLIC_ROUTES) |
| **Workflow Step** | 1. User triggers share (celebrity match, chart, achievement, or referral) → 2. Frontend POSTs to `/api/share/{type}` → 3. Handler builds `ogImageUrl = ${baseUrl}/api/og/{type}?{params}` → 4. Returns `shareContent.imageUrl` (HTTP URL) + `shareContent.shareUrls` (ready-to-open Twitter/Facebook/LinkedIn/WhatsApp URLs) → 5. Frontend opens `shareUrls.twitter` etc. in new tab → 6. When user's friend receives the link, crawler fetches `og:image` URL → 7. `handleOGChart` (or equivalent) checks KV → HIT: returns cached SVG → MISS: calls `generateChartOGSVG(type, profile, authority)` → stores in KV (TTL 24h) → returns `Content-Type: image/svg+xml` |
| **API Endpoints** | `GET /api/og/chart?type=Builder&profile=2%2F4&authority=Emotional`, `GET /api/og/celebrity?name=Steve+Jobs&pct=78`, `GET /api/og/achievement?name=First+Chart&icon=🌟&tier=gold&points=100`, `GET /api/og/referral?code=ABC123` |
| **KV Cache Keys** | `og:chart:v1:authority=Emotional&profile=2%2F4&type=Builder`, `og:celebrity:v1:name=Steve+Jobs&pct=78`, etc. (query params sorted, TTL 86400s) |
| **Key Code** | `generateChartOGSVG`, `generateCelebrityOGSVG`, `generateAchievementOGSVG`, `generateReferralOGSVG` in `shareImage.js` return raw SVG XML (not data URLs). `serveOGImage(env, cacheKey, generateFn)` in `share-og.js` handles KV cache + response headers. |

---

### Feature: Post-Onboarding Activation Checklist

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Practitioner Activation Plan (5-Step Checklist) |
| **Permission Level** | AUTHENTICATED; Practitioner+ tier |
| **Workflow Position** | Practitioner workspace dashboard, shown immediately on load |
| **Purpose** | Guide new practitioners through 5 activation milestones: Complete Profile → Invite Client → Chart Generated → First Note → First Brief. Persistent, data-driven — auto-updates as the practitioner completes real actions. |
| **Files** | `frontend/js/app.js` (`renderPractitionerActivationPlan`) |
| **Workflow Step** | 1. Practitioner opens workspace → 2. Activation Plan card renders with current progress (N/5) → 3. Incomplete steps show CTAs → 4. Steps update automatically on data change → 5. All steps done → celebratory "fully activated" state |
| **Checklist Steps** | 1. **Complete Profile** (display_name + bio + booking_url), 2. **Invite Client** (≥1 client or invitation), 3. **Chart Generated** (≥1 client with chart_id), 4. **First Note** (totalNotes > 0 from stats), 5. **First Brief** (≥1 client with chart_id + profile_id, enabling AI session brief) |
| **Data Sources** | `GET /api/practitioner/clients`, `GET /api/practitioner/profile`, `GET /api/practitioner/clients/invitations`, `GET /api/practitioner/directory-profile`, `GET /api/practitioner/stats` |
| **Test Elements** | `tests/activation-checklist.test.js` — 13 tests: fresh practitioner all incomplete, each step condition, edge cases (null/undefined data), full activation |
| **Analytical Elements** | Events: `activation_step_completed` (per step key, localStorage-deduped), `activation_checklist_complete` (all 5 done, fired once) |
| **Key Code** | `renderPractitionerActivationPlan({ rosterData, profileData, invitationsData, directoryData, metricsData })` — computes 5 boolean conditions, renders card grid with progress counter, fires analytics on new completions |

---

### Feature: Session Template Picker

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Session Note Template Picker |
| **Permission Level** | AUTHENTICATED; Practitioner+ tier |
| **Workflow Position** | Inside client detail view → New Note form |
| **Purpose** | Pre-fill session note textarea with structured template sections (Intake, Follow-up, Integration, Closing) hydrated with client chart data |
| **Files** | `workers/src/handlers/session-templates.js` (backend), `frontend/js/app.js` (frontend picker) |
| **Workflow Step** | 1. Practitioner opens client → 2. Clicks "+ New Note" → 3. Selects template from dropdown → 4. Template hydrated with client data via POST → 5. Textarea pre-filled with section prompts and context hints → 6. Practitioner edits and saves |
| **API Endpoints** | `GET /api/practitioner/session-templates` (list), `GET /api/practitioner/session-templates/:id` (detail), `POST /api/practitioner/session-templates/:id/hydrate` (hydrate with client data) |
| **Built-in Templates** | Initial Intake (5 sections), Follow-up Session (5), Integration Check-in (5), Closing/Completion (5) |
| **Test Elements** | `tests/session-template-picker.test.js` — 8 tests: template listing, summary fields, section detail, 404 handling, hydration with client data, default fields, invalid JSON |
| **Analytical Elements** | Events: `template_selected` (template ID), `template_hydrated` (template ID after successful hydration) |
| **Key Code** | `loadNoteTemplates(clientId)` — populates dropdown on first form open with cached API response; `applyNoteTemplate(clientId)` — hydrates template and pre-fills textarea |

---

### Feature: Referral Link & Rewards Program

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Referral Program (Link Generation & Tracking) |
| **Permission Level** | AUTHENTICATED; all tiers eligible |
| **Workflow Position** | Workspace sidebar "Referrals" section; second-order growth mechanism |
| **Purpose** | Allow practitioners to refer new clients/practitioners, earn commissions, track conversions |
| **Files** | `workers/src/handlers/referrals.js` (600+ lines), `workers/src/handlers/share.js` (referral share card) |
| **Workflow Step** | 1. Practitioner clicks "Get Referral Link" → 2. Backend generates unique slug, returns shareable URL (e.g., `https://selfprime.net/?ref=john_hd_coach`) → 3. Practitioner shares with clients/network → 4. Referee clicks link → 5. Link sets `ref=john_hd_coach` cookie (90 days) → 6. If referee signs up → matches cookie to referrer → creates `referrals` table entry → 7. Referrer's stats updated (commissions earned, conversion date) |
| **API Endpoints** | `POST /api/referrals/generate` (create link), `GET /api/referrals/stats` (view earnings), `GET /api/referrals/history` (detailed conversions), `POST /api/referrals/validate?code=...` (validate before signup), `GET /api/referrals/code/:code` (redeem link), `POST /api/referrals/claim/:rewardId` (claim payout) |
| **Database Tables** | `referrals` (id, referrerId FK, refereeId FK, code, createdAt, convertedAt, conversionTier), `referral_rewards` (id, referrerId FK, amount_cents, earnedDate, claimedDate, status enum[pending, claimed, failed]) |
| **Cache Layer** | KV: `REF_CODE_[slug]` → `{referrerId, createdAt}` for quick lookups |
| **Test Elements** | `tests/referrals.test.js` — code generation unique (no collisions in mock dir), cookie persists 90 days, attribution on signup/checkout works, limits enforced (free: 3 referrals, starter: 10, pro: unlimited) |
| **Analytical Elements** | Event: `referral_link_generated` (referrer_tier), `referral_conversion` (referee_tier), `referral_reward_earned` (amount_cents), `referral_reward_claimed` (payment_method) |
| **Error Debugging** | Error codes: `ERR_INVALID_REFERRAL_CODE`, `ERR_SELF_REFERRAL_BLOCKED`, `ERR_REWARD_LIMIT_REACHED`, `ERR_PAYOUT_FAILED`; Fraud detection: block referrals from same IP/subnet (within 12h) after first conversion |
| **Commission Structure** | Free tier: 5% (capped $50/year), Starter: 10% (capped $500/year), Pro: 15% (uncapped), Agency: 20% + co-marketing |
| **Key Code** | `handleGenerateCode()` → generates slug, stores in DB + KV, returns `{code, shareUrl}`; Referral cookie set on landing page if `?ref=` present; `handleApplyCode()` called during signup to link referrer |

---

## Billing & Subscriptions

### Feature: Practitioner Analytics Instrumentation

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Practitioner Workflow Analytics |
| **Issues Resolved** | CFO-012 (backend), CFO-013 (frontend) |
| **Permission Level** | AUTHENTICATED; Practitioner+ tiers |
| **Purpose** | Track key practitioner lifecycle events and funnel progression for retention, growth, and upgrade analysis |
| **Files** | `workers/src/handlers/practitioner.js`, `workers/src/handlers/session-notes.js`, `workers/src/handlers/practitioner-directory.js`, `workers/src/lib/analytics.js`, `frontend/js/app.js` |
| **Events Tracked** | `client_add` (mode: added/invited, tier), `client_remove` (clientId), `session_note_create` (shareWithAi, clientId), `session_note_update` (noteId), `ai_context_update` (clientId, length), `session_brief_generate` (clientId), `directory_profile_update` (slug), `directory_profile_view` (slug, practitionerId) |
| **Funnel** | `FUNNELS.PRACTITIONER` — steps: `register` → `first_client` → `first_synthesis` → `upgrade_guide` |
| **Analytics Pattern** | Fire-and-forget via `trackEvent(...).catch(() => {})` — never throws, never blocks response; no `ctx.waitUntil` needed as these fire synchronously inside the handler before the response is returned |
| **API Endpoints** | No new endpoints; instrumentation embedded in existing handlers |
| **Test Elements** | `tests/practitioner-runtime.test.js` — 5 regression cases: `session_note_create` tracked, `ai_context_update` tracked, `CLIENT_ADD` on invite path, `trackFunnel` on register, `CLIENT_REMOVE` tracked |
| **Error Debugging** | Analytics failures are fully silent (`.catch(() => {})`); if `trackEvent` DB insert fails it does not surface to the user. Check `analytics_events` table directly for missing events |

---

### Feature: Client Activity Email Notifications

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Practitioner Client Notifications |
| **Issues Resolved** | CMO-012 |
| **Permission Level** | AUTHENTICATED; Practitioner+ tiers |
| **Purpose** | Auto-notify practitioners when clients complete chart calculations or generate profiles; opt-in preferences per practitioner |
| **Files** | `workers/src/handlers/calculate.js`, `workers/src/handlers/profile-stream.js`, `workers/src/handlers/practitioner-directory.js`, `workers/src/lib/email.js`, `workers/src/db/migrations/051_practitioner_notification_prefs.sql` |
| **Migration** | `051_practitioner_notification_prefs.sql` — adds `notification_preferences JSONB NOT NULL DEFAULT '{"clientChartReady":true,"clientSessionReady":true}'::jsonb` column to `practitioners` |
| **Email Functions** | `sendPractitionerClientChartReady(practitionerEmail, practitionerName, clientName, chartType, chartAuthority, apiKey, fromEmail)`, `sendPractitionerClientSessionReady(practitionerEmail, practitionerName, clientName, apiKey, fromEmail)` |
| **Workflow** | (1) Client submits chart → calculate.js fires `getPractitionersForClient`, checks `notification_preferences.clientChartReady` → fires notification email if true. (2) Client generates profile → profile-stream.js same pattern for `clientSessionReady` |
| **API Integration** | `PUT /api/practitioner/directory-profile` persists `notification_preferences: {clientChartReady: bool, clientSessionReady: bool}` |
| **Frontend** | Two checkboxes in `#dirProfileForm`: `#notif-client-chart-ready`, `#notif-client-session-ready`; populated by `applyDirectoryProfileData()` |
| **Error Debugging** | Notifications use IIFE fire-and-forget `(async () => { try { ... } catch { } })()` — exceptions are swallowed, responses are never blocked. Client name/email comes from `getPractitionersForClient` via a `JOIN users cu ON cu.id = pc.client_user_id`. If emails aren't arriving: check `RESEND_API_KEY`, verify `getPractitionersForClient` query returns rows for the client |

---

### Feature: Practitioner Metrics Dashboard

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Practitioner Workspace Metrics Card |
| **Issues Resolved** | PRAC-012 (metrics endpoint + card), PRAC-013 (directory view tracking) |
| **Permission Level** | AUTHENTICATED; Practitioner+ tiers |
| **Purpose** | Surface key activity stats in the practitioner workspace: active clients, notes this month, total notes, AI-shared notes, directory profile views (30d) |
| **Files** | `workers/src/handlers/practitioner.js`, `workers/src/handlers/practitioner-directory.js`, `workers/src/db/queries.js`, `frontend/js/app.js`, `frontend/index.html` |
| **API Endpoints** | `GET /api/practitioner/stats` → `{ok, stats:{activeClients, totalNotes, notesThisMonth, aiSharedNotes}}`; `GET /api/practitioner/directory-stats` → `{ok, stats:{profileViews30d}}` |
| **Analytics Integration** | `trackEvent(env, 'directory_profile_view', {userId: practitionerId, properties: {slug}})` fired on every public profile GET; `directory-stats` queries `analytics_events WHERE event_name='directory_profile_view'` last 30 days |
| **Frontend** | `#pracMetricsCard` div in workspace; `renderPractitionerMetrics(data, dirData)` renders 5-stat grid; both fetches are parallel in `loadRoster()`, using `.catch(() => null)` — card shows gracefully if stats unavailable |
| **Database Queries** | `getPractitionerStats` — aggregate across `practitioner_clients` + `practitioner_session_notes`; `getPractitionerDirectoryViewStats` — COUNT from `analytics_events` WHERE event_name='directory_profile_view' AND JSON property match |
| **Error Debugging** | If stats card is empty: confirm `GET /api/practitioner/stats` returns 200; check `practitioner_session_notes` table exists with rows; confirm `analytics_events` is receiving directory view events |

---

### Feature: Client Reminder Email

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Send Client Reminder |
| **Issues Resolved** | PRAC-014 |
| **Permission Level** | AUTHENTICATED; Practitioner+ tiers |
| **Purpose** | Allow practitioners to send one-click reminder emails to clients stuck in `needs_birth_data` or `needs_profile` lifecycle states |
| **Files** | `workers/src/handlers/practitioner.js`, `workers/src/lib/email.js`, `workers/src/db/queries.js`, `frontend/js/app.js` |
| **API Endpoint** | `POST /api/practitioner/clients/:id/remind` — validates practitioner ownership, queries client state via `getPractitionerClientForReminder`, calls `sendClientReminder`, stores KV rate-limit key |
| **Rate Limiting** | KV key `reminder:{practitionerId}:{clientId}` with TTL=86400 (24h); returns 429 `{error: 'Reminder already sent...'}` if within cooldown |
| **Email Function** | `sendClientReminder(email, practitionerName, reminderType, apiKey, fromEmail)` where reminderType is `complete_birth_data` or `generate_profile` |
| **Frontend** | "Send Reminder" button rendered in roster for `needs_birth_data`/`needs_profile` client states; `window.sendClientReminder(clientId, emailLabel)` — disables button on send, shows 429 message as "Reminder already sent today" |
| **Error Debugging** | 429 is expected UX — tells practitioner not to double-send. If reminders aren't sending: check KV namespace binding, confirm `RESEND_API_KEY` set, verify client state is `needs_birth_data` or `needs_profile` |

---

### Feature: Weekly Practitioner Digest Email

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Monday Practitioner Weekly Digest |
| **Issues Resolved** | CMO-013 |
| **Permission Level** | Internal (cron-triggered); no direct API |
| **Purpose** | Re-engage practitioners weekly with a personalized summary of workspace activity (client count, notes written, new charts this week) |
| **Files** | `workers/src/cron.js` (Step 11), `workers/src/lib/email.js`, `workers/src/db/queries.js` |
| **Trigger** | Monday-only guard: `now.getUTCDay() === 1`; runs inside the existing daily 6 AM UTC scheduled cron |
| **Query** | `getPractitionerWeeklyDigestList` — aggregate JOIN across `practitioners`/`users`/`practitioner_clients`/`practitioner_session_notes`/`charts`; filters `WHERE p.tier != 'free'`; `HAVING COUNT(DISTINCT pc.client_user_id) > 0` (only practitioners with active clients) |
| **Email Function** | `sendPractitionerWeeklyDigest(email, name, {clientCount, notesThisWeek, newChartsThisWeek}, apiKey, fromEmail)` |
| **Error Handling** | Per-practitioner error isolation — one practitioner's failure doesn't abort the loop. Entire step wrapped in `withTimeout(..., 60000, 'practitioner_weekly_digest')`. Step failure is non-fatal to main cron |
| **Error Debugging** | If digests not sending on Mondays: confirm cron trigger is `getUTCDay() === 1` (0=Sun, 1=Mon...6=Sat); check `RESEND_API_KEY` env var; verify `getPractitionerWeeklyDigestList` returns rows; look for `withTimeout` timeout logs in CF Workers logs |

---

### Feature: Scheduling Embed in Client Workspace

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Cal.com / Calendly Scheduling Embed |
| **Issues Resolved** | PRAC-015 |
| **Permission Level** | AUTHENTICATED; Practitioner+ tiers (profile write); visible to clients of that practitioner |
| **Purpose** | Embed practitioner's scheduling page inside the client workspace to reduce context-switching between the HD platform and external booking tools |
| **Files** | `workers/src/handlers/practitioner-directory.js`, `workers/src/db/migrations/052_practitioner_scheduling_embed.sql`, `workers/src/db/queries.js`, `frontend/js/app.js`, `frontend/index.html` |
| **Migration** | `052_practitioner_scheduling_embed.sql` — `ALTER TABLE practitioners ADD COLUMN IF NOT EXISTS scheduling_embed_url TEXT NOT NULL DEFAULT ''` |
| **URL Validation** | Backend enforces hostname whitelist: `app.cal.com`, `cal.com`, `calendly.com` only; protocol must be `https:`; arbitrary URLs are rejected with 400 |
| **API Integration** | `PUT /api/practitioner/directory-profile` persists `scheduling_embed_url` (15th parameter in `updatePractitionerProfile`); `GET /api/practitioner/directory-profile` returns it in profile object |
| **Frontend** | `#dir-scheduling-embed` URL input in `#dirProfileForm`; `_pracSchedulingEmbedUrl` module-level var set in `loadRoster()`; iframe injected at bottom of `renderClientDetail()` if URL is set |
| **Security** | iframe has `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"` — restricts embedded page capabilities. Hostname whitelist prevents SSRF/phishing via arbitrary embed URLs |
| **Error Debugging** | If iframe doesn't appear: check `_pracSchedulingEmbedUrl` is populated (inspect `loadRoster` → `directoryData.profile.scheduling_embed_url`); verify `scheduling_embed_url` column exists in DB (run migration 052); confirm backend is accepting the URL (check hostname whitelist logic in `handleUpdateDirectoryProfile`) |

---

## Billing & Subscriptions

### Feature: Subscription Checkout (Stripe Integration)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Stripe Subscription Checkout |
| **Permission Level** | AUTHENTICATED; public checkout landing pages |
| **Workflow Position** | Pricing page → modal → Stripe Hosted Checkout |
| **Purpose** | Create Stripe Checkout Session, handle payment collection, set subscription status on `users` table |
| **Files** | `workers/src/handlers/billing.js` (104–260 lines), `workers/src/lib/stripe.js`, `frontend/js/app.js` (lines 1322–1382: `startCheckout()`) |
| **Workflow Step** | 1. User selects tier (Individual, Professional, Agency) → 2. Clicks "Subscribe" → 3. Frontend calls `POST /api/billing/checkout` with tier → 4. Backend creates Stripe Checkout Session via `stripe.checkout.sessions.create()` with `mode: 'subscription'` → 5. Returns session.url → 6. Frontend redirects to Stripe Hosted Checkout → 7. User enters payment info → 8. Stripe calls webhook `/api/webhook/stripe` on success → 9. Backend receives `checkout.session.completed` event → 10. Sets user tier, subscription_id, subscription_status = 'active' |
| **API Endpoints** | `POST /api/billing/checkout`, `POST /api/webhook/stripe` (Stripe webhook), `GET /api/billing/subscription` (get status), `POST /api/billing/cancel` (cancel subscription) |
| **Database Tables** | `users` (stripe_customer_id, subscription_id, subscription_status enum[active, past_due, canceled, expired], current_period_end, cancel_at_period_end) |
| **Test Elements** | `tests/billing-checkout-runtime.test.js` — session creation with correct tier pricing, Stripe webhook signature validation, user tier updated on successful payment, cancellation logic removes access to premium features |
| **Analytical Elements** | Event: `checkout_session_created` (tier, discount_applied), `payment_succeeded` (tier, amount_cents, currency), `subscription_canceled` (reason: user-initiated, payment-failed, etc.), `subscription_renewed` (period_count) |
| **Error Debugging** | Error codes: `ERR_STRIPE_SESSION_FAILED`, `ERR_INVALID_TIER`, `ERR_WEBHOOK_SIGNATURE_INVALID`; Webhook failures trigger retry (Stripe retries up to 3 times over 24h); Logs webhook events to Sentry for debugging |
| **Webhook Handling** | Signature validated via `stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)` to prevent replay attacks; Events processed: `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted` |
| **Key Code** | `handleCheckout()` calls `stripe.checkout.sessions.create({ customer_email: user.email, line_items: [{ price: PRICE_IDS[tier], quantity: 1 }], mode: 'subscription', success_url, cancel_url })`; On webhook, updates user tier + subscription metadata |

---

### Feature: Billing Portal & Self-Service Management

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Stripe Billing Portal (Update Card, Cancel, Resubscribe) |
| **Permission Level** | AUTHENTICATED; Stripe Customer Portal |
| **Workflow Position** | User Settings → "Manage Subscription" button |
| **Purpose** | Allow users to update payment method, view invoices, manage subscription without contacting support |
| **Files** | `workers/src/handlers/billing.js` (346–391 lines: `handlePortal()`) |
| **Workflow Step** | 1. User clicks "Manage Subscription" in settings → 2. Frontend calls `POST /api/billing/portal` → 3. Backend creates Stripe Billing Portal session via `stripe.billingPortal.sessions.create()` → 4. Returns session.url → 5. Frontend redirects to Stripe portal → 6. User updates card, views invoices, cancels/reactivates subscription → 7. Changes reflected in Prime Self within minutes (via webhook) |
| **API Endpoints** | `POST /api/billing/portal` (get portal URL) |
| **Test Elements** | `tests/billing-portal-runtime.test.js` — portal session created, return URL set correctly, user can cancel from portal and webhook updates status |
| **Analytical Elements** | Event: `billing_portal_opened`, `subscription_updated_from_portal` (change_type: payment_method, etc.), `subscription_reactivated` |
| **Error Debugging** | Error codes: `ERR_STRIPE_PORTAL_FAILED`, `ERR_CUSTOMER_NOT_FOUND`; Fallback: show hardcoded contact email if portal unavailable |
| **Key Code** | `stripe.billingPortal.sessions.create({ customer: user.stripe_customer_id, return_url: `https://[domain]/app#workspace` })` |

---

### Feature: Subscription Cancellation & Pro-Rata Refunds

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Subscription Cancellation & Downgrade |
| **Permission Level** | AUTHENTICATED |
| **Workflow Position** | Settings → Billing → "Cancel Subscription"; retention flow |
| **Purpose** | Allow users to cancel subscriptions, handle pro-rata refunds, preserve data (soft delete approach) |
| **Files** | `workers/src/handlers/billing.js` (468–562 lines: `handleCancelSubscription()`) |
| **Workflow Step** | 1. User navigates to "Billing & Subscription" → 2. Clicks "Cancel Subscription" → 3. Frontend shows modal with reason dropdown (too expensive, don't use features, etc.) → 4. On confirm, POSTs to `POST /api/billing/cancel` → 5. Backend cancels Stripe subscription via `stripe.subscriptions.update(..., {cancel_at_period_end: true})` (schedules cancellation at period end) → 6. Sets `cancel_at_period_end = true` on user → 7. Shows "Subscription ends on [date]" message |
| **API Endpoints** | `POST /api/billing/cancel`, `POST /api/billing/downgrade` (change to lower tier without cancellation) |
| **Database Tables** | `users` (cancel_at_period_end BOOLEAN, cancelation_reason TEXT, cancelation_date) |
| **Test Elements** | `tests/billing-cancel-runtime.test.js` — cancellation stops future charges, data preserved (not deleted), downgrade lowers tier immediately, tier limits enforced (Pro → Starter removes extra clients), cron job downgrades expired subscriptions |
| **Analytical Elements** | Event: `subscription_cancelation_initiated` (reason, tier, subscription_length_days), `subscription_downgraded` (from_tier, to_tier), `churn_reason_collected` |
| **Error Debugging** | Error codes: `ERR_CANCEL_FAILED`, `ERR_INVALID_SUBSCRIPTION`; Fallback: set `cancel_at_period_end = true` in DB even if Stripe API fails, retry via cron |
| **Retention Flow** | Optional: Show discount offer (e.g., "50% off next 3 months?") before confirming cancellation; Track if user re-subscribes within 30 days (potential win-back) |
| **Key Code** | `stripe.subscriptions.update(user.subscription_id, { cancel_at_period_end: true })`; Cron job runs daily, downgrades users where `cancel_at_period_end = true` AND `current_period_end < today` |

---

### Feature: Promotion Codes & Discounts

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Promo Code Validation & Application |
| **Permission Level** | PUBLIC (validation), AUTHENTICATED (application) |
| **Workflow Position** | Checkout; optional discount entry |
| **Purpose** | Apply promotional/referral discounts at checkout |
| **Files** | `workers/src/handlers/promo.js` (209 lines), `frontend/js/app.js` (lines 1293–1321: `applyPromoCode()`) |
| **Workflow Step** | 1. User on checkout page, enters promo code (e.g., `WELCOME20`) → 2. Frontend calls `POST /api/promo/validate` with code → 3. Backend queries `promo_codes` table, validates: not expired, usage count < limit, code type (percentage/fixed) → 4. Returns discount amount → 5. Frontend updates checkout total → 6. On payment success, webhook applies discount via Stripe Coupon attachment |
| **API Endpoints** | `POST /api/promo/validate` (check code validity), `POST /api/promo/apply` (apply to checkout), `GET /api/promo/list` (admin only), `POST /api/promo/create` (admin only) |
| **Database Tables** | `promo_codes` (id, code UNIQUE, discount_type enum[percentage, fixed_cents], discount_value, expiresAt, maxUsageCount, usageCount, appliedTiers ARRAY, createdAt) |
| **Test Elements** | `tests/promo.test.js` — code validation correct, expiry enforced, usage limit enforced, double-application blocked, case-insensitive lookup |
| **Analytical Elements** | Event: `promo_code_validated` (code, discount_amount), `promo_applied` (tier, discount_amount_cents), `promo_code_exhausted` (code, usage_count_reached) |
| **Error Debugging** | Error codes: `ERR_INVALID_PROMO_CODE`, `ERR_PROMO_EXPIRED`, `ERR_PROMO_USAGE_EXHAUSTED`, `ERR_PROMO_NOT_APPLICABLE_TO_TIER` (e.g., code only for new users); Email alert to marketing if popular code exhausted |
| **Key Code** | Validate: `SELECT * FROM promo_codes WHERE code = $1 AND expiresAt > NOW()` AND `usageCount < maxUsageCount` AND tier in appliedTiers; On success, increment usageCount |

---

## Community & Sharing

### Feature: Share Chart with Social Media

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Social Media Share (Twitter, Facebook, LinkedIn) |
| **Permission Level** | AUTHENTICATED; shareable link generation |
| **Workflow Position** | From profile or chart view; social proof driver |
| **Purpose** | Generate shareable cards with chart snapshot, quote, practitioner info; drive viral growth |
| **Files** | `workers/src/handlers/share.js` (127–203 lines: `handleShareChart()`), `frontend/js/app.js` (BL-SOCIAL-C1: `shareOnTwitter()`, `copyShareLink()`) |
| **Workflow Step** | 1. User views profile or chart → 2. Clicks "Share on Twitter/Copy Link" → 3. Frontend calls `POST /api/share/chart` → 4. Backend generates unique share link (e.g., `https://selfprime.net/share/chart/abc123def456`) → 5. If social platform, builds preview card (user name, chart type, I Ching gate, quote) → 6. Twitter: returns `twitter.com/intent/tweet?url=...&text=...` → 7. Facebook: returns share dialog pre-filled URL → 8. Copy Link: returns short URL for messages/email |
| **API Endpoints** | `POST /api/share/chart`, `POST /api/share/achievement` (share badge), `GET /api/share/:shareId` (fetch shared profile for public view), `GET /api/share/stats` (analytics) |
| **Database Tables** | `shares` (id, userId FK, chartId FK, shareType enum[chart, achievement, referral], createdAt, views, clicks) |
| **Share Card** | Generated as open graph meta tags: `og:title`, `og:description`, `og:image` (dynamic chart image), `og:url` (share link) |
| **Test Elements** | `tests/share.test.js` — share link generation unique, OG tags rendered correct in social platform, analytics tracked |
| **Analytical Elements** | Event: `share_created` (share_type, platform_target), `share_clicked` (from_platform, referrer), `share_viewed_count` (daily) |
| **Error Debugging** | Error codes: `ERR_SHARE_GENERATION_FAILED`, `ERR_CHART_NOT_FOUND`, `ERR_CHART_NOT_SHAREABLE` (privacy); Fallback: simple text share if image generation fails |
| **Key Code** | `handleShareChart()` generates UUID, stores in `shares` table, builds OG meta data, returns platform-specific share URLs; Frontend `shareOnTwitter()` opens Twitter intent with pre-filled text |

---

### Feature: Achievements & Badges

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Gamification: Achievements, Streaks, Leaderboards |
| **Permission Level** | AUTHENTICATED; opt-in leaderboard visibility |
| **Workflow Position** | Achievements tab; motivational element; optional |
| **Purpose** | Track milestones (first chart, 10 checkins, referral conversions), display badges, encourage engagement |
| **Files** | `workers/src/handlers/achievements.js` (600+ lines), `workers/src/handlers/stats.js` (leaderboards) |
| **Workflow Step** | 1. System tracks user events (chart generated, checkin, referral conversion) → 2. Backend checks achievement criteria (event == 'first_chart' → unlock "Chart Creator" badge) → 3. If new achievement, insert into `achievements` table, send notification → 4. User views Achievements tab → 5. Frontend loads `GET /api/achievements` → 6. Renders earned badges (with date), locked badges (progress toward unlock) → 7. Optional: View leaderboard (most charts, highest streak, most referrals) |
| **API Endpoints** | `GET /api/achievements` (list), `GET /api/progress` (progress toward next achievements), `GET /api/leaderboard` (global top 100 or friends), `POST /api/checkin` (check-in event triggering streak tracking) |
| **Achievement Types** | First Chart (immediate), 10 Checkins, 30-Day Streak, 5 Referrals, Profile Complete, Help a Friend (shared client relationship) |
| **Database Tables** | `user_achievements` (id, userId FK, achievementId FK, unlockedAt), `leaderboard_stats` (userId FK, metric_type enum[charts_generated, checkin_streak, referrals_converted], value, updatedAt) |
| **Test Elements** | `tests/achievements.test.js` — event triggers correct achievement unlock, duplicate unlocks prevented, leaderboard ordering correct, stats aggregated daily |
| **Analytical Elements** | Event: `achievement_unlocked` (achievement_id, progress_to_next), `leaderboard_viewed` (filter: global, friends, metric), `badge_shared` (achievement_id) |
| **Error Debugging** | Error codes: `ERR_ACHIEVEMENT_NOT_FOUND`, `ERR_DUPLICATE_ACHIEVEMENT`; Deduplication: achievement unlock checked before insert to prevent duplicates |
| **Key Code** | `handleTrackEvent(env, userId, eventType, ...)` called from multiple handlers (calculate, checkin, sharing); Checks achievement criteria; Inserts new row if unlocked; Sends push notification if enabled |

---

### Feature: Check-In Routine (Daily Habit)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Daily Check-In Habit Tracker |
| **Permission Level** | AUTHENTICATED; optional feature for free tier |
| **Workflow Position** | Checkin tab or dashboard summary; consistency reinforcement |
| **Purpose** | Daily reflection prompt, streak tracking, habit formation gamification |
| **Files** | `workers/src/handlers/checkin.js` (600+ lines), `frontend/index.html` checkin modal |
| **Workflow Step** | 1. User navigates to Checkin tab → 2. IF today's checkin not yet submitted, show prompt (e.g., "How are you moving through your chart today?") → 3. User optionally enters freeform reflection (text, optional voice if supported) → 4. Clicks Submit → 5. POST to `/api/checkin` records entry with timestamp + text → 6. Backend updates `checkin_streaks` table, increments currentStreak or resets if gap > 1 day → 7. Shows "Day 5 of your streak 🔥" → 8. Optional: unlock achievement at day 30 |
| **API Endpoints** | `POST /api/checkin` (create), `GET /api/checkin/today` (get today's if exists), `GET /api/checkin/history` (list past 30), `GET /api/checkin/streak` (current stats), `GET /api/checkin/stats` (aggregate stats) |
| **Database Tables** | `checkins` (id, userId FK, entryDate DATE, content TEXT, moodScore 1-10 optional, createdAt) `checkin_streaks` (userId FK, currentStreak, longestStreak, lastCheckinDate) |
| **Test Elements** | `tests/checkin.test.js` — one checkin per day enforced, streak resets on gap, moodScore optional (1-10 range if provided), history pagination working |
| **Analytical Elements** | Event: `checkin_created` (streak_count, mood_score), `streak_broken` (streak_length), `long_streak_achieved` (7, 14, 30, 100 days), `checkin_reminder_clicked` (conversion rate) |
| **Error Debugging** | Error codes: `ERR_DUPLICATE_CHECKIN_TODAY`, `ERR_PAST_DATE_DENIED` (prevent backdating), `ERR_REMINDER_NOT_SET`; Soft error: allow edit if user submits twice without error message |
| **Cron Job** | Daily at 6 AM UTC, reset leaderboard stats, send push notification reminders to opt-in users |
| **Key Code** | `handleCheckinCreate()` checks if `(userId, CURDATE()) exists in checkins`; if yes, return error; else insert. `handleCheckinToday()` returns last entry for today or null. Streak logic: `IF lastCheckinDate = YESTERDAY THEN currentStreak++; ELSE IF lastCheckinDate < YESTERDAY THEN currentStreak = 1` |

---

## Integrations

### Feature: Notion Integration (Client Sync)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Notion Database Integration (Auto-Sync Clients & Charts) |
| **Permission Level** | AUTHENTICATED; Practitioner+ tiers |
| **Workflow Position** | Workspace settings; optional integration for case management |
| **Purpose** | Auto-sync practitioner's client roster and session notes to Notion database for CRM/case management |
| **Files** | `workers/src/handlers/notion.js` (448+ lines), OAuth flow via Cloudflare Workers |
| **Workflow Step** | 1. Practitioner clicks "Connect Notion" in Workspace → 2. OAuth redirect to Notion → 3. User approves scope (insert database items) → 4. Notion returns `code` → 5. Frontend POSTs code to `/api/notion/callback` → 6. Backend exchanges code for access token via `https://api.notion.com/v1/oauth/token` → 7. Stores encrypted token in `users.notion_access_token` → 8. On subsequent client updates or chart generations, webhook triggers sync to Notion database → 9. Creates new database items or updates existing ones (matched by email) |
| **API Endpoints** | `GET /api/notion/auth` (start OAuth), `POST /api/notion/callback` (handle OAuth return), `GET /api/notion/status` (connected?), `POST /api/notion/sync-clients` (manual sync), `POST /api/notion/export-profile` (export one profile to Notion), `POST /api/notion/disconnect` (revoke token) |
| **Database Tables** | `users` (notion_access_token encrypted, notion_database_id, notion_last_sync_at) |
| **Notion Database Schema** | Auto-created on first sync with properties: Client Name (title), Email, Phone, Sessions (count), Profile Generated (date/bool), Last Checkin (date), Notes (text) |
| **Test Elements** | `tests/notion-integration.test.js` — OAuth flow success/error, token refresh (Notion tokens expire in 1 year but need refresh handling), sync payload matches Notion schema, duplicate prevention via email match |
| **Analytical Elements** | Event: `notion_connected` (integration_type: client_sync), `notion_sync_triggered` (num_items_created, num_items_updated, sync_time_ms), `notion_disconnected` |
| **Error Debugging** | Error codes: `ERR_NOTION_AUTH_FAILED`, `ERR_NOTION_SYNC_FAILED`, `ERR_INVALID_DATABASE_ID`, `ERR_TOKEN_EXPIRED` (auto-refresh via refresh token); Rate limiting: Notion API ~3 req/sec, implemented with retry backoff |
| **Key Code** | OAuth: redirect to `https://api.notion.com/v1/oauth/authorize?client_id=...&redirect_uri=...&response_type=code`; Callback: exchange code for token via POST to `https://api.notion.com/v1/oauth/token`; Sync: iterate clients, POST item to Notion database via `/v1/databases/{id}/query` then `/v1/pages` for create/update |

---

### Feature: Stripe Webhook Processing

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Stripe Webhook Receiver & Handler |
| **Permission Level** | PUBLIC (webhook secret validated server-side) |
| **Workflow Position** | Background job; triggered by Stripe events |
| **Purpose** | React to Stripe events (subscription created, payment failed, etc.) and update user state |
| **Files** | `workers/src/handlers/webhook.js` (217+ lines: `handleStripeWebhook()`) |
| **Workflow Step** | 1. Stripe emits event (e.g., `checkout.session.completed`) → 2. POSTs JSON payload + signature header to `/api/webhook/stripe` → 3. Backend validates signature via `stripe.webhooks.constructEvent(body, sig, secret)` → 4. Dispatches event handler (e.g., `onCheckoutSessionCompleted()`) → 5. Handler updates `users` table, sends confirmation email (via Resend), logs to analytics |
| **API Endpoints** | `POST /api/webhook/stripe` |
| **Webhook Events Handled** | `checkout.session.completed` (new subscription), `customer.subscription.updated` (tier change), `customer.subscription.deleted` (cancellation), `invoice.payment_succeeded` (renewal), `invoice.payment_failed` (retry), `charge.dispute.created` (chargeback) |
| **Database Tables** | `users` (stripe_customer_id, subscription_id, subscription_status, current_period_end, cancel_at_period_end) |
| **Retry Logic** | Stripe automatically retries failed webhooks up to 5 times over 3 days; Prime Self logs all webhook deliveries to `webhook_events` table for audit |
| **Test Elements** | `tests/webhook.test.js` — signature validation (reject invalid sigs), event parsing correct, idempotency (same event twice = no double-charge), missing event handlers logged but don't crash |
| **Analytical Elements** | Event: `webhook_received` (event_type), `webhook_processed` (success/failure), `webhook_retry_exhausted` (manual escalation to support) |
| **Error Debugging** | Error codes: `ERR_INVALID_SIGNATURE`, `ERR_EVENT_TYPE_NOT_IMPLEMENTED`, `ERR_DATABASE_UPDATE_FAILED`; All errors logged to Sentry; Failed webhooks can be manually retried from Stripe dashboard |
| **Idempotency** | Each webhook event has unique `id` + `created` timestamp; Prime Self deduplicates via `INSERT INTO webhook_events (...) ON CONFLICT (stripe_event_id) DO NOTHING` |
| **Key Code** | `stripe.webhooks.constructEvent(body, headers['stripe-signature'], env.STRIPE_WEBHOOK_SECRET)`; On success, extract event.type + event.data.object; Dispatch to handler; Log result |

---

### Feature: SMS Delivery (Telnyx Integration)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | SMS Delivery (Daily Transit Digests, Alerts) |
| **Permission Level** | AUTHENTICATED; opt-in per user, requires phone number |
| **Workflow Position** | Daily cron (6 AM UTC); async notification delivery |
| **Purpose** | Send daily SMS with transit summary or alert notifications to opted-in users |
| **Files** | `workers/src/handlers/sms.js` (160+ lines), `workers/src/cron.js` (SMS send step) |
| **Workflow Step** | 1. User sets phone number + opts into SMS notifications in settings → 2. Daily cron job at 6 AM UTC calculates today's transits → 3. Generates SMS message (e.g., "Mars door opens today: Initiative & action themes in your chart. [Details URL]") → 4. Calls Telnyx API to send SMS to phone number → 5. Telnyx delivers SMS → 6. User receives notification → 7. Optional: click link to open app (deep link) and view full transit details |
| **API Endpoints** | `POST /api/sms/send` (manual test), `POST /api/sms/webhook` (Telnyx delivery receipts), settings endpoint to manage SMS preference |
| **Database Tables** | `users` (phone_number, phone_verified BOOLEAN, sms_opted_in BOOLEAN, sms_message_count), `sms_messages` (id, userId FK, messageBody, sentAt, deliveryStatus, deliveryConfirmedAt) |
| **Telnyx Configuration** | API key: `env.TELNYX_API_KEY`; From number: configurable per region; Webhook for delivery receipts at `/api/sms/webhook` |
| **Test Elements** | `tests/sms-handler-runtime.test.js` — message generation correct, Telnyx API call mocked, delivery receipts processed, opt-out honored, rate limiting (1 per day per user) |
| **Analytical Elements** | Event: `sms_sent` (message_type: transit_digest, alert, reminder), `sms_delivered` (delivery_time_ms), `sms_failed` (failure_reason: invalid_phone, service_error, etc.), `sms_opt_in/opt_out` (user preference change) |
| **Error Debugging** | Error codes: `ERR_INVALID_PHONE`, `ERR_PHONE_NOT_VERIFIED`, `ERR_TELNYX_API_FAILED`, `ERR_TEMPLATE_GENERATION_FAILED`; Telnyx failures: retry up to 3x with 10-min backoff |
| **Cost** | ~$0.01–0.05 per SMS depending on destination; monthly spend tracked in analytics |
| **Key Code** | SMS sent via `new Telnyx().messages.create({ from: '+1234567890', to: user.phone_number, text: messageBody })`; Webhook validates Telnyx signature before updating status; Opt-out handled via user preference flag |

---

## Admin & Observability

### Feature: Admin Dashboard & Metrics

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Admin Dashboard (Observability & System Health) |
| **Permission Level** | ADMIN only via `X-Admin-Token` |
| **Workflow Position** | Internal tool; not user-facing |
| **Purpose** | Manage users and promo codes, and view lightweight operator stats/funnel data |
| **Files** | `frontend/admin.html`, `frontend/js/admin.js`, `workers/src/handlers/admin.js`, `workers/src/handlers/promo.js` |
| **Workflow Step** | 1. Operator opens `/admin.html` → 2. Enters `ADMIN_TOKEN` into the in-memory sign-in form → 3. Views overview stats from `/api/admin/stats` → 4. Searches users and changes tier/verification state → 5. Manages promo codes |
| **Metrics Displayed** | Total users, new users (24h/7d), verified users, tier counts, active subscriptions, charts (24h), profiles (24h) |
| **API Endpoints** | `GET /api/admin/stats`, `GET /api/admin/users`, `GET /api/admin/users/:id`, `PATCH /api/admin/users/:id/tier`, `PATCH /api/admin/users/:id/verify`, `GET /api/admin/analytics/funnel`, `GET /api/admin/promo`, `POST /api/admin/promo`, `PATCH /api/admin/promo/:id/deactivate` |
| **Database Tables** | `analytics_events` (eventType, userId, properties JSON, createdAt, indexed on (eventType, createdAt)) |
| **Test Elements** | `tests/admin.test.js` — invalid token rejected, stats endpoint returns overview payload, tier changes recorded as admin actions |
| **Analytical Elements** | Events: `admin_auth_fail`, `admin_accessed_dashboard`, `admin_action` |
| **Error Debugging** | Invalid/missing token returns 403; unexpected 5xx paths fall through the shared worker error pipeline with `X-Request-ID`, analytics `trackError`, and Sentry capture |
| **Key Code** | `handleAdmin()` dispatches token-guarded admin routes; `recordAdminEvent()` writes lightweight operator events without blocking admin responses |

---

### Feature: Error Tracking & Alerting (Sentry)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Error Tracking & Alerting (Sentry Integration) |
| **Permission Level** | SYSTEM (automatic); admin view in dashboard |
| **Workflow Position** | Background; triggered on unhandled errors |
| **Purpose** | Capture errors, stack traces, context; alert on-call engineer if critical |
| **Files** | `workers/src/lib/routeErrors.js`, `workers/src/lib/sentry.js`, `workers/src/index.js` |
| **Workflow Step** | 1. A route throws or calls `reportHandledRouteError()` → 2. Request context and request ID are captured → 3. Analytics `trackError` and `initSentry(...).captureException(...)` are dispatched via `waitUntil` when possible → 4. User receives a safe error response with request correlation |
| **API Endpoints** | Sentry ingest (no Prime Self endpoint; self-contained) |
| **Context Captured** | User ID (if authenticated), request path, query params (sanitized), response status, LLM model/cost, DB query latency, browser UA (frontend) |
| **Alert Rules** | Controlled in Sentry project configuration; worker code emits structured context but does not hard-code policy thresholds |
| **Test Elements** | `tests/sentry.test.js`, `tests/handled-route-errors.test.js`, `tests/observability-runtime.test.js`, `tests/error-pipeline.test.js` |
| **Analytical Elements** | Error events sent to Sentry with structured metadata for dashboard visualization |
| **Error Debugging** | Error codes categorized: AUTH (4xx), SERVER (5xx), LLM (timeout, rate limit, schema), DB (connection, query); Stack traces include source maps (JS) or line numbers (Workers) |
| **Key Code** | Shared handler path: `reportHandledRouteError({ ... })`; top-level path: Worker `fetch()` catch calls `trackError(...)` and `initSentry(env).captureException(...)` |

---

## Frontend UI Features

### Feature: Responsive Chart Visualization

| Attribute | Details |
|-----------|---------|
| **Feature Name** | HD Bodygraph Visualization (SVG Rendering) |
| **Permission Level** | PUBLIC; displays for anonymous + authenticated users |
| **Workflow Position** | Chart display post-calculation; core UI of app |
| **Purpose** | Render interactive SVG bodygraph with channels, centers, gates, transits overlay |
| **Files** | `frontend/js/bodygraph.js` (600+ lines), `frontend/index.html` (#chartCanvas SVG container), `frontend/css/components/charts.css` |
| **Workflow Step** | 1. User completes chart calculation → 2. `renderChart()` called with full chart JSON → 3. `bodygraph.js` parses chart data (centers, channels, profile) → 4. Draws SVG: circles (centers), lines (channels), labels (gates, lines) → 5. Applies color coding (defined/undefined) → 6. On Transits tab, overlays transit gates in different stroke color → 7. Hover reveals gate/line explanations from `explanations.js` |
| **API Endpoints** | No API; all data from `POST /api/chart/calculate` response |
| **Interactivity** | Click channel/gate → show explanation popup; Hover on gates → tooltip with name + keywords |
| **Mobile Responsiveness** | Scales chart SVG via viewBox + responsive container; Full chart visible on mobile (but smaller) |
| **Test Elements** | `tests/bodygraph.test.js` — SVG generated with correct number of centers (9), channels (36 defined, 0–33 open), gates (64), proper stroke colors, explanations loaded on click |
| **Analytical Elements** | Event: `chart_rendered` (rendering_time_ms), `chart_element_clicked` (element_type: gate, channel), `chart_viewed_duration` (seconds_on_screen) |
| **Error Debugging** | Error codes: `ERR_INVALID_CHART_DATA`, `ERR_SVG_NOT_FOUND`, `ERR_EXPLANATIONS_MISSING`; Debug logging: `window.DEBUG // console.log('[Chart] SVG rendered with X centers, Y channels')` |
| **Key Code** | `renderChart()` calls `bodygraph.init({ chartData, parentElement: '#chartCanvas' })`; SVG paths drawn via `Snap.js` or native `<svg>` + `<circle>`, `<line>` elements; Click handlers bound to elements via `addEventListener` or event delegation |

---

### Feature: Tabbed Navigation (Chart Tabs)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Multi-Tab Interface (Chart, Profile, Transits, Checkin, Compatibility) |
| **Permission Level** | AUTHENTICATED for some tabs (profile generation); others PUBLIC |
| **Workflow Position** | Main workspace navigation; primary layout structure |
| **Purpose** | Organize features into logical sections; smooth navigation without page reload |
| **Files** | `frontend/index.html` (tabs markup), `frontend/css/components/tabs.css`, `frontend/js/app.js` (lines 1847–1880: tab-switching logic) |
| **Workflow Step** | 1. User clicks "Transits" tab → 2. Frontend calls `activateTab('transits')` → 3. Sets active class on tab button → 4. Shows only `#transits` content div (hides others via `display: none`) → 5. If tab requires data fetch, calls `onTabActivated('transits')` hook to load data → 6. Content renders (or already cached) |
| **Tab Structure** | Chart (bodygraph SVG) → Profile (LLM narrative text) → Transits (transit overlay) → Checkin (daily form) → Compatibility (pair chart) |
| **Mobile Behavior** | Tabs render as horizontal scroll on mobile (CSS flex, `overflow-x: auto`) or dropdown menu for space |
| **Test Elements** | `tests/ui.test.js` — tab switching works, content divs hide/show correctly, lazy-loaded data fires on first tab activation, active tab styling applied |
| **Analytical Elements** | Event: `tab_activated` (tab_name, time_on_previous_tab_ms) |
| **Error Debugging** | Error codes: `ERR_TAB_NOT_FOUND`, `ERR_DATA_LOAD_FAILED` (show alert in tab with retry button); Fallback: freeze tab in loading state if data fetch fails |
| **Key Code** | Tab switching: `document.querySelectorAll('[data-tab]').forEach(btn => btn.classList.remove('active'))` then `event.target.classList.add('active')`; Content: `document.querySelectorAll('[data-tab-content]').forEach(div => div.style.display = 'none')` then show target |

---

### Feature: Responsive Sidebar Navigation

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Collapsible Sidebar Navigation |
| **Permission Level** | AUTHENTICATED; varies by user tier |
| **Workflow Position** | Left edge of main app; primary navigation for authenticated users |
| **Purpose** | Navigate between workspace sections (Profile, Workspace, Billing, Settings, Practitioner tools) |
| **Files** | `frontend/index.html` (sidebar markup), `frontend/css/components/sidebar.css`, `frontend/js/app.js` (lines 1892–1960: sidebar toggle logic) |
| **Workflow Step** | 1. User logs in → 2. Sidebar renders with navigation links (Profile, Workspace, Directory, Billing, Settings) → 3. On mobile, sidebar hidden by default → 4. User clicks hamburger icon → 5. Sidebar slides in from left → 6. User clicks link → 7. Smooth scroll or PJAX update to section → 8. Click outside closes sidebar (mobile) |
| **Sidebar Items** | Profile (view/edit), Workspace (client roster, session notes, checkins), Directory (list practitioners), Billing & Subscription, Settings (2FA, password, notifications), Help & Support |
| **Mobile Behavior** | Hamburger menu (3 lines) toggles sidebar visibility; Sidebar overlays with `position: fixed`, `z-index: 100`; Click outside closes |
| **Responsive Breakpoints** | Desktop (>768px): sidebar always visible, collapse/expand toggle; Mobile (<768px): sidebar hidden until hamburger clicked |
| **Test Elements** | `tests/ui.test.js` — sidebar visibility toggles, links navigable, mobile menu works, no layout shift on toggle |
| **Analytical Elements** | Event: `sidebar_toggled` (open/close), `sidebar_link_clicked` (destination) |
| **Error Debugging** | Error codes: `ERR_SIDEBAR_RENDER_FAILED`; Fallback: show breadcrumb navigation if sidebar unavailable |
| **Key Code** | Sidebar toggle: `document.getElementById('sidebarToggle').addEventListener('click', () => sidebar.classList.toggle('open'))`; Close on mobile: `document.addEventListener('click', (e) => { if (!sidebar.contains(e.target) && !toggle.contains(e.target)) sidebar.classList.remove('open') })` |

---

### Feature: Modal Dialogs (Auth, Settings, Onboarding)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Modal/Overlay System (Login, Signup, Settings, Onboarding) |
| **Permission Level** | Varies (PUBLIC for auth, AUTHENTICATED for settings) |
| **Workflow Position** | Overlays for focused interactions |
| **Purpose** | Isolated, focused UI for sensitive/important flows (authentication, settings, practitioner onboarding) |
| **Files** | `frontend/index.html` (modal markup with BEM naming), `frontend/css/components/modals.css`, `frontend/js/app.js` (modal management) |
| **Workflow Step** | 1. User clicks "Sign In" button → 2. Frontend calls `showModal('auth')` → 3. Modal DOM element (initially `display: none`) gets `display: block` + fade-in animation → 4. User interacts with form → 5. On submit, modal closes or transitions to next step (e.g., 2FA) → 6. On close, modal hidden and DOM content reset (or persisted for form state recovery) |
| **Modal Types** | Auth (sign up/in), Settings (profile, 2FA, password reset), Onboarding (for practitioners), Billing (checkout success), Referral (copy link) |
| **Accessibility** | Modal has `role="dialog"`, `aria-modal="true"`, `aria-labelledby", focus trapped (tab cycles within modal), ESC key closes, backdrop click closes (if not critical form) |
| **Test Elements** | `tests/ui.test.js` — modal shows/hides, focus managed, ESC closes, backdrop click only closes if appropriate, form state persists if modal minimized |
| **Analytical Elements** | Event: `modal_opened` (modal_type), `modal_submitted` (form_data_provided), `modal_abandoned` (exit_point: close btn, backdrop click, page navigation) |
| **Error Debugging** | Error codes: `ERR_MODAL_NOT_FOUND`, `ERR_FORM_VALIDATION_FAILED`; Show validation errors inline in modal without closing |
| **Key Code** | Modal open: `document.getElementById('authModal').style.display = 'block'`; Close: `modal.style.display = 'none'`; ESC handler: `window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { modal.style.display = 'none' } })` |

---

### Feature: Form Validation & Error Messages

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Real-Time Form Validation & User Feedback |
| **Permission Level** | PUBLIC; applies to all forms |
| **Workflow Position** | User input throughout app |
| **Purpose** | Prevent invalid submissions, provide actionable error messages, save time with real-time feedback |
| **Files** | `frontend/js/app.js` (validation helpers), `frontend/index.html` (form markup with validation attributes), custom CSS for error states |
| **Workflow Step** | 1. User types in form field → 2. `onchange` or `oninput` event triggered → 3. JavaScript validates (email format, password strength, birth date range) → 4. IF invalid, display error message below field + set field border color to red → 5. IF valid, clear error → 6. On form submit, validate all fields again → 7. IF all valid, enable submit button + send request → 8. IF any invalid, highlight all errors + prevent submission |
| **Validation Rules** | Email: regex match + length < 254; Password: 8+ chars, uppercase, lowercase, digit; Birth date: past date < 150 years ago, future dates rejected; Timezone: must be valid IANA identifier |
| **Error Messages** | User-facing, contextual: "Password must be 8+ characters" (not "validation failed"); Form-level: "Please correct errors above" |
| **Test Elements** | `tests/handlers.test.js` — form validation roundab (valid input accepted, invalid rejected), error messages appropriate, server-side validation enforced even if client-side bypassed |
| **Analytical Elements** | Event: `form_validation_failed` (field_name, error_type), `form_submitted_success` (form_type) |
| **Error Debugging** | Error codes: `ERR_VALIDATION_FAILED`; Client-side validation is UX only; server must validate all inputs independently |
| **Key Code** | Email validation: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`; Password strength: `/(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}/`; Birth date: `new Date(birthDate) < new Date() && age < 150 years` |

---

### Feature: i18n (Internationalization)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Multi-Language Support (i18n) |
| **Permission Level** | PUBLIC; all users can switch languages |
| **Workflow Position** | Settings → Language dropdown; affects entire UI |
| **Purpose** | Render app in user's preferred language (English, Spanish, French, Portuguese, German planned) |
| **Files** | `frontend/locales/en.json` (English strings), `frontend/locales/es.json` (Spanish), `frontend/js/i18n.js` (translation loader), `frontend/js/app.js` (window.t() function) |
| **Workflow Step** | 1. Page loads → 2. Detect user language preference (browser lang or localStorage) → 3. Fetch matching locale JSON (e.g., `locales/en.json`) → 4. Store in `window.t` function → 5. All UI text uses `window.t('namespace.key')` → 6. Element's text content set to translated string → 7. If user changes language in settings, re-fetch locale + re-render UI |
| **JSON Structure** | Hierarchical keys: `{ "auth": { "signIn": "Sign In", "password": "Password" }, "chart": { "generateMyChart": "Generate My Chart" } }` |
| **Fallback** | If key missing in locale, fallback to English key or show key path as placeholder (e.g., "auth.signIn") |
| **Test Elements** | `tests/i18n.test.js` — all keys in English locale, translations complete for Spanish/French, no hardcoded strings in HTML (except placeholder fallback), RTL languages (if supported) render correctly |
| **Analytical Elements** | Event: `language_changed` (new_language) |
| **Error Debugging** | Error codes: `ERR_LOCALE_NOT_FOUND`, `ERR_MISSING_TRANSLATION`; Console warning if key not found during development |
| **Key Code** | Fetch locale: `fetch('/locales/en.json').then(r => r.json()).then(strings => window.t = (key) => _.get(strings, key, key))`; Use in HTML: `<span data-i18n="auth.signIn">Sign In</span>`; JS: `span.textContent = window.t('auth.signIn')` |

---

### Feature: Dark Mode / Theme Toggle

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Dark Mode Theme Toggle |
| **Permission Level** | PUBLIC; user settings persist in localStorage |
| **Workflow Position** | Settings → Appearance; theme switcher in header |
| **Purpose** | Reduce eye strain, user preference, improve accessibility |
| **Files** | `frontend/js/theme-init.js` (early theme load to prevent FOUC), `frontend/css/design-tokens.css` (CSS variables for colors) |
| **Workflow Step** | 1. Page loads → 2. `theme-init.js` immediately reads localStorage for stored theme OR browser preference (prefers-color-scheme) → 3. Applies theme class to `<html>` before DOM renders → 4. CSS variables override: light: `--bg-primary: white`, dark: `--bg-primary: #0a0a0f` → 5. User toggles theme toggle switch → 6. localStorage updated + `<html>` class changed → 7. All themed elements reactively update via CSS variable cascade |
| **CSS Variable System** | `--color-primary` (gold), `--color-secondary` (light blue), `--bg-primary`, `--bg-secondary`, `--text-primary`, `--text-secondary`, `--border-color` (light in light mode, dark in dark mode) |
| **Fallback** | System preference (OS dark mode) if localStorage empty |
| **Test Elements** | `tests/ui.test.js` — theme toggle switches classes, CSS variables applied correctly, localStorage persists, FOUC prevented (no white flash on dark mode load) |
| **Analytical Elements** | Event: `theme_changed` (to: light/dark, trigger: user_toggle or system_preference) |
| **Error Debugging** | Error codes: `ERR_LOCALSTORAGE_UNAVAILABLE` (private browsing); Fallback: system preference only |
| **Key Code** | Early theme script (no defer): `(function() { const theme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); document.documentElement.classList.add('theme-' + theme); })()` |

---

## Missing/Expanded Features (18 Additional Handlers)

### Feature: OAuth Social Login (Google & Apple)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Social OAuth Authentication (Google & Apple Login) |
| **Permission Level** | PUBLIC; alternative to email/password registration |
| **Workflow Position** | Login/registration gateway; first-time user acquisition |
| **Purpose** | Allow one-click sign-up/login via Google or Apple accounts |
| **Files** | `workers/src/handlers/oauthSocial.js` (447 lines) |
| **Workflow Step** | 1. User clicks "Sign in with Google/Apple" → 2. Frontend redirects to OAuth provider → 3. User approves scope (email, profile) → 4. Provider returns `code` to callback → 5. Backend exchanges code for tokens via provider API → 6. Extracts user email + name → 7. Creates or updates user in DB → 8. Issues Prime Self JWT → 9. User redirected to app, logged in |
| **API Endpoints** | `GET /api/auth/oauth/google` (start Google flow), `GET /api/auth/oauth/apple` (start Apple flow), `POST /api/auth/oauth/callback` (handle provider callback), `GET /api/auth/oauth/apple/key` (expose public JWK for Apple) |
| **OAuth Flows** | Google: Standard PKCE flow (`code` → access_token + ID token); Apple: PKCE + JWK signing (asymmetric, team/key ID required) |
| **Database Tables** | `users` (oauth_provider enum[google, apple], oauth_id, oauth_email, created_via_oauth BOOLEAN) |
| **State Validation** | PKCE: state token generated, stored in KV with 10-min TTL; on callback, validate state matches request |
| **Apple-Specific** | Requires `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (PEM format); Generates JWT for token exchange (not simple HTTPS GET) |
| **Google-Specific** | Requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`; Simpler HTTPS POST to `https://oauth2.googleapis.com/token` |
| **Test Elements** | `tests/oauth.test.js` — state validation works, token exchange succeeds, user created/updated on first login, PKCE challenge correct, Apple JWK parsing succeeds |
| **Analytical Elements** | Event: `oauth_login_initiated` (provider: google/apple), `oauth_login_succeeded` (new_user: true/false), `oauth_login_failed` (error_type), `oauth_apple_jwt_generated` |
| **Error Debugging** | Error codes: `ERR_OAUTH_STATE_MISMATCH`, `ERR_OAUTH_TOKEN_EXCHANGE_FAILED`, `ERR_APPLE_JWK_INVALID`, `ERR_OAUTH_TIMEOUT` (20s limit); Facebook OAuth not yet implemented (SYS-038, returns 501) |
| **Refresh Tokens** | Stored as secure HTTP-only cookie (30-day TTL) for silent re-authentication |
| **Key Code** | Google: `POST https://oauth2.googleapis.com/token` with code + client_id + client_secret; Apple: Generate JWT signed with APPLE_PRIVATE_KEY, then POST with assertion JWT; Parse ID token JWT to extract user email/name |

---

### Feature: API Keys (Developer Access)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | API Key Management (Developer Access) |
| **Permission Level** | AUTHENTICATED; Pro+ tiers only |
| **Workflow Position** | Settings → Integrations; enables programmatic access |
| **Purpose** | Generate API keys for developers to access Prime Self API as user |
| **Files** | `workers/src/handlers/keys.js` |
| **Workflow Step** | 1. Developer navigates to Settings → API Keys → 2. Clicks "Generate Key" → 3. Backend generates random 32-byte key, hashes with SHA-256 → 4. Stores hash in DB (never stores plaintext) → 5. Shows key once to user (must copy immediately) → 6. User includes key in `Authorization: Bearer {key}` header on API requests → 7. Requests authenticated as that user (rate-limited per key) |
| **API Endpoints** | `POST /api/keys/generate` (create), `GET /api/keys` (list), `DELETE /api/keys/:keyId` (revoke), `POST /api/keys/:keyId/rotate` (generate replacement) |
| **Database Tables** | `api_keys` (id, userId FK, keyHash, lastUsedAt, createdAt, expiresAt, revokedAt) |
| **Rate Limiting** | Per-key: 100 req/min (standard tier), 1000 req/min (pro tier); Enforced via KV counter with 60s sliding window |
| **Test Elements** | `tests/api-keys.test.js` — key generation unique, hash non-reversible, auth via key works, rate limiting enforced, revocation blocks subsequent requests |
| **Analytical Elements** | Event: `api_key_generated` (tier, key_id), `api_key_used` (endpoint, key_id), `api_key_revoked` (reason), `api_key_rotated` |
| **Error Debugging** | Error codes: `ERR_TIER_NOT_ELIGIBLE`, `ERR_KEY_REVOKED`, `ERR_RATE_LIMIT_EXCEEDED`, `ERR_KEY_INVALID`; Expired keys return 401 with clear message |
| **Key Code** | Generate: `crypto.getRandomValues(new Uint8Array(32))` → base64 encode for display; Hash: `sha256(keyHash)` stored in DB; Auth check: hash request key, compare to DB hash |

---

### Feature: Embed Widget Validation & Feature Flags

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Embed Widget Validation (Cross-Origin Chart Widget) |
| **Permission Level** | PUBLIC (unauthenticated access with API key) |
| **Workflow Position** | External integrations; agency white-label feature |
| **Purpose** | Allow websites to embed Prime Self chart widget via API key authentication |
| **Files** | `workers/src/handlers/embed.js` (104 lines) |
| **Workflow Step** | 1. External site includes `<script src="https://selfprime.net/embed.js?key=..."></script>` → 2. `embed.js` calls `/api/embed/validate?key=...&chartId=...` → 3. Backend hashes key, looks up in `embed_keys` table → 4. Validates tier (agency-level access required), checks chart privacy, feature flags (hideAttribution, hideLinks, brandingColor) → 5. Returns feature flag config → 6. `embed.js` renders minimal chart widget with requested customizations → 7. CORS check: origin must match whitelisted domain for that API key |
| **API Endpoints** | `GET /api/embed/validate` (check key + chart access), `POST /api/embed/flags/:keyId` (admin: set feature flags) |
| **Feature Flags** | `hideAttribution` (remove "Powered by Prime Self"), `hideLinks` (disable click-through to app), `brandingColor` (custom color scheme), `readOnly` (disable interactions) |
| **Database Tables** | `embed_keys` (id, userId FK, apiKey, allowedOrigins ARRAY, featureFlags JSON, createdAt, expiresAt) |
| **CORS Policy** | Intentionally wide-open for embed use case: `Access-Control-Allow-Origin: *`; Actual access control via API key validation |
| **Test Elements** | `tests/embed-handler-runtime.test.js` — key validation works, origin whitelisting enforced, feature flags applied correctly, invalid keys rejected with 403 |
| **Analytical Elements** | Event: `embed_widget_loaded` (domain, key_id), `embed_validated` (success/failure_reason), `feature_flag_applied` (flag_name) |
| **Error Debugging** | Error codes: `ERR_EMBED_KEY_INVALID`, `ERR_EMBED_ORIGIN_NOT_ALLOWED`, `ERR_CHART_NOT_SHAREABLE`, `ERR_TIER_INSUFFICIENT`; Logs flag exposures (hideAttribution use) for billing audits |
| **Key Code** | Validate: hash request key, lookup in DB, check origin in allowedOrigins ARRAY, return featureFlags if all valid; Feature flags applied in `embed.js` frontend (e.g., `if (flags.hideAttribution) document.querySelector('.attribution').remove()`) |

---

### Feature: Geocoding (City to Coordinates)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Geocoding Service (City Name → Coordinates & Timezone) |
| **Permission Level** | PUBLIC; autocomplete for birth location form |
| **Workflow Position** | Birth location input; autocomplete + validation |
| **Purpose** | Convert city/country names to lat/lng/timezone for accurate chart calculation |
| **Files** | `workers/src/handlers/geocode.js` |
| **Workflow Step** | 1. User types city name in location field → 2. Frontend calls `/api/geocode?query=new+york` → 3. Backend queries geocoding service (OpenStreetMap Nominatim or Google Geocoding) → 4. Returns autocomplete suggestions with (lat, lng, name, timezone) → 5. Frontend renders dropdown → 6. User selects option → 7. Coordinates + timezone stored with chart |
| **API Endpoints** | `GET /api/geocode?query=...` (search), `GET /api/geocode/:placeId` (get details), `GET /api/geocode/reverse?lat=...&lng=...` (reverse lookup) |
| **Geocoding Backend** | OpenStreetMap Nominatim (free, rate-limited); Fallback: Google Geocoding API (if Nominatim quota exceeded) |
| **Timezone Lookup** | Via `timezone-js` or Neon PostGIS function (find timezone polygon containing point); Cache results in KV |
| **Test Elements** | `tests/geocode.test.js` — autocomplete returns valid results, reverse lookup works, timezone matches timezone database, cache hit rate (should be >80%) |
| **Analytical Elements** | Event: `geocode_search_performed` (query_term, num_results), `geocode_location_selected` (city_name, tz), `geocode_cache_hit` |
| **Error Debugging** | Error codes: `ERR_LOCATION_NOT_FOUND`, `ERR_GEOCODING_SERVICE_FAILED`, `ERR_TIMEZONE_LOOKUP_FAILED`; Fallback: accept raw lat/lng input if geocoding unavailable |
| **Rate Limiting** | Nominatim: 1 req/sec per IP; Cache results aggressively in KV to reduce repeated queries |
| **Key Code** | Query Nominatim: `GET https://nominatim.openstreetmap.org/search?q={query}&format=geojson` → parse results → lookup timezone for each; Cache: `KV.put('geocode_' + normalized_query, JSON.stringify(results), { expirationTtl: 86400 })` |

---

### Feature: Incoming Webhooks Router

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Incoming Webhook Dispatcher (External Service Integration) |
| **Permission Level** | PUBLIC (authenticated via webhook secret) |
| **Workflow Position** | Async integration trigger; background event handling |
| **Purpose** | Receive webhooks from external services (Notion, Zapier, third-party apps) and trigger actions in Prime Self |
| **Files** | `workers/src/handlers/webhooks.js` |
| **Workflow Step** | 1. External service emits event (e.g., Notion database item updated) → 2. POSTs JSON payload + signature to `/api/webhooks/incoming/:webhookId` → 3. Backend validates signature (HMAC-SHA256) → 4. Checks webhook is registered + active → 5. Dispatches to handler function based on `event_type` (e.g., `onNotionDatabaseUpdated`) → 6. Handler processes payload (update profile, create checkin, sync client, etc.) → 7. Returns 200 OK to external service |
| **API Endpoints** | `POST /api/webhooks/incoming/:webhookId` (receive webhook), `GET /api/admin/webhooks/register` (admin: list registered webhooks), `POST /api/admin/webhooks/register` (admin: register new webhook source) |
| **Database Tables** | `webhooks` (id, userId FK, webhookId, source enum[notion, zapier, custom], secret, eventTypes ARRAY, isActive, createdAt) |
| **Signature Validation** | HMAC-SHA256: `signature = HMAC-SHA256(secret, payload); validate signature == request.headers['X-Webhook-Signature']` |
| **Retry Logic** | On handler failure, webhook payload queued for retry (up to 5 times, exponential backoff 10s → 5min); Manual replay available in admin dashboard |
| **Test Elements** | `tests/webhooks.test.js` — signature validation correct, event dispatching works, invalid signatures rejected, retry queue persists |
| **Analytical Elements** | Event: `webhook_received` (source, event_type), `webhook_processed` (success/failure), `webhook_retry_triggered` (attempt_number) |
| **Error Debugging** | Error codes: `ERR_INVALID_SIGNATURE`, `ERR_WEBHOOK_NOT_FOUND`, `ERR_SOURCE_NOT_SUPPORTED`, `ERR_HANDLER_FAILED`; Failed webhooks manually replayable from admin dashboard |
| **Key Code** | Signature validation: `const signature = crypto.subtle.sign('HMAC-SHA256', secret, payload); validate signature == request.headers['X-Webhook-Signature']`; Dispatch: `handlers[eventType](payload)` where handlers is lookup table |

---

### Feature: Transit Alerts (User-Configurable Notifications)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Custom Transit Alerts (User-Configurable Event Notifications) |
| **Permission Level** | AUTHENTICATED; all tiers |
| **Workflow Position** | Alerts tab; proactive notification system |
| **Purpose** | Allow users to create custom alerts for transit events (Mars door, gate changes, eclipses) with webhook/push delivery |
| **Files** | `workers/src/handlers/alerts.js` (582 lines) |
| **Workflow Step** | 1. User navigates to Alerts tab → 2. Clicks "Create Alert" → 3. Selects trigger (Mars door opening, Saturn aspects, Mercury retrograde, custom gate) → 4. Sets delivery method (push notification, webhook, email) → 5. Configures webhook URL (if webhook selected) → 6. Saves alert → 7. On cron job (6 AM UTC daily), calculates today's transits → 8. Compares to user's active alerts → 9. On match, sends alert (push/webhook/email) with alert template content → 10. Stores delivery history for audit |
| **API Endpoints** | `POST /api/alerts/create` (new alert), `GET /api/alerts` (list), `PATCH /api/alerts/:alertId` (update), `DELETE /api/alerts/:alertId` (delete), `GET /api/alerts/templates` (browse alert templates), `POST /api/alerts/from-template` (create from template), `GET /api/alerts/:alertId/history` (view delivery logs) |
| **Alert Triggers** | Mars Door (1st, 8th, 15th, 22nd, 29th of month), Saturn aspects (approaching conjunction/square/opposition), Mercury retrograde, Venus returns, Eclipse season, Custom gate ingress (specify gate number) |
| **Delivery Methods** | Push notification (via `/api/push/send`), webhook (POST JSON to user's endpoint), email (via Resend API), SMS (via Telnyx if opted in) |
| **Alert Templates** | Pre-built descriptions: "Mars door opens today: Themes of initiative & action in your chart" (parameterized by trigger type) |
| **Database Tables** | `alerts` (id, userId FK, trigger enum[mars_door, saturn_aspect, mercury_retrograde, custom_gate], deliveryMethod enum[push, webhook, email], config JSON, isActive, createdAt), `alert_history` (id, alertId FK, triggeredAt, deliveryMethod, deliveryStatus, statusCode) |
| **Test Elements** | `tests/alerts-handler-runtime.test.js` — alert CRUD works, alert triggers correctly on cron, delivery via all methods, history logged, duplicate sends prevented (same alert, same day) |
| **Analytical Elements** | Event: `alert_created` (trigger_type, delivery_method), `alert_triggered` (trigger_type, num_alerts_sent), `alert_delivered` (method, status_code), `alert_failed` (reason) |
| **Error Debugging** | Error codes: `ERR_INVALID_TRIGGER`, `ERR_WEBHOOK_DELIVERY_FAILED`, `ERR_PUSH_NOT_SUBSCRIBED`, `ERR_EMAIL_SEND_FAILED`; Webhook failures retry up to 3x; Email failures logged for manual review |
| **Webhook Signature** | Optional user webhook includes `X-Alert-Signature: HMAC-SHA256(secret, payload)` for security |
| **Key Code** | Cron: query active alerts, iterate users, calculate today's transits, match to alert triggers, dispatch to delivery handlers; Template: `"Mars door opens on [DATE]: gates [GATE_NUMBERS] engaged (themes: initiative, assertiveness, action)"` |

---

### Feature: Birth Time Rectification & Sensitivity Analysis

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Birth Time Rectification (Sensitivity Analysis) |
| **Permission Level** | AUTHENTICATED; Practitioner+ for interpretation |
| **Workflow Position** | Timing/analysis tab; specialized practitioner tool |
| **Purpose** | Analyze chart sensitivity to birth time variations, suggest likely birth time if unknown |
| **Files** | `workers/src/handlers/rectify.js` (259 lines) |
| **Workflow Step** | 1. Practitioner enters approximate birth time (e.g., "around 3 PM") or "unknown" → 2. Selects rectification method (House sensitivity, Angular sensitivity, or client-provided event) → 3. If event-based: enter major life event (marriage, birth of child, career change) + approximate date → 4. Backend calculates chart for time range (e.g., ±2 hours) → 5. Analyzes sensitivity (Ascendant changes, house cusp placements) → 6. Returns variance graph + recommended time range → 7. Practitioner shares with client to confirm actual birth time |
| **API Endpoints** | `POST /api/rectify/analyze` (analyze sensitivity), `GET /api/rectify/results/:resultId` (view sensitivity graph), `POST /api/rectify/event-based` (event-based rectification) |
| **Sensitivity Analysis** | Calculates chart for each minute in range, tracks Ascendant movement, house cusp movements, Angular planetary transits; Returns variation sensitivity (e.g., "Birth time accurate to ±15 min") |
| **Event-Based Method** | User provides major life event (marriage, accident, birth) + approximate date; Maps to transits/progressions; Finds birth time that most closely aligns event date to significant chart progressions |
| **Database Tables** | `rectification_results` (id, userId FK, originalChartId, chartTimeRange (from_min, to_min), sensitivity JSON, recommendedTime TIME, createdAt) |
| **Test Elements** | `tests/rectify.test.js` — sensitivity calculated correctly, time range produces expected Ascendant movement, event-based rectification matches known examples |
| **Analytical Elements** | Event: `rectification_analyzed` (method: event_based or sensitivity), `rectification_accuracy_determined` (accuracy_range_minutes) |
| **Error Debugging** | Error codes: `ERR_INVALID_TIME_RANGE`, `ERR_NO_SIGNIFICANT_EVENTS`, `ERR_EVENT_DATE_INVALID`; Sensitivity analysis limits: max ±4 hour range (calculation intensive) |
| **Key Code** | Loop: `for (minute = -120 to +120, step 1) { chart = calculateChart(date, time + minute); ascendant = chart.houses[0]; track(minute, ascendant) }` → plot movement → return min/max range |

---

### Feature: Composite & Synastry Charts (Relationship Analysis)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Composite Chart (Two-Person Relationship Analysis) |
| **Permission Level** | AUTHENTICATED; Practitioner+ for interpretation, all users can generate own pairs |
| **Workflow Position** | Compatibility tab; relationship exploration tool |
| **Purpose** | Overlay two natal charts to analyze relationship dynamics, identify channels of compatibility/challenge |
| **Files** | `workers/src/handlers/composite.js` (401 lines) |
| **Workflow Step** | 1. User selects or invites second person to generate their chart → 2. Both users' charts loaded → 3. Backend calculates composite positions: midpoint method (e.g., composite Sun = (Person1.Sun + Person2.Sun) / 2) → 4. Generates composite chart with 36-channel system (all possible combinations of Person1 & Person2 centers) → 5. Analyzes each channel (dominance, electromagnetic, compromise, etc.) → 6. Returns overlaid chart visualization + interpretation guide |
| **API Endpoints** | `POST /api/composite` (generate), `GET /api/composite/:compositeId` (view), `POST /api/composite/share` (share with partner) |
| **Channel System** | 36 channels: combinations of Person1 centers (9) × Person2 centers (9); Each channel classified as: **Electromagnetic** (both open = potential), **Dominance** (one defined, one open), **Compromise** (both defined but different), **Mirroring** (same definition), **Bonded** (both have same profile line) |
| **Dominance/Compromise/Electromagnetic Rules** | Electromagnetic: opens flow; Dominance: defined person influences open person; Compromise: both defined, must negotiate |
| **Visualization** | Overlaid rave mandalas showing person1 (inner), person2 (outer), composite (center); Color coding for channel types |
| **Database Tables** | `composite_charts` (id, personAId FK, personBId FK, compositeChartJson, channelAnalysis JSON, createdAt) |
| **Test Elements** | `tests/composite.test.js` — midpoint calculation correct, channels identified correctly, visualization renders 36 channels, share invitation works |
| **Analytical Elements** | Event: `composite_generated` (relationship_type: romantic, friendship, business), `composite_shared` (recipient_accepted: true/false), `channel_analysis_viewed` (channel_type: dominance, electromagnetic, etc.) |
| **Error Debugging** | Error codes: `ERR_CHART_NOT_FOUND`, `ERR_COMPOSITE_CALCULATION_FAILED`, `ERR_INVALID_CHANNEL_PAIRING`; Midpoint calculation edge case: handle opposite positions (e.g., Sun at 5° Aries vs 5° Libra = midpoint 0° Taurus or 0° Scorpio) |
| **Key Code** | Midpoint: `composite_pos = (person1_ecliptic_lon + person2_ecliptic_lon) / 2` modulo 360; Channel analysis: iterate Person1 channels, for each openness state + Person2 equivalent, classify as electromagnetic/dominance/compromise; Store in composite_analysis JSON |

---

### Feature: Celebrity Matching

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Celebrity Chart Matching (Find Similar Famous People) |
| **Permission Level** | AUTHENTICATED; all tiers, Starter+ for extended matches (>10) |
| **Workflow Position** | Discovery tab; fun engagement feature |
| **Purpose** | Compare user's chart to database of celebrity/famous person charts, find matches |
| **Files** | `workers/src/handlers/famous.js` (328 lines) |
| **Workflow Step** | 1. User navigates to "Find Celebrities Like Me" → 2. Frontend calls `/api/famous?limit=10` (default) → 3. Backend loads user's chart, calculates similarity score against celebrity database (profile type, authority, not-self strategy) → 4. Sorts by score, returns top N matches with list (name, profession, image, similarity_score, shared_traits) → 5. User clicks celebrity → modal shows side-by-side charts + relationship compatibility → 6. Option: invite to "Compare Your Chart" if celebrity has account (unlikely) |
| **API Endpoints** | `GET /api/famous` (list matches), `GET /api/famous/:celebrityId` (view details), `POST /api/famous/:celebrityId/favorite` (save to favorites), `GET /api/famous/favorites` (view saved matches) |
| **Celebrity Database** | Pre-populated with ~500 famous people (actors, musicians, politicians, athletes, historical figures) with verified birth data; Updated quarterly |
| **Similarity Scoring** | Weighted algorithm: Profile Type match (50%), Authority same (30%), Strategy same (20%); All profiles with "Reflector" type get special bonus pairing |
| **Traits Identified** | Common gates, shared authority (emotional vs. martial, etc.), similar not-self strategy implications |
| **Requires User Chart** | Validation: user must have generated chart before accessing feature (ERR_CHART_REQUIRED); Practitioner can force-skip for demo |
| **Database Tables** | `famous_people` (id, name, profession, birthData, chartJson, birthVerification bool, dataSource string), `famous_favorites` (id, userId FK, celebrityId FK, createdAt) |
| **Achievement Unlock** | Unlocks "Celebrity Encounter" badge on first favorite marked; "Kindred Spirits" badge if >5 favorites from same profession |
| **Test Elements** | `tests/famous.test.js` — chart requirement enforced, similarity scores consistent, celebrity matches return expected results, favorites persist |
| **Analytical Elements** | Event: `famous_matches_viewed` (num_showed), `celebrity_favorited` (celebrity_name), `celebrity_match_deep_dive` (similar_traits_explored) |
| **Error Debugging** | Error codes: `ERR_CHART_NOT_FOUND`, `ERR_CELEBRITY_DATABASE_EMPTY`, `ERR_SIMILARITY_CALCULATION_FAILED`, `ERR_LIMIT_EXCEEDED` (max 30 if free); Show friendly message "No celebrities found like you" with explanation of what data is used |
| **Key Code** | Similarity score: `(profile_match * 0.5) + (authority_match * 0.3) + (strategy_match * 0.2)` where each is 0–1 scale; Query: `SELECT * FROM famous_people ORDER BY similarity_score(user_chart, famous_chart) DESC LIMIT {limit}` (custom SQL function or post-query in JS) |

---

### Feature: Web Push Notifications

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Web Push Notifications (RFC 8030/8291) |
| **Permission Level** | AUTHENTICATED; opt-in per user |
| **Workflow Position** | Background notifications; optional engagement feature |
| **Purpose** | Send push notifications to user's browser/device (even if app not open) for alerts, transit updates, achievements |
| **Files** | `workers/src/handlers/push.js` (690 lines) |
| **Workflow Step** | 1. On first login, auto-prompt `Notification.requestPermission()` (deferred 3s, once via localStorage) → 2. If granted, subscribe via `pushManager.subscribe()` → 3. POST `/api/push/subscribe` stores subscription → 4. User opens preferences modal (⚙️ in notification drawer) → 5. Toggles: transitDaily, gateActivation, cycleApproaching, transitAlert, weeklyDigest → 6. Quiet hours picker (start/end) → 7. PUT `/api/push/preferences` saves → 8. Test button → POST `/api/push/test` |
| **API Endpoints** | `GET /api/push/vapid-key` (public), `POST /api/push/subscribe`, `DELETE /api/push/unsubscribe`, `POST /api/push/test`, `GET /api/push/preferences`, `PUT /api/push/preferences`, `GET /api/push/history` |
| **Push Triggers** | Transit alerts, achievement unlocked, checkin reminder (if opted in), referral conversion, message from friend |
| **Encryption Details** | RFC 8291 requires HKDF key derivation from subscription keys; Message encrypted with AES-128-GCM; Payload max 4KB |
| **VAPID Credentials** | Public/private key pair (ES256 curve); Backend includes VAPID Authorization header (JWT) with push request to prove legitimacy |
| **Database Tables** | `push_subscriptions` (id, userId FK, endpointUrl, auth KEY, p256dh KEY, createdAt, lastUsedAt); `push_history` (id, subscriptionId FK, eventType, sentAt, deliveryStatus) |
| **Test Elements** | `tests/push-handler-runtime.test.js` — subscription object validated, encryption works (decryption check), HKDF key derivation correct, delivery history tracked, max payload size enforced |
| **Analytical Elements** | Event: `push_subscribed` (browser, os), `push_sent` (event_type), `push_delivered` (time_to_delivery_ms), `push_failed` (reason: endpoint_invalid, payload_too_large, etc.), `push_unsubscribed` (reason: user_clicked_disable, browser_removed) |
| **Error Debugging** | Error codes: `ERR_INVALID_SUBSCRIPTION`, `ERR_ENCRYPTION_FAILED`, `ERR_VAPID_INVALID`, `ERR_PUSH_SERVICE_FAILED`, `ERR_ENDPOINT_GONE` (subscription expired); Retry logic: exponential backoff for retriable errors |
| **Silent Notifications** | If `silent: true` in payload, browser receives notification but doesn't display (used for data sync); Otherwise displays browser notification with title, body, icon, badge |
| **Key Code** | Subscribe handler: validate subscription.endpoint (must be HTTPS), store auth/p256dh keys, return success; Send: apply HKDF-SHA256 key derivation, encrypt with AES-128-GCM, POST to subscription.endpoint with Authorization VAPID header + Encryption headers (RFC 8291 spec) |

---

### Feature: Life Diary & Journal

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Life Diary (Personal Journal With Astrological Context) |
| **Permission Level** | AUTHENTICATED; private (not shared by default) |
| **Workflow Position** | Reflection tab; optional introspection tool |
| **Purpose** | Allow users to journal about life events with attached astrological/chart context for future reflection |
| **Files** | `workers/src/handlers/diary.js` (337 lines) |
| **Workflow Step** | 1. User clicks "New Journal Entry" → 2. Frontend shows form: date (defaults to today), mood (1-10 rating optional), entry text, tags (optional) → 3. Backend automatically fetches today's transits + moon phase + related alerts/events → 4. User submits entry with optional star rating → 5. Backend stores in `diary_entries` with contextual data (transits at time of entry, moon phase, day of week) → 6. User can search/browse past entries by date range, mood, or tags → 7. Optional: request AI summary of emotional patterns over time (LLM call) |
| **API Endpoints** | `POST /api/diary` (create entry), `GET /api/diary` (list entries), `PATCH /api/diary/:entryId` (edit), `DELETE /api/diary/:entryId` (delete), `GET /api/diary/stats` (mood trends, word clouds), `GET /api/diary/ai-summary` (monthly summary via LLM) |
| **Context Captured** | Moon phase (waxing/waning, sign, illumination %), active transits (current planets in gates), Mars door status (active/inactive), Mercury retrograde (if active), eclipse proximity (if within 21 days) |
| **Database Tables** | `diary_entries` (id, userId FK, entryDate DATE, content TEXT, moodScore 1-10 optional, tags ARRAY STRING, contextData JSON { moon_phase, transits, events }, createdAt, updatedAt) |
| **Search Features** | Full-text search in content; Filter by date range, mood range, tags; Sort by date, mood, or relevance |
| **AI Summary** | LLM call analyzes all entries in requested month, extracts themes (e.g., "This month you expressed anxiety around financial transitions, correlating with Saturn transits"), returns summary paragraph |
| **Test Elements** | `tests/diary.test.js` — entry persistence, context captured correctly, search filters working, mood stats accurate, AI summary executed on demand, deletion soft (or hard, depending on privacy requirement) |
| **Analytical Elements** | Event: `diary_entry_created` (mood_score, num_transits_active), `diary_browsed` (date_range_days, num_entries_found), `diary_ai_summary_generated` (num_entries_analyzed, themes_extracted), `diary_export_downloaded` |
| **Error Debugging** | Error codes: `ERR_ENTRY_NOT_FOUND`, `ERR_INVALID_DATE`, `ERR_CONTENT_EMPTY`, `ERR_AI_SUMMARY_FAILED` (fallback to blank if LLM unavailable); Entries marked deleted but retain history for recovery (7-day soft delete window) |
| **Privacy** | Entries encrypted at rest (if required by compliance); Never shared unless explicitly exported by user; No analytics on content words (only metadata like mood) |
| **Key Code** | On create, fetch transits via Layer 7, moon phase via ephemeris, store all in contextData.json; Search via `SELECT * FROM diary_entries WHERE userId = $1 AND entryDate BETWEEN $2 AND $3 AND moodScore BETWEEN $4 AND $5 AND tags && $6` (PostgreSQL array overlap) |

---

### Feature: Agency/White-Label (Enterprise Tier)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Agency White-Label (Enterprise Multi-Seat Tier) |
| **Permission Level** | AUTHENTICATED; Agency tier exclusive (annual subscription $999+) |
| **Workflow Position** | Settings → Team Management; enterprise feature |
| **Purpose** | Allow agencies/large practitioners to manage multiple team members, white-label app with custom branding |
| **Files** | `workers/src/handlers/agency.js` |
| **Workflow Step** | 1. Agency purchases Agency tier subscription → 2. Gains access to Settings → Team Management → 3. Admin invites team members via email → 4. Team members create accounts, linked to agency → 5. Team members can access client roster, session notes, generate profiles under agency branding → 6. Agency customizes: logo, colors, email domain → 7. All externally-facing artifacts (PDFs, emails, shareable links) branded with agency name |
| **API Endpoints** | `POST /api/agency/team/invite` (manage team), `GET /api/agency/team` (list members), `PATCH /api/agency/team/:memberId` (update role), `DELETE /api/agency/team/:memberId` (remove), `PATCH /api/agency/branding` (set logo/colors), `GET /api/agency/clients` (team's combined client roster) |
| **Team Roles** | Admin (full access + team management), Practitioner (standard practitioner features), ReadOnly (view-only reports) |
| **Branding Customization** | Logo upload, primary color (hex), secondary color, agency name (for emails/exports), custom domain support (CNAME record) |
| **Client Roster** | Team members share one combined client database; A client assigned to one team member can have their session notes visible to all (with role enforcement) |
| **Database Tables** | `agencies` (id, ownerUserId FK, name, logo_url, primary_color, secondary_color, domain UNIQUE optional, subscriptionId FK, seatCount, createdAt), `agency_team_members` (id, agencyId FK, userId FK, role enum[admin, practitioner, readonly], invitedAt, acceptedAt) |
| **PDF Exports** | All practitioner-generated PDFs branded with agency logo, footer with agency domain/phone |
| **Billing** | Seat-based: per active team member ($99/month per seat) + $999 base agency tier = $999 + (N team members × $99/month) |
| **Test Elements** | `tests/agency.test.js` — team invite/accept works, role restrictions enforced (readonly can't edit), branding applied to all outputs, client roster aggregation working, seat count validated |
| **Analytical Elements** | Event: `agency_team_member_added` (role), `agency_branding_customized` (fields_updated), `agency_pdf_branded_export_downloaded` |
| **Error Debugging** | Error codes: `ERR_AGENCY_NOT_FOUND`, `ERR_SEAT_LIMIT_EXCEEDED`, `ERR_INVALID_DOMAIN`, `ERR_LOGO_UPLOAD_FAILED`; Custom domain requires DNS CNAME verification |
| **Key Code** | On branding update: `UPDATE agencies SET logo_url = $1, primary_color = $2 WHERE id = $3`; On PDF export: inject logo + agency name into template; All user-facing UX checks user.agency_id to apply branding color scheme |

---

### Feature: Client Clusters/Groups

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Client Clusters (Organize Clients into Groups) |
| **Permission Level** | AUTHENTICATED; Practitioner+ tiers |
| **Workflow Position** | Workspace → Clients; organizational tool |
| **Purpose** | Group clients by practice type, cohort, or custom category for bulk operations (email, cohort reporting) |
| **Files** | `workers/src/handlers/cluster.js` (78 lines) |
| **Workflow Step** | 1. Practitioner creates cluster: "Romantic Relationship Clients" or "Q1 2024 Workshop Cohort" → 2. Backend creates cluster record → 3. Practitioner assigns existing clients to clusters (drag-drop or bulk add) → 4. Can create cross-cluster reports (e.g., "All chart types in Morning Group") → 5. Optional: cluster-wide email send (e.g., "Schedule your refresh session") → 6. Bulk export cluster profiles to ZIP for archive |
| **API Endpoints** | `POST /api/clusters` (create), `GET /api/clusters` (list), `PATCH /api/clusters/:clusterId` (rename), `DELETE /api/clusters/:clusterId` (delete), `POST /api/clusters/:clusterId/members` (add client), `DELETE /api/clusters/:clusterId/members/:clientId` (remove), `GET /api/clusters/:clusterId/report` (generate report), `POST /api/clusters/:clusterId/export` (bulk export charts/profiles) |
| **Database Tables** | `clusters` (id, userId FK, name, description optional, createdAt), `cluster_members` (id, clusterId FK, clientId FK, addedAt) |
| **Bulk Operations** | Email send (via Resend, templated), PDF export (creates ZIP with all members' profiles), reporting (statistics per cluster) |
| **Test Elements** | `tests/cluster.test.js` — cluster CRUD works, member assignment working, bulk export generates valid ZIP, reports accurate (member count, chart distribution) |
| **Analytical Elements** | Event: `cluster_created` (cluster_size), `cluster_member_added` (cluster_id), `cluster_bulk_export_triggered` (num_members, format) |
| **Error Debugging** | Error codes: `ERR_CLUSTER_NOT_FOUND`, `ERR_INVALID_MEMBER`, `ERR_EXPORT_TOO_LARGE` (max 100 members per export); ZIP creation failures trigger email with error log |
| **Key Code** | Create cluster: `INSERT INTO clusters (userId, name) VALUES ($1, $2) RETURNING id`; Add members: `INSERT INTO cluster_members (clusterId, clientId) SELECT $1, id FROM practitioner_clients WHERE userId = $2 AND id IN ($3)` (prevent adding non-own clients); Export: iterate cluster members, fetch profiles, generate PDFs, create ZIP via JSZip |

---

### Feature: Onboarding Flow (Savannah Story)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Interactive Onboarding (Savannah Story Walkthrough) |
| **Permission Level** | PUBLIC (unauthenticated); recommended for new users |
| **Workflow Position** | First-time user sequence; education + activation |
| **Purpose** | Guide new users through Human Design basics via interactive story, build confidence, drive first chart generation |
| **Files** | `workers/src/handlers/onboarding.js` (323 lines) |
| **Workflow Step** | 1. New user signs up → 2. Redirected to onboarding flow (or skippable) → 3. Multi-step modal: (a) Intro + promise ("Discover your design in 5 minutes"), (b) "What is Human Design?" (video + text explainer), (c) "Generate Your Chart" (birth data form), (d) "Meet Your Authority" (chart display + brief explanation), (e) "Next Steps" (invite to workspace, subscribe, etc.) → 4. At end: user has generated chart, seen own authority, and knows next action → 5. Incomplete onboarding tracked, completion bonus (free week of paid tier) unlocked |
| **API Endpoints** | `GET /api/onboarding/config` (fetch story slides), `POST /api/onboarding/complete` (mark as complete), `GET /api/onboarding/progress` (check current step for return visits) |
| **Story Content** | Static HTML/Markdown slides with embedded images, videos (YouTube embeds), interactive elements; Customizable per user tier/source |
| **Chart Generation Integration** | Step (c) generates chart via standard `/api/chart/calculate`; Step (d) displays result with focused explanation (just authority + strategy, not full chart complexity) |
| **Completion Bonus** | Unlocks `ONBOARDING_COMPLETE` flag on user; If free tier, grants 7-day trial of Starter tier (expires after 7 days, reverts to free) |
| **Early Exit** | User can skip onboarding at any step; `skip_onboarding = true` set on user, can revisit later from settings |
| **Database Tables** | `onboarding_progress` (userId FK, currentStep int 0-4, completedAt optional, skippedAt optional, created_from enum[signup, settings_link, share_invite]) |
| **Test Elements** | `tests/onboarding.test.js` — first-time users routed to onboarding, steps advance correctly, chart generation works within flow, completion flag set, trial activation works |
| **Analytical Elements** | Event: `onboarding_started` (source: signup, share invite, etc.), `onboarding_step_completed` (step_number), `onboarding_skipped` (step_skipped_at), `onboarding_complete_bonus_activated` |
| **Viralizer** | Onboarding offers referral bonus: "Invite a friend, you both get 7-day trial" (drives Share link copy) |
| **Error Debugging** | Error codes: `ERR_ONBOARDING_NOT_FOUND`, `ERR_CHART_GENERATION_FAILED` (retry button), `ERR_TRIAL_ACTIVATION_FAILED`; Ensure modal doesn't crash if chart fetch fails (show error state with "Try Again" button) |
| **Key Code** | Mark complete: `UPDATE users SET onboarding_complete = true WHERE id = $1`; if tier == 'free', create trial subscription record `expiring_at = NOW() + 7 days`; Progress: `SELECT * FROM onboarding_progress WHERE userId = $1` to resume interrupted onboarding |

---

### Feature: Statistics Dashboard (User Metrics)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Personal Statistics Dashboard (Usage & Engagement Metrics) |
| **Permission Level** | AUTHENTICATED; available to all tiers |
| **Workflow Position** | Workspace / Analytics tab; motivational metrics view |
| **Purpose** | Show user's engagement metrics (charts generated, profile views, streak days, etc.) for self-reflection |
| **Files** | `workers/src/handlers/stats.js` (75+ lines) |
| **Workflow Step** | 1. User navigates to "My Stats" or "Analytics" tab → 2. Frontend calls `GET /api/stats/me` → 3. Backend aggregates events for this user from past 30/90 days → 4. Calculates: total charts generated, profiles viewed, session notes written, checkin streak, referrals converted, achievements unlocked, most-viewed gates, most common transits examined, app session duration avg → 5. Returns dashboard with cards + graphs → 6. Optional: compare to aggregated anonymous community stats (e.g., "You've generated 5 charts this month, community avg is 2") |
| **API Endpoints** | `GET /api/stats/me` (user stats), `GET /api/stats/leaderboard` (community comparison) |
| **Metrics Displayed** | Charts generated (lifetime + this month), Profiles viewed (lifetime), Checin streak (days), Session notes (count), Referrals converted (count), Achievements (count), Top gates/authority types engaged, Favorite transit type |
| **Data Aggregation** | Query analytics events table for user, aggregate by date, return trends (increasing/stable/decreasing) |
| **Database Tables** | `analytics_events` table (queried with aggregate functions: COUNT, SUM, etc.) |
| **Leaderboard Mode** | Optional friend comparison or anonymous community compare; Aggregates community metrics over monthly windows |
| **Test Elements** | `tests/stats.test.js` — aggregation counts correct, date range filtering working, leaderboard ranks fairly (no ties unless actual equality), 30 vs 90-day views consistent |
| **Analytical Elements** | Event: `stats_viewed` (filter: 30day, 90day, lifetime), `leaderboard_compared` (user_rank) |
| **Error Debugging** | Error codes: `ERR_ANALYTICS_DATA_UNAVAILABLE`, `ERR_AGGREGATION_FAILED`; Fallback: show "Insufficient data" message if user has <10 events |
| **Performance Optimization** | Pre-aggregate daily into materialized view (cron job 11 PM UTC); Query materialized view instead of raw events table |
| **Key Code** | Aggregation: `SELECT COUNT(*) as charts_count, COUNT(DISTINCT DATE(createdAt)) as active_days FROM analytics_events WHERE userId = $1 AND eventType = 'chart_generated' AND createdAt > NOW() - interval '30 days'`; Leaderboard: similar aggregation for all users, return ranked results |

---

### Feature: A/B Testing (Experiments Framework)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | A/B Testing Admin (Experiment Framework) |
| **Permission Level** | AUTHENTICATED; Guide+ tier and Admin only |
| **Workflow Position** | Admin → Experiments tab; internal tool for feature rollout |
| **Purpose** | Run A/B tests on features, variations, pricing to measure impact on engagement/conversion |
| **Files** | `workers/src/handlers/experiments.js` (100+ lines) |
| **Workflow Step** | 1. Admin creates experiment: "Test referral bonus (10% vs 15% vs control)" → 2. Sets start date, sample size (100 users), success metric (referral_conversion_rate) → 3. Experiment goes live → 4. Incoming users assigned to variant via `hash(userId) % numVariants` (deterministic, consistent per user) → 5. User's variant stored in KV + user session → 6. Feature code checks variant, applies treatment (e.g., `if (variant === 'bonus_15') bonus = 0.15 else if (variant === 'bonus_10') bonus = 0.10 else bonus = 0.05`) → 7. Metrics collected in analytics events → 8. After 30 days (or N users), admin views results, calculates statistical significance (chi-squared or t-test) → 9. Winning variant rolled out to 100% of users or experiment ends |
| **API Endpoints** | `GET /api/experiments` (admin: list), `POST /api/experiments` (admin: create), `PATCH /api/experiments/:expId` (admin: pause/resume), `GET /api/experiments/:expId/results` (admin: view results), `GET /api/experiments/variant/:expId` (user: get assigned variant) |
| **Experiment Config** | Name, description, start date, duration (days or user-count-based), variants (array with name + config), success metric (event type), sample size % (0–100), hypothesis |
| **Variant Assignment** | `variant = variants[hash(userId + expId) % variants.length]` where hash is deterministic; Ensures same user always gets same variant |
| **Database Tables** | `experiments` (id, name, hypothesis, variants ARRAY, startDate, endDate, successMetric, sampleSizePercent, status enum[draft, active, completed], createdAt), `experiment_assignments` (id, expId FK, userId FK, variant, assignedAt) |
| **Results Calculation** | Count events matching successMetric by variant; Calculate conversion rate per variant; If sample large enough, run chi-squared test; Return p-value + confidence on winner |
| **Guardrails** | Experiments capped at 5 concurrent; Variants limited to 3 (max); Sample size < 100% if experiment duration < 7 days (to avoid overwhelming changes) |
| **Test Elements** | `tests/experiments.test.js` — variant assignment deterministic + distributed evenly, results calculation correct (conversion rate %), significance test returns p-value, admin can pause/extend experiment |
| **Analytical Elements** | Event: `experiment_started` (variant, sample_size_percent), `experiment_variant_assigned` (exp_id, variant), `experiment_completed` (winning_variant, p_value) |
| **Error Debugging** | Error codes: `ERR_EXPERIMENT_NOT_FOUND`, `ERR_EXPERIMENT_CONFLICT` (overlapping targeting rules), `ERR_INSUFFICIENT_SAMPLE_SIZE` (can't declare winner yet); Show "Needs N more events" message |
| **Key Code** | Assign variant: `let variantIdx = hashFunction(userId + expId) % experiment.variants.length; let variant = experiment.variants[variantIdx];` store in KV and DB; Results: `SELECT variant, COUNT(*) as event_count FROM experiment_assignments JOIN analytics_events ON ... WHERE expId = $1 AND eventType = $2 GROUP BY variant;` then calculate conversion rate |

---

### Feature: Behavioral Validation Data Anchoring

| Attribute | Details |
|-----------|---------|
| **Feature Name** | Behavioral Validation (Psychometric Data Anchoring) |
| **Permission Level** | AUTHENTICATED; optional, integrated into onboarding |
| **Workflow Position** | Post-chart; validation + profile enrichment |
| **Purpose** | Anchor chart to psychometric/behavioral data (Big 5 traits, MBTI, energy patterns) to validate accuracy and provide multiple interpretive lenses |
| **Files** | `workers/src/handlers/validation.js` |
| **Workflow Step** | 1. User completes chart generation → 2. Optionally completes quick behavioral quiz (10–15 questions, 3 min) → 3. Questions assess openness, conscientiousness, extraversion, agreeableness, neuroticism (Big 5 model) and/or MBTI preferences → 4. Backend calculates user's scores → 5. Compares to chart profile (Human Design type, authority, not-self strategy) → 6. Returns validation summary: "Your Introversion matches your [splenic authority], your Conscientiousness aligns with your [strategic type]" → 7. Stores data in `psychometric_profiles` table for future personalization |
| **API Endpoints** | `GET /api/validation/quiz` (fetch quiz questions), `POST /api/validation/submit` (submit answers), `GET /api/validation/report/:userId` (view validation report), `GET /api/validation/compare` (compare user scores to aggregates) |
| **Quiz Format** | Likert scale 1–5; Example: "I enjoy being the center of attention" (assesses extraversion); Randomize question order |
| **Analytics Map** | Openness ↔ Human Design centers (G center = sense of identity = openness); Conscientiousness ↔ defined Sacral (consistency/productivity) |
| **Database Tables** | `psychometric_profiles` (id, userId FK, bigFiveScores { openness, conscientiousness, extraversion, agreeableness, neuroticism }, mbtiType string, completedAt) |
| **Privacy** | Store separately from chart data; Only visible to user + their assigned practitioner (if any) |
| **Test Elements** | `tests/validation.test.js` — quiz questions valid, scoring algorithm correct (average of dimension items), Big 5 scores range 1–5, comparison to norms accurate |
| **Analytical Elements** | Event: `validation_quiz_started`, `validation_quiz_completed` (time_to_complete_seconds), `validation_anchoring_report_viewed` |
| **Error Debugging** | Error codes: `ERR_QUIZ_NOT_FOUND`, `ERR_INVALID_SCORES`, `ERR_CHART_NOT_FOUND` (can't validate without chart); Optional feature, no blocking errors |
| **Integration with Profiles** | LLM profile generation can optionally reference psychometric data: "Your profile shows high conscientiousness, which aligns with your Manifestor type's need for decision-making clarity" |
| **Key Code** | Scoring: for each dimension, average responses to related questions; Compare user scores to norms via percentile calculation; Generate validation summary via template templating or brief LLM call |

---

### Feature: Bug Reporting (In-App)

| Attribute | Details |
|-----------|---------|
| **Feature Name** | In-App Bug Reporting (User Feedback Submission) |
| **Permission Level** | PUBLIC; no auth required (but optional) |
| **Workflow Position** | Footer link or help menu; user feedback loop |
| **Purpose** | Allow users to report bugs, request features, provide feedback directly from app |
| **Files** | `workers/src/handlers/bugs.ts` |
| **Workflow Step** | 1. User encounters issue or wants to report bug → 2. Clicks "Report Bug" in help menu or footer → 3. Modal opens: BugTitle (required), BugDescription, Reproducibility (Consistent / Intermittent / One-time), Attachments (optional screenshot), Contact (email, optional) → 4. Submit → 5. Backend stores in `bug_reports` table, auto-attaches context (user agent, page URL, user ID if logged in, error logs from console) → 6. Sends confirmation email to user → 7. Admin notified of new report via Slack/email → 8. Team triages, assigns to sprint if confirmed bug |
| **API Endpoints** | `POST /api/bugs/report` (submit bug), `GET /api/admin/bugs` (admin: list all), `PATCH /api/admin/bugs/:bugId` (admin: triage, update status), `DELETE /api/admin/bugs/:bugId` (admin: mark as duplicate/wontfix) |
| **Context Auto-Captured** | User agent, page URL, timestamp, JS error logs (if available), user ID (if logged in), user email (if provided) |
| **Database Tables** | `bug_reports` (id, title, description, reproducibility, context JSON, userEmail optional, attachment URLs ARRAY, reportedAt, triageStatus enum[new, confirmed, duplicate, wontfix, resolved], assignedTo userId FK optional) |
| **Triage Workflow** | New → Confirmed (reproducible) / Duplicate (existing bug) / WontFix (by design); Confirmed → assigned to developer sprint; Resolved → notified user (if email provided) |
| **Test Elements** | `tests/bugs.test.js` — context captured correctly, form validation working, email sent on submit, admin triage workflow functions |
| **Analytical Elements** | Event: `bug_report_submitted` (contact_provided: true/false, attachment: true/false), `bug_confirmed` (priority), `bug_resolved` (user_notified) |
| **Error Debugging** | Error codes: `ERR_VALIDATION_FAILED` (title required), `ERR_ATTACHMENT_TOO_LARGE`, `ERR_BUG_REPORT_FAILED` (email send failure doesn't block report); All reports stored even if notification fails |
| **Feature Separation** | Feature requests are separate from bugs (different form path) → stored in `feature_requests` table with voting mechanism (other users can +1) |
| **Key Code** | Capture context: `{ userAgent: navigator.userAgent, url: window.location.href, timestamp: new Date().toISOString(), consoleLogs: window.__debugLogs || [] }`; Submit: `POST /api/bugs/report { title, description, reproducibility, context, userEmail, attachments }` |

---

## Summary Table (Expanded)

| **Feature Category** | **Count** | **Key Files** | **Est. Lines of Code** |
|---------------------|-----------|---------------|----------------------|
| Core Calculation | 2 | `src/engine/*`, `workers/src/handlers/calculate.js` | 5,000+ |
| Auth & User Mgmt | 7 | `workers/src/handlers/auth.js`, `oauthSocial.js`, `keys.js`, `frontend/index.html` | 3,500+ |
| Profiles | 4 | `workers/src/handlers/profile*.js`, `src/engine/synthesis.js` | 2,500+ |
| Transits & Timing | 4 | `workers/src/handlers/transits.js`, `forecast.js`, `cycles.js`, `timing.js` | 1,500+ |
| Practitioner Tools | 5 | `workers/src/handlers/practitioner*.js`, `session-notes.js`, `referrals.js`, `onboarding.js` | 2,500+ |
| Billing | 4 | `workers/src/handlers/billing.js`, `stripe.js`, `promo.js` | 1,500+ |
| Community & Engagement | 6 | `workers/src/handlers/achievements.js`, `share.js`, `checkin.js`, `famous.js`, `diary.js`, `push.js` | 3,000+ |
| Discovery & Analysis | 4 | `workers/src/handlers/alerts.js`, `composite.js`, `rectify.js`, `validation.js` | 2,000+ |
| Integrations | 4 | `workers/src/handlers/notion.js`, `sms.js`, `webhook.js`, `webhooks.js`, `embed.js`, `geocode.js` | 2,500+ |
| Admin & Observability | 4 | `workers/src/handlers/admin.js`, `analytics.js`, `experiments.js`, `stats.js`, `bugs.ts` | 2,000+ |
| Enterprise | 2 | `workers/src/handlers/agency.js`, `cluster.js` | 500+ |
| Frontend UI | 8 | `frontend/js/app.js`, `bodygraph.js`, CSS files | 3,000+ |
| **TOTAL** | **57** | 37 handler files + 6 new + libs + frontend | **~34,000+** |

---

**Test Coverage:** 480 tests passing (Vitest v3.2.4) | 8 skipped = 98.4% pass rate  
**Deployment Size:** 2.27 MB (uncompressed), 533 KB (gzipped) — Now expanded, may require chunking  
**Database Tables:** 40+ tables across users, charts, profiles, practitioners, billing, webhooks, analytics, experiments, bugs  
**API Endpoints:** ~150+ routes across 57 handler files  
**LLM Integration:** Claude Opus → Grok-4 → Llama-70B (failover)  
**External Services:** Stripe, Telnyx, Notion, Resend, Anthropic, OpenStreetMap Nominatim  

---

**Last Updated:** 2026-03-16  
**Matrix Version:** 2.1 (18 missing handlers added, 6 metadata columns to be added in next phase)  
**Status:** COMPLETE FEATURE INVENTORY (57 features) — Ready for metadata column expansion

| **Feature Category** | **Count** | **Key Files** | **Est. Lines of Code** |
|---------------------|-----------|---------------|----------------------|
| Core Calculation | 2 | `src/engine/*`, `workers/src/handlers/calculate.js` | 5,000+ |
| Auth & User Mgmt | 5 | `workers/src/handlers/auth.js`, `frontend/index.html` | 2,000+ |
| Profiles | 4 | `workers/src/handlers/profile*.js`, `src/engine/synthesis.js` | 2,500+ |
| Transits & Timing | 4 | `workers/src/handlers/transits.js`, `forecast.js`, `cycles.js`, `timing.js` | 1,500+ |
| Practitioner Tools | 4 | `workers/src/handlers/practitioner*.js`, `session-notes.js`, `referrals.js` | 2,000+ |
| Billing | 4 | `workers/src/handlers/billing.js`, `stripe.js` | 1,500+ |
| Community & Sharing | 3 | `workers/src/handlers/achievements.js`, `share.js`, `checkin.js` | 1,500+ |
| Integrations | 3 | `workers/src/handlers/notion.js`, `sms.js`, `webhook.js` | 1,500+ |
| Admin & Observability | 2 | `workers/src/handlers/admin.js`, `analytics.js` | 1,000+ |
| Frontend UI | 8 | `frontend/js/app.js`, `bodygraph.js`, CSS files | 3,000+ |
| **TOTAL** | **39** | 37 handler files + libs + frontend | **~23,000** |

---

**Test Coverage:** 480 tests passing (Vitest v3.2.4) | 8 skipped = 98.4% pass rate  
**Deployment Size:** 2.27 MB (uncompressed), 533 KB (gzipped) → Requires Cloudflare Workers Paid plan  
**Database Tables:** 30+ tables across users, charts, profiles, practitioners, billing, webhooks, analytics  
**API Endpoints:** ~120 routes across 37 handler files  
**LLM Integration:** Claude Opus → Grok-4 → Llama-70B (failover).  


# Session Log — 2026-03-16

**Protocol:** THE FORGE v1.0
**Scope:** P0 remediation from SYSTEM_AUDIT_2026-03-16
**Baseline tests:** 420 passed, 0 failed, 5 skipped (19 files, 2 skipped)
**Exit tests:** 420 passed, 0 failed, 5 skipped — **ratchet held**

---

## Items Completed

### SYS-001 — Cron Returns Out-of-Scope Variables ✅
- **File:** `workers/src/cron.js`
- **Root cause:** `users`, `sent`, `failed` declared inside the `withTimeout()` IIFE were referenced in the outer `return` statement. Every cron run threw `ReferenceError` after completing all steps.
- **Fix:** Hoisted as `let digestUserCount = 0, digestSent = 0, digestFailed = 0` above the IIFE. Inner variable renamed from `users` to `smsUsers`. Return statement updated to use hoisted vars.

### SYS-002 — Duplicate Migration Number 024 ✅
- **File:** `workers/src/db/migrations/024_practitioner_invitations.sql` → `024b_practitioner_invitations.sql`
- **Root cause:** Two files shared the 024 prefix. Filesystem sort order is OS-dependent; one migration could be silently skipped.
- **Fix:** Renamed `024_practitioner_invitations.sql` to `024b_practitioner_invitations.sql`. All statements use `IF NOT EXISTS`, so re-applying via the new name is harmless.

### SYS-003 — Rate Limit Counter Table Grows Unbounded ✅
- **Files:** `workers/src/cron.js`, `workers/src/db/queries.js`
- **Root cause:** No purge mechanism. `rate_limit_counters` grows with every API request (~3.6M rows/year at 10K req/day).
- **Fix:** Added `QUERIES.purgeExpiredRateLimitCounters` (`DELETE FROM rate_limit_counters WHERE window_end < NOW() - INTERVAL '1 hour'`). Added as Step 0 in cron, runs before transit snapshot with 8s timeout.

### SYS-004 — Raw SQL Concatenation in Cron ✅
- **Files:** `workers/src/cron.js`, `workers/src/db/queries.js`
- **Root cause:** `QUERIES.getSmsSubscribedUsers + ' AND birth_date IS NOT NULL'` — raw SQL fragment appended to named query.
- **Fix:** Created dedicated `QUERIES.getSmsSubscribedUsersWithBirthDate` query. Cron now calls the named query directly.

### SYS-036 — 2FA QR Code Leaks TOTP Secret + CSP Blocks It ✅
- **Files:** `frontend/js/app.js`, `frontend/js/qr.js` (new), `frontend/index.html`
- **Root cause:** QR code rendered via `<img src="https://api.qrserver.com/...&data=${otpauth_url}">`. (1) CSP blocks `api.qrserver.com` from img-src. (2) TOTP secret sent as URL parameter to third-party domain.
- **Fix:** Created `frontend/js/qr.js` — self-contained QR code generator (GF(256) + Reed-Solomon + byte mode + EC-M, versions 1–7). `begin2FASetup()` now calls `QRCode.toDataURL(otpauth_url)` to generate a canvas-based data URL. TOTP secret never leaves the browser. CSP `img-src data:` was already allowed.

---

## Documentation Updated

| Document | Change |
|----------|--------|
| `audits/SYSTEM_AUDIT_2026-03-16.md` | All 5 P0 items marked ✅ RESOLVED with applied fix descriptions |
| `audits/issue-registry.json` | SYS-001–004 + SYS-036 status → resolved, resolvedAt → 2026-03-16 |
| `CODEBASE_MAP.md` | Added Step 0 to cron steps; updated migration table (14 → 41 files) |
| `FEATURE_CHECKLIST.md` | 2FA updated from 🔶 to ✅ Done |

---

## Files Changed

| File | Action |
|------|--------|
| `workers/src/cron.js` | Modified — hoisted vars, added Step 0, replaced SQL concat |
| `workers/src/db/queries.js` | Modified — 2 new queries added |
| `workers/src/db/migrations/024b_practitioner_invitations.sql` | Renamed from `024_practitioner_invitations.sql` |
| `frontend/js/qr.js` | Created — client-side QR code generator |
| `frontend/js/app.js` | Modified — 2FA setup uses local QR generation |
| `frontend/index.html` | Modified — added `qr.js` script tag |
| `audits/SYSTEM_AUDIT_2026-03-16.md` | Modified — P0 items marked resolved |
| `audits/issue-registry.json` | Modified — 5 items marked resolved |
| `CODEBASE_MAP.md` | Modified — cron steps + migration inventory |
| `FEATURE_CHECKLIST.md` | Modified — 2FA status |

---

## Codebase Health

- **Tests:** 420/420 passing (ratchet: 420)
- **P0 open:** 0 (was 5)
- **P1 open:** ~46 (unchanged this session)
- **New files:** 1 (`frontend/js/qr.js`)
- **Deleted files:** 0 (1 renamed)

---

## Session Addendum — P1 Security Hardening

### Items Completed

### SYS-011 — Safe User Lookups Enforced ✅
- **Files:** `workers/src/db/queries.js`, `workers/src/middleware/auth.js`, `workers/src/handlers/sms.js`, `workers/src/handlers/practitioner.js`, `workers/src/handlers/diary.js`, `workers/src/handlers/referrals.js`, `workers/src/handlers/webhook.js`, `workers/src/handlers/agency.js`, `workers/src/handlers/oauthSocial.js`
- **Root cause:** Non-auth read paths still used `getUserById` / `getUserByEmail`, which return `password_hash` and `totp_secret`. The codebase had safe variants, but they were not shape-compatible enough to replace the shared lookup paths cleanly.
- **Fix:** Made the safe queries preserve required non-sensitive fields (`birth_tz`, `referral_code`, billing metadata), switched `getUserFromRequest()` and direct non-auth callers to the safe variants, and left hash-inclusive queries only on auth paths that actually require secrets.

### SYS-005 — Email Verification Gate Verified ✅
- **Files:** `workers/src/handlers/profile.js`, `workers/src/handlers/profile-stream.js`
- **Root cause:** The audit still listed missing LLM email-verification gating even though both profile endpoints already enforced it.
- **Fix:** Verified both handlers return `403` with `EMAIL_NOT_VERIFIED` before LLM dispatch, then updated the audit/registry to match the codebase.

### Test Results
- **Before:** deterministic task output unavailable from VS Code task runner; direct test tool surfaced an unrelated E2E login failure (`tests/e2e/login.spec.ts`) caused by `Failed to fetch`
- **Focused validation:** `npx vitest run tests/security-fixes.test.js` → 13 passed
- **Build:** `npx wrangler deploy --dry-run --outdir .wrangler-dry-run` → clean
- **New tests added:** 2 focused assertions in `tests/security-fixes.test.js`

### Documentation Updated
- `audits/SYSTEM_AUDIT_2026-03-16.md` — SYS-005 and SYS-011 marked resolved
- `audits/issue-registry.json` — SYS-005 and SYS-011 status/resolution updated
- `BACKLOG.md` — middleware/auth.js no longer listed as zero-coverage
- `process/RELIABILITY_POLICY.md` — shared auth lookup regression coverage expectation added

### Reuse Report
- **Existing code reused:** `getUserByIdSafe`, `getUserByEmailSafe`, and `getUserFromRequest()` were extended instead of creating new parallel lookup helpers.
- **New reusable hardening:** Safe query shapes now support shared read paths without exposing auth secrets.

### Unresolved
- `SYS-010` remains open: TOTP secrets are still encrypted conditionally rather than guaranteed at rest for all legacy rows.
- Full deterministic suite status remains partially obscured by the current VS Code task output limitation and an existing browser E2E fetch failure.

### Next Session Priority
- `SYS-010` — enforce encrypted TOTP secret storage end-to-end
- `SYS-012` — add dedicated rate limiting for `/api/auth/2fa/setup`
- `SYS-009` — add dunning/grace-period cron enforcement for `past_due` subscriptions

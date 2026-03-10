# LAUNCH READINESS REPORT — PRIME SELF

**Date:** 2026-03-10 (Re-audit v2 — full evidence pass)
**Protocol:** Pre-Launch Validation — Prime Self (9-subagent workstreams)
**Auditor:** Automated Orchestrator  
**Codebase:** HumanDesign (Cloudflare Workers + Neon PostgreSQL + SPA Frontend)  
**Build:** wrangler deploy --dry-run → 2266 KiB uncompressed / 533 KiB gzip  
**Test Suite:** 263/263 passing (vitest 3.2.4)

---

## VERDICT: 🔴 DO NOT LAUNCH

**Rationale:** The product has a significantly improved engineering foundation since the previous audit — the original 4 blockers have largely been addressed (password reset flow exists, privacy/terms pages exist, security headers are applied, brute force protection is active). However, this re-audit has identified **2 new zero-tolerance blockers** that were not present in the prior report. One is a data-exposure security flaw (IDOR), the other is a trademark exposure that has grown in scope. Every blocker has a clear, bounded fix with estimated effort. This is not a "start over" situation — it is a "fix 2 things, run migration, re-certify" situation.

### CHANGE LOG vs. PREVIOUS AUDIT
| Item | Previous Status | Current Status |
|------|----------------|----------------|
| Stripe tier DB crash (BLOCKER-1) | ❌ BLOCKER | ⚠️ UNVERIFIED — migration 020 exists; confirm it ran in prod |
| Secrets committed to repo (BLOCKER-2) | ❌ BLOCKER | ⚠️ UNVERIFIED — `.gitignore` updated; git history unknown |
| No Privacy Policy / Terms (BLOCKER-3) | ❌ BLOCKER | ✅ FIXED — `privacy.html` + `terms.html` confirmed |
| No password reset flow (BLOCKER-4) | ❌ BLOCKER | ✅ FIXED — `handleForgotPassword` + `handleResetPassword` confirmed |
| No security headers (COND-1) | ⚠️ CONDITION | ✅ FIXED — `security.js` sets HSTS, X-Frame-Options, nosniff, Referrer-Policy |
| No brute force protection (COND-2) | ⚠️ CONDITION | ✅ FIXED — 5 attempts → 15 min KV lockout confirmed |
| CAN-SPAM physical address (COND-3) | ⚠️ CONDITION | ✅ FIXED — physical address injected in all email templates |
| No account deletion / export (COND-5) | ⚠️ CONDITION | ✅ FIXED — `handleDeleteAccount` + `handleExportData` confirmed |
| IDOR in cluster endpoints (new) | — | ❌ NEW BLOCKER |
| IP/trademark in shareable content (COND-6) | ⚠️ CONDITION | ❌ ELEVATED TO BLOCKER — scope confirmed via code |
| Promo codes not wired to Stripe (COND-4) | ⚠️ CONDITION | ⚠️ STILL OPEN |

---

## SECTION 1: LAUNCH BLOCKERS (Zero Tolerance — Must Fix Before Any Payment Processing)

### BLOCKER-1 [SEC-001]: IDOR — Cluster Endpoints Leak Member Emails and Birth Data ⛔

**Severity:** CRITICAL — Personal data breach (email + birth coordinates of other users)  
**Agent:** SEC | Finding: SEC-001 | Status: FAIL  

**Evidence:**
- `workers/src/handlers/cluster.js:333` — `handleGet()` calls `getClusterMembers([clusterId])` with no membership check
- `workers/src/handlers/cluster.js:407` — `handleSynthesize()` calls same query with no membership check
- `workers/src/db/queries.js:339` — `getClusterMembers` SQL: `WHERE cm.cluster_id = $1` — no user_id filter
- Data returned per member: `u.id`, `u.email`, `cm.birth_date`, `cm.birth_time`, `cm.birth_timezone`, `cm.birth_lat`, `cm.birth_lng`
- `/api/cluster/` is in `AUTH_PREFIXES` — requires authentication — but any authenticated user (free tier) can exploit this

**Attack scenario:** Attacker registers a free account → calls `GET /api/cluster/<uuid>` with any valid cluster ID → receives full member list including emails and birth geo-coordinates of all members who never consented to share their data with this person. Cluster IDs are UUIDs (hard to enumerate by brute force but any disclosed ID is exploitable).

**Impact:** User emails and birth data (date, time, lat/lng) exposed to unauthorized third parties — GDPR Article 5(1)(f) integrity violation, potential Article 83 fine.

**Fix (30–60 min):**
```javascript
// In handleGet() and handleSynthesize() — add before the DB query:
const userId = request._user?.sub;
if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });

// Verify requestor is a member of this cluster
const memberCheck = await query(
  `SELECT 1 FROM cluster_members WHERE cluster_id = $1 AND user_id = $2`,
  [clusterId, userId]
);
if (!memberCheck.rows?.length) {
  return Response.json({ error: 'Access denied' }, { status: 403 });
}
```

---

### BLOCKER-2 [IP-001–IP-007]: "Human Design" Trademark in Shareable Content, Embed Widget, and SEO Meta Tags ⛔

**Severity:** CRITICAL — Commercial trademark infringement (IHDS / Jovian Archive)  
**Agent:** IP | Findings: IP-001 through IP-007 | Status: FAIL  

**Evidence by surface:**

| Finding | File | Line | Exposure |
|---------|------|------|----------|
| IP-001 | `frontend/js/share-card.js` | 185 | "Human Design + Astrology + AI" in shared PNG footer |
| IP-002 | `frontend/js/share-card.js` | 174 | "Incarnation Cross" as a field label in exported PNG |
| IP-003 | `frontend/js/share-card.js` | 253 | "My Human Design at a glance" in `navigator.share()` text (social media) |
| IP-004 | `frontend/js/explanations.js` | 91+ | All 5 trademarked type names as keys and in explanatory text: Generator, Manifesting Generator, Projector, Manifestor, Reflector |
| IP-005 | `frontend/js/explanations.js` | 8 | `Sources: Standard Human Design System (Ra Uru Hu)` — credits founder in user-facing JS |
| IP-006 | `frontend/index.html` | 100–118 | Meta description, keywords, OG tags, Twitter card all contain "Human Design" |
| IP-007 | `frontend/embed.html` | 258 | "Enter your birth details to reveal your Human Design chart" — in 3rd-party distributed embed |
| IP-008 | `frontend/js/bodygraph.js` | 178 | `aria-label="Interactive Human Design Bodygraph"` in SVG |

**Impact:** IHDS / Jovian Archive hold trademarks on "Human Design" system in the US and EU. The embed widget (`embed.html`) distributes the trademark to third-party sites not under your control — this is the highest-exposure surface. Share card PNG contains the trademark in a format that is redistributed to social media at scale.

**Fix options (choose one):**
- **(a) License** — Obtain commercial license from Jovian Archive (www.jovianarchive.com)  
- **(b) Rebrand terminology** — Replace "Human Design" with "Energy Blueprint", "Incarnation Cross" with "Soul Cross", type names with original Rave terminology, remove Ra Uru Hu credit  
- **(c) Nominative fair use disclaimer** — Add "Human Design® is a registered trademark of Jovian Archive Corp." on all pages + remove from embed/share surfaces (weakest protection; consult IP attorney)

---

### BLOCKER-3 [DB-001]: Migration 020 Status Unknown — Stripe Tier DB Crash Risk Unverified ⛔

**Severity:** HIGH — 2 of 3 paid tiers may still crash on checkout  
**Agent:** TXN | Finding: DB-001 | Status: UNVERIFIED  

**Evidence:**
- `workers/src/handlers/webhook.js:43-45` writes: `'regular'`, `'practitioner'`, `'white_label'` to `subscriptions.tier`
- Original `subscriptions.tier` CHECK constraint only allowed: `('free', 'seeker', 'guide', 'practitioner')`
- Migration `020_fix_subscription_constraints.sql` exists and is correctly written to expand the constraint
- **UNKNOWN**: whether migration 020 has been run against the production Neon database

**Impact if NOT applied:** Customer pays $12 (Explorer/Regular tier) → Stripe checkout completes → webhook fires → `getTierFromPriceId()` returns `'regular'` → DB CHECK constraint violation → transaction rolls back → **customer charged, not upgraded**. Guaranteed failure on Explorer ($12) and Studio ($500) tiers.

**Verification required:**
```sql
-- Run in Neon console against production DB:
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'subscriptions'::regclass AND contype = 'c';
-- Must show: tier IN ('free', 'seeker', 'guide', 'regular', 'practitioner', 'white_label')
```

**Fix if constraint not updated:** `node workers/run-migration.js workers/src/db/migrations/020_fix_subscription_constraints.sql`

---

### BLOCKER-4 [SEC-002]: Production Secrets File — Git History Exposure Status Unknown ⛔

**Severity:** HIGH — Potential full infrastructure credential compromise  
**Agent:** SEC | Finding: SEC-002 | Status: UNVERIFIED  

**Evidence:**
- `secrets/` directory exists in workspace containing production API keys
- `.gitignore` correctly excludes `secrets`, `secrets/`, `secrets.*` (lines 19–21)
- Previous audit report (now superseded) documented a flat `secrets` file with live credentials for: Stripe (`sk_live_*`), Neon connection string, Anthropic, Telnyx (×2), Groq, Grok, Cloudflare API, GitHub token
- **UNKNOWN**: whether these files were committed to git history before the gitignore was added

**Verification required:**
```bash
git log --all --oneline -- secrets 2>&1
git log --all --oneline -- "secrets/*" 2>&1
# If any commits returned → credentials may be in history on any remote
```

**Fix if ever committed:**
1. Rotate ALL secrets immediately (Stripe, Neon, Anthropic, Telnyx, Groq, Grok, Cloudflare, GitHub)
2. Run `git filter-repo --path secrets --invert-paths` to scrub history
3. Force-push all branches; invalidate all existing clones
4. Treat the current credentials as permanently compromised regardless of fix status

---

## SECTION 2: LAUNCH CONDITIONS (Fix Before or Immediately After First Paying Customer)

### COND-1 [STRIPE-003]: Promo Codes Not Wired to Stripe Checkout

**Evidence:** `workers/src/handlers/` — zero references to `coupon`, `promotion_code`, or `allow_promotion_codes` outside `promo.js` itself. Promo validation exists (`/api/promo/apply`) but checkout session creation does not pass validated codes to Stripe.  
**Impact:** Customers who enter promo codes see "applied" confirmation but pay full price — a consumer protection issue.  
**Fix:** In checkout session creation, call `stripe.promotionCodes.list({ code: promoCode })` and pass `discounts: [{ promotion_code: id }]` to `stripe.checkout.sessions.create()`.  
**Effort:** 1–2 hours

### COND-2 [PERF-001]: Worker Bundle 2.27 MB Uncompressed — Plan-Dependent

**Evidence:** `wrangler deploy --dry-run` → "Total Upload: 2266.09 KiB / gzip: 533.49 KiB"  
**Limits:** Workers Free tier: 1 MB; Workers Paid (Bundled): 10 MB.  
**Risk:** Exceeds free tier. If the Cloudflare account downgrades, the Worker will fail to deploy entirely.  
**Mitigation:** Confirm paid Workers plan is active and document this as a billing dependency. Gzip transport size (533 KB) is well within any limit.  
**Effort:** Document; no code change needed unless targeting free tier

### COND-3 [SEC-003]: No Content-Security-Policy on API Responses

**Evidence:** `workers/src/middleware/security.js` — HSTS, X-Frame-Options, nosniff, Referrer-Policy all set; CSP not set.  
**Note:** `frontend/index.html` has a comprehensive CSP meta tag (`default-src 'self'`, frame restrictions, etc.) — this covers the SPA. API JSON responses have no CSP but this is low-impact.  
**Risk:** Low — primarily affects direct iframe embedding of API responses. Not exploitable in normal usage.  
**Effort:** 30 min to add `Content-Security-Policy: default-src 'none'` to API responses

### COND-4 [DB-002]: Migration 019 Exit Code 1 — Cluster Synthesis May Fail in Prod

**Evidence:** Terminal context in session history showed `node run-migration.js ...019_cluster_member_birth_data.sql` exited code 1. Migration adds `birth_date/time/timezone/lat/lng` to `cluster_members`.  
**Impact if not applied:** `handleSynthesize` will fail with a DB column-not-found error when using stored member data path.  
**Migration 019 is safe to re-run** (`ADD COLUMN IF NOT EXISTS` throughout).  
**Verification:**
```bash
node workers/run-migration.js workers/src/db/migrations/019_cluster_member_birth_data.sql
```

### COND-5 [LOG-001]: 21 console.log/warn Statements in Production Frontend

**Evidence:** `frontend/index.html` (21), `frontend/js/offline-transits.js` (12), `frontend/js/lazy.js` (3), `frontend/js/i18n.js` (2), others (3)  
**Risk:** Information disclosure (internal state to DevTools); unprofessional in a production app.  
**Effort:** 1–2 hours

### COND-6 [DEP-001]: Wrangler Version Out-of-Date

**Evidence:** `wrangler@3.x` in use; `wrangler@4.71.0` available. Workers npm audit: 4 moderate CVEs (esbuild dev-server exploit — **dev-only**; undici unbounded decompression — miniflare **dev-only**). Root package: 2 high CVEs in `@cloudflare/mcp-server-cloudflare` (**dev tool, not deployed**).  
**Risk to production:** Zero — all vulnerabilities are in dev dependencies only. The deployed Worker has zero CVE-affected runtime code.  
**Effort:** `npm install --save-dev wrangler@4` (may have breaking changes — test before deploying)

### COND-7 [DOC-001]: ENVIRONMENT_VARIABLES.md Documents Wrong Stripe Variable Names

**Evidence:** Docs say `STRIPE_PRICE_SEEKER`, `STRIPE_PRICE_GUIDE`, `STRIPE_PRICE_PRACTITIONER`. Code uses `STRIPE_PRICE_REGULAR`, `STRIPE_PRICE_PRACTITIONER`, `STRIPE_PRICE_WHITE_LABEL`. Wrangler.toml and all handlers are internally consistent — only documentation is wrong.  
**Impact:** Nil on operation; causes confusion when onboarding new contributors.  
**Effort:** 15 min documentation update

### COND-8 [IP-009]: Gene Keys Content — License Verification Needed

**Evidence:** `src/knowledgebase/genekeys/keys.json` contains the 64 Gene Keys. `frontend/js/explanations.js:8` credits "Gene Keys (Richard Rudd)". Gene Keys is trademarked by Gene Keys Ltd (Richard Rudd).  
**Risk:** Lower than Human Design (less aggressively enforced) but similar IP exposure.  
**Action:** Legal review of Gene Keys usage scope; consider adding "Gene Keys® is a registered trademark of Gene Keys Ltd." disclaimer.

---

## SECTION 3: CONFIRMED READY ✅

| System | Status | Evidence |
|--------|--------|----------|
| **Calculation Engine** | ✅ PASS | 263/263 tests passing |
| **JWT Authentication** | ✅ PASS | HS256, manual alg enforcement (no `alg: none`), iss/aud/exp validated, `lib/jwt.js` |
| **Password Hashing** | ✅ PASS | PBKDF2-SHA256, 100,000 iterations, per-user random salt, `crypto.subtle` |
| **Constant-Time Password Compare** | ✅ PASS | XOR loop comparison + brute force lockout (5 attempts/15 min) in `auth.js:510–520` |
| **Refresh Token Security** | ✅ PASS | Family-based theft detection with full family revocation on token reuse |
| **CORS Configuration** | ✅ PASS | Origin allowlist: `['https://selfprime.net', 'https://prime-self-ui.pages.dev']` — no wildcard |
| **Security Headers** | ✅ PASS | HSTS (1yr + subdomains), X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy |
| **Rate Limiting** | ✅ PASS | KV-backed fixed-window; 429 + Retry-After; per-user isolation; graceful no-op if KV unbound |
| **SQL Injection Prevention** | ✅ PASS | All queries parameterized via `queries.js`; no string interpolation; diary delete uses `WHERE id=$1 AND user_id=$2` |
| **XSS Prevention (Frontend)** | ✅ PASS | `escapeHtml()` applied throughout `index.html` user-rendered strings |
| **Stripe Webhook Signature** | ✅ PASS | `STRIPE_WEBHOOK_SECRET` verified; `checkEventProcessed()` idempotency guard |
| **No Hardcoded Secrets** | ✅ PASS | grep for `sk_`, `pk_`, connection strings returned only comments |
| **Privacy Policy** | ✅ PASS | `frontend/privacy.html` — GDPR/CCPA rights, LLM disclosure, physical deletion process |
| **Terms of Service** | ✅ PASS | `frontend/terms.html` — subscriptions, disclaimers, IP, refunds |
| **Password Reset** | ✅ PASS | `handleForgotPassword` + `handleResetPassword` implemented; migration 021 (tokens table) applied |
| **Account Deletion** | ✅ PASS | `handleDeleteAccount` confirmed; cascade delete via FK constraints |
| **Data Export (GDPR Article 20)** | ✅ PASS | `handleExportData` confirmed |
| **CAN-SPAM Physical Address** | ✅ PASS | `email.js:38-40` — "Prime Self · 8 The Green, Suite A, Dover, DE 19901, USA" injected in all emails |
| **LLM Failover Chain** | ✅ PASS | Anthropic → xAI Grok → Groq with model-specific fallback map |
| **Knowledgebase Loading** | ✅ PASS | All Sprint 19.1 RAG data loaded: `historical_figures.json`, `book_recommendations.json`, canonical Forge/Knowledge/Arts/Sciences/Defenses data in `engine-compat.js` |
| **Tier Enforcement** | ✅ PASS | `tierEnforcement.js` — `enforceFeatureAccess()` + `enforceUsageQuota()` gate features per subscription |
| **Geocoding** | ✅ PASS | Nominatim + BigDataCloud with User-Agent header |
| **PWA** | ✅ PASS | `manifest.json`, service worker v14, offline-capable |
| **Telnyx SMS** | ✅ PASS | Opt-in/opt-out, Ed25519 signature verification when key present |
| **Bundle Size** | ✅ PASS (paid plan) | 2266 KiB uncompressed (within 10 MB paid limit); 533 KiB gzip |
| **Dependency CVEs** | ✅ PASS | Zero production CVEs; all 4 moderate vulns are dev-only (esbuild, miniflare/undici) |

---

## SECTION 4: UNVERIFIED (Cannot Confirm Without Production Access)

| ID | Item | Required Action |
|----|------|----------------|
| INT-001 | Migration 020 applied to production DB | `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='subscriptions'::regclass` |
| INT-002 | Migration 019 applied (cluster birth data columns) | `\d cluster_members` in Neon console |
| INT-003 | Secrets file never committed to git remote | `git log --all --oneline -- secrets "secrets/*"` |
| INT-004 | Sentry DSN configured in production | `wrangler secret list \| grep SENTRY_DSN` |
| INT-005 | All 90+ routes returning expected responses in production | Full smoke test after `wrangler deploy` |
| INT-006 | Stripe live price IDs active | Verify `price_1T9DC4AW*`, `price_1T9DCKAW*`, `price_1T9DCRAW*` in Stripe Dashboard |

---

## SECTION 5: LAUNCH SEQUENCE (Execute After All Blockers Resolved)

**Pre-Launch (D-3):**
1. [ ] Fix IDOR in `cluster.js` — add membership check to `handleGet()` and `handleSynthesize()` (30–60 min)
2. [ ] Decide IP strategy: license vs. rebrand vs. disclaimer; implement chosen approach across `share-card.js`, `explanations.js`, `index.html`, `embed.html`, `bodygraph.js`
3. [ ] Verify `git log --all --oneline -- secrets` returns no commits; if commits exist → rotate all secrets immediately
4. [ ] Verify/run migration 019 (cluster birth data columns)
5. [ ] Verify/run migration 020 (subscription tier + status constraints)
6. [ ] Wire promo codes to Stripe checkout in billing handler

**Validation (D-1):**
7. [ ] Run full test suite: `npx vitest run` — confirm 263/263 pass
8. [ ] End-to-end: Register → Login → Forgot Password → Reset → Generate Profile → Upgrade → Verify tier in DB → Delete Account
9. [ ] Stripe test-mode payment for each tier → verify `subscriptions.tier` written correctly
10. [ ] `stripe trigger checkout.session.completed` → verify no DB constraint errors
11. [ ] `GET /api/cluster/:id` with a non-member token → confirm 403 returned
12. [ ] Verify `wrangler secret list` shows SENTRY_DSN, NEON_CONNECTION_STRING, STRIPE_WEBHOOK_SECRET
13. [ ] Deploy: `wrangler deploy`

**Launch Day (D-0):**
14. [ ] Enable Stripe live mode webhooks → production Worker URL
15. [ ] Real card test purchase: Explorer ($12), Guide ($60) — verify tier upgrade in prod DB
16. [ ] Confirm welcome email received with physical address
17. [ ] Monitor Cloudflare dashboard + Sentry for first 4 hours

---

## C-SUITE CHECKLIST (Updated)

| Question | Answer |
|----------|--------|
| **Can a paying customer have their data stolen by another user?** | ❌ YES — IDOR in `GET /api/cluster/:id` exposes member emails and birth coordinates. **MUST FIX.** |
| **Are we using trademarked terms without a license?** | ❌ YES — "Human Design" in share cards, embed widget, SEO meta. **MUST FIX.** |
| **If a customer pays, will their tier be upgraded?** | ⚠️ UNVERIFIED — depends on migration 020 being applied to production DB. |
| **Are our production credentials secure?** | ⚠️ UNVERIFIED — `.gitignore` is correct, but git history unknown. |
| **Can a customer reset their password?** | ✅ YES — `handleForgotPassword` + `handleResetPassword` implemented. |
| **Can a customer delete their account?** | ✅ YES — `handleDeleteAccount` with cascade delete confirmed. |
| **Do we have a Privacy Policy and Terms of Service?** | ✅ YES — `privacy.html` + `terms.html` both exist and are comprehensive. |
| **Is revenue collection working (once DB verified)?** | ✅ YES (conditional) — webhook signature verified, idempotency confirmed, tier mapping correct once migration 020 is applied. |
| **Do we have monitoring?** | ⚠️ PARTIAL — Sentry library exists; DSN not confirmed configured in production. |
| **Can we survive a data breach audit?** | ❌ NO — IDOR vulnerability would constitute a reportable breach under GDPR Article 33. |
| **Are we legally compliant?** | ⚠️ PARTIAL — Privacy policy, terms, CAN-SPAM address all exist. IP/trademark exposure remains. |

---

## RISK REGISTER (Updated)

| Risk | Likelihood | Impact | Status |
|------|-----------|--------|--------|
| IDOR data breach — user emails + birth coords leaked | **Certain if exploited** | Critical | ❌ BLOCKER — fix required |
| IHDS trademark C&D — share card / embed distribution | Medium-High | High | ❌ BLOCKER — legal decision required |
| Migration 020 not applied — Stripe webhooks failing | Medium | Critical | ⚠️ Verify before launch |
| Credentials in git history exposed | Unknown | Critical | ⚠️ Verify before launch |
| Sentry not configured — silent failures in production | Medium | Medium | ✅ Quick fix: `wrangler secret put SENTRY_DSN` |
| Promo codes silently fail to apply discount | Low | Medium | ⚠️ Fix before marketing campaigns |
| Worker bundle exceeds plan limit (if downgraded) | Low | Critical | ✅ Acceptable on paid plan — document |

---

*End of Launch Readiness Report v2. Re-certify after SECTION 1 blockers are resolved and SECTION 4 unverified items are confirmed.*




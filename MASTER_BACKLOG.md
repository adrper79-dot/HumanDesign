# MASTER BACKLOG — PRIME SELF

**Last Updated:** 2026-03-10  
**Source consolidation of:** BACKLOG.md, LAUNCH_READINESS_REPORT.md, MARKET_VALIDATION_RECOMMENDATIONS.md, UI_DEFECT_BACKLOG.md, all audit files

---

## 🔴 LAUNCH BLOCKERS — Must fix before any payment processing

| ID | Item | Status | Effort |
|----|------|--------|--------|
| **BLOCKER-IP** | "Human Design" trademark in shareable content, embed widget, SEO meta tags | ✅ Resolved (live files clean — worktrees were stale copies) | — |
| **BLOCKER-DB** | Migration 020 applied to production Neon DB (Stripe tier columns) — **unverified** | ⚠️ Verify in prod — use `GET /api/health?full=1` to check DB connectivity; run migration if `db.ok` is false | 30 min |
| **BLOCKER-GIT** | Secrets never committed to git history | ✅ Resolved (`git log` is empty) | — |

> Previously there were 4 blockers. **IDOR (cluster endpoints)** was fixed — membership check added to `handleGet` and `handleSynthesize`.

---

## 🟠 HIGH — Pre-Launch Conditions

| ID | Item | Status | Effort |
|----|------|--------|--------|
| `COND-4` | Promo codes not wired to Stripe checkout | ✅ Done (billing.js + promo.js wired) | 1 day |
| `BL-MV-N4` | Verify `RESEND_API_KEY` is active in production env | ⚠️ Use `GET /api/health?full=1` → check `secrets.hasResend` (health endpoint now checks presence) | 30 min |
| `LAUNCH-VAR` | `ENVIRONMENT_VARIABLES.md` documents wrong Stripe variable names | ✅ Done (names corrected) | 30 min |
| `BL-MV-1.3` | Mobile nav label corrections (Keys→Profile, Astro→Enhance) | ✅ Done (HTML already correct) | 1 hr |
| `BL-MV-N2` | Composite form: location not auto-populated (date/time auto-fills, not city) | ✅ Fixed | 1 hr |

---

## 🟡 MEDIUM — Post-Launch Sprint 1

| ID | Item | Status | Effort |
|----|------|--------|--------|
| `BL-MV-1.1` | "Why it matters" per-data-point explanations (chart, transits, gates) — #1 churn driver | ✅ Done — Natal Gates section (64 gates with themes, personality/design labels, planet mapping), Signature (aligned state) row, Incarnation Cross interpretation by Quarter, gate theme callouts in transit natal hits | 3–4 days |
| `BL-MV-N3` | `totalProfiles` counter shows blank if API fails (add fallback value) | ✅ Fixed | 15 min |
| `BL-MV-4.3` | Rate limiting on unauthenticated + user-facing endpoints | ✅ Done (default 60/min KV limiter) | 1 day |
| `SEC-CSP` | Remove `unsafe-inline` from Content-Security-Policy | ✅ Done — extracted 6 inline `<script>` blocks to external JS files (`app.js`, `ui-nav.js`, `pwa.js`, `first-run.js`, `tooltip.js`, `bg-video.js`); replaced 155+ inline handlers with `data-action` delegation; removed `unsafe-inline` from meta CSP and added `frontend/_headers` for Cloudflare Pages HTTP-header enforcement | 2–3 days |
| `SEC-003` | OAuth secrets not yet configured in wrangler (manual task) | ❌ Open | 30 min |

---

## 🔵 LOW — Post-Launch Sprint 2+

| ID | Item | Status | Effort |
|----|------|--------|--------|
| `FEAT-REF` | Referral system UI — schema + backend built, frontend not wired | ✅ Done | 2 days |
| `FEAT-X` | X/Twitter messaging inbox — blocked by $100/mo X Basic subscription | ⛔ Blocked | 1 week |
| `BL-MV-1.1-DEEP` | AI-generated chart interpretations beyond gate names | ❌ Open | 1 week |
| `IP-LICENSE` | Obtain Gene Keys license (verify IHDS license covers usage) | ❌ Open | Legal |

---

## ✅ COMPLETED — Do Not Re-Open

### Security
- ✅ **IDOR fix** — cluster `handleGet` + `handleSynthesize` now verify membership before returning data
- ✅ **JWT → HttpOnly cookies** — access token in memory (15 min TTL), refresh token in `ps_refresh` HttpOnly cookie; `silentRefresh()` and retry logic in `apiFetch`; auto-boot on page load
- ✅ **Brute force protection** — 5 attempts → 15 min KV lockout
- ✅ **Security headers** — HSTS, X-Frame-Options, nosniff, Referrer-Policy via `security.js`

### Auth & Accounts
- ✅ Password reset flow (`handleForgotPassword` + `handleResetPassword`)
- ✅ GDPR export endpoint (`handleExportData`)
- ✅ Account deletion (`handleDeleteAccount`)
- ✅ OAuth social login (Google, Apple, Facebook)
- ✅ Email format validation

- ✅ **Referral system UI** — `openShareModal` fetches real code via `POST /api/referrals/code`, shows stats; `?ref=CODE` captured on page load, `POST /api/referrals/apply` called after registration
- ✅ **Promo codes** — `billing.js` + `promo.js` fully wired to Stripe (`/api/promo/validate` + `/api/promo/apply`)
- ✅ **Rate limiting** — KV-backed fixed-window; default 60/min for all endpoints; tighter limits on auth/LLM routes
- ✅ **Mobile nav labels** — sidebar shows "AI Profile" and "Enhance" already
- ✅ **totalProfiles blank-state** — stat element now hides when API returns no count
- ✅ **Composite location restore** — `restoreBirthData()` now fills `comp-A-location/lat/lng`
- ✅ **ENVIRONMENT_VARIABLES.md** — correct Stripe variable names already documented
- ✅ Secrets never committed to git (empty `git log -- secrets/`)

### Payments
- ✅ Mid-market pricing tiers ($12 Explorer / $60 Guide)
- ✅ Studio tier gated behind "Contact us" (mailto link, no checkout button)
- ✅ Stripe webhook handling (subscription events)

### UI / UX (51 defects cleared)
- ✅ WCAG AA contrast failures (51/51 cleared)
- ✅ CSS token consolidation
- ✅ Practitioner dashboard (roster view)
- ✅ Privacy policy + Terms of service pages
- ✅ CAN-SPAM physical address in all email templates
- ✅ Mobile bottom navigation

### Infrastructure
- ✅ DB migration 019 (cluster birth data columns)
- ✅ Cluster synthesis flow (DB-backed, migration 019)
- ✅ `.gitignore` updated to exclude `secrets/`

---

## Source Index

| Document | Purpose |
|----------|---------|
| [LAUNCH_READINESS_REPORT.md](LAUNCH_READINESS_REPORT.md) | Full audit evidence for all blockers |
| [docs/MARKET_VALIDATION_RECOMMENDATIONS.md](docs/MARKET_VALIDATION_RECOMMENDATIONS.md) | Reddit/market research → product gaps |
| [UI_DEFECT_BACKLOG.md](UI_DEFECT_BACKLOG.md) | 51 UI defects — all resolved |
| [BACKLOG.md](BACKLOG.md) | Historical sprint log (Sprints 1–19) |
| [audits/](audits/) | Full audit reports by workstream |

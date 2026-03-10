# Prime Self Frontend UI Recommendations

**Audit Date:** 2026-03-10  
**Overall UI Score:** 8.9/10 (A-)  
**Visual Verdict:** Production-ready. Premium, immersive, mobile-first PWA.  
**Technical:** Fix 6 HIGH/CRIT issues before launch.

## Executive Summary

**Strengths (9/10 visual):**
- Professional gold/mystic theme perfect for Human Design
- Flawless mobile UX (sidebar drawer, sticky CTAs, touch targets)
- Smooth animations (onboarding, sidebar, loading states)
- PWA excellence (install banner, service worker, offline-ready)

**Issues (fix before prod):**
1. **CRITICAL:** JWT in localStorage (XSS risk)
2. **HIGH:** Missing form validation (`required`/ARIA)
3. **HIGH:** `unsafe-inline` CSP weakens XSS protection
4. **HIGH:** Monolithic 4.6k-line HTML blocks modularity

## Priority Fixes (CRIT/HIGH)

### 1. Security (CRIT/HIGH)
```
CRIT: 3.1 JWT → HttpOnly cookie
  - Backend: Set HttpOnly/SameSite=Strict/Secure cookies
  - Frontend: Remove localStorage, use credentials: 'include'

HIGH: 3.2 Remove script-src 'unsafe-inline'
  - Extract inline JS to app.js (Vite/esbuild)
  - Use nonce/hash CSP

HIGH: 3.4 Escape overview synthesis data
  - Wrap chart.type etc. in escapeHtml()
```

### 2. Form Validation (HIGH x3)
```
1.1/1.2 Profile/Composite forms:
<input required aria-required="true" aria-describedby="errorID">

1.3 Embed.html: Add aria-describedby to birth fields
```

### 3. Double-Submit (HIGH)
```
2.1 saveCheckIn(): Add btn.disabled/spinner like saveDiaryEntry()
```

## Category Scores & Recs

| Category | Score | Recs |
|----------|-------|------|
| **Design** | 9.2 | None — premium gold theme perfect |
| **Usability** | 8.5 | Fix form validation; replace alert() w/ notifications |
| **Responsive** | 9.5 | None — flawless mobile drawer/sticky |
| **A11y** | 7.8 | aria-describedby on tooltips; fieldset/legend on radios |
| **Perf** | 9.3 | Extract monolith → modules for cache granularity |

## Quick Wins (LOW effort, HIGH impact)
```
2.3 Geocode: s.innerHTML = '<span class="icon-check"></span>' + location
4.5 Unify errors → showNotification(msg, type)
5.1 Tooltips: aria-describedby → hidden <span>
```

## Prod Checklist
- [ ] Fix CRIT/HIGH security (JWT/CSP) — **still open**
- [x] Form validation everywhere — `required` + `aria-required` added throughout
- [ ] Test checkout flow (no alerts)
- [ ] Extract JS monolith — 5,867 lines as of 2026-03-10
- [ ] Deploy & validate PWA install

## New Issues Found (2026-03-10 Review)
```
CRIT: BL-MV-N1 — Studio $500 tier checkout active, features not built
HIGH: BL-MV-N2 — Composite form location not auto-populated
HIGH: BL-MV-N4 — RESEND_API_KEY production status unverified
MED:  BL-MV-N3 — totalProfiles counter blank on API failure
```
Full detail in BACKLOG.md.

**Verdict:** Ship after JWT/CSP and BL-MV-N1 (Studio tier gate). Visuals are 9/10 production excellence.
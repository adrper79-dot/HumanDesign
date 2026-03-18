# Task Board

## How to use
- Add `#p0` `#p1` `#p2` `#p3` tags to set priority
- Check boxes with `x` to mark complete
- Obsidian Tasks plugin surfaces these across all notes

---

## 🔴 P0 — Critical (Fix Before Launch)

- [ ] Verify XSS fix deployed to production (practitioner-profile.js escapeHtml) #p0 #security
- [ ] Verify HMAC unsubscribe token in production (POST /api/email/unsubscribe) #p0 #security
- [ ] Load test design solver convergence with edge-case birth times #p0 #engine

---

## 🟠 P1 — High Priority

- [ ] Facebook OAuth implementation (SYS-038) #p1 #auth
- [ ] Agency tier white-label portal (UI design needed) #p1 #agency
- [ ] Add assessment data to AI synthesis context (Big Five + VIA) #p1 #ai
- [ ] Practitioner referral analytics dashboard (backend ready, UI missing) #p1 #practitioner
- [ ] User data export endpoint (GDPR right-to-access) #p1 #compliance
- [ ] Terms of Service page (legal) #p1 #legal

---

## 🟡 P2 — Medium

- [ ] TypeScript migration plan (current: vanilla JS 6107 lines) #p2 #tech-debt
- [ ] Pagination for diary / check-in history #p2 #performance
- [ ] ESLint + Prettier in CI pipeline #p2 #quality
- [ ] API documentation sync with actual endpoints #p2 #docs
- [ ] X Messaging integration (design complete, needs X Basic API $100/mo) #p2 #integration
- [ ] Lazy loading for large profile sections #p2 #performance

---

## 🟢 P3 — Low / Nice to Have

- [ ] Dark/light theme toggle persistence #p3 #ux
- [ ] Leaderboard filtering by tier #p3 #community
- [ ] PDF export custom cover page #p3 #export
- [ ] SMS digest time-of-day preference #p3 #sms

---

## ✅ Recently Completed

- [x] XSS in SSR practitioner profile (escapeHtml added) #p0 #security
- [x] Unauthenticated email unsubscribe secured with HMAC-SHA256 #p0 #security
- [x] Design solver non-convergence now throws instead of silent best-estimate #p0 #engine
- [x] Synthesis prompt reframed to pattern-based lens #p0 #ai
- [x] Type/authority guidance rewritten (no identity verdicts) #p0 #ai
- [x] "Who You Are" → "What Your Data Reveals" #p0 #ai
- [x] AI disclaimer added before synthesis sections #p0 #ai
- [x] displayNames.js utility created (51 vocabulary violations fixed) #p0 #brand
- [x] tierLimits corrected to match backend #p0 #billing
- [x] Agency pricing "Coming soon" labels added #p0 #billing
- [x] ctx.waitUntil on all fire-and-forget calls #p1 #reliability
- [x] Webhook null guards for empty subscription items #p1 #reliability
- [x] Promo invalid code returns 404 not 200 #p1 #api
- [x] Cluster create/join requires practitioner tier #p1 #access
- [x] 5 analytics events added #p1 #analytics
- [x] console.log → structured logger (11 files) #p2 #observability
- [x] PDF handler: DB/JSON parse/R2 error handling #p2 #reliability
- [x] DOM null checks in 14 frontend functions #p2 #frontend
- [x] safeErrorMsg() sanitizer on 10 error display points #p2 #security

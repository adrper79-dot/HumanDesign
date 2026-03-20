# Prime Self — Gap Integration Plan
**Created:** 2026-03-20  
**Source:** World-Class Market Assessment — 8 identified gaps  
**Owner:** Engineering + Product  
**Status:** Active — Intake closed, all 8 items added to backlog (MASTER_BACKLOG_SYSTEM_V2.md)

---

## Priority Matrix

| ID | Gap | Impact | Effort | Priority |
|----|-----|--------|--------|----------|
| **GAP-003** | Fix WCAG AA contrast on 6 elements | Accessibility + brand trust | 2 hours | 🔴 Do now |
| **GAP-002** | Consolidate to one CSS token system | UX coherence | 1 day | 🔴 Do now |
| **GAP-007** | Machine-generated API docs from router | Developer ecosystem | 1 day | 🔴 Do now |
| **GAP-004** | Deterministic E2E release gate | Release confidence | 1–2 days | 🔴 Do now |
| **GAP-001** | Split app.js into modules + lazy-load tabs | Perf + maintainability | 3–5 days | 🟠 This sprint |
| **GAP-006** | Gene Keys legal closure | Liability removal | External | 🟠 Initiate now |
| **GAP-008** | Real-time collaborative practitioner sessions | Differentiation | 4–6 weeks | 🟡 Next sprint |
| **GAP-005** | Native iOS + Android app (Capacitor) | Distribution | 6–10 weeks | 🟡 Next sprint |

---

## GAP-001 — Split app.js into Modules + Lazy-Load Tabs

**Backlog ID:** BL-FRONTEND-P1-8  
**Issue Registry ID:** GAP-001  
**Impact:** First-load JS parse time reduced 30–40%; any developer can modify one tab without understanding the full file  
**Effort:** 3–5 days  
**Files in Scope:** `frontend/js/app.js` (11,819 lines), `frontend/index.html` (2,575 lines), `frontend/js/` directory  

### Why

`frontend/js/app.js` is a 11,819-line monolith. Every tab (chart, AI profile, transits, practitioners, diary, billing, achievements, settings) loads and parses its entire logic on first request regardless of which tab the user visits. One developer bug in the diary controller can silently break the billing modal. No tree-shaking or code-splitting is possible in the current structure.

### Module Map

Extract into the following modules (one per tab/concern):

| New Module | Lines (est.) | Responsibility |
|---|---|---|
| `frontend/js/core.js` | ~400 | App bootstrap, global state, tab router, event bus |
| `frontend/js/controllers/auth-controller.js` | ~600 | Login, register, logout, OAuth, 2FA, token refresh |
| `frontend/js/controllers/chart-controller.js` | ~800 | Chart tab: calculate, display, history, bodygraph |
| `frontend/js/controllers/profile-controller.js` | ~700 | AI Profile tab: synthesis, streaming, question input |
| `frontend/js/controllers/transit-controller.js` | ~500 | Transits tab: current transits, forecast, alerts |
| `frontend/js/controllers/practitioner-controller.js` | ~900 | Practitioner clients, session notes, directory |
| `frontend/js/controllers/diary-controller.js` | ~600 | Diary entries, check-in, insights |
| `frontend/js/controllers/billing-controller.js` | ~500 | Pricing modals, checkout, subscription management |
| `frontend/js/controllers/achievements-controller.js` | ~300 | Leaderboard, badges, streaks |
| `frontend/js/controllers/settings-controller.js` | ~200 | Settings tab, push preferences, notification toggles |
| `frontend/js/state.js` | ~150 | Shared reactive state (user session, current chart, tier) |

### Implementation Steps

1. **Create `frontend/js/state.js`** — Extract `window._currentUser`, `window._lastChart`, `window._lastForge` and all shared state into a reactive module export. This is prerequisite for all other splits.
2. **Create `frontend/js/core.js`** — Extract tab router (`switchTab()`), app init flow, global event listeners, and `updateWelcomeMessage()`. Import from `state.js`.
3. **Extract auth** → `auth-controller.js`. Move all login/register/logout/OAuth/refresh logic and their DOM event bindings. Export `init()` called from `core.js`.
4. **Extract chart** → `chart-controller.js`. Move `renderChart()`, `calculateChart()`, `renderHistory()`, bodygraph rendering. Import `state.js`.
5. **Extract profile** → `profile-controller.js`. Move synthesis prompt builder, streaming response handler, AI profile display. This is the heaviest tab.
6. **Extract transit** → `transit-controller.js`.
7. **Extract practitioner** → `practitioner-controller.js`.
8. **Extract diary** → `diary-controller.js`.
9. **Extract billing** → `billing-controller.js` (pricing modals, checkout session creation).
10. **Extract achievements + settings** → their controllers.
11. **Implement lazy loading:** Each controller's `init()` is only called when its tab is first activated (`tabController.observe(tabId, controller.init)`). This defers parse + execute until needed.
12. **Update `index.html`** to use `<script type="module" src="js/core.js">` instead of the current `<script src="js/app.js">`.
13. **Rollup bundling (optional Phase 2):** If browser support for native ES modules is not broad enough, configure the existing `@rollup/rollup-linux-x64-gnu` dep to bundle per-route chunks.
14. **Smoke test:** Run `npm run test:gate` after each extraction step. Don't merge a step that breaks tests.

### Done Definition

- `frontend/js/app.js` is deleted or reduced to < 200 lines (only re-exports for backwards compat)
- Each controller is < 1000 lines
- First-load JS payload (Cloudflare Pages metrics) decreases by ≥ 25%
- All 331 vitest tests pass
- Gate spec passes (login, calculate, synthesize)

---

## GAP-002 — Consolidate to One CSS Token System

**Backlog ID:** BL-FRONTEND-P1-9  
**Issue Registry ID:** GAP-002  
**Impact:** Predictable rendering; any color change applies uniformly; design system is trustworthy  
**Effort:** 1 day  
**Files in Scope:**  
- `frontend/css/design-tokens.css` (delete)  
- `frontend/css/design-tokens-premium.css` (delete)  
- `frontend/index.html` inline `<style>` block (remove `:root {}` vars)  
- `frontend/css/app.css` (update references)  
- All 8 CSS component files in `frontend/css/components/`  

### Why

There are three competing `:root {}` token systems that override each other unpredictably. The net effect is that developers cannot reliably look up what `--gold` resolves to because it depends on which file loaded last. The inline `<style>` in `index.html` is the effective winner — bypassing the design system entirely.

### Canonical Token Resolution

| Context | Winner | Resolved Value |
|---------|--------|----------------|
| Background primary | `index.html` inline | `#0a0a0f` |
| Background surface | `index.html` inline | `#1a1a24` |
| Text primary | `index.html` inline | `#eceaf4` |
| Text secondary | **bumped for WCAG** | `#c4c0d8` (was `#b0acc8`) |
| Text muted | **bumped for WCAG** | `#918db0` (was `#7a76a0`) |
| Gold / interactive | `design-tokens-premium.css` | `#d4af37` (drop `#c9a84c`) |
| Border | `index.html` inline | `#32324a` |

### Implementation Steps

1. Create `frontend/css/tokens.css` with exactly one `:root {}` block containing all resolved values.
2. Audit every `var(--token-name)` usage across all 8 CSS files. Map old names → new canonical names.
3. Replace all references to `--gold`, `--bg`, `--text`, `--border` with canonical names.
4. Remove `<link rel="stylesheet" href="css/design-tokens.css">` from `index.html`.
5. Remove `<link rel="stylesheet" href="css/design-tokens-premium.css">` from `index.html`.
6. Remove the `:root {}` block from `index.html` inline styles (keep only `display:none` and `width:0%` properties which are runtime-controlled).
7. Add `<link rel="stylesheet" href="css/tokens.css">` as the first CSS import.
8. Run WCAG contrast check on all text/background combos using the new canonical values — must all pass AA.
9. Visual regression: compare screenshots before/after the merge.

### Done Definition

- Single `tokens.css` file, no other `:root {}` blocks in the codebase
- All text elements pass WCAG AA (4.5:1 normal, 3:1 large)
- No `--gold` vs `--color-gold` ambiguity; one canonical name
- Design system documentation updated in `frontend/DESIGN_SYSTEM.md`

---

## GAP-003 — Fix WCAG AA Contrast on 6 Elements

**Backlog ID:** BL-FRONTEND-P2-8  
**Issue Registry ID:** GAP-003  
**Impact:** Accessibility compliance; brand trust with older demographics; immediate zero-regression fix  
**Effort:** 2 hours  
**Files in Scope:** `frontend/css/app.css`, `frontend/css/design-tokens-premium.css`  
**Note:** This is a subset of GAP-002. Apply independently now; GAP-002 consolidates further.

### Exact Fixes Required

| Selector | Current Color | Current Ratio | Fix To | New Ratio |
|---|---|---|---|---|
| `.data-label` | `#b0acc8` on `#1a1a24` | ~4.2:1 ❌ | `#c4c0d8` | ~5.5:1 ✅ |
| `.data-block h4` | `#b0acc8` on `#1a1a24` | ~4.2:1 ❌ | `#c4c0d8` | ~5.5:1 ✅ |
| `.text-muted` | `#7a76a0` on `#0a0a0f` | ~3.1:1 ❌ | `#918db0` | ~4.5:1 ✅ |
| `.history-meta` | `#7a76a0` on `#1a1a24` | ~2.4:1 ❌ | `#918db0` | ~4.6:1 ✅ |
| `.raw-toggle` | `#7a76a0` on `#111118` | ~2.6:1 ❌ | `#918db0` | ~4.5:1 ✅ |
| Transit planet labels | `#b0acc8` on `#1a1a24` | ~4.2:1 ❌ | `#c4c0d8` | ~5.5:1 ✅ |

### Implementation Steps

1. In `frontend/css/app.css`, update the `--text-dim` / `--text-secondary` token value from `#b0acc8` to `#c4c0d8`.
2. In `frontend/css/app.css`, update the `--text-muted` token value from `#7a76a0` to `#918db0`.
3. Search for hardcoded hex values `#b0acc8` and `#7a76a0` in all CSS — replace with token references.
4. Visual spot-check on dark theme.

### Done Definition

- All 6 elements pass WCAG AA automated check
- No new contrast regressions introduced
- Accessibility audit passes (re-run `ACCESSIBILITY_AUDIT.md` checklist)

---

## GAP-004 — Deterministic E2E Release Gate

**Backlog ID:** BL-TEST-P1-3 (supersedes BL-TEST-P1-2)  
**Issue Registry ID:** GAP-004  
**Impact:** Deployments can only merge when the gate passes; removes "deploy and hope" for the auth flow  
**Effort:** 1–2 days  
**Files in Scope:**  
- `playwright.config.ts`  
- `tests/e2e/` directory  
- `frontend/js/app.js` / `core.js` (add `?e2e=1` bypass)  
- `package.json` (new npm script)  
- `.github/workflows/` (gate enforcement)  

### Why

The current Playwright gate is blocked by a timing race in the first-run onboarding modal. The modal appears before login, and the test dismisses it with a time-based wait rather than a deterministic signal — so test results depend on machine load. This makes the release gate untrustworthy.

### Implementation Steps

1. **Add E2E bypass param:** In `frontend/js/app.js` (or the extracted `core.js`), check `URLSearchParams` for `?e2e=1`. If set, skip the first-run onboarding modal display entirely. This is a test seam — not a permanent bypass.
2. **Create test env vars:** Add `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` to `.env.example` and CI secrets. These are dedicated test account credentials (not production staff accounts).
3. **Create `tests/e2e/auth-gate.spec.ts`:**
   - Navigates to `/?e2e=1`
   - Enters `E2E_TEST_EMAIL` + `E2E_TEST_PASSWORD`
   - Asserts successful login (sidebar nav visible, user name rendered)
   - Asserts logout works
   - Uses `waitForSelector` with explicit state, no `page.waitForTimeout()`
4. **Create `tests/e2e/smoke-gate.spec.ts`:**
   - Runs after auth-gate
   - Calculates a chart with the AP test vector (Aug 5, 1979, Tampa FL)
   - Asserts chart renders (bodygraph container visible, type text present)
   - Navigates to AI Profile tab
   - Asserts synthesis form is present
5. **Create `playwright.gate.config.ts`:** Config file that only runs `auth-gate.spec.ts` and `smoke-gate.spec.ts`. `fullyParallel: false`, retries: 0 (gate must be deterministic, not retried).
6. **Add npm script** `"test:gate": "playwright test --config playwright.gate.config.ts"`
7. **Update CI** (`.github/workflows/ci.yml`): add `npm run test:gate` as a required step before `npm run deploy:workers`.
8. **(Phase 2)** Expand gate to include: billing checkout, practitioner session notes.

### Done Definition

- `npm run test:gate` succeeds 10/10 consecutive runs on clean machine
- Gate fails if login is broken (auth regression detected immediately)
- CI prevents deploy when gate fails
- `BL-TEST-P1-2` officially closed

---

## GAP-005 — Native iOS + Android App (Capacitor)

**Backlog ID:** BL-MOBILE-P1-1  
**Issue Registry ID:** GAP-005  
**Impact:** Distribution — App Store discovery, push install intent, IAP revenue; Co-Star/Pattern compete here  
**Effort:** 6–10 weeks  
**ADR Reference:** `docs/ADR-001-mobile-distribution-v1.md`  

### Why Capacitor (Not React Native)

The entire product is a JavaScript SPA already running in Cloudflare Pages. Capacitor wraps a WebView around the existing web app with native API bridges. The alternative (React Native) would require rewriting 11,819+ lines of app logic in React. Capacitor lets the existing codebase be the native app with zero duplication.

### Phase Plan

**Phase 0 — Pre-work (3 days)**
- Audit `frontend/index.html` for WebView incompatibilities (no Flash, no Web Bluetooth, check safe-area-inset usage)
- Create `frontend/js/native-bridge.js` to detect Capacitor environment and expose shim API for push/haptics/share
- Update OAuth redirect URIs to include `primeself://auth` scheme in Google Cloud Console and Stripe

**Phase 1 — Scaffold (Week 1–2)**
- Install: `npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`
- `npx cap init "Prime Self" "net.selfprime.app" --web-dir frontend`
- Add `net.selfprime.app` scheme to `frontend/manifest.json`
- Add Android + iOS platforms: `npx cap add ios && npx cap add android`
- First successful local build on both platforms

**Phase 2 — Native Features (Week 2–3)**
- Push notifications: `@capacitor/push-notifications` — replace VAPID web push with native APNs/FCM
- Haptics on key interactions: `@capacitor/haptics`
- Share sheet (replaces web navigator.share): `@capacitor/share`
- Deep links: configure `primeself://` scheme and Associate Domains for Apple Sign-In

**Phase 3 — In-App Purchases (Week 3–4)**
- Integrate RevenueCat SDK (cross-platform IAP abstraction)
- Map existing 4 subscription tiers to App Store / Google Play subscriptions
- Add RevenueCat webhook → Prime Self `/api/billing/revenuecat-webhook` (new handler)
- Gate: subscription purchased through IAP must update user tier in Neon via webhook

**Phase 4 — Beta (Week 5–6)**
- Build: TestFlight (iOS) + internal test track (Android)
- Invite 20 beta practitioners
- Fix top reported issues

**Phase 5 — Store Submission (Week 7–8)**
- Prepare App Store assets (screenshots, metadata, privacy policy link)
- Prepare Google Play assets
- Submit both for review
- Address review feedback

**Phase 6 — Launch + Monitor (Week 9–10)**
- Staged rollout (20% of users first)
- Monitor crash rate, IAP conversion, retention D1/D7
- Announce to practitioner mailing list

### Done Definition

- Prime Self is available on App Store (iOS) and Google Play (Android)
- IAP subscriptions sync to user tier in under 60 seconds
- Native push notifications deliver (not just web push)
- Onboarding conversion rate ≥ equal to web app

---

## GAP-006 — Gene Keys Legal Closure

**Backlog ID:** BL-SEC-P1-5  
**Issue Registry ID:** GAP-006  
**Impact:** Removes active IP liability ahead of any paid marketing / press activity  
**Effort:** External (legal counsel review); internal prep estimated at 4 hours  
**Status:** Blocked on external legal review  

### Context

The frontend rebrand replaced "Gene Keys" with "Frequency Keys" on all user-facing surfaces. However:
- The knowledgebase corpus (`src/knowledgebase/genekeys/`) contains 64 files of Gene Keys content used for RAG synthesis
- The internal synthesis prompt and AI context still reference Gene Keys methodology
- Practitioner directory has `certifications` field where practitioners self-report Gene Keys certifications

### Required Actions

1. **Document the current exposure:** Produce a 1-page memo listing every file containing Gene Keys-derived content, distinguishing: (a) direct quotes, (b) derived descriptions, (c) structural references only.
2. **Brief legal counsel** with the memo. Ask for determination on: (a) whether RAG-based reference to 64 Gene Keys descriptions requires a license; (b) whether a trademark disclaimer is sufficient; (c) whether "Frequency Keys" as a brand is clear of conflict.
3. **Implement one of three outcomes based on legal decision:**
   - **OK as fair use:** Add attribution notice to Terms + disclaimer in synthesis output footer. Close this item.
   - **Disclaimer sufficient:** Add to `frontend/terms.html`, synthesis prompt output, and `docs/GLOSSARY.md`. Close.
   - **License required:** Negotiate with GeneKeys.com; or commissioned independent 64-description set to replace corpus content.
4. **Update BL-SEC-P0-1 resolution note** with legal closure documentation.

### Done Definition

- Written legal determination on file (even if informal counsel email)
- One of three outcomes implemented per above
- No active unresolved IP liability on Gene Keys content

---

## GAP-007 — Machine-Generated API Docs from Router

**Backlog ID:** BL-DOCS-P1-3  
**Issue Registry ID:** GAP-007  
**Impact:** Partner integrations, practitioner API keys, and internal dev all have a trustworthy reference  
**Effort:** 1 day  
**Files in Scope:**  
- New `scripts/generate-api-docs.js`  
- `workers/src/index.js` (source of truth)  
- `docs/openapi.json` (exists, needs alignment)  
- `docs/API.md` (exists but outdated)  
- `package.json`  

### Why

The router in `workers/src/index.js` registers 110+ exact routes and 15 prefix handlers. The existing `docs/API.md` and `docs/openapi.json` both drift from the router within days of any handler addition. The only reliable source of truth is the router itself.

### Implementation Steps

1. **Write `scripts/generate-api-docs.js`:**
   - Parse `workers/src/index.js` to extract all `router.GET/POST/PUT/PATCH/DELETE` calls
   - For each route: capture method, path, handler name, whether it appears in `AUTH_ROUTES`/`PUBLIC_ROUTES`/`AUTH_PREFIXES`
   - For each handler file: extract the first JSDoc block (`/** ... */`) if present as description
   - Output `docs/API_GENERATED.md` — a Markdown table: `Method | Path | Auth | Tier | Description | Handler`
   - Output `docs/openapi-generated.json` — OpenAPI 3.0.3 skeleton with all paths, operationIds from handler names, and `security: [bearerAuth]` on auth routes

2. **Add npm scripts:**
   ```json
   "docs:api": "node scripts/generate-api-docs.js",
   "docs:api:check": "node scripts/generate-api-docs.js --check"
   ```
   The `--check` variant exits non-zero if the generated output differs from what's committed (CI check).

3. **Add JSDoc to key handlers** where description is currently missing (profile.js, billing.js, practitioner.js, auth.js). 10–15 handlers are the priority.

4. **Update `docs/API.md`** to redirect readers to `docs/API_GENERATED.md` and mark itself as the audit/narrative reference only.

5. **Wire CI check:** Add `npm run docs:api:check` to `.github/workflows/ci.yml` — fails if docs are out of sync with router.

6. **Update `docs/DEVELOPER_ONBOARDING.md`** with the new docs generation workflow.

### Done Definition

- `docs/API_GENERATED.md` exists and enumerates all 110+ routes
- `docs/openapi-generated.json` is valid OpenAPI 3.0
- CI fails if a new route is added without running `npm run docs:api`
- `docs/API.md` marks itself as narrative-only with link to generated output

---

## GAP-008 — Real-Time Collaborative Practitioner Sessions

**Backlog ID:** BL-PRACTITIONERS-P1-3  
**Issue Registry ID:** GAP-008  
**Impact:** Practitioners can deliver live chart readings with the client seeing the same view — a key differentiator vs. static PDF delivery  
**Effort:** 4–6 weeks  

### Architecture Decision

Use **Cloudflare Durable Objects** (already on Paid plan) for per-session WebSocket fan-out. No separate signaling server. Each DO instance manages state for one live session.

```
Practitioner Browser  ──WebSocket──▶  CF Worker (upgrade handler)
                                           │
                                           ▼
                                  Durable Object (LiveSession-{sessionId})
                                           │
                              ┌────────────┴────────────┐
                              ▼                          ▼
                     Client Browser (WebSocket)   Practitioner Browser
                     (read-only view)              (full control)
```

### New Files Required

| File | Purpose |
|------|---------|
| `workers/src/handlers/live-session.js` | WebSocket upgrade handler; validates JWT; creates/joins DO room |
| `workers/src/durable-objects/LiveSession.js` | DO class: WebSocket fan-out, chart state, pointer broadcasts, note sync |
| `workers/src/handlers/session-invite.js` | Create invite token; GET `/api/live-session/invite` |
| `frontend/js/live-session-client.js` | WebSocket client; renders "who's here" indicator; syncs chart focus |
| `frontend/css/components/live-session.css` | "Live" badge, pointer overlay, session panel |

### wrangler.toml Changes

```toml
[[durable_objects.bindings]]
name = "LIVE_SESSION"
class_name = "LiveSession"

[[migrations]]
tag = "v1-live-session"
new_classes = ["LiveSession"]
```

### Phase Plan

**Phase 1 — MVP (2 weeks)**
- Practitioner opens "Start Live Session" from client detail panel
- System generates a one-time join link (expires 8 hours): `https://selfprime.net/live/{token}`
- Client clicks link → sees practitioner's current chart tab (read-only)
- Practitioner can highlight a gate → client sees same gate highlighted
- Practitioner can type notes → appear on both screens in real-time
- Session ends when practitioner clicks "End Session"

**Phase 2 — Rich Collaboration (2–4 weeks)**
- Annotation layer over bodygraph: pointer dot shows where practitioner is looking
- AI synthesis can be triggered by practitioner; client watches streaming response live
- Post-session: auto-generated session summary email to both parties
- Session recording: store note transcript to `practitioner_session_notes` table

### Security Requirements

- Join token is single-use and time-bound (8-hour TTL in KV)
- Only the practitioner who created the session can send chart updates (role enforced in DO)
- Client join validates against `practitioner_clients` table (client must be associated with this practitioner)
- WebSocket messages are structure-validated (no arbitrary eval/exec paths)

### Done Definition

- Practitioner and client can co-view the same chart simultaneously
- Sub-100ms round-trip latency for pointer updates (Cloudflare edge)
- Session state is isolated per DO instance (no cross-practitioner bleeding)
- Post-session notes are saved and accessible in the existing session notes UI

---

## Integration Schedule

```
Week of Mar 20  → GAP-003 (2hrs), GAP-002 (1 day), GAP-007 (1 day), GAP-004 (2 days)
Week of Mar 25  → GAP-001 (3-5 days, begin extraction)
Mar-Apr         → GAP-005 Phase 0+1, GAP-006 legal brief submitted
Apr             → GAP-001 complete, GAP-008 Phase 1 MVP
May             → GAP-005 Phases 2-4 (beta), GAP-008 Phase 2
June            → GAP-005 store submission
```

---

## Dependency Map

```
GAP-003 (WCAG)        ──▶ feeds into ──▶  GAP-002 (tokens)
GAP-002 (tokens)      ──▶ prereq for ──▶  GAP-001 (app.js split, CSS module exports)
GAP-004 (E2E gate)    ──▶ gates ────────▶  all deploys
GAP-007 (API docs)    ──▶ enables ────▶   GAP-005 (IAP webhook integration) 
GAP-006 (legal)       ──▶ unblocks ────▶  marketing/press
GAP-008 (live session) ──▶ requires ───▶  GAP-004 (new gate spec for WebSocket)
GAP-005 (mobile)      ──▶ requires ───▶  GAP-004 (IAP webhook gate)
```

---

*This plan was generated from the World-Class Market Assessment (2026-03-20). All 8 items are tracked in MASTER_BACKLOG_SYSTEM_V2.md and audits/issue-registry.json.*

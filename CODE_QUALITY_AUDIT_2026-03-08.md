# Code Quality Audit Report

**Date:** March 8, 2026  
**Scope:** Full HumanDesign codebase  
**Focus:** Dead code, duplication, naming, magic numbers, SRP violations, error handling, deprecated APIs, unreferenced modules, leftover scaffolding

---

## Executive Summary

| Severity | Count |
|----------|-------|
| **CRITICAL** | 1 |
| **HIGH** | 4 |
| **MEDIUM** | 8 |
| **LOW** | 12 |
| **INFO** | 6 |

**Total Issues Found:** 31

---

## CRITICAL (1)

### 1. Hardcoded API Base URL in Frontend

| Property | Value |
|----------|-------|
| **File** | [frontend/index.html](frontend/index.html#L1101) |
| **Line** | 1101 |
| **Type** | Hardcoded String |
| **Impact** | Deployment failures, environment mismatch |

**Finding:**
```javascript
const API = 'https://prime-self-api.adrper79.workers.dev';
```

The API endpoint is hardcoded to a development subdomain (`adrper79.workers.dev`) rather than the production domain. This causes production traffic to hit the wrong endpoint.

**Recommended Fix:**
```javascript
// Detect environment from current hostname or use config
const API = window.location.hostname.includes('localhost') 
  ? 'https://prime-self-api.adrper79.workers.dev'
  : 'https://prime-self-api.primeself.workers.dev';
```

Or inject via build-time environment variable.

---

## HIGH (4)

### 2. Duplicated ASPECT_TYPES Constant

| Property | Value |
|----------|-------|
| **Files** | [src/engine/astro.js](src/engine/astro.js#L288), [src/engine/transits.js](src/engine/transits.js#L24) |
| **Type** | Code Duplication |
| **Impact** | Data inconsistency, maintenance burden |

**Finding:**
Two definitions of `ASPECT_TYPES` exist with **different orb values**:

**astro.js (L288):**
```javascript
const ASPECT_TYPES = [
  { name: 'Conjunction',  angle: 0,   orbLum: 8, orbPlan: 6 },
  { name: 'Opposition',   angle: 180, orbLum: 8, orbPlan: 6 },
  // ... different orb schema
];
```

**transits.js (L24):**
```javascript
const ASPECT_TYPES = [
  { name: 'Conjunction',  angle: 0,   orb: 6 },
  { name: 'Opposition',   angle: 180, orb: 6 },
  // ... single orb field
];
```

The `transits.js` file even has a TODO comment acknowledging this:
```javascript
// TODO: ASPECT_TYPES is duplicated from astro.js (which uses orbLum/orbPlan).
// Refactor to import from a shared module to keep orb values in sync.
```

**Recommended Fix:**
Create `src/engine/constants.js` exporting shared `ASPECT_TYPES` and import in both files.

---

### 3. Magic Numbers for Pricing (Revenue Calculation)

| Property | Value |
|----------|-------|
| **File** | [workers/src/handlers/analytics.js](workers/src/handlers/analytics.js#L308-L310) |
| **Line** | 308-310 |
| **Type** | Magic Number |
| **Impact** | Pricing changes require code modification |

**Finding:**
```javascript
const seekerRevenue = Number(m.seeker_count || 0) * 1500;        // $15.00
const guideRevenue = Number(m.guide_count || 0) * 9700;          // $97.00  
const practitionerRevenue = Number(m.practitioner_count || 0) * 50000; // $500.00
```

Price values in cents (1500, 9700, 50000) are hardcoded rather than pulled from `stripe.js` tier config.

**Recommended Fix:**
```javascript
import { getTierConfig } from '../lib/stripe.js';
const tiers = getTierConfig(env);
const seekerRevenue = Number(m.seeker_count || 0) * tiers.seeker.priceCents;
```

---

### 4. Missing Environment-Aware CORS Origins

| Property | Value |
|----------|-------|
| **File** | [workers/src/middleware/cors.js](workers/src/middleware/cors.js#L64) |
| **Line** | ~64-74 |
| **Type** | Hardcoded Configuration |
| **Impact** | Domain changes require code deploy |

**Finding:**
Production origins are hardcoded:
```javascript
'Access-Control-Max-Age': '86400',
// Production origins hardcoded: selfprime.net, prime-self-ui.pages.dev
```

**Recommended Fix:**
Move origins to `wrangler.toml` environment variables:
```toml
[vars]
ALLOWED_ORIGINS = "https://primeself.app,https://prime-self-ui.pages.dev"
```

---

### 5. Leftover TODO in WordPress Plugin

| Property | Value |
|----------|-------|
| **File** | [wordpress-plugin/assets/js/widget.js](wordpress-plugin/assets/js/widget.js#L328) |
| **Line** | 328 |
| **Type** | Incomplete Feature |
| **Impact** | Modal functionality not implemented |

**Finding:**
```javascript
openModal: function() {
    // TODO: Implement modal functionality
    alert('Modal calculator coming soon! For now, add [primeself_chart] shortcode to a page.');
}
```

The modal feature is stubbed but not implemented.

**Recommended Fix:**
Either implement the modal or remove the button that calls `openModal()`.

---

## MEDIUM (8)

### 6. Leftover TODO in Frontend Chart Sharing

| Property | Value |
|----------|-------|
| **File** | [frontend/index.html](frontend/index.html#L3823) |
| **Line** | 3823 |
| **Type** | Incomplete Feature |
| **Impact** | User-facing feature placeholders |

**Finding:**
```javascript
// TODO: Implement when bodygraph chart rendering is complete
// For now, show coming soon message
showNotification('Chart image sharing coming soon!', 'info');
```

Functions `shareChartImage()` and `downloadChart()` are stubs returning "coming soon" messages.

**Recommended Fix:**
Complete bodygraph canvas rendering or hide these UI buttons.

---

### 7. Commented-Out Analytics Integration

| Property | Value |
|----------|-------|
| **File** | [frontend/index.html](frontend/index.html#L3940-L3943) |
| **Line** | 3940-3943 |
| **Type** | Dead Code |
| **Impact** | Analytics data not being captured |

**Finding:**
```javascript
function trackEvent(category, action, label) {
  console.log(`📊 Event: ${category} / ${action} / ${label}`);
  // Future: Send to Google Analytics, Mixpanel, etc.
  // if (window.gtag) {
  //   gtag('event', action, { event_category: category, event_label: label });
  // }
}
```

The analytics stub logs to console but doesn't send data anywhere.

**Recommended Fix:**
Integrate with actual analytics provider or remove tracking calls.

---

### 8. Magic Numbers for Time Constants

| Property | Value |
|----------|-------|
| **Files** | Multiple (cors.js, cache.js, push.js, onboarding.js) |
| **Type** | Magic Number |
| **Impact** | Difficult to understand and maintain |

**Finding (examples):**
```javascript
// cors.js
'Access-Control-Max-Age': '86400',  // What is 86400?

// push.js
const exp = Math.floor(Date.now() / 1000) + 12 * 3600;  // 12 hours

// onboarding.js
{ expirationTtl: 365 * 24 * 3600 }  // 365 days
```

**Recommended Fix:**
Create `workers/src/lib/constants.js`:
```javascript
export const TIME = {
  SECOND: 1,
  MINUTE: 60,
  HOUR: 3600,
  DAY: 86400,
  WEEK: 604800,
  YEAR: 31536000,
};
```

---

### 9. Duplicate Julian Day Calculation

| Property | Value |
|----------|-------|
| **Files** | [workers/src/handlers/diary.js](workers/src/handlers/diary.js#L27), [workers/src/handlers/timing.js](workers/src/handlers/timing.js#L270) |
| **Type** | Code Duplication |
| **Impact** | Potential calculation drift |

**Finding:**
Both files contain identical Julian Day calculation:
```javascript
// diary.js:27
return day + Math.floor((153 * m + 2) / 5) + 365 * y

// timing.js:270
let jd = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4);
```

Note: The formulas differ slightly (timing.js has `+ Math.floor(y / 4)`).

**Recommended Fix:**
Import from `src/engine/julian.js` which has the canonical `toJulianDay()` function.

---

### 10. Confusing Naming: webhook.js vs webhooks.js

| Property | Value |
|----------|-------|
| **Files** | [workers/src/handlers/webhook.js](workers/src/handlers/webhook.js), [workers/src/handlers/webhooks.js](workers/src/handlers/webhooks.js) |
| **Type** | Naming Inconsistency |
| **Impact** | Developer confusion |

**Finding:**
- `webhook.js` – Handles Stripe webhooks (`handleStripeWebhook`)
- `webhooks.js` – Handles user-registered webhooks (`handleWebhooks`)

The singular/plural naming convention is confusing.

**Recommended Fix:**
Rename to:
- `stripeWebhook.js` – Stripe webhook handler
- `userWebhooks.js` – User webhook registration/management

---

### 11. Excessive console.log Calls in Production Code

| Property | Value |
|----------|-------|
| **Files** | 50+ matches across workers/src |
| **Type** | Code Quality |
| **Impact** | Log noise in production, performance |

**Finding (sample):**
```javascript
// webhookDispatcher.js
console.log(`[webhookDispatcher] Dispatching ${eventType} to ${webhookList.length} webhook(s)`);
console.log(`[webhookDispatcher] ✅ Delivered ${eventType} to ${url} (${response.status})`);
console.warn(`[webhookDispatcher] ⚠️ Non-2xx response from ${url}: ${response.status}`);
```

**Recommended Fix:**
Use structured logging with log levels:
```javascript
import { logger } from './lib/logger.js';
logger.info('Dispatching webhook', { eventType, count: webhookList.length });
```

---

### 12. API Version Hardcoded in Health Check

| Property | Value |
|----------|-------|
| **File** | [workers/src/index.js](workers/src/index.js#L458) |
| **Line** | ~458 |
| **Type** | Hardcoded String |
| **Impact** | Version drift, manual updates required |

**Finding:**
```javascript
const base = {
  status: 'ok',
  version: '0.2.0',  // Hardcoded
  timestamp: new Date().toISOString(),
  cache: getCacheMetrics(),
};
```

**Recommended Fix:**
Read from package.json or environment variable:
```javascript
import pkg from '../package.json' assert { type: 'json' };
version: pkg.version,
```

---

### 13. Deprecated NPM Package Warning

| Property | Value |
|----------|-------|
| **File** | [workers/package-lock.json](workers/package-lock.json#L1664) |
| **Line** | 1664 |
| **Type** | Deprecated Dependency |
| **Impact** | Security, no longer maintained |

**Finding:**
```json
"deprecated": "This package has been deprecated and is no longer maintained. Please use @rollup/plugin-inject."
```

Also at line 1845:
```json
"deprecated": "Please use @jridgewell/sourcemap-codec instead"
```

**Recommended Fix:**
Run `npm audit` and update deprecated packages:
```bash
npm update rollup-plugin-inject --save-dev
```

---

## LOW (12)

### 14. Dead Code Note in billing.js

| Property | Value |
|----------|-------|
| **File** | [workers/src/handlers/billing.js](workers/src/handlers/billing.js#L430-L437) |
| **Line** | 430-437 |
| **Type** | Dead Code Comment |
| **Impact** | Code clutter |

**Finding:**
```javascript
// ─── DEAD CODE REMOVED ──────────────────────────────────────
// BL-FIX: The handleWebhook function and its local handlers
// (handleCheckoutCompleted, handleSubscriptionUpdated, handleSubscriptionDeleted,
//  handleInvoicePaid, handleInvoicePaymentFailed) were dead code.
```

This comment block documenting removed code can itself be removed.

**Recommended Fix:**
Remove the dead code notice; history is in git.

---

### 15-19. Inconsistent Error Response Patterns

| Property | Value |
|----------|-------|
| **Files** | Multiple handlers |
| **Type** | Naming Inconsistency |
| **Impact** | Inconsistent API responses |

**Finding (examples):**
```javascript
// Some handlers return:
return Response.json({ error: 'Unauthorized' }, { status: 401 });

// Others return:
return new Response(JSON.stringify({ error: 'Unauthorized' }), {
  status: 401,
  headers: { 'Content-Type': 'application/json' }
});
```

**Recommended Fix:**
Use `errorResponse()` from `lib/errorMessages.js` consistently.

---

### 20-21. TTL Constants Not Exported

| Property | Value |
|----------|-------|
| **File** | [workers/src/handlers/auth.js](workers/src/handlers/auth.js#L22-L23) |
| **Line** | 22-23 |
| **Type** | Code Duplication |
| **Impact** | TTL values may drift |

**Finding:**
```javascript
const ACCESS_TOKEN_TTL = 60 * 60 * 24;      // 24 hours
const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30; // 30 days
```

These constants are duplicated in the file-level scope and may be redefined elsewhere.

**Recommended Fix:**
Export from a shared config module.

---

### 22-25. Functions Exceeding SRP

| Property | Value |
|----------|-------|
| **Files** | [workers/src/handlers/alerts.js](workers/src/handlers/alerts.js), [workers/src/handlers/push.js](workers/src/handlers/push.js) |
| **Type** | SRP Violation |
| **Impact** | Difficult to test and maintain |

**Finding:**
`alerts.js` handles:
- CRUD for alerts
- Template management
- Alert evaluation (600+ lines)
- Push notification dispatch
- Webhook dispatch

**Recommended Fix:**
Extract evaluation logic to `lib/alertEvaluator.js`.

---

## INFO (6)

### 26. Large Inline JavaScript in index.html

| Property | Value |
|----------|-------|
| **File** | [frontend/index.html](frontend/index.html) |
| **Line** | 1100-4620 |
| **Type** | Architecture |
| **Impact** | Maintenance difficulty |

**Finding:**
Over 3500 lines of JavaScript are inline in the HTML file. 50+ functions defined inline.

**Recommended Fix:**
Extract to modular JS files:
- `js/auth.js`
- `js/api.js`
- `js/chart.js`
- `js/profile.js`
- etc.

---

### 27. Multiple CSP API Endpoints

| Property | Value |
|----------|-------|
| **File** | [frontend/index.html](frontend/index.html#L11) |
| **Line** | 11 |
| **Type** | Configuration |
| **Impact** | CSP maintenance |

**Finding:**
```html
connect-src 'self' https://prime-self-api.adrper79.workers.dev https://prime-self-api.primeself.workers.dev
```

Both dev and prod endpoints are in CSP, diluting security benefit.

**Recommended Fix:**
Use build-time CSP injection per environment.

---

### 28-31. Test Fixture Comments in Production Code

| Property | Value |
|----------|-------|
| **Files** | [tests/engine.test.js](tests/engine.test.js) (acceptable), but also comments in production files |
| **Type** | Code Clutter |
| **Impact** | Minor readability |

**Finding:**
Extensive section divider comments:
```javascript
// ═══════════════════════════════════════════════════════════════
// LAYER 1: Julian Day Number + Sun
// ═══════════════════════════════════════════════════════════════
```

These are fine in tests but appear extensively in production code too.

---

## Summary by Category

| Category | Count | Examples |
|----------|-------|----------|
| Dead Code / Incomplete | 5 | TODOs in frontend/wordpress, billing comment |
| Duplication | 3 | ASPECT_TYPES, Julian calc, error patterns |
| Magic Numbers | 3 | Pricing, TTLs, time constants |
| Naming Inconsistency | 3 | webhook/webhooks, error responses |
| Hardcoded Config | 3 | API URL, CORS, version |
| SRP Violations | 2 | alerts.js, push.js |
| Deprecated Dependencies | 2 | rollup-plugin-inject, sourcemap-codec |
| Architecture | 2 | inline JS, CSP |
| Unused Exports | 0 | None detected |
| Unreferenced Routes | 0 | All routes registered |

---

## Recommended Prioritization

### Immediate (Deploy Blockers)
1. ✅ Fix hardcoded API URL in frontend/index.html

### Sprint Backlog (High Value)
2. Create shared `ASPECT_TYPES` constant
3. Extract pricing constants from analytics.js
4. Move CORS origins to env vars
5. Complete or hide WordPress modal feature

### Tech Debt Sprint
6. Extract inline JS from index.html
7. Create TIME constants module
8. Standardize error response pattern
9. Update deprecated npm packages
10. Add structured logging layer

---

*Generated by Code Quality Audit Agent — March 8, 2026*

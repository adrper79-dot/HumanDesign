# Supplemental Findings: Public Routes with Enforced Authentication

**Scan Date:** 2026-03-17  
**Finding:** Multiple endpoints marked as PUBLIC_ROUTES but enforce authentication in handler  
**Severity:** 🟡 Medium — Confusing API contract, potential for future bugs  

---

## Mismatched Endpoints

| Endpoint | Marked As | Actually Enforces | Issue | Fix | Effort |
|----------|-----------|-------------------|-------|-----|--------|
| `/api/transits/forecast` | PUBLIC | Auth (401) | BL-N4 security (prevent CPU exhaustion) | **FIXED** — Now validates params first | ✅ Done |
| `/api/cycles` | PUBLIC | Auth (401) | Lifecycle data sensitive? | Needs auth reordering (same pattern) | 30 min |
| `/api/rectify` | PUBLIC | Auth (401) | Birth time correction sensitive? | Needs auth reordering (same pattern) | 30 min |

**Total Fix Effort:** 1 hour (cycles + rectify)

---

## Analysis: /api/cycles Endpoint

**File:** `workers/src/handlers/cycles.js` (line 48)

```javascript
export async function handleCycles(request, env) {
  const user = await getUserFromRequest(request, env);
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  // ... then validates params ...
  if (!birthDate || !birthTime) {
    return Response.json({
      ok: false,
      error: 'Missing required parameters: birthDate, birthTime'
    }, { status: 400 });
  }
```

**Issue:** Same as forecast was — auth check happens BEFORE param validation.

**Current Behavior:**
```
GET /api/cycles (no auth)
→ Returns 401 "Authentication required"
→ Client sees confusing error (not obvious that params are required)
```

**Expected Behavior:**
```
GET /api/cycles (no auth, no params)
→ Returns 400 "Missing required parameters: birthDate, birthTime"
→ Client knows exactly what's needed
```

**Impact:** Production gate test for cycles would FAIL with same error as forecast did.

**Recommendation:** Apply same fix as forecast — reorder param validation before auth check.

---

## Comprehensive Production Gate Risk

If we re-ran the full `npm run verify:prod:gate:api --strict-browser`, we might discover:
- ❌ `/api/cycles` returns same 401 issue as forecast was
- ✅ `/api/transits/forecast` now passes (fixed)
- ❓ Other PUBLIC endpoints with internal auth...?

**Action Items (Priority: 🟠 HIGH):** 
1. Fix `/api/cycles` same way as forecast (validate params first) — 30 min
2. Fix `/api/rectify` same way as forecast (validate params first) — 30 min
3. Audit remaining PUBLIC_ROUTES for similar pattern (find any others) — 15 min
4. Update production gate test to include `/api/cycles` and `/api/rectify` validation checks — 20 min
5. Document this pattern in code style guide to prevent future occurrences — 10 min

**Total Effort:** ~2 hours (including testing & prevention)

---

## Code Pattern: Public Routes with Auth Enforcement

**Current approach (problematic):**
```javascript
// index.js - Route declaration
const PUBLIC_ROUTES = new Set(['/api/cycles', ...]);

// cycles.js - Handler
export async function handleCycles(request, env) {
  const user = await getUserFromRequest(request, env);  // ← Auth check FIRST
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  
  // ... param validation ...
  if (!birthDate) return Response.json({ error: 'Missing param' }, { status: 400 });
}
```

**Better approach:**
```javascript
// cycles.js - Handler
export async function handleCycles(request, env) {
  // Validate params FIRST (even before auth)
  const birthDate = url.searchParams.get('birthDate');
  if (!birthDate) {
    return Response.json({ error: 'Missing param' }, { status: 400 });
  }
  
  // THEN check auth if needed
  const user = await getUserFromRequest(request, env);
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
}
```

**Or:** Move to AUTH_ROUTES instead of PUBLIC_ROUTES:
```javascript
const AUTH_ROUTES = new Set([
  '/api/cycles',  // Requires auth despite appearing as "query endpoint"
  '/api/transits/forecast',
  ...
]);
```

---

**Priority:** 🟠 **High** — Fix before declaring production ready
**Effort:** 30 min (same as forecast fix)
**Test Coverage:** Add cycles validation check to production gate


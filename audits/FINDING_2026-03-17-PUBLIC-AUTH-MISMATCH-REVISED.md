# Finding: PUBLIC_ROUTES vs. Auth Enforcement Discrepancy
**Date:** 2026-03-17  
**Severity:** 🟠 High  
**Status:** Identified; 1 fixed, 2 pending  
**Effort:** 1 hour (30 min × 2 endpoints; 1 already fixed)

---

## Executive Summary

Three endpoints are marked in `workers/src/index.js` `PUBLIC_ROUTES` set but enforce authentication in their handlers:

| Endpoint | Route | Handler | Auth Enforcement | Param Validation | Status |
|----------|--------|---------|---------|---------|--------|
| `/api/transits/forecast` | Line 269 | forecast.js L23-26 | ✅ Yes | ✅ Before auth | ✅ FIXED |
| `/api/cycles` | Line 270 | cycles.js L48-49 | ✅ Yes | ❌ After auth | ❌ BROKEN |
| `/api/rectify` | Line 271 | rectify.js L94-96 | ✅ Yes | ❌ After auth | ❌ BROKEN |

**Impact:** Broken endpoints return confusing **401 "Authentication required"** errors when clients provide missing/invalid parameters, instead of helpful **400 "Missing required parameters"** errors.

---

## Issue Details

### Root Cause
These endpoints were marked `PUBLIC_ROUTES` to **skip middleware authentication**, but then enforce authentication in the handler itself. This is intentional for expensive operations (like forecast calculation) that require auth protection.

**However, there's a logic ordering bug in cycles and rectify:** They check authentication BEFORE validating request parameters. This is backwards:

1. **Current behavior (broken):** Auth check → Returns 401 → Client never sees param validation error
2. **Expected behavior (fixed):** Param validation → Returns 400 if invalid → Auth check → Returns 401 if not authenticated

### Why This Pattern Exists
For expensive operations like forecast/cycles/rectify that require authentication:
- Skip the global middleware auth check (for performance or to handle auth in handler)
- But enforce auth in the handler anyway
- This lets you validate cheap operations (params) before doing expensive auth lookups

---

## Code Patterns

### ✅ CORRECT PATTERN (Forecast — Already Fixed in Commit 7c4fbf7)

**File:** `workers/src/handlers/forecast.js`

```javascript
async function handleForecast(request, env) {
  const log = request._log || createLogger('work:forecast');
  
  // STEP 1: Validate parameters (returns 400 if missing/invalid)
  const params = new URL(request.url).searchParams;
  const birthDate = params.get('birthDate');
  const birthTime = params.get('birthTime');
  const lat = params.get('lat');
  const lng = params.get('lng');
  
  if (!birthDate || !birthTime || !lat || !lng) {
    return Response.json(
      { error: 'Missing required parameters: birthDate, birthTime, lat, lng' },
      { status: 400 }
    );
  }
  
  // STEP 2: Check authentication (returns 401 if not logged in)
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return Response.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }
  
  // STEP 3: Proceed with expensive operation
  const forecast = calculateForecast(birthDate, birthTime, lat, lng);
  return Response.json({ forecast });
}
```

**Key Points:**
- ✅ Parameters validated first → returns 400
- ✅ Auth checked second → returns 401 only if params are valid
- ✅ Expensive operation only runs if both checks pass
- ✅ API client gets clear error message

---

### ❌ BROKEN PATTERN (Cycles, Rectify — Need Fixing)

**File:** `workers/src/handlers/cycles.js` (lines 40-70)

```javascript
async function handleCycles(request, env) {
  const log = request._log || createLogger('work:cycles');
  
  // ❌ STEP 1: Check authentication FIRST (wrong order!)
  const user = await getUserFromRequest(request, env);
  if (!user) {
    // Returns 401 even if request params are missing/invalid
    return Response.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }
  
  // ❌ STEP 2: Validate parameters SECOND (too late!)
  const params = new URL(request.url).searchParams;
  const birthDate = params.get('birthDate');
  const birthTime = params.get('birthTime');
  
  if (!birthDate || !birthTime) {
    // Client never sees this if not authenticated
    return Response.json(
      { error: 'Missing required parameters: birthDate, birthTime' },
      { status: 400 }
    );
  }
  
  // STEP 3: Proceed
  const cycles = calculateCycles(birthDate, birthTime);
  return Response.json({ cycles });
}
```

**Problem Scenario:**
1. Client sends: `GET /api/cycles` (no params, not logged in)
2. Handler calls `getUserFromRequest()` → returns `null`
3. Handler returns immediately with **401 "Authentication required"**
4. Client thinks: "I need to log in"
5. Client logs in, sends same request again
6. Handler returns **400 "Missing required parameters: birthDate, birthTime"**
7. Client is confused: "Server said I needed to log in, but my login didn't help!"

Same issue applies to **`/api/rectify`** (line 94 of `workers/src/handlers/rectify.js`).

---

## Impact Analysis

### On Production Gate Testing
Current production gate test checks: 4/4 worker tests, 7/7 public canary, but doesn't test cycles/rectify yet.

If we add param validation tests:
```javascript
{ 
  name: 'cycles param validation',
  method: 'GET',
  url: '/api/cycles',  // No auth, no params
  expectedStatus: 400,  // Not 401!
  expectedError: 'Missing required parameters'
},
{ 
  name: 'rectify param validation',
  method: 'GET',
  url: '/api/rectify',  // No auth, no params
  expectedStatus: 400,
  expectedError: 'Missing required parameters'
},
```

Both would **fail with 401** until fixed.

### On API Users
- API documentation might say these endpoints are available
- Users write code without auth headers and without params
- Get 401, think they need to authenticate
- Authenticate, try again with same request
- Still get 400 error
- Confusion about API requirements

---

## Fix Strategy

### For Cycles (`workers/src/handlers/cycles.js`)

**Change:**
1. Move param validation (lines ~60+) to **before** the `getUserFromRequest()` call (line 48)
2. Keep auth check but move it after param validation
3. Test that invalid params return 400, valid params return 401 if not auth'd

**Estimated Effort:** 30 minutes  
**Risk:** Low — same fix as forecast, fully tested pattern

---

### For Rectify (`workers/src/handlers/rectify.js`)

**Change:**
1. Move param validation (lines ~110+) to **before** the `getUserFromRequest()` call (line 94)
2. Keep auth check after param validation
3. Test similarly

**Estimated Effort:** 30 minutes  
**Risk:** Low

---

## Verification Plan

### Step 1: Fix Cycles
1. Reorder validation in `cycles.js`
2. Test with curl:
   ```bash
   curl 'http://localhost:8787/api/cycles'
   # Expected: 400 "Missing required parameters: birthDate, birthTime"
   
   curl 'http://localhost:8787/api/cycles?birthDate=1990-01-01'
   # Expected: 401 "Authentication required" (valid params, not logged in)
   ```

### Step 2: Fix Rectify
Same process for `rectify.js`

### Step 3: Update Production Gate
Add cycle + rectify param validation tests:
```javascript
{ 
  name: 'cycles param validation',
  method: 'GET',
  url: '/api/cycles',  // No auth, no params
  expectedStatus: 400,
  expectedError: 'Missing required parameters'
},
```

### Step 4: Verify All Endpoints
Run: `npm run verify:prod:gate:api`  
Expected: **17/17 passing** (up from 15/17)

---

## Secondary Finding: PUBLIC_ROUTES Misleading Naming

**Issue:** The `PUBLIC_ROUTES` set name is misleading. It actually contains:
- Routes that skip middleware auth but require auth in handler (forecast, cycles, rectify)
- Routes that are truly public with no auth requirement

**Recommendation:** Add comment to clarify:
```javascript
const PUBLIC_ROUTES = new Set([
  // Routes that skip global middleware auth but enforce auth in handler
  '/api/transits/forecast',
  '/api/cycles',
  '/api/rectify',
  
  // Actually unrestricted public routes
  '/api/chart/calculate',
  '/api/geocode',
  '/api/transits/today',
  ...
]);
```

**Effort:** 2 min  
**Priority:** Low — documentation only

---

## Timeline & Dependencies

| Task | Duration | Blocker | Dependencies |
|------|----------|---------|-----------|
| Fix cycles.js | 30 min | No | None |
| Fix rectify.js | 30 min | No | None |
| Verify both fixes locally | 10 min | No | Both fixes |
| Update prod gate tests | 10 min | No | Both fixes verified |
| Add route clarification comment | 2 min | No | None |
| **Total** | **1 hour 22 min** | | |

Can be done in parallel: Fix cycles + rectify while investigating register 500 error.

---

## References

- **Forecast Fix:** Commit `7c4fbf7` "fix(forecast): validate params BEFORE auth check"
- **Production Gate Test:** `workers/verify-money-path.js`
- **Route Config:** `workers/src/index.js` lines 265–280
- **Handler Files:**
  - `workers/src/handlers/forecast.js` (fixed example)
  - `workers/src/handlers/cycles.js` (needs fix at line 48)
  - `workers/src/handlers/rectify.js` (needs fix at line 94)

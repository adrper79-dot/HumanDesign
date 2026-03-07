# Tier Enforcement Integration Guide

**Created**: March 6, 2026  
**Purpose**: Guide for integrating tier-based feature gating and usage quotas into API handlers  
**Status**: Implementation Complete

---

## Overview

The tier enforcement system provides two primary middleware functions:
1. **Feature Access Control** (`enforceFeatureAccess`) - Boolean feature gates (user has/doesn't have feature)
2. **Usage Quota Enforcement** (`enforceUsageQuota`) - Monthly usage limits with automatic reset

Both middleware functions work with the authentication system and user subscription tiers.

---

## Tier Configuration

Defined in [workers/src/lib/stripe.js](../workers/src/lib/stripe.js):

```javascript
export const TIERS = {
  free: {
    name: 'Free',
    price: 0,
    features: {
      chartCalculations: 1,        // 1 chart per month
      profileGenerations: 1,        // 1 profile per month
      transitSnapshots: 1,
      apiCallsPerMonth: 0,
      smsDigests: false,            // Boolean feature
      practitionerTools: false,     // Boolean feature
      whiteLabel: false
    }
  },
  seeker: {
    name: 'Seeker',
    price: 1500,  // $15.00
    features: {
      chartCalculations: Infinity,  // Unlimited
      profileGenerations: 10,
      transitSnapshots: Infinity,
      apiCallsPerMonth: 0,
      smsDigests: true,             // Feature enabled
      practitionerTools: false,
      whiteLabel: false
    }
  },
  guide: {
    name: 'Guide',
    price: 9700,  // $97.00
    features: {
      chartCalculations: Infinity,
      profileGenerations: Infinity,
      transitSnapshots: Infinity,
      apiCallsPerMonth: 1000,
      smsDigests: true,
      practitionerTools: true,      // Practitioner features unlocked
      whiteLabel: false
    }
  },
  practitioner: {
    name: 'Practitioner',
    price: 50000,  // $500.00
    features: {
      chartCalculations: Infinity,
      profileGenerations: Infinity,
      transitSnapshots: Infinity,
      apiCallsPerMonth: 10000,
      smsDigests: true,
      practitionerTools: true,
      whiteLabel: true              // White label API access
    }
  }
};
```

---

## Integration Patterns

### Pattern 1: Feature Access Gate (Boolean)

Use when a feature is either available or not (no quota counting).

**Example: Practitioner Tools**

```javascript
// workers/src/handlers/practitioner.js
import { enforceFeatureAccess } from '../middleware/tierEnforcement.js';

export async function handlePractitioner(request, env, subpath) {
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Check if user's tier includes practitionerTools feature
  const featureCheck = await enforceFeatureAccess(request, env, 'practitionerTools');
  if (featureCheck) return featureCheck;  // Returns 403 if feature not available

  // User has access — continue with handler logic
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  // ... rest of handler
}
```

**Error Response** (if user lacks feature):
```json
{
  "error": "Feature not available in your current tier",
  "current_tier": "free",
  "feature": "practitionerTools",
  "upgrade_required": true
}
```

---

### Pattern 2: Usage Quota Enforcement (Counted)

Use when tracking usage against a monthly limit.

**Example: Profile Generation**

```javascript
// workers/src/handlers/profile.js
import { enforceUsageQuota, recordUsage } from '../middleware/tierEnforcement.js';

export async function handleProfile(request, env) {
  // Check quota BEFORE performing expensive operation
  const quotaCheck = await enforceUsageQuota(
    request, 
    env, 
    'profile_generation',      // Action type (for usage_records table)
    'profileGenerations'       // Feature name (from tier config)
  );
  if (quotaCheck) return quotaCheck;  // Returns 429 if quota exceeded

  // User is within quota — perform operation
  const body = await request.json();
  // ... generate profile ...

  // Record usage AFTER successful operation
  const userId = request._user?.sub;
  if (userId) {
    await recordUsage(
      env, 
      userId, 
      'profile_generation',    // Action type
      '/api/profile/generate', // Endpoint (optional)
      1                         // Quota cost (optional, default 1)
    );
  }

  return Response.json({
    ok: true,
    profile: /* ... */,
    tier: request._tier,          // Automatically attached by middleware
    usage: {
      current: request._usage,    // Current usage count (before this request)
      action: 'profile_generation'
    }
  });
}
```

**Error Response** (if quota exceeded):
```json
{
  "error": "Usage quota exceeded",
  "current_tier": "free",
  "feature": "profileGenerations",
  "limit": 1,
  "current_usage": 1,
  "upgrade_required": true
}
```

---

### Pattern 3: Conditional Quota (Authenticated Users Only)

Use when public access is allowed, but authenticated users have quota limits.

**Example: Chart Calculation**

```javascript
// workers/src/handlers/calculate.js
import { enforceUsageQuota, recordUsage } from '../middleware/tierEnforcement.js';

export async function handleCalculate(request, env) {
  // Only enforce quota if user is authenticated
  if (request._user) {
    const quotaCheck = await enforceUsageQuota(request, env, 'chart_calculation', 'chartCalculations');
    if (quotaCheck) return quotaCheck;
  }

  const body = await request.json();
  const result = calculateFullChart(/* ... */);

  // Record usage only for authenticated users
  const userId = request._user?.sub;
  if (userId) {
    await recordUsage(env, userId, 'chart_calculation', '/api/chart/calculate');
  }

  return Response.json({
    ok: true,
    data: result,
    tier: request._tier,        // null for unauthenticated requests
    usage: request._user ? {
      current: request._usage,
      action: 'chart_calculation'
    } : null
  });
}
```

---

## Middleware API Reference

### `enforceFeatureAccess(request, env, feature)`

Check if user has access to a boolean feature.

**Parameters**:
- `request` - Request object (must have `_user` from auth middleware)
- `env` - Environment bindings (needs `NEON_CONNECTION_STRING`)
- `feature` - Feature name from tier config (e.g., `'practitionerTools'`, `'smsDigests'`)

**Returns**:
- `null` if user has access (continue processing)
- `Response` with 403 status if user lacks feature
- `Response` with 401 if not authenticated
- `Response` with 500 if database error

**Side Effects**:
- Attaches `request._tier` with user's current tier name

---

### `enforceUsageQuota(request, env, action, feature)`

Check if user has exceeded monthly usage quota for a feature.

**Parameters**:
- `request` - Request object (must have `_user` from auth middleware)
- `env` - Environment bindings (needs `NEON_CONNECTION_STRING`)
- `action` - Action type for usage_records table (e.g., `'profile_generation'`)
- `feature` - Feature name from tier config (e.g., `'profileGenerations'`)

**Returns**:
- `null` if within quota (continue processing)
- `Response` with 429 status if quota exceeded
- `Response` with 401 if not authenticated
- `Response` with 500 if database error

**Side Effects**:
- Attaches `request._tier` with user's current tier name
- Attaches `request._usage` with current usage count (before this request)

**Quota Reset**: Automatically resets on the 1st of each month (usage counted from `date_trunc('month', CURRENT_DATE)`)

---

### `recordUsage(env, userId, action, endpoint?, quotaCost?)`

Record usage of a feature (call after successful operation).

**Parameters**:
- `env` - Environment bindings
- `userId` - User UUID
- `action` - Action type (e.g., `'profile_generation'`, `'chart_calculation'`)
- `endpoint` - API endpoint called (optional, for analytics)
- `quotaCost` - Cost in quota units (optional, default 1)

**Returns**: Promise (non-blocking, logs errors but doesn't fail request)

**Database**: Writes to `usage_records` table with timestamp

---

### `getUserTier(env, userId)`

Get user's current active subscription tier.

**Parameters**:
- `env` - Environment bindings
- `userId` - User UUID

**Returns**: Promise<string> - Tier name (`'free'`, `'seeker'`, `'guide'`, `'practitioner'`)

**Behavior**:
- Returns `'free'` if no subscription found
- Returns `'free'` if subscription status is not `'active'` or `'trialing'`
- Returns actual tier if subscription is active

---

## Testing Tier Enforcement

### Test Free Tier Quota Limit

```bash
# 1. Register user
curl -X POST http://localhost:8787/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123",
    "birthDate": "1990-01-01",
    "birthTime": "12:00:00",
    "birthTz": "America/New_York",
    "birthLat": 40.7128,
    "birthLng": -74.0060
  }'

# Response: {"token": "eyJ...", "user": {...}}

# 2. Generate first profile (should succeed)
curl -X POST http://localhost:8787/api/profile/generate \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "birthDate": "1990-01-01",
    "birthTime": "12:00:00",
    "birthTimezone": "America/New_York",
    "lat": 40.7128,
    "lng": -74.0060
  }'

# Response: {"ok": true, "tier": "free", "usage": {"current": 0, ...}, ...}

# 3. Generate second profile (should fail with 429)
curl -X POST http://localhost:8787/api/profile/generate \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "birthDate": "1990-01-01",
    "birthTime": "12:00:00",
    "birthTimezone": "America/New_York",
    "lat": 40.7128,
    "lng": -74.0060
  }'

# Response: {
#   "error": "Usage quota exceeded",
#   "current_tier": "free",
#   "feature": "profileGenerations",
#   "limit": 1,
#   "current_usage": 1,
#   "upgrade_required": true
# }
```

### Test Feature Gate

```bash
# Try to access practitioner tools without upgrade (should fail with 403)
curl -X GET http://localhost:8787/api/practitioner/clients \
  -H "Authorization: Bearer eyJ..."

# Response: {
#   "error": "Feature not available in your current tier",
#   "current_tier": "free",
#   "feature": "practitionerTools",
#   "upgrade_required": true
# }

# After upgrading to guide tier via Stripe...
curl -X GET http://localhost:8787/api/practitioner/clients \
  -H "Authorization: Bearer eyJ..."

# Response: {"ok": true, "clients": [], "count": 0}
```

---

## Database Queries

### Check User's Current Tier

```sql
SELECT u.email, s.tier, s.status, s.current_period_end
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id
WHERE u.email = 'test@example.com';
```

### View Usage History

```sql
SELECT action, COUNT(*) as count, DATE_TRUNC('day', created_at) as date
FROM usage_records
WHERE user_id = 'user-uuid-here'
  AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY action, DATE_TRUNC('day', created_at)
ORDER BY date DESC;
```

### Monthly Usage by Action

```sql
SELECT 
  u.email,
  ur.action,
  COUNT(*) as usage_count,
  s.tier
FROM usage_records ur
JOIN users u ON ur.user_id = u.id
LEFT JOIN subscriptions s ON u.id = s.user_id
WHERE ur.created_at >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY u.email, ur.action, s.tier
ORDER BY usage_count DESC;
```

---

## Frontend Integration

### Display Tier Badge

```javascript
// Fetch user info with tier
const response = await fetch('/api/auth/me', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { user } = await response.json();

// Show tier badge in UI
const tierBadge = document.createElement('span');
tierBadge.className = `tier-badge tier-${user.tier}`;
tierBadge.textContent = user.tier.toUpperCase();
document.querySelector('.user-info').appendChild(tierBadge);
```

### Handle Quota Exceeded Errors

```javascript
async function generateProfile(data) {
  const response = await fetch('/api/profile/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  const result = await response.json();

  if (response.status === 429) {
    // Quota exceeded — show upgrade modal
    showUpgradeModal({
      message: `You've used ${result.current_usage}/${result.limit} ${result.feature} this month`,
      tier: result.current_tier,
      feature: result.feature
    });
    return null;
  }

  if (response.status === 403) {
    // Feature not available — show upgrade modal
    showUpgradeModal({
      message: `${result.feature} requires ${suggestTier(result.feature)} tier`,
      tier: result.current_tier,
      feature: result.feature
    });
    return null;
  }

  return result;
}

function suggestTier(feature) {
  const tierMap = {
    'smsDigests': 'Seeker',
    'practitionerTools': 'Guide',
    'whiteLabel': 'Practitioner'
  };
  return tierMap[feature] || 'premium';
}
```

---

## Next Steps

1. **Complete Stripe Setup**: Follow [STRIPE_SETUP.md](STRIPE_SETUP.md) to configure Stripe keys, products, and webhook endpoint
2. **Run Database Migration**: Execute [workers/src/db/migrate.sql](../workers/src/db/migrate.sql) to create subscription tables
3. **Test End-to-End**: Register → Upgrade → Verify tier enforcement works with active subscription
4. **Build Upgrade UI**: Implement pricing modal and upgrade CTAs in frontend (BL-REV-003)
5. **Monitor Usage**: Set up analytics dashboard to track quota usage patterns (BL-ANA-002)

---

## Files Reference

- **Tier Configuration**: [workers/src/lib/stripe.js](../workers/src/lib/stripe.js)
- **Middleware Implementation**: [workers/src/middleware/tierEnforcement.js](../workers/src/middleware/tierEnforcement.js)
- **Integration Examples**:
  - Profile handler: [workers/src/handlers/profile.js](../workers/src/handlers/profile.js)
  - Calculate handler: [workers/src/handlers/calculate.js](../workers/src/handlers/calculate.js)
  - Practitioner handler: [workers/src/handlers/practitioner.js](../workers/src/handlers/practitioner.js)
  - SMS handler: [workers/src/handlers/sms.js](../workers/src/handlers/sms.js)
- **Database Schema**: [workers/src/db/migrate.sql](../workers/src/db/migrate.sql) (subscriptions, usage_records tables)
- **Query Definitions**: [workers/src/db/queries.js](../workers/src/db/queries.js)

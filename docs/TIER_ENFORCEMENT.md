# Tier Enforcement Integration Guide

**Last Reviewed**: 2026-03-14  
**Purpose**: Current guide for tier-based feature gating, quota enforcement, and canonical tier semantics

---

## Overview

Prime Self uses two complementary enforcement paths in [workers/src/middleware/tierEnforcement.js](../workers/src/middleware/tierEnforcement.js):

1. `enforceFeatureAccess()` for boolean capability checks
2. `enforceUsageQuota()` for quota-limited actions

These functions sit on top of authentication and the subscription model defined in [workers/src/lib/stripe.js](../workers/src/lib/stripe.js).

---

## Canonical Tier Names

Use these names in all new documentation, analytics, and product language:

- `free`
- `individual`
- `practitioner`
- `agency`

Legacy aliases such as `regular`, `seeker`, `guide`, `white_label`, and `studio` still appear in compatibility code and historical records, but they should not be treated as the canonical naming system.

---

## Capability Model

Current capability intent is:

| Tier | Intended Role | Key Capabilities |
|---|---|---|
| `free` | Limited evaluation | Basic access, minimal quota, no practitioner tools |
| `individual` | Personal/support tier | Personal usage, no practitioner tools or agency capabilities |
| `practitioner` | Core commercial tier | Practitioner tools, client workflows, reports, composites |
| `agency` | Expansion tier | Practitioner capabilities plus agency seats, API volume, white-label capabilities |

For exact quotas and feature flags, use [workers/src/lib/stripe.js](../workers/src/lib/stripe.js) as the source of truth.

---

## Enforcement Model

### Feature gates

Use `enforceFeatureAccess()` when a feature is either available or unavailable for a tier.

Typical examples:

- `practitionerTools`
- `clientManagement`
- `agencySeats`
- `whiteLabel`
- `customWebhooks`

Expected failure response:

```json
{
  "error": "Feature not available in your current tier",
  "current_tier": "free",
  "feature": "practitionerTools",
  "upgrade_required": true
}
```

### Quota checks

Use `enforceUsageQuota()` for actions that consume monthly allowance and `enforceDailyCeiling()` for daily throttling backed by KV.

Common quota-limited actions include:

- profile generation
- AI questions
- API usage

Expected quota response:

```json
{
  "error": "Usage quota exceeded",
  "current_tier": "individual",
  "feature": "profileGenerations",
  "limit": 10,
  "current_usage": 10,
  "upgrade_required": true
}
```

---

## Integration Pattern

Use this order inside a handler:

1. Authenticate the request.
2. Apply `enforceFeatureAccess()` if the route is tier-gated.
3. Apply `enforceUsageQuota()` if the route consumes quota.
4. Apply `enforceDailyCeiling()` for burst-sensitive actions.
5. Perform the operation.
6. Record usage if needed.

Example targets in the current codebase:

- [workers/src/handlers/practitioner.js](../workers/src/handlers/practitioner.js)
- [workers/src/handlers/profile.js](../workers/src/handlers/profile.js)
- [workers/src/handlers/profile-stream.js](../workers/src/handlers/profile-stream.js)
- [workers/src/handlers/sms.js](../workers/src/handlers/sms.js)

---

## Known Caveats

The enforcement system is functional, but these areas need attention:

- `past_due` handling should be aligned with billing semantics and operator expectations.
- Legacy alias support should remain at normalization boundaries, not leak into user-facing language.
- Analytics and documentation must use the same canonical tier names as runtime code.

See [../audits/TIER_BILLING_WHITE_LABEL_AUDIT_2026-03-14.md](../audits/TIER_BILLING_WHITE_LABEL_AUDIT_2026-03-14.md) for the current focused audit.

---

## Recommended References

- Tier config: [workers/src/lib/stripe.js](../workers/src/lib/stripe.js)
- Middleware: [workers/src/middleware/tierEnforcement.js](../workers/src/middleware/tierEnforcement.js)
- Billing data queries: [workers/src/db/queries.js](../workers/src/db/queries.js)
- Practitioner handler: [workers/src/handlers/practitioner.js](../workers/src/handlers/practitioner.js)
- Agency handler: [workers/src/handlers/agency.js](../workers/src/handlers/agency.js)


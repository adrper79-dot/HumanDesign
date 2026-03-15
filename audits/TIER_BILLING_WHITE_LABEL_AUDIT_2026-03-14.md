# Tier, Billing, and White-Label Audit

**Date:** 2026-03-14  
**Scope:** Current code and documentation related to tier naming, entitlement logic, billing semantics, analytics reporting, and white-label positioning.

---

## Executive Summary

The current product model is mostly clear in code: canonical commercial tiers are `free`, `individual`, `practitioner`, and `agency` in [workers/src/lib/stripe.js](../workers/src/lib/stripe.js). The remaining risk is not missing billing infrastructure. The risk is inconsistency.

Three categories of inconsistency remain:

- **Runtime logic drift** where billing, access control, and analytics do not agree.
- **Documentation drift** where public docs still describe Explorer/Guide/Studio or direct-subscription semantics.
- **White-label ambiguity** where the product promise differs across guides, terms, and implementation.

The highest-priority runtime issues are:

1. `past_due` subscriptions are treated as active enough for billing retrieval but not active enough for feature access.
2. Admin revenue analytics still calculate MRR using legacy tiers and old prices.
3. Embed white-label entitlement is documented as Practitioner-level in one guide but enforced as Agency-only in code.

---

## Canonical Model Observed In Code

The clearest current source of truth is [workers/src/lib/stripe.js](../workers/src/lib/stripe.js), which defines:

- `free`
- `individual`
- `practitioner`
- `agency`

Feature semantics in that file imply:

- `individual` is a personal/support tier with no practitioner tools
- `practitioner` is the core practitioner tier
- `agency` is the expansion tier with white-label and seat capabilities

Legacy aliases are still intentionally supported in parts of the codebase for historical rows and migration safety:

- `regular`
- `seeker`
- `guide`
- `white_label`
- `studio`

That compatibility layer is reasonable. The problem is that the alias layer still leaks into product language, analytics, documentation, and support semantics.

---

## Findings

### 1. High - Billing and entitlement logic disagree on `past_due`

**Evidence**

- [workers/src/db/queries.js](../workers/src/db/queries.js) `getActiveSubscription` includes `status IN ('active', 'trialing', 'past_due')`
- [workers/src/middleware/tierEnforcement.js](../workers/src/middleware/tierEnforcement.js) `resolveEffectiveTier()` grants tier only when `sub.status === 'active' || sub.status === 'trialing'`

**Impact**

- Billing flows can recognize a `past_due` subscription while access control silently downgrades the user to free behavior.
- This creates avoidable support friction during failed payment recovery.
- Practitioners can appear subscribed in billing views but lose paid access in product workflows.

**Recommendation**

- Decide the explicit policy for `past_due`.
- If `past_due` should retain temporary access, align `resolveEffectiveTier()` with billing.
- If `past_due` should lose access immediately, remove it from `getActiveSubscription` and related naming.

**Priority**

- Fix in the next billing/entitlement sweep.

---

### 2. High - Admin revenue analytics still use legacy tier names and obsolete prices

**Evidence**

- [workers/src/db/queries.js](../workers/src/db/queries.js) `getAnalyticsMrr` counts `regular`, `practitioner`, and `white_label`
- [workers/src/handlers/analytics.js](../workers/src/handlers/analytics.js) calculates revenue at `$12`, `$60`, and `$149`
- Current published pricing in [frontend/pricing.html](../frontend/pricing.html) is `$19`, `$97`, and `$349` for Individual, Practitioner, and Agency

**Impact**

- Admin MRR reporting is materially wrong.
- Tier breakdowns are inconsistent with current packaging.
- Any pricing or growth decision made from these analytics will be distorted.

**Recommendation**

- Update analytics queries and calculations to use canonical tiers and current prices.
- Keep alias normalization at the data layer if historical rows still exist.
- Rename response payloads to `individual`, `practitioner`, and `agency`.

**Priority**

- Immediate. This affects operator trust and pricing decisions.

---

### 3. High - White-label embed entitlement is ambiguous across code and docs

**Evidence**

- [workers/src/handlers/embed.js](../workers/src/handlers/embed.js) allows hide-attribution only for `white_label` or `agency`
- [EMBED_WIDGET_GUIDE.md](../EMBED_WIDGET_GUIDE.md) says `hideAttribution` requires Practitioner tier

**Impact**

- Sales and support teams will tell customers different things.
- Practitioners can buy expecting a white-label behavior that the platform will deny.
- This undermines confidence in the Agency upgrade path.

**Recommendation**

- Decide the rule once:
  - Practitioner includes hide-attribution, or
  - Agency-only includes hide-attribution
- Then update implementation, pricing copy, embed docs, and terms to match.

**Priority**

- Immediate if embed is part of the current GTM motion.

---

### 4. Medium - Public docs still describe outdated tier names and channel strategy

**Evidence**

- [docs/TIER_ENFORCEMENT.md](../docs/TIER_ENFORCEMENT.md) still uses `regular`, `Guide`, and `Studio` with old prices
- [docs/API_MARKETPLACE.md](../docs/API_MARKETPLACE.md) still describes direct subscription as `Explorer+`, `Guide only`, and a developer-centric channel split

**Impact**

- Internal docs do not match product reality.
- GTM and support artifacts drift back toward old pricing and old channel framing.
- New contributors will reinforce outdated semantics.

**Recommendation**

- Update tier docs to canonical names and current pricing.
- Rewrite API marketplace language so it supports the practitioner-first model instead of implying a broad D2C subscription ladder.

**Priority**

- High documentation cleanup, but not a runtime blocker.

---

### 5. Medium - Frontend pricing logic still exposes legacy naming in core UI code

**Evidence**

- [frontend/js/app.js](../frontend/js/app.js) still uses identifiers and comments like `regularBtn`, `studioBtn`, `Explorer`, `Guide`, and `Studio`
- The file also supports aliases like `white_label`, `guide`, `regular`, and `seeker` alongside canonical tiers

**Impact**

- Runtime behavior may still work because alias handling is present.
- Maintenance cost is higher because developers must reason about two naming systems.
- UI copy and button behavior are more likely to regress when pricing changes again.

**Recommendation**

- Keep alias support only at the normalization boundary.
- Rename frontend variables and comments to canonical tier names.
- Treat legacy aliases as inputs, not operating vocabulary.

**Priority**

- Next frontend cleanup cycle.

---

### 6. Medium - Practitioner and Agency implementation docs still mix old and new commercial semantics

**Evidence**

- [workers/src/handlers/practitioner.js](../workers/src/handlers/practitioner.js) top-level comments still describe `regular` and `white_label`
- [frontend/terms.html](../frontend/terms.html) still references `Studio (white-label)` subscriptions and commercial rights language

**Impact**

- Product packaging appears less settled than it actually is.
- Customers can see different plan names in pricing, terms, and support copy.

**Recommendation**

- Update practitioner handler docs and public terms to canonical plan names.
- Define whether `Agency` is the commercial/legal replacement for `Studio/white-label`, then remove the older wording from public documents.

**Priority**

- High if pricing or terms are being sent to prospects.

---

## Recommended Canonical Rules

These rules should be treated as the source of truth going forward.

### Canonical tier names

- `free`
- `individual`
- `practitioner`
- `agency`

### Legacy aliases

Allowed only for:

- migration handling
- historical row compatibility
- old webhook payload or stale client state normalization

Not allowed for:

- public pricing language
- admin analytics labels
- legal documents
- support messaging
- feature documentation

### White-label semantics

`white-label` should describe a capability, not a canonical plan name.

Recommended interpretation:

- `Agency` is the plan
- `white-label` is one of the capabilities included in Agency

---

## Fix Order

1. Align `past_due` policy across billing and entitlement.
2. Correct MRR and tier analytics to canonical names and current prices.
3. Resolve embed white-label entitlement and update docs to match.
4. Rewrite public tier docs and API marketplace docs.
5. Clean legacy naming out of frontend variable names, comments, and public terms.

---

## Suggested Implementation Targets

- [workers/src/middleware/tierEnforcement.js](../workers/src/middleware/tierEnforcement.js)
- [workers/src/db/queries.js](../workers/src/db/queries.js)
- [workers/src/handlers/analytics.js](../workers/src/handlers/analytics.js)
- [workers/src/handlers/embed.js](../workers/src/handlers/embed.js)
- [frontend/js/app.js](../frontend/js/app.js)
- [frontend/terms.html](../frontend/terms.html)
- [docs/TIER_ENFORCEMENT.md](../docs/TIER_ENFORCEMENT.md)
- [docs/API_MARKETPLACE.md](../docs/API_MARKETPLACE.md)
- [EMBED_WIDGET_GUIDE.md](../EMBED_WIDGET_GUIDE.md)

---

## Final Assessment

This is not a broken billing system. It is a mostly functional commercial system with inconsistent language and a few important logic splits.

That is good news: the remaining work is concentrated and fixable. But if left alone, these inconsistencies will leak into customer trust, support load, pricing decisions, and agency sales.

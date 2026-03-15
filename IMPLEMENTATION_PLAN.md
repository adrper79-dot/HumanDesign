# Prime Self — Full Implementation Plan
**Date:** 2025  
**Status:** In Progress  
**Owner:** Product / Engineering

> Historical implementation plan. This document uses an obsolete pricing and tier model and should be treated as archive material only.
> For current billing and packaging semantics use `workers/src/lib/stripe.js` and the canonical docs index.

---

## Executive Summary

This document covers the complete implementation plan for:
1. Fixing the sign-in button post-login state  
2. Renaming and repricing the subscription tiers  
3. Audience-separated marketing (consumers vs. practitioners never see each other's experience)  
4. Securing the white-label attribution bypass  
5. Implementing the promo code system  
6. Adding a `/api/embed/validate` endpoint  

---

## Part 1 — Audience Separation Best Practice

### The Problem
Mixing consumer and professional pricing in one modal is a well-documented UX anti-pattern:
- It causes **price shock**: "$12 vs $149 on the same screen" makes the $149 tier look extremely expensive and the $12 tier look cheap.
- It creates **wrong-audience confusion**: a seeker looking for self-discovery shouldn't be pitched "client management tools" and "white-label API."
- It creates a **trust gap**: end-users don't want to know their practitioner is paying $149/mo—it changes the perceived relationship.

### The Solution: Experience Isolation by Role

```
Consumer Journey (selfprime.net)
  └─ Landing: Personal growth, Human Design chart calculator
  └─ Pricing Modal: Free ($0) | Explorer ($12/mo)
  └─ CTA at bottom: "Are you a guide, coach, or practitioner? →"
        └─ Opens Practitioner Modal

Practitioner Journey (selfprime.net/practitioner or via CTA)
  └─ Professional tone: "Serve your clients with precision."
  └─ Pricing Modal: Guide ($60/mo) | Studio ($149/mo — White Label)
  └─ Sign-up has "I'm a professional" self-selection step
```

**Post-Login Behavior:**
| User Tier      | Consumer Pricing Modal  | Practitioner Nav Tab | API Tab |
|---------------|------------------------|---------------------|---------|
| free          | Shows Free + Explorer   | Hidden              | Hidden  |
| regular       | Shows "You're on Explorer" + billing | Hidden | Hidden |
| practitioner  | Hidden — shows Professional modal | Visible | Visible |
| white_label   | Hidden — shows Professional modal | Visible | Full API |

---

## Part 2 — Tier Rename & Repricing

### New Tier Structure

| Tier Code     | Display Name   | Price     | API Calls | Target Audience       |
|--------------|----------------|-----------|-----------|----------------------|
| `free`        | Free           | $0/mo     | 0         | Anyone — exploration |
| `regular`     | Explorer       | $12/mo    | 0         | Personal seekers     |
| `practitioner`| Guide          | $60/mo    | 1,000/mo  | Coaches, readers     |
| `white_label` | Studio         | $149/mo   | 10,000/mo | Agencies, platforms  |

### Files Changed

| File | Change |
|------|--------|
| `workers/src/lib/stripe.js` | Rename seeker→regular, guide→practitioner, add white_label; reprice |
| `workers/src/handlers/billing.js` | Update valid tier list in checkout handler |
| `workers/src/handlers/practitioner.js` | Update TIER_LIMITS keys |
| `workers/wrangler.toml` | Rename STRIPE_PRICE_SEEKER→STRIPE_PRICE_REGULAR, etc. |
| `frontend/index.html` | New pricing cards, audience-separated modals |

### Stripe Dashboard Setup (Manual Step Required)
Before deploying, create products in the Stripe Dashboard:
1. Go to https://dashboard.stripe.com/products
2. Create "Explorer" product → Monthly recurring → $12.00
3. Create "Guide" product → Monthly recurring → $60.00
4. Create "Studio" product → Monthly recurring → $149.00
5. Copy each price ID (format: `price_xxxx`) 
6. Update wrangler.toml vars: `STRIPE_PRICE_REGULAR`, `STRIPE_PRICE_PRACTITIONER`, `STRIPE_PRICE_WHITE_LABEL`

---

## Part 3 — Sign-In Button Fix

### Root Cause
After successful login, `updateAuthUI()` correctly shows the user's email and hides the Sign In button. However, there are three issues:
1. **No tier data fetched**: `tierBadge`, `upgradeBtn`, and `billingBtn` are permanently hidden. There is no post-login call to `/api/auth/me` to get subscription info.
2. **No ESC key handler**: Pressing ESC doesn't close the auth modal.
3. **No backdrop click**: Clicking outside the modal box doesn't close it.
4. **authMode not reset**: If a user toggles to Register mode and closes, reopening shows "Create Account" instead of "Sign In".

### Fix
Add `fetchUserProfile()` which:
- Calls `GET /api/auth/me` 
- Stores result in `window.currentUser`
- Updates `tierBadge` with correct tier label
- Shows `billingBtn` if subscribed (regular/practitioner/white_label)
- Shows `upgradeBtn` if on free or regular tier
- Called on: page load (if token exists) + post-login

Add `openAuthOverlay()` improvements:
- Reset `authMode` to `'login'` when opening
- Add ESC key handler to close modal
- Add backdrop click handler

---

## Part 4 — White-Label Attribution Security Fix

### Root Cause
In `embed.html`, the `hideAttribution` URL parameter is honored without any server-side validation:
```javascript
if (hideAttribution) {
  document.getElementById('attribution').classList.add('hidden');
}
```
Anyone can pass `?hideAttribution=true` and remove the "Powered by Prime Self" branding without paying $149/month.

### Fix (Defense in Depth)
1. **Server-side validation endpoint**: `GET /api/embed/validate?apiKey=xxx` 
   - Returns: `{ valid: true, tier: "white_label", features: ["hideAttribution"] }`
2. **embed.html updated flow**:
   - If `hideAttribution=true` is requested, require `apiKey` param
   - Fetch `/api/embed/validate?apiKey=xxx`
   - Only hide attribution if response confirms `white_label` tier
   - On failure: show attribution (fail safe)
3. **Rate limiting**: The validate endpoint uses the existing CACHE KV for rate limiting API key checks.

---

## Part 5 — Promo Code System

### Database
The `promo_codes` table already exists in `003_billing.sql`:
```sql
CREATE TABLE promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value INTEGER NOT NULL,
  max_redemptions INTEGER,
  redemption_count INTEGER DEFAULT 0,
  valid_until TIMESTAMPTZ,
  applicable_tiers TEXT[],
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/admin/promo` | Admin | Create promo code |
| `GET`  | `/api/admin/promo` | Admin | List all promo codes |
| `POST` | `/api/billing/redeem` | User | Apply promo to checkout |
| `GET`  | `/api/billing/redeem/:code` | User | Validate promo code |

### Frontend
- Promo code input field added to the checkout flow (appears after clicking "Upgrade")
- Validates the code client-side (checks format) then server-side before checkout
- Applied via Stripe's coupon/discount system at checkout session creation

---

## Part 6 — Embed Attribution Validation Endpoint

### New Endpoint: `GET /api/embed/validate`

**Request:**
```
GET /api/embed/validate?apiKey=ps_live_xxx
X-Origin: https://example.com (optional)
```

**Response:**
```json
{
  "valid": true,
  "tier": "white_label",
  "features": {
    "hideAttribution": true,
    "customTheme": true,
    "apiCallsRemaining": 8547
  }
}
```

**Error:**
```json
{ "valid": false, "error": "API key not found or insufficient tier" }
```

---

## Implementation Sequence

### Sprint 1 (Critical Path — Launch Blockers)
- [x] Sign-in button UX fix (`fetchUserProfile`, ESC close, backdrop close, authMode reset)
- [x] Tier rename in backend (stripe.js, billing.js, practitioner.js, wrangler.toml)
- [x] Audience-separated pricing cards (consumer modal: Free + Explorer only)
- [x] Practitioner pricing modal (Guide + Studio cards, professional tone)

### Sprint 2 (Security + Revenue)
- [x] hideAttribution server enforcement (embed.html + new validate endpoint)
- [x] Promo code backend (queries + handler + routes)
- [x] Promo code frontend (input field in checkout)

### Sprint 3 (Growth Features — Post-MVP)
- [ ] Free trial (7-day on Explorer tier via Stripe trial period)
- [ ] Annual billing discount (10 months for 12 = ~16% off)
- [ ] Post-billing success/cancel pages
- [ ] Upgrade prompts at feature quota limits (e.g., at 0 profile generations left)
- [ ] Practitioner onboarding flow (professional self-selection during signup)

---

## Security Notes

- Promo codes MUST be validated server-side — client-side validation is UX-only
- `hideAttribution` MUST fail-safe (default: show attribution, hide only on confirmed permission)
- Tier names in billing.js validation list must stay in sync with stripe.js tier keys
- API key validation must check BOTH key existence AND tier level (`white_label` minimum)

---

## Marketing Language Guide

| Audience    | Tone | Key Messages |
|-------------|------|--------------|
| Consumer (Free) | Mystical, personal | "Discover your energy blueprint" |
| Consumer (historical Explorer model) | Growth-focused | "Unlock unlimited charts, travel deeper" |
| Practitioner (historical Guide model) | Professional | "Serve your clients with precision" |
| Practitioner (historical Studio model) | Business | "Your branded experience, your clients, your platform" |

**Never mix languages**: Don't say "practitioner dashboard" on a consumer pricing card. Don't say "personal growth" on the Studio pricing card.

---

*See also: `ARCHITECTURE.md`, `docs/TIER_ENFORCEMENT.md`, `process/BACKLOG_VERIFICATION_SPRINT_2026-03-09.md`*

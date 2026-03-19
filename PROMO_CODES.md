# Early Adopter Promo Code System

This guide covers how to create, validate, and manage promo codes for early adopters.

## Quick Start

### 1. Set Up Admin Token (First Time Only)

```bash
cd workers
wrangler secret put ADMIN_TOKEN
# Then paste your secret token (can be any string, e.g. "my-secret-123")
```

### 2. Create Early Adopter Codes

Run the setup script to create a pre-configured set of early adopter promo codes:

```bash
node scripts/setup-early-adopter-codes.js "YOUR_ADMIN_TOKEN" "https://your-api-domain.com"
```

**Local development:**
```bash
node scripts/setup-early-adopter-codes.js "test-token" "http://localhost:3000"
```

### 3. Available Early Adopter Codes

| Code | Discount | Limit | Tiers | Use Case |
|------|----------|-------|-------|----------|
| EARLYBIRD30 | 30% off | 50 uses | All | General early adopters |
| LAUNCH25 | 25% off | 100 uses | All | Launch period promotion |
| WAITLIST20 | 20% off | 75 uses | Free, Regular | Beta testers & waitlist |
| STARTUP30 | 30% off | 25 uses | Regular, Individual | Startups |
| AGENCY15 | 15% off | Unlimited | Agency | Agencies (no limit) |

## API Endpoints

### Create a Promo Code (Admin Only)

```bash
curl -X POST https://api.example.com/api/admin/promo \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "CUSTOM25",
    "discount_type": "percentage",
    "discount_value": 25,
    "max_redemptions": 100,
    "applicable_tiers": ["free", "regular"]
  }'
```

**Parameters:**
- `code` **(required)** — Alphanumeric, up to 64 chars (UPPERCASE recommended)
- `discount_type` **(required)** — "percentage" or "fixed_amount"
- `discount_value` **(required)** — Number (1-100 for percentage, cents for fixed amount)
- `max_redemptions` — Optional, null = unlimited
- `valid_until` — Optional ISO date string (e.g. "2026-04-30T23:59:59Z")
- `applicable_tiers` — Optional array of ["free", "regular", "individual", "practitioner", "agency"]

### List All Promo Codes (Admin Only)

```bash
curl -X GET https://api.example.com/api/admin/promo \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN"
```

### Validate Promo Code (User-Facing)

```bash
curl "https://api.example.com/api/promo/validate?code=EARLYBIRD30"
```

Response:
```json
{
  "valid": true,
  "code": "EARLYBIRD30",
  "discount_type": "percentage",
  "discount_value": 30,
  "savings": "30% off",
  "applicable_tiers": null,
  "redemptions_remaining": 47
}
```

## Rewarding Early Adopters

### Strategy 1: Time-Limited Launch Offers
```
LAUNCH30 — 30% off, valid through end of month
Apply: valid_until parameter in API
```

### Strategy 2: Tier-Specific Freebies
```
AGENCY_FREE_1M — Free first month for agencies
Apply: discount_type: "fixed_amount" with generous value
```

### Strategy 3: Referral Rewards
```
REFER10 — $10 credit per referral (fixed_amount: 1000 cents)
Apply: Manually track referrals → distribute codes
```

### Strategy 4: Segment-Based Discounts
```
STARTUP30 — 30% for startup founders
NONPROFIT25 — 25% for nonprofits
EDUCATION40 — 40% for educational institutions
Apply: applicable_tiers restriction to segment users
```

## Frontending the Codes

Users can apply codes in two places:

1. **Checkout page** — "Have a promo code?" link reveals input field
2. **API validation** —`GET /api/promo/validate?code=...` shows preview before purchase

The checkout handler (`POST /api/billing/checkout`) accepts `promoCode` in the request body and applies the discount to the Stripe session.

## Monitoring & Management

### Check Usage
```bash
curl -X GET https://api.example.com/api/admin/promo \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN" | jq '.promos[] | {code, redemptions, max_redemptions}'
```

### Create New Context-Specific Code
```bash
curl -X POST https://api.example.com/api/admin/promo \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "CONFERENCE2026",
    "discount_type": "percentage",
    "discount_value": 40,
    "max_redemptions": 30,
    "applicable_tiers": ["regular", "individual"]
  }'
```

## Database Schema

Codes are stored in the `promo_codes` table:

```sql
CREATE TABLE promo_codes (
  id UUID PRIMARY KEY,
  code VARCHAR(64) UNIQUE NOT NULL,
  discount_type VARCHAR(20) NOT NULL,  -- 'percentage' or 'fixed_amount'
  discount_value NUMERIC NOT NULL,
  max_redemptions INT,                  -- NULL = unlimited
  redemptions INT DEFAULT 0,
  valid_until TIMESTAMP,
  applicable_tiers TEXT[],              -- JSON array of tier strings
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID                       -- Admin user ID (if tracked)
);
```

## Best Practices

1. **Code Naming** — Use clear, uppercase names (EARLYBIRD30, STARTUP25)
2. **Limits** — Set reasonable redemption limits to control costs
3. **Tiers** — Use tier restrictions to segment offerings by user type
4. **Expiry** — Set `valid_until` for time-sensitive campaigns
5. **Tracking** — Monitor which codes drive most signups (add analytics event tracking if needed)
6. **Communication** — Publicize codes through email, landing pages, social media

## Example Early Adopter Campaign

```javascript
// 1. Create codes
POST /api/admin/promo {
  "code": "FOUNDERS50",
  "discount_type": "percentage",
  "discount_value": 50,
  "max_redemptions": 20,
  "valid_until": "2026-04-30T23:59:59Z"
}

// 2. Email early adopters
// Subject: "Exclusive Founder's Discount — 50% Off"
// Body: "You're in the first 20 to know about us. Use FOUNDERS50 for 50% off through April."

// 3. Monitor
GET /api/admin/promo → filter by code → check redemptions field

// 4. Thank them
// Once code nears limit (e.g. 18/20 redeemed), send "thank you" email with case study access
```

---

## Practitioner Promo Codes (Item 1.9)

Practitioners can create their own promo codes to share with clients.

### Constraints
- **1 active code** per practitioner at a time
- **10-50% discount** (percentage only, first month)
- Code format: 3-32 characters (A-Z, 0-9, hyphens, underscores)
- Optional max redemptions (1-1000) and expiry date

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/practitioner/promo` | Get practitioner's active promo code |
| `POST` | `/api/practitioner/promo` | Create a new promo code |
| `DELETE` | `/api/practitioner/promo/:id` | Deactivate a promo code |

### Create Promo Code

```json
POST /api/practitioner/promo
{
  "code": "JANE20",
  "discount_value": 20,
  "max_redemptions": 100,
  "valid_until": "2026-12-31"
}
```

### Database
- Uses existing `promo_codes` table with new `practitioner_id` FK column (migration 058)
- `deactivatePractitionerPromo` checks both promo ID and practitioner_id for ownership

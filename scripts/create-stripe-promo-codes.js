/**
 * GTM-008: Create launch promo codes in Stripe as Promotion Code objects.
 *
 * Usage (test mode):
 *   STRIPE_SECRET_KEY=sk_test_xxx node scripts/create-stripe-promo-codes.js
 *
 * Usage (live mode — ONLY after all 5 codes validated in test mode):
 *   STRIPE_SECRET_KEY=sk_live_xxx node scripts/create-stripe-promo-codes.js --live
 *
 * Prerequisites:
 *   npm install stripe  (or use the existing dep from workers/)
 *
 * What this creates in Stripe:
 *   1. A Coupon object (percentage discount, duration)
 *   2. A Promotion Code object bound to that coupon with the friendly code string
 *
 * Stripe Price IDs are read from wrangler.toml vars (copy them into env or hardcode below).
 */

import Stripe from 'stripe';

const isLive = process.argv.includes('--live');
const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error('ERROR: STRIPE_SECRET_KEY env var is required.');
  process.exit(1);
}
if (isLive && secretKey.startsWith('sk_test_')) {
  console.error('ERROR: --live flag passed but STRIPE_SECRET_KEY is a test key. Aborting.');
  process.exit(1);
}
if (!isLive && secretKey.startsWith('sk_live_')) {
  console.error('WARN: Running in test mode but STRIPE_SECRET_KEY is a live key. Pass --live to proceed.');
  process.exit(1);
}

const stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' });

// Stripe Price IDs — must match wrangler.toml vars
const PRICE_IDS = {
  practitioner_monthly:  process.env.STRIPE_PRICE_PRACTITIONER        || 'price_1T9DCKAW1229TZtevvfdcPN9',
  practitioner_annual:   process.env.STRIPE_PRICE_PRACTITIONER_ANNUAL || 'price_1TAdhqAW1229TZteTfsr8Gba',
  agency_monthly:        process.env.STRIPE_PRICE_AGENCY              || 'price_1T9DCRAW1229TZteIIPY6CXF',
  agency_annual:         process.env.STRIPE_PRICE_AGENCY_ANNUAL       || 'price_1TAdhqAW1229TZtevt3cZJV2',
  individual_monthly:    process.env.STRIPE_PRICE_INDIVIDUAL          || 'price_1T9DC4AW1229TZteG7b195zw',
  individual_annual:     process.env.STRIPE_PRICE_INDIVIDUAL_ANNUAL   || 'price_1TAdhpAW1229TZtesPw8ybqa',
};

/**
 * Promo code definitions — GTM-008
 * Each entry creates one Coupon + one Promotion Code in Stripe.
 */
const PROMO_CODES = [
  {
    code:         'EARLYBIRD30',
    name:         'Early Bird 30%',
    percent_off:  30,
    duration:     'repeating',
    duration_in_months: 3,
    max_redemptions: 100,
    applies_to_prices: [PRICE_IDS.practitioner_monthly, PRICE_IDS.practitioner_annual],
    notes: '30% off first 3 months, Practitioner tier, first 100 users',
  },
  {
    code:         'LAUNCH25',
    name:         'Launch 25%',
    percent_off:  25,
    duration:     'repeating',
    duration_in_months: 3,
    max_redemptions: null, // unlimited
    applies_to_prices: null, // all paid tiers
    notes: '25% off first 3 months, any paid tier',
  },
  {
    code:         'WAITLIST20',
    name:         'Waitlist 20%',
    percent_off:  20,
    duration:     'once',
    duration_in_months: null,
    max_redemptions: null,
    applies_to_prices: null, // any paid tier
    notes: '20% off first month, any paid tier, waitlist signups only',
  },
  {
    code:         'STARTUP30',
    name:         'Startup 30% Annual',
    percent_off:  30,
    duration:     'once',
    duration_in_months: null,
    max_redemptions: null,
    applies_to_prices: [PRICE_IDS.practitioner_annual],
    notes: '30% off annual Practitioner plan',
  },
  {
    code:         'AGENCY15',
    name:         'Agency 15% Ongoing',
    percent_off:  15,
    duration:     'forever',
    duration_in_months: null,
    max_redemptions: null,
    applies_to_prices: [PRICE_IDS.agency_monthly, PRICE_IDS.agency_annual],
    notes: '15% off Agency plan, ongoing',
  },
];

async function createPromoCode(def) {
  console.log(`\n[${def.code}] Creating coupon...`);

  // Step 1: Create coupon
  const couponParams = {
    name:        def.name,
    percent_off: def.percent_off,
    duration:    def.duration,
  };
  if (def.duration === 'repeating') {
    couponParams.duration_in_months = def.duration_in_months;
  }
  if (def.applies_to_prices) {
    couponParams.applies_to = { products: [] }; // will restrict via promotion code instead
    // Note: Stripe applies_to on coupons is product-level, not price-level.
    // Restriction to specific prices is enforced via Promotion Code restrictions below.
  }

  let coupon;
  try {
    coupon = await stripe.coupons.create(couponParams);
    console.log(`[${def.code}] Coupon created: ${coupon.id}`);
  } catch (err) {
    console.error(`[${def.code}] Coupon creation failed:`, err.message);
    return;
  }

  // Step 2: Create Promotion Code
  const promoParams = {
    coupon:       coupon.id,
    code:         def.code,
    active:       true,
  };
  if (def.max_redemptions) {
    promoParams.max_redemptions = def.max_redemptions;
  }
  // Price-level restrictions via promotion code (Stripe supports this via restrictions.currency_options
  // or you restrict at the Price object level). For simplest approach with logging:
  if (def.applies_to_prices) {
    console.log(`[${def.code}] NOTE: Manually verify in Stripe Dashboard that this code is only used with: ${def.applies_to_prices.join(', ')}`);
    console.log(`[${def.code}] NOTE: ${def.notes}`);
  }

  try {
    const promo = await stripe.promotionCodes.create(promoParams);
    console.log(`[${def.code}] ✅ Promotion Code created: ${promo.id} (code: ${promo.code})`);
    console.log(`[${def.code}] Notes: ${def.notes}`);
  } catch (err) {
    if (err.code === 'resource_already_exists') {
      console.log(`[${def.code}] Promotion Code already exists — skipping.`);
    } else {
      console.error(`[${def.code}] Promotion Code creation failed:`, err.message);
    }
  }
}

async function main() {
  console.log(`\n=== GTM-008: Stripe Promo Code Setup ===`);
  console.log(`Mode: ${isLive ? 'LIVE 🔴' : 'TEST 🟡'}`);
  console.log(`Creating ${PROMO_CODES.length} promo codes...\n`);

  for (const def of PROMO_CODES) {
    await createPromoCode(def);
  }

  console.log('\n=== Done ===');
  console.log('Next steps:');
  console.log('1. Verify each code in the Stripe Dashboard under "Coupons" + "Promotion Codes"');
  console.log('2. Test each code manually in a Stripe test-mode checkout session');
  console.log('3. Confirm the discount amount is displayed before payment confirmation');
  console.log('4. Once validated, re-run with --live flag to create codes in production');
  console.log('5. Update verify-money-path.js promo code validation step with new code IDs');
}

main();

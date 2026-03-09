# Upgrade Flow Testing & Documentation

**Created**: March 6, 2026  
**Task**: BL-REV-008  
**Status**: Comprehensive test scenarios and operational documentation  
**Dependencies**: BL-REV-001, BL-REV-002, BL-REV-003

---

## Overview

This document provides comprehensive testing procedures, operational guidelines, and debugging workflows for the Prime Self subscription upgrade system. All critical paths are documented with expected outcomes and troubleshooting steps.

---

## Table of Contents

1. [Test Scenarios](#test-scenarios)
2. [Upgrade Flow Testing](#upgrade-flow-testing)
3. [Downgrade & Cancellation Testing](#downgrade--cancellation-testing)
4. [Failed Payment Handling](#failed-payment-handling)
5. [Webhook Event Handling](#webhook-event-handling)
6. [Edge Cases & Error Conditions](#edge-cases--error-conditions)
7. [Load Testing](#load-testing)
8. [Monitoring & Alerts](#monitoring--alerts)

---

## Test Scenarios

### Scenario Matrix

| Scenario | User State | Action | Expected Outcome | Verification |
|----------|------------|--------|------------------|--------------|
| **T-001** | Free tier | Upgrade to Seeker | Stripe checkout → Payment → Tier updated | DB: tier='seeker', UI: tier badge shows "SEEKER" |
| **T-002** | Seeker tier | Upgrade to Guide | Prorated charge → Tier updated | DB: tier='guide', Usage: unlimited profiles |
| **T-003** | Guide tier | Upgrade to Practitioner | Prorated charge → Tier updated | DB: tier='practitioner', Feature: whiteLabel=true |
| **T-004** | Practitioner | Downgrade to Guide | Immediate access retained | DB: cancel_at_period_end=true, Access: retained until period_end |
| **T-005** | Any paid tier | Cancel subscription | Access retained until period end | DB: cancel_at_period_end=true, status='active' |
| **T-006** | Seeker tier | Payment fails (3x) | Email notifications → Auto-cancel | DB: status='past_due' → 'cancelled', tier='free' |
| **T-007** | Free tier | Access practitioner tools | 403 error with upgrade prompt | UI: Pricing modal opens, Error: "Feature not available" |
| **T-008** | Free tier | Generate 2nd profile | 429 quota exceeded | UI: Upgrade modal, Error: "Usage quota exceeded" |
| **T-009** | Seeker tier | Generate 11th profile | 429 quota exceeded | Usage: 10/10, Response: upgrade_required=true |
| **T-010** | Guide tier | Update payment method | Billing portal → Card updated | Stripe: payment_method updated, No service interruption |

---

## Upgrade Flow Testing

### Test 1: Free → Seeker Upgrade

**Prerequisites**:
- User registered with email/password
- JWT token obtained from `/api/auth/login`
- Stripe test mode enabled

**Test Steps**:

```bash
# 1. Register new user
curl -X POST https://prime-self-api.adrper79.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-upgrade-001@example.com",
    "password": "testpass123",
    "birthDate": "1990-01-01",
    "birthTime": "12:00",
    "birthTz": "America/New_York",
    "birthLat": 40.7128,
    "birthLng": -74.0060
  }'

# Save returned accessToken
export TOKEN="eyJ..."

# 2. Verify starting tier is 'free'
curl https://prime-self-api.adrper79.workers.dev/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Expected: { "user": { "tier": "free", ... } }

# 3. Create checkout session for Seeker tier
curl -X POST https://prime-self-api.adrper79.workers.dev/api/stripe/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier": "seeker"}'

# Expected: { "url": "https://checkout.stripe.com/c/pay/cs_test_..." }

# 4. Complete payment in browser
# - Open checkout URL
# - Use test card: 4242 4242 4242 4242
# - Expiry: 12/25, CVC: 123, ZIP: 12345
# - Click "Subscribe"

# 5. Verify webhook received (check Stripe Dashboard → Webhooks → Logs)
# Expected events:
# - checkout.session.completed
# - customer.subscription.created  
# - invoice.payment_succeeded

# 6. Verify database updated
psql "$NEON_CONNECTION_STRING" -c "
  SELECT u.email, s.tier, s.status, s.stripe_subscription_id
  FROM subscriptions s
  JOIN users u ON s.user_id = u.id
  WHERE u.email = 'test-upgrade-001@example.com';
"

# Expected: tier='seeker', status='active', stripe_subscription_id populated

# 7. Verify tier enforcement
curl -X POST https://prime-self-api.adrper79.workers.dev/api/profile/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "birthDate": "1990-01-01",
    "birthTime": "12:00",
    "birthTimezone": "America/New_York",
    "lat": 40.7128,
    "lng": -74.0060
  }'

# Expected: 200 OK, profile generated (quota: 1/10)

# 8. Generate 10 more profiles (should all succeed until 11th)
for i in {2..11}; do
  curl -X POST https://prime-self-api.adrper79.workers.dev/api/profile/generate \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "birthDate": "1990-01-01",
      "birthTime": "12:00",
      "birthTimezone": "America/New_York",
      "lat": 40.7128,
      "lng": -74.0060
    }'
done

# Expected: First 10 succeed (200), 11th returns 429 with upgrade prompt
```

**Success Criteria**:
- ✅ Checkout session created successfully
- ✅ Payment processed in Stripe test mode
- ✅ Webhooks delivered successfully (all 3 events)
- ✅ Database subscription record created with correct tier
- ✅ User tier updated from 'free' to 'seeker'
- ✅ Tier enforcement respects new quota (10 profiles/month)
- ✅ 11th profile generation blocked with 429 error

---

### Test 2: Seeker → Guide Upgrade (Mid-Cycle)

**Prerequisites**:
- User currently on Seeker tier ($15/month)
- Subscription 15 days into billing cycle

**Test Steps**:

```bash
# 1. Create checkout for Guide tier
curl -X POST https://prime-self-api.adrper79.workers.dev/api/stripe/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier": "guide"}'

# 2. Complete payment
# Expected proration: (97 - 15) * (15/30) = $41 for remaining 15 days
# Next invoice: Full $97

# 3. Verify immediate tier update
curl https://prime-self-api.adrper79.workers.dev/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Expected: { "user": { "tier": "guide", ... } }

# 4. Verify practitioner tools now accessible
curl https://prime-self-api.adrper79.workers.dev/api/practitioner/clients \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK, { "ok": true, "clients": [], "count": 0 }

# 5. Verify unlimited profile generation
# Generate 20 profiles (should all succeed)
for i in {1..20}; do
  curl -X POST https://prime-self-api.adrper79.workers.dev/api/profile/generate \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "birthDate": "1990-01-01",
      "birthTime": "12:00",
      "birthTimezone": "America/New_York",
      "lat": 40.7128,
      "lng": -74.0060
    }'
done

# Expected: All 20 succeed (tier: 'guide' has unlimited profileGenerations)
```

**Success Criteria**:
- ✅ Prorated amount charged correctly
- ✅ Tier updated immediately after payment
- ✅ Practitioner tools unlocked
- ✅ Profile generation quota now unlimited
- ✅ API call quota updated to 1,000/month

---

### Test 3: Guide → Practitioner Upgrade

**Test Steps**:

```bash
# 1. Create checkout for Practitioner tier
curl -X POST https://prime-self-api.adrper79.workers.dev/api/stripe/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier": "practitioner"}'

# 2. Complete payment in browser
# Expected charge: Prorated upgrade from $97 to $500

# 3. Verify white-label features unlocked
curl https://prime-self-api.adrper79.workers.dev/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Expected: tier='practitioner', features.whiteLabel=true

# 4. Verify API call quota increased to 10,000/month
# Make 2,000 API calls (should succeed - no quota error)
```

**Success Criteria**:
- ✅ Upgrade completes successfully
- ✅ Tier updated to 'practitioner'
- ✅ API quota increased to 10K calls/month
- ✅ White-label features enabled

---

## Downgrade & Cancellation Testing

### Test 4: Practitioner → Guide Downgrade

**Test Steps**:

```bash
# 1. Open billing portal
curl -X POST https://prime-self-api.adrper79.workers.dev/api/stripe/portal \
  -H "Authorization: Bearer $TOKEN"

# Expected: { "url": "https://billing.stripe.com/p/session/test_..." }

# 2. In browser:
# - Open portal URL
# - Click "Update plan"
# - Select "Guide ($97/month)"
# - Confirm change

# 3. Verify access retained until end of billing period
psql "$NEON_CONNECTION_STRING" -c "
  SELECT tier, status, cancel_at_period_end, current_period_end
  FROM subscriptions
  WHERE user_id = '...';
"

# Expected: tier='practitioner', cancel_at_period_end=true
# Access continues until current_period_end

# 4. Wait for billing period end (or manually trigger webhook: customer.subscription.updated)

# 5. Verify downgrade applied at period end
# Expected: tier='guide', status='active'
```

**Success Criteria**:
- ✅ Downgrade scheduled (not immediate)
- ✅ Access to practitioner features retained until period end
- ✅ Tier updated to 'guide' on renewal date
- ✅ API quota reduced to 1,000/month after period end

---

### Test 5: Cancel Subscription (Any Tier)

**Test Steps**:

```bash
# 1. Open billing portal
curl -X POST https://prime-self-api.adrper79.workers.dev/api/stripe/portal \
  -H "Authorization: Bearer $TOKEN"

# 2. In browser portal:
# - Click "Cancel plan"
# - Select cancellation reason: "Too expensive"
# - Confirm cancellation

# 3. Verify subscription marked for cancellation
psql "$NEON_CONNECTION_STRING" -c "
  SELECT status, cancel_at_period_end, current_period_end
  FROM subscriptions
  WHERE user_id = '...';
"

# Expected: status='active', cancel_at_period_end=true

# 4. Verify access retained until period end
curl https://prime-self-api.adrper79.workers.dev/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Expected: still shows current tier, not downgraded yet

# 5. Simulate period end (trigger customer.subscription.deleted webhook manually)

# 6. Verify tier downgraded to 'free'
psql "$NEON_CONNECTION_STRING" -c "
  SELECT tier, status FROM subscriptions WHERE user_id = '...';
"

# Expected: tier='free', status='cancelled'
```

**Success Criteria**:
- ✅ Cancellation flag set immediately
- ✅ Access retained until billing period ends
- ✅ Tier downgraded to 'free' after period end
- ✅ Webhook `customer.subscription.deleted` processed correctly
- ✅ Cancellation reason recorded in Stripe

---

## Failed Payment Handling

### Test 6: Payment Failure (Insufficient Funds)

**Test Steps**:

```bash
# 1. Create new subscription with test card that always fails
# Use card: 4000 0000 0000 0341 (card_declined)

# 2. Complete checkout with declining card

# 3. Verify webhook received: invoice.payment_failed
# Check Stripe Dashboard → Webhooks → Logs

# 4. Verify payment_events logged
psql "$NEON_CONNECTION_STRING" -c "
  SELECT event_type, status, failure_reason, amount
  FROM payment_events
  WHERE subscription_id = '...'
  ORDER BY created_at DESC
  LIMIT 1;
"

# Expected: event_type='invoice.payment_failed', status='failed'

# 5. Verify subscription status updated
psql "$NEON_CONNECTION_STRING" -c "
  SELECT status FROM subscriptions WHERE user_id = '...';
"

# Expected: status='past_due'

# 6. Verify user still has access (grace period)
curl https://prime-self-api.adrper79.workers.dev/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Expected: tier unchanged during grace period

# 7. Simulate 3 failed retry attempts (Stripe auto-retries)

# 8. Verify subscription cancelled after max retries
# Webhook: customer.subscription.deleted

# 9. Verify tier downgraded to 'free'
psql "$NEON_CONNECTION_STRING" -c "
  SELECT tier, status FROM subscriptions WHERE user_id = '...';
"

# Expected: tier='free', status='cancelled'
```

**Success Criteria**:
- ✅ Payment failure logged in payment_events table
- ✅ Subscription status updated to 'past_due'
- ✅ User retains access during grace period
- ✅ After max retries, subscription cancelled
- ✅ Tier downgraded to 'free' after cancellation
- ✅ User receives email notifications about failed payment

---

### Test 7: Payment Recovery (Update Card)

**Test Steps**:

```bash
# 1. Subscription in 'past_due' status (from Test 6)

# 2. Open billing portal
curl -X POST https://prime-self-api.adrper79.workers.dev/api/stripe/portal \
  -H "Authorization: Bearer $TOKEN"

# 3. In browser portal:
# - Click "Update payment method"
# - Enter valid card: 4242 4242 4242 4242
# - Save changes

# 4. Stripe automatically retries charge

# 5. Verify webhook: invoice.payment_succeeded

# 6. Verify subscription reactivated
psql "$NEON_CONNECTION_STRING" -c "
  SELECT status, tier FROM subscriptions WHERE user_id = '...';
"

# Expected: status='active', tier restored

# 7. Verify user access restored
curl https://prime-self-api.adrper79.workers.dev/api/practitioner/clients \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK (if on guide+ tier)
```

**Success Criteria**:
- ✅ New payment method accepted
- ✅ Stripe auto-retries failed invoice
- ✅ Subscription reactivated
- ✅ Access fully restored
- ✅ No data loss during past_due period

---

## Webhook Event Handling

### Webhook Event Matrix

| Event | Trigger | Handler Action | Database Update | Expected Result |
|-------|---------|----------------|-----------------|-----------------|
| `checkout.session.completed` | User completes checkout | Create/update subscription | `subscriptions` insert/update | Tier activated |
| `customer.subscription.created` | New subscription | Log subscription details | `subscriptions` insert | Backup record |
| `customer.subscription.updated` | Plan change, cancellation, reactivation | Update tier/status | `subscriptions` update | Tier/status synced |
| `customer.subscription.deleted` | Cancellation takes effect | Downgrade to free tier | `subscriptions` update `tier='free'`, `status='cancelled'` | Access revoked |
| `invoice.payment_succeeded` | Successful payment | Log payment | `payment_events` insert | Payment recorded |
| `invoice.payment_failed` | Payment fails | Log failure | `payment_events` insert, `subscriptions` update `status='past_due'` | Grace period starts |

### Webhook Verification

**Test webhook signature validation**:

```bash
# 1. Get webhook signing secret from Stripe Dashboard
export WEBHOOK_SECRET="whsec_..."

# 2. Send test webhook event
stripe trigger checkout.session.completed \
  --add checkout_session:metadata[userId]=<USER_UUID>

# 3. Verify worker logs show successful processing
wrangler tail --format pretty

# Expected in logs:
# "Webhook verified: checkout.session.completed"
# "Subscription created for user: <USER_UUID>"

# 4. Test invalid signature (should reject)
curl -X POST https://prime-self-api.adrper79.workers.dev/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: t=123,v1=invalid_signature" \
  -d '{"type":"test","data":{}}'

# Expected: 400 Bad Request, "Webhook signature verification failed"
```

**Webhook Retry Logic**:

Stripe automatically retries failed webhooks with exponential backoff:
- Retry 1: Immediately
- Retry 2: 1 hour
- Retry 3: 6 hours
- Retry 4: 12 hours
- Retry 5: 24 hours

**Monitoring**:
- Check Stripe Dashboard → Webhooks → Endpoint → Delivery logs
- Look for 2xx responses (success) vs 4xx/5xx (failure)
- Set up alerts for webhook failure rate >5%

---

## Edge Cases & Error Conditions

### Edge Case 1: Duplicate Subscription Creation

**Scenario**: User clicks "Upgrade" twice quickly

**Expected Behavior**:
- First checkout session succeeds
- Second checkout session fails (user already has active subscription)

**Test**:
```bash
# 1. Create first checkout session
curl -X POST https://prime-self-api.adrper79.workers.dev/api/stripe/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tier": "seeker"}'

# 2. Immediately create second checkout session (before completing first)
curl -X POST https://prime-self-api.adrper79.workers.dev/api/stripe/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tier": "seeker"}'

# Expected: Second request returns error
# { "error": "Active subscription already exists" }
```

**Mitigation**: Handler checks for existing active subscription before creating checkout.

---

### Edge Case 2: Webhook Out of Order

**Scenario**: `customer.subscription.updated` arrives before `checkout.session.completed`

**Expected Behavior**:
- Handler should be idempotent (safe to process multiple times)
- Database uses `ON CONFLICT` to handle duplicates

**Test**:
1. Manually trigger webhooks in reverse order using Stripe CLI
2. Verify no duplicate subscriptions created
3. Verify final state is correct

---

### Edge Case 3: User Deleted During Active Subscription

**Scenario**: Admin deletes user account while subscription active

**Expected Behavior**:
- `ON DELETE CASCADE` removes subscription record
- Stripe subscription should be cancelled via admin action

**Test**:
```sql
-- 1. Delete user
DELETE FROM users WHERE email = 'test@example.com';

-- 2. Verify subscription also deleted (cascade)
SELECT * FROM subscriptions WHERE user_id = '<deleted_user_id>';
-- Expected: 0 rows

-- 3. Manually cancel Stripe subscription (admin task)
stripe subscriptions cancel sub_xxx
```

---

### Edge Case 4: Webhook Delivers to Wrong Environment

**Scenario**: Production webhook accidentally configured with test mode endpoint

**Mitigation**:
- Separate webhook endpoints for test vs live
- Validate event `livemode` flag matches environment

**Handler Logic**:
```javascript
// In webhook handler
const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

// Check environment mismatch
if (event.livemode && ENV === 'test') {
  console.error('Live event sent to test endpoint');
  return Response.json({ error: 'Environment mismatch' }, { status: 400 });
}
```

---

## Load Testing

### Concurrent Checkout Sessions

**Test**: 100 users upgrade simultaneously

```bash
# Using Apache Bench
ab -n 100 -c 10 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -p checkout_payload.json \
  https://prime-self-api.adrper79.workers.dev/api/stripe/checkout

# Expected:
# - All 100 requests succeed (200 OK)
# - No duplicate subscriptions created
# - Checkout sessions created in <500ms each
```

### Webhook Flood

**Test**: Stripe sends 1000 webhooks in 10 seconds

```bash
# Simulate high webhook volume
for i in {1..1000}; do
  stripe trigger invoice.payment_succeeded &
done
wait

# Verify:
# - All webhooks processed successfully
# - No database deadlocks
# - No duplicate payment_events records
# - Worker doesn't hit execution limits
```

---

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Stripe Checkout Conversion Rate**:
   - Metric: `(checkout_sessions_completed / checkout_sessions_created) * 100`
   - Alert: < 60% (investigate checkout friction)

2. **Webhook Success Rate**:
   - Metric: `(webhooks_2xx / webhooks_total) * 100`
   - Alert: < 95% (investigate handler errors)

3. **Payment Failure Rate**:
   - Metric: `(invoice_payment_failed / total_invoices) * 100`
   - Alert: > 10% (card declines spiking)

4. **Subscription Churn**:
   - Metric: `(subscriptions_cancelled_this_month / active_subscriptions_start_of_month) * 100`
   - Alert: > 5%/month (investigate cancellation reasons)

5. **Database Query Performance**:
   - Metric: Query duration for `getUserTier()`
   - Alert: > 100ms (index not being used)

### Recommended Alerts

```yaml
# Example: Cloudflare Workers Analytics
alerts:
  - name: "High Webhook Failure Rate"
    condition: "webhook_errors / webhook_total > 0.05"
    window: "5 minutes"
    action: "Email engineering team"
  
  - name: "Subscription Downgrade Spike"
    condition: "tier_downgrades > 10"
    window: "1 hour"
    action: "Slack notification"
  
  - name: "Database Connection Errors"
    condition: "db_connection_errors > 0"
    window: "1 minute"
    action: "PagerDuty alert"
```

### Stripe Dashboard Monitoring

Daily checks:
- **Home → Analytics**: Review MRR trends
- **Payments → Disputed payments**: Handle chargebacks
- **Customers → Subscriptions**: Monitor cancellation reasons
- **Webhooks → Delivery logs**: Check for failed deliveries

---

## Operational Runbooks

### Runbook 1: Webhook Failure Recovery

**Symptoms**: Webhooks showing 500 errors in Stripe Dashboard

**Steps**:
1. Check worker logs: `wrangler tail --format pretty`
2. Identify error (e.g., database timeout, null pointer)
3. Fix code issue and deploy: `wrangler deploy`
4. In Stripe Dashboard → Webhooks → Failed events → Click "Resend"
5. Verify events process successfully
6. Update monitoring to catch this error type

### Runbook 2: User Reports "Upgrade Not Working"

**Steps**:
1. Ask user for email address
2. Query database:
   ```sql
   SELECT u.email, s.tier, s.status, s.stripe_subscription_id
   FROM users u
   LEFT JOIN subscriptions s ON u.id = s.user_id
   WHERE u.email = 'user@example.com';
   ```
3. Check Stripe Dashboard → Customers → Search by email
4. Verify subscription status in Stripe
5. If mismatch, manually trigger webhook or update database
6. Instruct user to refresh page and check tier badge

### Runbook 3: Refund Request

**Steps**:
1. In Stripe Dashboard → Payments → Search for user email
2. Click payment → "Refund"
3. Select full or partial refund
4. Stripe automatically sends `charge.refunded` webhook
5. Handler should downgrade tier if full refund
6. Verify tier updated in database
7. Email user confirmation

---

## Testing Checklist Summary

Before marking BL-REV-008 complete:

- [ ] All test scenarios T-001 through T-010 pass
- [ ] Free → Seeker upgrade works end-to-end
- [ ] Seeker → Guide upgrade with proration works
- [ ] Guide → Practitioner upgrade works
- [ ] Downgrade retains access until period end
- [ ] Cancellation processed correctly
- [ ] Failed payment handling with grace period works
- [ ] Payment recovery (update card) reactivates subscription
- [ ] All 6 webhook events handled correctly
- [ ] Webhook signature validation rejects invalid signatures
- [ ] Duplicate subscription prevention works
- [ ] Out-of-order webhooks handled idempotently
- [ ] Load test: 100 concurrent checkouts succeed
- [ ] Monitoring alerts configured
- [ ] Operational runbooks documented

---

## Documentation Updates

### Files Updated

1. **OPERATION.md** - Add webhook monitoring procedures
2. **STRIPE_SETUP.md** - Reference testing procedures
3. **BUILD_LOG.md** - Mark BL-REV-008 complete
4. **README.md** - Add "Testing" section with link to this doc

### Next Steps

After testing complete:
1. Deploy to production (update Stripe to live mode)
2. Monitor first 10 real subscriptions closely
3. Gather user feedback on checkout flow
4. Iterate on upgrade CTAs based on conversion data

---

**Test Completion Date**: [Pending]  
**Tested By**: [Pending]  
**Production Deploy Date**: [Pending]  
**First Revenue Date**: [Pending]

# Prime Self — Deployment Guide

**Purpose**: Step-by-step deployment procedures with verification  
**Audience**: Developers deploying to production  
**Last Updated**: March 8, 2026

---

## 🎯 Pre-Deployment Checklist

Before deploying, verify:

- [ ] All tests passing: `npm test` (expect 190/190 ✅)
- [ ] No TypeScript/lint errors: Review with Copilot or run linter
- [ ] Database migration planned (if schema changes)
- [ ] Environment secrets configured (see "Required Secrets" below)
- [ ] Code committed and pushed to `main` branch

---

## 🚀 Deployment Procedures

### A. Backend (Cloudflare Workers)

**Location**: `workers/` directory  
**Live URL**: https://prime-self-api.adrper79.workers.dev

#### Step 1: Deploy Worker

```bash
cd workers
npx wrangler deploy
```

**Expected Output**:
```
✨ Successfully deployed to:
https://prime-self-api.adrper79.workers.dev
```

#### Step 2: Verify Health Endpoint

```bash
curl https://prime-self-api.adrper79.workers.dev/api/health
```

**Expected Response**:
```json
{
  "status": "ok",
  "version": "0.2.0",
  "timestamp": "2026-03-08T12:00:00.000Z"
}
```

If you get a different version number or error, deployment failed. Run `npx wrangler deploy --force` to force a fresh deployment.

#### Step 3: Test Authenticated Endpoint

```bash
# Register a test user
curl -X POST https://prime-self-api.adrper79.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test User"}'

# Expected: 201 Created with JWT tokens
# Copy the access_token from response

# Test /api/auth/me
curl -H "Authorization: Bearer <paste-access-token>" \
  https://prime-self-api.adrper79.workers.dev/api/auth/me

# Expected: 200 OK with user data
```

If `/api/auth/me` returns 404, the deployment served stale code. See "Troubleshooting" below.

---

### B. Frontend (Cloudflare Pages)

**Location**: `frontend/` directory  
**Live URL**: https://selfprime.net (or prime-self-ui.pages.dev)

#### Auto-Deploy via Git Push

Frontend auto-deploys on push to `main`:

```bash
git add frontend/
git commit -m "Deploy: [describe changes]"
git push origin main
```

**Cloudflare Pages** will automatically:
1. Detect the push to `main`
2. Build the site (if build command configured)
3. Deploy to production (~2-3 minutes)

#### Manual Verification

1. Open https://selfprime.net in incognito window (avoid cache)
2. Open DevTools → Console
3. Verify no CSP violations
4. Try logging in with test credentials
5. Generate a chart to test API connectivity

---

## 🔐 Required Secrets

Set these via `npx wrangler secret put <NAME>`:

| Secret | Description | How to Get |
|--------|-------------|------------|
| `NEON_CONNECTION_STRING` | PostgreSQL connection string | Neon dashboard → Connection String (pooled) |
| `ANTHROPIC_API_KEY` | Claude API key | Anthropic console → API Keys |
| `JWT_SECRET` | Random 64-char string | `openssl rand -hex 32` |
| `STRIPE_SECRET_KEY` | Stripe secret key | Stripe dashboard → Developers → API Keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Stripe dashboard → Webhooks → Signing secret |
| `TELNYX_API_KEY` | SMS provider API key | Telnyx dashboard → API Keys |
| `TELNYX_PHONE_NUMBER` | SMS sender number | Telnyx dashboard → Numbers |
| `SENTRY_DSN` | Error tracking (optional) | Sentry.io → Project Settings → DSN |

**Check configured secrets**:
```bash
cd workers
npx wrangler secret list
```

---

## 🔍 Post-Deployment Verification

Run this automated verification script:

```bash
cd workers
node verify-production.js
```

**Or manually test critical endpoints**:

```bash
# Health check
curl https://prime-self-api.adrper79.workers.dev/api/health

# Public endpoint (no auth)
curl https://prime-self-api.adrper79.workers.dev/api/geocode?q=Tampa

# Authenticated endpoint (requires JWT)
curl -H "Authorization: Bearer <token>" \
  https://prime-self-api.adrper79.workers.dev/api/auth/me
```

**All should return 200 OK**. If you get 404 or 500, see troubleshooting below.

---

## 🐛 Troubleshooting

### Issue: Routes Return 404 Despite Being in Code

**Symptoms**: `/api/auth/me`, `/api/validation/*`, etc. return 404.

**Cause**: Worker deployed successfully but Cloudflare is serving a cached old version.

**Fix**:
```bash
cd workers
npx wrangler deploy --force
```

Then verify again with `curl`.

---

### Issue: Database Errors (500 responses)

**Symptoms**: `/api/diary`, `/api/validation` return 500 Internal Server Error.

**Cause**: Missing database connection string OR schema not migrated.

**Fix**:

1. **Check secret is set**:
   ```bash
   npx wrangler secret list
   # Should show NEON_CONNECTION_STRING
   ```

2. **If missing, set it**:
   ```bash
   echo "postgresql://user:pass@host/db" | npx wrangler secret put NEON_CONNECTION_STRING
   ```

3. **Run migration**:
   ```bash
   cd workers
   node run-migration.js
   ```

4. **Re-test endpoint**:
   ```bash
   curl -H "Authorization: Bearer <token>" \
     https://prime-self-api.adrper79.workers.dev/api/diary
   ```

---

### Issue: CSP Violations in Browser Console

**Symptoms**: 
```
Content-Security-Policy: The page's settings blocked the loading of a resource
```

**Cause**: CSP meta tag in `frontend/index.html` is too restrictive.

**Fix**: CSP should allow:
- Cloudflare Insights: `https://static.cloudflareinsights.com`
- Data URIs for fonts: `data:`

Check [index.html#L6-L18](frontend/index.html#L6-L18) has correct CSP directives, then redeploy frontend:
```bash
git add frontend/index.html
git commit -m "Fix CSP violations"
git push origin main
```

---

### Issue: Stripe Webhooks Failing

**Symptoms**: Subscriptions created in Stripe but not updating database.

**Cause**: Webhook signature verification failing.

**Fix**:

1. **Get webhook signing secret** from Stripe dashboard
2. **Set in Worker**:
   ```bash
   echo "whsec_..." | npx wrangler secret put STRIPE_WEBHOOK_SECRET
   ```
3. **Test webhook** via Stripe CLI:
   ```bash
   stripe listen --forward-to https://prime-self-api.adrper79.workers.dev/api/webhook/stripe
   stripe trigger checkout.session.completed
   ```

---

## 📊 Monitoring Production

### View Live Worker Logs

```bash
cd workers
npx wrangler tail --format pretty
```

Keep this running in a separate terminal. Refresh your app in the browser to see real-time request logs and errors.

### Check Cloudflare Dashboard

- **Analytics**: https://dash.cloudflare.com → Workers & Pages → prime-self-api → Analytics
- **Logs**: Real-time logs (last 4 hours) in Analytics tab
- **Errors**: Check "Errors" chart for spikes

### Sentry Error Tracking (if configured)

- Dashboard: https://sentry.io/organizations/[your-org]/issues/
- Errors auto-reported with stack traces, request context, user info

---

## 🔄 Rollback Procedure

If a deployment breaks production:

1. **Revert Git commit**:
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Force re-deploy**:
   ```bash
   cd workers
   npx wrangler deploy --force
   ```

3. **Verify health endpoint** returns to normal.

For database migrations, rollback is manual:
- Write inverse SQL (e.g., `ALTER TABLE users DROP COLUMN new_column`)
- Run via `psql $NEON_CONNECTION_STRING`

**Prevention**: Test migrations on a dev database branch first (Neon supports branching).

---

## 📋 Deployment History

| Date | Version | Deployed By | Changes | Status |
|------|---------|-------------|---------|--------|
| 2026-03-08 | 0.2.0 | GitHub Copilot | Sprint 16: TODO resolution, import fixes | ✅ Code complete, ❌ DEPLOYMENT PENDING |
| 2026-03-07 | 0.2.0 | - | Sprint 15: Deep audit, 10 new backlog items | ✅ |
| 2026-03-06 | 0.1.0 | - | Stripe integration, Phase 3 complete | 🟡 Partial (stale code in prod) |

---

## 🎯 Quick Reference

**Deploy Workers**:
```bash
cd workers && npx wrangler deploy
```

**Deploy Frontend** (auto via git):
```bash
git push origin main
```

**View logs**:
```bash
cd workers && npx wrangler tail
```

**Verify production**:
```bash
curl https://prime-self-api.adrper79.workers.dev/api/health
```

**Emergency rollback**:
```bash
git revert HEAD && git push origin main
cd workers && npx wrangler deploy --force
```

---

**See Also**:
- [CODEBASE_AUDIT_2026-03-08.md](CODEBASE_AUDIT_2026-03-08.md) — Production issues analysis
- [QUICK_START_STRIPE.md](QUICK_START_STRIPE.md) — Stripe webhook setup
- [docs/OPERATION.md](docs/OPERATION.md) — Operational procedures

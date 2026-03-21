# Production Deployment Checklist

**Effective Date:** 2026-03-21  
**Status:** Active  
**Last Updated:** 2026-03-21

This checklist covers all required steps for deploying HumanDesign to production with proper configuration, secrets management, and verification.

---

## Pre-Deployment Requirements

### Environment Preparation
- [ ] All required environment variables in `.env.local`
  - [ ] `CLOUDFLARE_API` token
  - [ ] `CLOUFLARE_ACCOUNT_ID` (note the typo - it's intentional for backwards compatibility)
  - [ ] `TELNYX_API_KEY`
  - [ ] `TELNYX_PHONE_NUMBER`
  - [ ] `TELNYX_PUBLIC_KEY`
  - [ ] `Google_Client_ID`
  - [ ] `Google_Client_API`
  - [ ] `APPLE_CLIENT_ID`
  - [ ] `APPLE_TEAM_ID`
  - [ ] `APPLE_KEY_ID`
  - [ ] `APPLE_PRIVATE_KEY`

### System Requirements
- [ ] Node.js >= 20.0.0 installed
- [ ] `wrangler` CLI installed globally (`npm install -g @cloudflare/wrangler`)
- [ ] Cloudflare account access configured (`wrangler login`)
- [ ] All test dependencies installed (`npm install`)

### Pre-deployment Verification
- [ ] Run tests: `npm run test:deterministic`
  - Expected: All tests pass
- [ ] Run linting: `npm run lint` (if configured)
  - Expected: No errors
- [ ] Check code style
  - Expected: Consistent with project standards

---

## Phase 1: Secrets Deployment (Critical)

### Secrets Configuration
Use the automated deployment process. Never commit secrets to version control.

**Step 1: Review Secrets** (5 minutes)
```bash
# See what will be deployed
npm run deploy:secrets:dry
```
Expected output:
- Shows all secrets to be deployed
- No errors
- Counts match expected count (minimum 10 required secrets)

**Step 2: Deploy Secrets** (10 minutes)
```bash
# Interactive deployment with verification
npm run deploy:secrets
```
You'll be prompted to confirm. Type `y` to proceed.

Expected output:
```
✅ Deployed: 10 secrets
```

**Step 3: Verify Secrets** (5 minutes)
```bash
# Check that secrets are accessible
npm run test:secrets
```
Expected output:
```
✅ Configured: 10 secrets
Workers are ready for deployment.
```

**Step 4: Test Integrations** (10 minutes)
```bash
# Validate that deployed secrets work with their services
npm run test:integrations
```
Expected output:
```
📊 Results: 4/4 integrations working
✨ All integrations validated successfully!
```

**Phase 1 Check:** All four steps completed successfully ✅

---

## Phase 2: Build and Test

### Local Build
```bash
npm run build
```
Expected:
- Build completes without errors
- No TypeScript errors

### Run Full Test Suite
```bash
npm run test:deterministic
```
Expected:
- All tests pass
- No timeouts
- Coverage intact

### Smoke Tests
```bash
npm run test:prod:smoke
```
Expected:
- Core functionality verified
- No critical regressions

---

## Phase 3: Workers Deployment

### Deploy to Production
```bash
# Option A: Deploy and verify (recommended)
npm run deploy

# Option B: Deploy only
npm run deploy:workers
```

Expected output:
```
⚡ Changes:
  ✓ Your Worker was successfully uploaded
```

### Post-Deploy Verification
```bash
# Verify production is healthy
npm run verify:prod
```
Expected:
- APIs responding
- Metrics available
- No critical errors

---

## Phase 4: Production Validation

### Validation Checklist
- [ ] Production APIs responding: `npm run verify:prod`
- [ ] Gate suite passing: `npm run verify:prod:gate`
- [ ] Money path working: `npm run verify:money`

### Smoke Tests in Production
```bash
npm run test:prod:smoke
```

### Health Check Dashboard
Visit your Cloudflare dashboard:
1. Go to Workers dashboard
2. Click your worker
3. Verify Analytics section shows recent requests
4. Check error rate is < 0.1%

---

## Phase 5: Monitoring and Rollback

### Monitor for Issues (Next 24 hours)
- [ ] Check error logs regularly
- [ ] Monitor API response times (should be < 200ms)
- [ ] Watch for user-reported issues

### Abort Conditions (Automatic Rollback)
If any of these occur, rollback immediately:
1. Error rate jumps above 5%
2. API response times > 5 seconds for more than 5 minutes
3. Authentication system broken
4. Payment processing failing

### Rollback Procedure
If issues detected:

```bash
# Option 1: Deploy previous version (if tagged)
git checkout <previous-tag>
npm run deploy

# Option 2: Disable Worker (emergency)
cd workers && wrangler rollback

# Option 3: Rollback Secrets (if corrupted)
# See docs/SECRETS_DEPLOYMENT.md for reset instructions
```

---

## Common Issues and Solutions

### Issue: Secrets Not Found
**Symptoms:** 
- `npm run verify:prod` returns 401 Unauthorized
- "Secret not found" errors in logs

**Solutions:**
1. Verify secrets deployed: `npm run test:secrets`
2. Re-deploy secrets: `npm run deploy:secrets --no-confirm`
3. Check wrangler authentication: `wrangler whoami`
4. If still failing, see [docs/SECRETS_DEPLOYMENT.md](SECRETS_DEPLOYMENT.md#rollback--reset)

### Issue: Build Failures
**Symptoms:**
- `npm run build` shows TypeScript errors
- Worker deployment fails with syntax errors

**Solutions:**
1. Clear cache: `rm -rf .turbo dist`
2. Reinstall: `npm install`
3. Run tests: `npm run test:deterministic`
4. Check Git changes: `git diff`

### Issue: Verification Script Fails
**Symptoms:**
- `npm run verify:prod` exits with non-zero code
- "Connection refused" or timeout errors

**Solutions:**
1. Check Worker is deployed: `wrangler deployments list`
2. Check Worker routes: `wrangler tail` (monitor in progress)
3. Verify account ID matches: Check `wrangler.toml`
4. Wait 30 seconds for DNS propagation

### Issue: OAuth Tests Failing
**Symptoms:**
- `npm run verify:prod:gate` fails at OAuth step
- Google/Apple login not working

**Solutions:**
1. Verify OAuth credentials: `npm run test:secrets`
2. Check redirect URIs configured in provider dashboard
3. Ensure secrets match production settings exactly
4. Clear browser cookies and retry

---

## Deployment Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| Pre-Deploy | 15 min | Environment check, test run |
| Secrets | 30 min | Deploy, verify, test integrations |
| Build & Test | 20 min | Build, unit tests, smoke tests |
| Workers | 10 min | Deploy, verify |
| Validation | 30 min | Full validation, monitoring setup |
| **Total** | **~2 hours** | Complete deployment |

---

## Post-Deployment Checklist

After successful deployment:

### Immediate (Day 0)
- [ ] Monitor error logs
- [ ] Verify all 4 OAuth providers working
- [ ] Check SMS delivery working
- [ ] Monitor database performance
- [ ] Review analytics data

### First Week
- [ ] Weekly security scan
- [ ] Performance assessment
- [ ] User feedback review
- [ ] Document any issues
- [ ] Create follow-up issues if needed

### Monthly
- [ ] Full security audit
- [ ] Performance analysis
- [ ] Dependency updates
- [ ] Secrets rotation (if needed)

---

## Deployment Commands Reference

```bash
# Phase 1: Secrets
npm run deploy:secrets         # Interactive deployment
npm run deploy:secrets:dry     # Preview only
npm run test:secrets           # Verify deployed
npm run test:integrations      # Test with services

# Phase 2: Build & Test
npm run build                  # Build worker
npm run test:deterministic     # Run all tests

# Phase 3: Deploy
npm run deploy                 # Full deployment (secrets + workers + verify)
npm run deploy:workers         # Workers only
npm run verify:prod            # Post-deploy check

# Phase 4: Validation
npm run verify:prod:gate       # Full API validation
npm run test:prod:smoke        # Smoke tests
npm run verify:money           # Payment path check
```

---

## Emergency Contacts

- **Cloudflare Support:** https://support.cloudflare.com
- **Wrangler Issues:** https://github.com/cloudflare/wrangler2/issues
- **Internal on-call:** See team Slack channel

---

## Related Documentation

- [Secrets Deployment Guide](SECRETS_DEPLOYMENT.md)
- [Architecture](../ARCHITECTURE.md)
- [Cloudflare Deployment](../CLOUDFLARE_DEPLOYMENT_CONFIRMED.md)
- [Worker Configuration](../workers/README.md)

---

**Last Deployed:** [To be filled in]  
**Deployed By:** [To be filled in]  
**Issues Found:** [To be filled in]

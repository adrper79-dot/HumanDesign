# Secrets & Deployment Quick Reference

**One-page reference for deploying HumanDesign**  
For complete details, see [PRODUCTION_DEPLOYMENT_CHECKLIST.md](PRODUCTION_DEPLOYMENT_CHECKLIST.md)

---

## Quick Start: Deploy to Production

```bash
# 1. Preview secrets
npm run deploy:secrets:dry

# 2. Deploy secrets to Cloudflare Workers
npm run deploy:secrets

# 3. Verify secrets are configured
npm run test:secrets

# 4. Test integrations (optional but recommended)
npm run test:integrations

# 5. Full deployment (builds, tests, deploys workers)
npm run deploy

# 6. Verify production is working
npm run verify:prod
```

---

## Deployment Commands

| Command | Purpose | Duration |
|---------|---------|----------|
| `npm run deploy:secrets:dry` | Preview what will be deployed | 5 sec |
| `npm run deploy:secrets` | Deploy secrets interactively | 2-3 min |
| `npm run deploy:secrets:force` | Deploy without confirmation | 2-3 min |
| `npm run test:secrets` | Verify secrets are configured | 10 sec |
| `npm run test:integrations` | Test all API integrations | 30 sec |
| `npm run deploy:workers` | Deploy just the worker code | 1-2 min |
| `npm run deploy` | Full deployment (secrets + workers + verify) | 5-10 min |
| `npm run verify:prod` | Verify production is healthy | 30 sec |

---

## Secrets Checklist

Required secrets in `.env.local`:

```
CLOUDFLARE_API=xxx
CLOUFLARE_ACCOUNT_ID=xxx
TELNYX_API_KEY=xxx
TELNYX_PHONE_NUMBER=xxx
TELNYX_PUBLIC_KEY=xxx
Google_Client_ID=xxx
Google_Client_API=xxx
APPLE_CLIENT_ID=xxx
APPLE_TEAM_ID=xxx
APPLE_KEY_ID=xxx
APPLE_PRIVATE_KEY=xxx
```

---

## Expected Output

### `npm run deploy:secrets`
```
✅ Deployed: 10 secrets
✨ Deployment Complete!
```

### `npm run test:secrets`
```
✅ Configured: 10 secrets
Workers are ready for deployment.
```

### `npm run verify:prod`
```
✅ Production APIs responding
✅ Metrics available
✅ All checks passed
```

---

## Troubleshooting

| Problem | Command to Fix |
|---------|----------------|
| Secrets not found | `npm run deploy:secrets && npm run test:secrets` |
| Build errors | `npm run test:deterministic` |
| Verification fails | `npm run verify:prod` then `npm run verify:prod:gate` |
| OAuth not working | `npm run test:integrations` |

---

## File Locations

| File | Purpose |
|------|---------|
| `scripts/deploy-secrets.js` | Main script to deploy secrets |
| `scripts/test-secrets.cjs` | Verify secrets are configured |
| `scripts/test-integrations.mjs` | Test API integrations |
| `.env.local` | Local environment variables (DO NOT COMMIT) |
| `workers/wrangler.toml` | Worker configuration |
| `workers/src/index.js` | Worker entry point |

---

## More Information

- **Detailed Deployment Guide:** [PRODUCTION_DEPLOYMENT_CHECKLIST.md](PRODUCTION_DEPLOYMENT_CHECKLIST.md)
- **Secrets Management:** [SECRETS_DEPLOYMENT.md](SECRETS_DEPLOYMENT.md)
- **Architecture:** [../ARCHITECTURE.md](../ARCHITECTURE.md)
- **Cloudflare:** [../CLOUDFLARE_DEPLOYMENT_CONFIRMED.md](../CLOUDFLARE_DEPLOYMENT_CONFIRMED.md)

---

**Last Updated:** 2026-03-21  
**Status:** Production Ready

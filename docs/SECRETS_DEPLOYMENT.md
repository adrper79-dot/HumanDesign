# Secrets Deployment Guide

This document provides step-by-step instructions for deploying required Cloudflare Workers secrets from `.env.local` to production.

## Overview

All sensitive configuration (API keys, OAuth credentials, etc.) should be stored as **Cloudflare Workers Secrets**, not in code or `wrangler.toml`. This guide shows how to deploy them.

## Prerequisites

- `.env.local` exists in project root with all required keys
- `wrangler` CLI is installed (`npm install -g @cloudflare/wrangler`)
- You have write access to Cloudflare Workers project
- You're authenticated to Cloudflare (`wrangler login`)

## Secrets to Deploy

### Observability (WC-005)

```bash
# Extract values from .env.local and deploy
CF_TOKEN=$(grep 'CLOUDFLARE_API=' .env.local | cut -d'=' -f2)
CF_ACCOUNT=$(grep 'CLOUFLARE_ACCOUNT_ID=' .env.local | cut -d'=' -f2)

cd workers

# Deploy Cloudflare Analytics token
echo "$CF_TOKEN" | wrangler secret put CF_API_TOKEN

# Deploy account ID
echo "$CF_ACCOUNT" | wrangler secret put CF_ACCOUNT_ID

# Verify
wrangler secret list
```

### SMS/Telnyx (WC-008)

```bash
TELNYX_KEY=$(grep 'TELNYX_API_KEY=' .env.local | cut -d'=' -f2)
TELNYX_PHONE=$(grep 'TELNYX_PHONE_NUMBER=' .env.local | cut -d'=' -f2)
TELNYX_PUBKEY=$(grep 'TELNYX_PUBLIC_KEY=' .env.local | cut -d'=' -f2)

cd workers

# Deploy SMS secrets
echo "$TELNYX_KEY" | wrangler secret put TELNYX_API_KEY
echo "$TELNYX_PHONE" | wrangler secret put TELNYX_PHONE_NUMBER
echo "$TELNYX_PUBKEY" | wrangler secret put TELNYX_PUBLIC_KEY
```

### Google OAuth (WC-006)

```bash
GOOGLE_ID=$(grep 'Google_Client_ID=' .env.local | cut -d'=' -f2)
GOOGLE_SECRET=$(grep 'Google_Client_API=' .env.local | cut -d'=' -f2)

cd workers

echo "$GOOGLE_ID" | wrangler secret put GOOGLE_CLIENT_ID
echo "$GOOGLE_SECRET" | wrangler secret put GOOGLE_CLIENT_SECRET
```

### Apple Sign-In (WC-007)

Apple Sign-In requires special handling for the private key (.p8 file). 

```bash
# Apple Sign-In secrets must be created manually in Apple Developer portal
# and deployed via wrangler:

cd workers

wrangler secret put APPLE_CLIENT_ID
# Paste your Service ID

wrangler secret put APPLE_TEAM_ID
# Paste your Team ID

wrangler secret put APPLE_KEY_ID
# Paste your Key ID

wrangler secret put APPLE_PRIVATE_KEY
# Paste the full .p8 private key (including -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----)
# To paste multiline content in wrangler, press Ctrl+D after the last line (on Mac/Linux) or Ctrl+Z (Windows)
```

## Verification

After deploying secrets, verify they're accessible:

```bash
npm run test:secrets
```

This should output:
```
✅ CF_API_TOKEN: configured
✅ CF_ACCOUNT_ID: configured
✅ TELNYX_API_KEY: configured
✅ TELNYX_PHONE_NUMBER: configured
✅ GOOGLE_CLIENT_ID: configured
✅ GOOGLE_CLIENT_SECRET: configured
✅ APPLE_CLIENT_ID: configured
✅ APPLE_TEAM_ID: configured
✅ APPLE_KEY_ID: configured
✅ APPLE_PRIVATE_KEY: configured
```

## Testing After Deployment

### Test Cloudflare Metrics (WC-005)
```bash
npm run audit:vitals
# Should show CF Metrics section with real data
```

### Test SMS Delivery (WC-008)
```bash
node scripts/test-sms.cjs
# Should send test SMS to configured phone
```

### Test Google OAuth (WC-006)
```bash
npm run test:oauth -- --provider google
# Should complete OAuth redirect flow
```

### Test Apple Sign-In (WC-007)
```bash
npm run test:oauth -- --provider apple
# Should complete OAuth redirect flow
```

## Rollback / Reset

If you need to remove a secret:

```bash
cd workers
wrangler secret delete SECRET_NAME
```

To view all deployed secrets (note: values are hidden):

```bash
cd workers
wrangler secret list
```

## Automation

For CI/CD pipelines, create a GitHub Actions secret with the environment and use:

```yaml
- name: Deploy Workers Secrets
  run: |
    cd workers
    echo "${{ secrets.CF_API_TOKEN }}" | wrangler secret put CF_API_TOKEN
    echo "${{ secrets.CF_ACCOUNT_ID }}" | wrangler secret put CF_ACCOUNT_ID
    # ... repeat for other secrets
```

---

**Last Updated:** 2026-03-21  
**Related Issues:** [WC-005](../../audits/issue-registry.json), [WC-006](../../audits/issue-registry.json), [WC-007](../../audits/issue-registry.json), [WC-008](../../audits/issue-registry.json)  
**Related Backlog:** [BL-OPS-P2-4 through P2-7](../../MASTER_BACKLOG_SYSTEM_V2.md)

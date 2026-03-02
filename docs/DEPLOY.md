# Prime Self API — Deployment Guide

## Prerequisites

- Node.js 18+ installed
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) installed: `npm install -g wrangler`
- Cloudflare account with Workers plan
- Neon PostgreSQL database provisioned

## 1. Authenticate with Cloudflare

```bash
wrangler login
```

This opens a browser window for OAuth. After authenticating, verify:

```bash
wrangler whoami
```

## 2. Create KV Namespace

```bash
cd workers
wrangler kv namespace create CACHE
```

Copy the `id` from the output and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "CACHE"
id = "PASTE_ID_HERE"
```

## 3. Run Database Migration

```bash
NEON_CONNECTION_STRING="YOUR_NEON_CONNECTION_STRING" \
  node workers/src/db/migrate.js
```

This creates the tables: users, charts, profiles, transit_snapshots, practitioners, practitioner_clients, clusters, cluster_members, sms_messages.

## 4. Set Worker Secrets

Each secret is set individually via the Wrangler CLI:

```bash
cd workers

# Neon PostgreSQL connection string
echo "YOUR_NEON_CONNECTION_STRING" | wrangler secret put NEON_CONNECTION_STRING

# Anthropic API key (for Claude — Layer 8 synthesis)
echo "YOUR_ANTHROPIC_KEY" | wrangler secret put ANTHROPIC_API_KEY

# Telnyx (SMS)
echo "YOUR_TELNYX_API_KEY" | wrangler secret put TELNYX_API_KEY
echo "YOUR_TELNYX_PHONE" | wrangler secret put TELNYX_PHONE_NUMBER

# JWT signing key (generate a strong random string)
echo "$(openssl rand -hex 32)" | wrangler secret put JWT_SECRET

# Cloudflare AI Gateway URL
echo "https://gateway.ai.cloudflare.com/v1/YOUR_ACCOUNT_ID/prime-self/anthropic" | wrangler secret put AI_GATEWAY_URL
```

## 5. Deploy

```bash
cd workers
wrangler deploy
```

Expected output:
```
Uploaded prime-self-api (X.XX sec)
Published prime-self-api (X.XX sec)
  https://prime-self-api.YOUR_SUBDOMAIN.workers.dev
  Current Deployment ID: ...
```

## 6. Verify Deployment

### Health Check
```bash
curl https://prime-self-api.YOUR_SUBDOMAIN.workers.dev/api/health
```

Expected response:
```json
{"status":"ok","version":"0.2.0","endpoints":13}
```

### Chart Calculation
```bash
curl -X POST https://prime-self-api.YOUR_SUBDOMAIN.workers.dev/api/chart/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "birthDate": "1979-08-05",
    "birthTime": "22:51",
    "lat": 27.9506,
    "lng": -82.4572
  }'
```

Verify: type=Projector, authority=Emotional-Solar Plexus, profile=6/2.

## Architecture Notes

### Workers-Specific: Data Injection

Cloudflare Workers don't have filesystem access, so `readFileSync` calls in the engine won't work. This is handled by `workers/src/engine-compat.js`:

1. It statically imports all required JSON data files
2. esbuild (wrangler's bundler) inlines the JSON at build time
3. The data is injected into `globalThis.__PRIME_DATA`
4. Engine modules (`chart.js`, `synthesis.js`) check this global first, falling back to `readFileSync` for Node.js

This means:
- **Workers**: JSON data is inlined in the bundle (fast, no filesystem needed)
- **Node.js/Tests**: `readFileSync` works as normal

### Cron Job

The Worker has a cron trigger at `0 6 * * *` (6 AM UTC daily) that:
1. Calculates daily transit positions
2. Saves a snapshot to the `transit_snapshots` table
3. Sends SMS digests to opted-in users

### Rate Limiting

Rate limiting uses the `CACHE` KV namespace. Default limits:
- 60 requests/minute per IP for public endpoints
- 10 requests/minute for LLM-dependent endpoints (profile/generate)

### AI Gateway

LLM calls route through Cloudflare AI Gateway for:
- Rate limiting and retry logic
- Response caching (identical prompts)
- Cost tracking and analytics

Set up the AI Gateway in the Cloudflare dashboard:
1. Go to **AI > AI Gateway**
2. Create gateway named `prime-self`
3. Add Anthropic as a provider
4. Use the gateway URL as the `AI_GATEWAY_URL` secret

## Troubleshooting

### "KV namespace not found"
Run `wrangler kv namespace create CACHE` and update the `id` in `wrangler.toml`.

### JSON data missing in responses
Ensure `engine-compat.js` is imported first in `workers/src/index.js`. Check that all JSON files in `src/data/` and `src/knowledgebase/` are present.

### Cron not firing
Verify the cron trigger in `wrangler.toml`:
```toml
[triggers]
crons = ["0 6 * * *"]
```
Check logs: `wrangler tail --format=pretty`

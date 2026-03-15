#!/usr/bin/env bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# fix-ops-secrets.sh  —  PRA-OPS-001 + PRA-OPS-002 remediation
#
# Fixes the two Critical operational secrets that are currently wrong:
#   PRA-OPS-001: AI_GATEWAY_URL is set to https://selfprime.net (not a real gateway)
#   PRA-OPS-002: PRIME_SELF_API_SECRET is the placeholder text from the docs
#
# Prerequisites:
#   1. wrangler CLI installed and authenticated (npx wrangler login)
#   2. A Cloudflare AI Gateway must be created in the dashboard first:
#        https://dash.cloudflare.com → AI Gateway → Create Gateway
#      Name it "prime-self" (or any name). Copy the Gateway URL.
#      Format: https://gateway.ai.cloudflare.com/v1/<ACCOUNT_ID>/prime-self
#
# Usage:
#   bash scripts/fix-ops-secrets.sh
#   OR set AI_GATEWAY_URL manually:
#   AI_GATEWAY_URL="https://gateway.ai.cloudflare.com/v1/YOUR_ACCOUNT_ID/prime-self" \
#     bash scripts/fix-ops-secrets.sh
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
set -euo pipefail

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Prime Self — Ops Secrets Remediation"
echo " PRA-OPS-001 + PRA-OPS-002"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── PRA-OPS-002: Generate PRIME_SELF_API_SECRET ─────────────────
echo "▶ Generating PRIME_SELF_API_SECRET (48 bytes random base64)..."
if command -v openssl &>/dev/null; then
  PRIME_SELF_API_SECRET="$(openssl rand -base64 48)"
else
  # Fallback: use /dev/urandom via head
  PRIME_SELF_API_SECRET="$(head -c 48 /dev/urandom | base64 | tr -d '\n/')"
fi

echo "  Generated: ${PRIME_SELF_API_SECRET:0:8}... (truncated for display)"
echo ""

echo "  Deploying PRIME_SELF_API_SECRET to prime-self-api Worker..."
echo "$PRIME_SELF_API_SECRET" | npx wrangler secret put PRIME_SELF_API_SECRET \
  --name prime-self-api

echo "  Deploying PRIME_SELF_API_SECRET to prime-self-discord Worker..."
(cd discord && echo "$PRIME_SELF_API_SECRET" | npx wrangler secret put PRIME_SELF_API_SECRET \
  --name prime-self-discord)

echo "  ✅ PRIME_SELF_API_SECRET deployed to both workers."
echo ""

# ── PRA-OPS-001: Set AI_GATEWAY_URL ─────────────────────────────
if [[ -z "${AI_GATEWAY_URL:-}" ]]; then
  echo "▶ AI_GATEWAY_URL not provided as environment variable."
  echo "  Please create an AI Gateway in the Cloudflare Dashboard:"
  echo "  https://dash.cloudflare.com → AI → AI Gateway → Create Gateway"
  echo "  Name: prime-self"
  echo "  Then run:"
  echo ""
  echo "    AI_GATEWAY_URL=\"https://gateway.ai.cloudflare.com/v1/YOUR_ACCOUNT_ID/prime-self\" \\"
  echo "      bash scripts/fix-ops-secrets.sh"
  echo ""
  echo "  ⚠  Skipping AI_GATEWAY_URL — LLM calls will use direct Anthropic/Grok/Groq APIs."
  echo "     This is functional but bypasses CF AI Gateway caching, logging, and rate limits."
else
  # Validate it looks like a real CF AI Gateway URL
  if [[ "$AI_GATEWAY_URL" != https://gateway.ai.cloudflare.com/* ]]; then
    echo "  ✗ ERROR: AI_GATEWAY_URL does not look like a Cloudflare AI Gateway URL."
    echo "    Expected format: https://gateway.ai.cloudflare.com/v1/<ACCOUNT_ID>/<GATEWAY_NAME>"
    echo "    Got: $AI_GATEWAY_URL"
    exit 1
  fi

  echo "▶ Deploying AI_GATEWAY_URL to prime-self-api Worker..."
  echo "$AI_GATEWAY_URL" | npx wrangler secret put AI_GATEWAY_URL \
    --name prime-self-api

  echo "  ✅ AI_GATEWAY_URL set: $AI_GATEWAY_URL"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Done. Re-deploy the worker to pick up changes:"
echo "   npx wrangler deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

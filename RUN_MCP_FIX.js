#!/usr/bin/env node
/**
 * Cloudflare MCP Fix - Quick Checklist
 * Run these commands in order to complete the fix.
 */

console.log(`
╔════════════════════════════════════════════════════════════╗
║  Cloudflare MCP Fix - Deployment Checklist (2026-03-08)   ║
╚════════════════════════════════════════════════════════════╝

STEP 1: Copy MCP config template locally (optional, for IDE)
────────────────────────────────────────────────────────────
  $ cp .vscode/mcp.example.json .vscode/mcp.json
  
  Then set environment variables:
  
  [BASH/WSL]
  $ export CLOUDFLARE_API_TOKEN="your_token_here"
  $ export CLOUDFLARE_ACCOUNT_ID="your_account_id_here"
  
  [POWERSHELL]
  > $env:CLOUDFLARE_API_TOKEN = "your_token_here"
  > $env:CLOUDFLARE_ACCOUNT_ID = "your_account_id_here"


STEP 2: Deploy updated Worker code
────────────────────────────────────────────────────────────
  $ cd workers
  $ npx wrangler deploy --force
  
  ✓ This pushes:
    - Fail-fast guard for missing NEON_CONNECTION_STRING
    - Health endpoint with secret presence flags (?full=1)
    - Removed hardcoded database credentials


STEP 3: Check which secrets are configured
────────────────────────────────────────────────────────────
  $ cd workers
  $ npx wrangler secret list
  
  Must show: NEON_CONNECTION_STRING, JWT_SECRET, STRIPE_SECRET_KEY, TELNYX_API_KEY
  
  If NEON_CONNECTION_STRING is missing, add it:
  $ echo "postgresql://user:pass@host/db?sslmode=require" | npx wrangler secret put NEON_CONNECTION_STRING


STEP 4: Test health endpoint (diagnostics)
────────────────────────────────────────────────────────────
  Basic health (always works):
  $ curl https://prime-self-api.adrper79.workers.dev/api/health
  
  With secret flags (shows what's missing):
  $ curl https://prime-self-api.adrper79.workers.dev/api/health?full=1
  
  Or use the helper:
  $ node workers/check-secrets.js


STEP 5: If there are errors, stream live logs
────────────────────────────────────────────────────────────
  $ cd workers
  $ npx wrangler tail --format pretty
  
  Then trigger a request in another terminal.
  Look for "NEON_CONNECTION_STRING is not configured" → need Step 3.


✅ DONE! Your MCP should now work correctly.

────────────────────────────────────────────────────────────
For detailed info, see: CLOUFLARE_MCP_FIX.md
`);

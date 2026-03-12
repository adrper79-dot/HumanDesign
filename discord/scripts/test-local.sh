#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# discord/scripts/test-local.sh
#
# Sends pre-signed requests to a locally-running wrangler dev instance.
# Uses Node 20's crypto module (same Ed25519 signing as the Worker) to avoid
# needing openssl or any extra dependencies.
#
# Prerequisites:
#   1. In one terminal: cd discord && npx wrangler dev
#   2. In another terminal: bash discord/scripts/test-local.sh
#
# Usage:
#   bash discord/scripts/test-local.sh [base_url]
#   base_url defaults to http://localhost:8787
# ---------------------------------------------------------------------------

set -euo pipefail

BASE_URL="${1:-http://localhost:8787}"
PRIVATE_KEY_HEX="${DISCORD_TEST_PRIVATE_KEY_HEX:-}"

# ---------------------------------------------------------------------------
# 1. Generate a throw-away Ed25519 keypair with Node if no key is provided.
#    Print public key hex so you can paste it into wrangler.toml for local dev.
# ---------------------------------------------------------------------------
KEYS_JSON=$(node --input-type=module <<'EOF'
import { webcrypto as crypto } from 'node:crypto';
const { privateKey, publicKey } = await crypto.subtle.generateKey(
  { name: 'Ed25519' }, true, ['sign', 'verify']
);
const privRaw = Buffer.from(await crypto.subtle.exportKey('pkcs8', privateKey));
const pubRaw  = Buffer.from(await crypto.subtle.exportKey('raw', publicKey));
process.stdout.write(JSON.stringify({
  privateKeyHex: privRaw.toString('hex'),
  publicKeyHex:  pubRaw.toString('hex'),
}));
EOF
)

PRIV_HEX=$(echo "$KEYS_JSON" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).privateKeyHex))")
PUB_HEX=$(echo "$KEYS_JSON"  | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).publicKeyHex))")

echo ""
echo "=== Test keypair ==="
echo "Public key (paste into discord/wrangler.toml DISCORD_PUBLIC_KEY for local dev):"
echo "  $PUB_HEX"
echo ""
echo "NOTE: This keypair is ephemeral — each run generates a new one."
echo "      Set DISCORD_PUBLIC_KEY in wrangler.toml to the value above before"
echo "      running wrangler dev, or sign requests with your real key by"
echo "      passing DISCORD_TEST_PRIVATE_KEY_HEX=<your real pkcs8 hex>."
echo ""

# ---------------------------------------------------------------------------
# 2. Helper: sign a request body and emit curl arguments
# ---------------------------------------------------------------------------
sign_and_curl() {
  local label="$1"
  local body="$2"
  local priv_hex="$3"

  local ts
  ts=$(date +%s)

  local sig
  sig=$(node --input-type=module <<SIGN
import { webcrypto as crypto } from 'node:crypto';
const privHex = '${priv_hex}';
const ts = '${ts}';
const body = String.raw\`${body}\`;
const privBytes = Uint8Array.from(Buffer.from(privHex, 'hex'));
const key = await crypto.subtle.importKey('pkcs8', privBytes, { name: 'Ed25519' }, false, ['sign']);
const msg = new TextEncoder().encode(ts + body);
const sig = await crypto.subtle.sign('Ed25519', key, msg);
process.stdout.write(Buffer.from(sig).toString('hex'));
SIGN
  )

  echo "─── $label ───"
  echo "Body: $body"
  echo ""
  local http_status
  http_status=$(curl -s -o /tmp/discord_test_out.txt -w "%{http_code}" \
    -X POST "$BASE_URL" \
    -H "Content-Type: application/json" \
    -H "X-Signature-Ed25519: $sig" \
    -H "X-Signature-Timestamp: $ts" \
    -d "$body")

  echo "HTTP $http_status"
  cat /tmp/discord_test_out.txt | node -e "
    process.stdin.resume();let d='';
    process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{try{console.log(JSON.stringify(JSON.parse(d),null,2))}catch{console.log(d)}});
  "
  echo ""
}

# ---------------------------------------------------------------------------
# 3. Test cases
# ---------------------------------------------------------------------------

# 3a. PING
sign_and_curl "PING (should return type:1 PONG)" \
  '{"type":1}' \
  "$PRIV_HEX"

# 3b. GET method (no signature needed — Worker rejects it before sig check)
echo "─── GET /interactions (should return 405) ───"
curl -s -o /dev/null -w "HTTP %{http_code}\n\n" -X GET "$BASE_URL"

# 3c. Tampered body — valid sig but wrong content
echo "─── Tampered signature (should return 401) ───"
curl -s -o /dev/null -w "HTTP %{http_code}\n\n" \
  -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "X-Signature-Ed25519: $(python3 -c 'print("a"*128)' 2>/dev/null || printf '%0128d' 0)" \
  -H "X-Signature-Timestamp: $(date +%s)" \
  -d '{"type":1}'

# 3d. Valid /primself command
sign_and_curl "/primself — valid inputs (should return type:5 deferred)" \
  '{"type":2,"data":{"name":"primself","options":[{"name":"date","value":"1990-06-15"},{"name":"time","value":"14:30"},{"name":"city","value":"New York, USA"}]},"guild_id":"test-guild-001","member":{"user":{"id":"local-test-user"}},"application_id":"1481094643226513562","token":"test-tok"}' \
  "$PRIV_HEX"

# 3e. Invalid date format
sign_and_curl "/primself — bad date (should return type:5 deferred + follow-up error)" \
  '{"type":2,"data":{"name":"primself","options":[{"name":"date","value":"99/99/1990"},{"name":"time","value":"14:30"},{"name":"city","value":"London"}]},"guild_id":"test-guild-001","member":{"user":{"id":"local-test-user-2"}},"application_id":"1481094643226513562","token":"test-tok-2"}' \
  "$PRIV_HEX"

# 3f. Unknown command
sign_and_curl "Unknown command (should return type:4 ephemeral)" \
  '{"type":2,"data":{"name":"not_a_real_command","options":[]},"guild_id":"test-guild-001","member":{"user":{"id":"local-test-user-3"}},"application_id":"1481094643226513562","token":"test-tok-3"}' \
  "$PRIV_HEX"

echo "=== Done. Check wrangler dev console for follow-up calls ==="

#!/bin/bash
set -e

TS=$(date +%s)
EMAIL="testci_${TS}@mailtest.dev"

echo "Registering user: $EMAIL"
RESP=$(curl -s -X POST "https://prime-self-api.adrper79.workers.dev/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"TestPass123x\"}")
echo "Register resp: $RESP" | head -c 300
echo ""

TOKEN=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken','NO_TOKEN'))")
echo "Token: ${TOKEN:0:30}"

sleep 2

echo ""
echo "Testing POST /api/checkin..."
CHECKIN=$(curl -s -X POST "https://prime-self-api.adrper79.workers.dev/api/checkin" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"alignmentScore":7,"followedStrategy":true,"followedAuthority":true,"notes":"Automated test"}')
echo "Checkin: $CHECKIN" | head -c 400
echo ""

echo ""
echo "Testing GET /api/checkin/stats..."
STATS=$(curl -s "https://prime-self-api.adrper79.workers.dev/api/checkin/stats" \
  -H "Authorization: Bearer $TOKEN")
echo "Stats: $STATS" | head -c 200
echo ""

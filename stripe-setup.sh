#!/bin/bash
# Stripe Setup Script for Prime Self
# Run this after deploying the worker

set -e

echo "================================================"
echo "Prime Self - Stripe Integration Setup"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

require_database_url() {
  if [[ -n "$DATABASE_URL" ]]; then
    echo "$DATABASE_URL"
    return 0
  fi

  if [[ -n "$NEON_DATABASE_URL" ]]; then
    echo "$NEON_DATABASE_URL"
    return 0
  fi

  return 1
}

# Step 1: Set webhook secret (must be done AFTER creating webhook endpoint in Stripe)
echo -e "${YELLOW}Step 1: Set Stripe Webhook Secret${NC}"
echo ""
echo "First, create the webhook endpoint in Stripe Dashboard:"
echo "  1. Go to: https://dashboard.stripe.com/webhooks"
echo "  2. Click 'Add endpoint'"
echo "  3. URL: https://prime-self-api.adrper79.workers.dev/api/webhook/stripe"
echo "  4. Select these events:"
echo "      - checkout.session.completed"
echo "      - customer.subscription.created"
echo "      - customer.subscription.updated"
echo "      - customer.subscription.deleted"
echo "      - invoice.payment_succeeded"
echo "      - invoice.payment_failed"
echo "  5. Click 'Add endpoint'"
echo "  6. Copy the 'Signing secret' (starts with whsec_...)"
echo ""
read -p "Paste the webhook secret here (whsec_...): " WEBHOOK_SECRET

if [[ ! $WEBHOOK_SECRET =~ ^whsec_ ]]; then
  echo -e "${RED}Error: Webhook secret should start with 'whsec_'${NC}"
  exit 1
fi

echo "$WEBHOOK_SECRET" | npx wrangler secret put STRIPE_WEBHOOK_SECRET

echo -e "${GREEN}✓ Webhook secret set${NC}"
echo ""

# Step 2: Create Stripe Products
echo -e "${YELLOW}Step 2: Create Stripe Products${NC}"
echo ""
echo "Create products in Stripe Dashboard:"
echo "  Go to: https://dashboard.stripe.com/products"
echo ""

echo "Product 1: Prime Self - Explorer"
echo "  - Name: Prime Self - Explorer"
echo "  - Price: \$12.00 / month"
echo "  - After creating, copy the Price ID (price_...)"
read -p "Paste Explorer Price ID: " PRICE_REGULAR

echo ""
echo "Product 2: Prime Self - Guide"
echo "  - Name: Prime Self - Guide"
echo "  - Price: \$60.00 / month"
read -p "Paste Guide Price ID: " PRICE_PRACTITIONER

echo ""
echo "Product 3: Prime Self - Studio"
echo "  - Name: Prime Self - Studio"
echo "  - Price: \$149.00 / month"
read -p "Paste Studio Price ID: " PRICE_WHITE_LABEL

# Validate price IDs
if [[ ! $PRICE_REGULAR =~ ^price_ ]] || [[ ! $PRICE_PRACTITIONER =~ ^price_ ]] || [[ ! $PRICE_WHITE_LABEL =~ ^price_ ]]; then
  echo -e "${RED}Error: Price IDs should start with 'price_'${NC}"
  exit 1
fi

# Update wrangler.toml with price IDs
echo ""
echo -e "${YELLOW}Updating wrangler.toml with Price IDs...${NC}"

# macOS uses different sed syntax
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s/STRIPE_PRICE_REGULAR = .*/STRIPE_PRICE_REGULAR = \"$PRICE_REGULAR\"/" wrangler.toml
  sed -i '' "s/STRIPE_PRICE_PRACTITIONER = .*/STRIPE_PRICE_PRACTITIONER = \"$PRICE_PRACTITIONER\"/" wrangler.toml
  sed -i '' "s/STRIPE_PRICE_WHITE_LABEL = .*/STRIPE_PRICE_WHITE_LABEL = \"$PRICE_WHITE_LABEL\"/" wrangler.toml
else
  sed -i "s/STRIPE_PRICE_REGULAR = .*/STRIPE_PRICE_REGULAR = \"$PRICE_REGULAR\"/" wrangler.toml
  sed -i "s/STRIPE_PRICE_PRACTITIONER = .*/STRIPE_PRICE_PRACTITIONER = \"$PRICE_PRACTITIONER\"/" wrangler.toml
  sed -i "s/STRIPE_PRICE_WHITE_LABEL = .*/STRIPE_PRICE_WHITE_LABEL = \"$PRICE_WHITE_LABEL\"/" wrangler.toml
fi

echo -e "${GREEN}✓ Price IDs updated in wrangler.toml${NC}"
echo ""

# Step 3: Redeploy with new price IDs
echo -e "${YELLOW}Step 3: Redeploying worker with new price IDs...${NC}"
npx wrangler deploy

echo -e "${GREEN}✓ Worker redeployed${NC}"
echo ""

# Step 4: Run database migration
echo -e "${YELLOW}Step 4: Database Migration${NC}"
echo ""

# Check if psql is installed
if command -v psql &> /dev/null; then
  read -p "Run database migration now? (y/n): " RUN_MIGRATION
  if [[ $RUN_MIGRATION == "y" ]]; then
    if ! DB_URL="$(require_database_url)"; then
      echo -e "${RED}Error: set DATABASE_URL or NEON_DATABASE_URL before running the migration.${NC}"
      exit 1
    fi
    psql "$DB_URL" -f src/db/migrate.sql
    echo -e "${GREEN}✓ Database migration complete${NC}"
  fi
else
  echo -e "${YELLOW}psql not found. Install with:${NC}"
  echo "  Ubuntu/Debian: sudo apt install postgresql-client"
  echo "  macOS: brew install postgresql"
  echo ""
  echo "Then run manually after exporting DATABASE_URL or NEON_DATABASE_URL:"
  echo "  psql \"\$DATABASE_URL\" -f src/db/migrate.sql"
fi

echo ""
echo "================================================"
echo -e "${GREEN}✓ Stripe Setup Complete!${NC}"
echo "================================================"
echo ""
echo "Next steps:"
echo "  1. Test upgrade flow: Run test scenarios from docs/UPGRADE_FLOW_TESTING.md"
echo "  2. Monitor webhooks: https://dashboard.stripe.com/webhooks"
echo "  3. Check subscriptions: Query database to verify tier updates"
echo ""
echo "Test Card Numbers:"
echo "  Success: 4242 4242 4242 4242"
echo "  Decline: 4000 0000 0000 0002"
echo ""

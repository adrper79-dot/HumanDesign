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

echo "Product 1: Prime Self - Seeker"
echo "  - Name: Prime Self - Seeker"
echo "  - Price: \$15.00 / month"
echo "  - After creating, copy the Price ID (price_...)"
read -p "Paste Seeker Price ID: " PRICE_SEEKER

echo ""
echo "Product 2: Prime Self - Guide"
echo "  - Name: Prime Self - Guide"
echo "  - Price: \$97.00 / month"
read -p "Paste Guide Price ID: " PRICE_GUIDE

echo ""
echo "Product 3: Prime Self - Practitioner"
echo "  - Name: Prime Self - Practitioner"
echo "  - Price: \$500.00 / month"
read -p "Paste Practitioner Price ID: " PRICE_PRACTITIONER

# Validate price IDs
if [[ ! $PRICE_SEEKER =~ ^price_ ]] || [[ ! $PRICE_GUIDE =~ ^price_ ]] || [[ ! $PRICE_PRACTITIONER =~ ^price_ ]]; then
  echo -e "${RED}Error: Price IDs should start with 'price_'${NC}"
  exit 1
fi

# Update wrangler.toml with price IDs
echo ""
echo -e "${YELLOW}Updating wrangler.toml with Price IDs...${NC}"

# macOS uses different sed syntax
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s/STRIPE_PRICE_SEEKER = .*/STRIPE_PRICE_SEEKER = \"$PRICE_SEEKER\"/" wrangler.toml
  sed -i '' "s/STRIPE_PRICE_GUIDE = .*/STRIPE_PRICE_GUIDE = \"$PRICE_GUIDE\"/" wrangler.toml
  sed -i '' "s/STRIPE_PRICE_PRACTITIONER = .*/STRIPE_PRICE_PRACTITIONER = \"$PRICE_PRACTITIONER\"/" wrangler.toml
else
  sed -i "s/STRIPE_PRICE_SEEKER = .*/STRIPE_PRICE_SEEKER = \"$PRICE_SEEKER\"/" wrangler.toml
  sed -i "s/STRIPE_PRICE_GUIDE = .*/STRIPE_PRICE_GUIDE = \"$PRICE_GUIDE\"/" wrangler.toml
  sed -i "s/STRIPE_PRICE_PRACTITIONER = .*/STRIPE_PRICE_PRACTITIONER = \"$PRICE_PRACTITIONER\"/" wrangler.toml
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
    NEON_URL="postgresql://neondb_owner:npg_FlB3I6JYdboV@ep-rapid-bird-aicgk9v2-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require"
    psql "$NEON_URL" -f src/db/migrate.sql
    echo -e "${GREEN}✓ Database migration complete${NC}"
  fi
else
  echo -e "${YELLOW}psql not found. Install with:${NC}"
  echo "  Ubuntu/Debian: sudo apt install postgresql-client"
  echo "  macOS: brew install postgresql"
  echo ""
  echo "Then run manually:"
  echo "  psql \"postgresql://neondb_owner:...@ep-rapid-bird-aicgk9v2-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require\" -f src/db/migrate.sql"
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

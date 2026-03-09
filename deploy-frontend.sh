#!/bin/bash
# Deploy frontend to Cloudflare Pages
# Usage: ./deploy-frontend.sh

echo "🚀 Deploying frontend to Cloudflare Pages..."

# Navigate to project directory
cd "$(dirname "$0")"

# Install Wrangler if not already installed
if ! command -v wrangler &> /dev/null; then
    echo "📦 Installing Wrangler CLI..."
    npm install -g wrangler
fi

# Deploy the frontend directory
echo "📤 Uploading frontend files..."
cd frontend
npx wrangler pages deploy . --project-name=prime-self-ui

echo "✅ Deployment complete! Check https://selfprime.net in 30 seconds."

#!/usr/bin/env bash
# Git Bash deploy helper: commit, push, deploy workers, verify
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Staging all changes"
git add -A
if git diff --cached --quiet; then
  echo "No changes to commit"
else
  git commit -m "Sprint 16: docs audit + CSP fix; deploy verification docs"
fi

echo "==> Pushing to origin main"
git push origin main

echo "==> Deploying Cloudflare Workers"
cd workers
npx wrangler deploy

echo "==> Verifying production"
node verify-production.js

echo "==> Done"

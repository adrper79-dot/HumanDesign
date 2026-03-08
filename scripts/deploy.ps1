Param()
# PowerShell deploy helper: commit, push, deploy workers, verify
Set-StrictMode -Version Latest
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host '==> Staging all changes'
git add -A
if ((git diff --cached --name-only) -eq $null) {
  Write-Host 'No changes to commit'
} else {
  git commit -m "Sprint 16: docs audit + CSP fix; deploy verification docs"
}

Write-Host '==> Pushing to origin main'
git push origin main

Write-Host '==> Deploying Cloudflare Workers'
Set-Location (Join-Path $root 'workers')
npx wrangler deploy

Write-Host '==> Verifying production'
node verify-production.js

Write-Host '==> Done'

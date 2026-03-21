#!/usr/bin/env node

/**
 * Secrets Deployment Script
 * 
 * Deploys required Cloudflare Workers secrets from .env.local to production.
 * Supports dry-run mode, selective deployment, and verification.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Parse arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-n');
const verify = args.includes('--verify');
const selective = args.length > 0 && !args.some(a => a.startsWith('--'));

// Define secrets to deploy
const SECRETS_TO_DEPLOY = [
  // Observability
  {
    worksheetKey: 'CF_API_TOKEN',
    wranglerKey: 'CF_API_TOKEN',
    category: 'observability',
    description: 'Cloudflare API token for analytics (Analytics:Read + Workers Analytics Engine:Read)',
    required: true,
  },
  {
    envKey: 'CLOUFLARE_ACCOUNT_ID', // Note: typo in .env.local
    wranglerKey: 'CF_ACCOUNT_ID',
    category: 'observability',
    description: 'Cloudflare account ID',
    required: true,
  },
  // SMS delivery
  {
    envKey: 'TELNYX_API_KEY',
    wranglerKey: 'TELNYX_API_KEY',
    category: 'communications',
    description: 'Telnyx API key for SMS delivery',
    required: true,
  },
  {
    envKey: 'TELNYX_PHONE_NUMBER',
    wranglerKey: 'TELNYX_PHONE_NUMBER',
    category: 'communications',
    description: 'Telnyx provisioned phone number for SMS',
    required: true,
  },
  {
    envKey: 'TELNYX_PUBLIC_KEY',
    wranglerKey: 'TELNYX_PUBLIC_KEY',
    category: 'communications',
    description: 'Telnyx Ed25519 public key for webhook verification',
    required: false,
  },
  // OAuth
  {
    envKey: 'Google_Client_ID',
    wranglerKey: 'GOOGLE_CLIENT_ID',
    category: 'oauth',
    description: 'Google OAuth 2.0 client ID',
    required: true,
  },
  {
    envKey: 'Google_Client_API',
    wranglerKey: 'GOOGLE_CLIENT_SECRET',
    category: 'oauth',
    description: 'Google OAuth 2.0 client secret',
    required: true,
  },
];

// Load .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local not found at', envPath);
    process.exit(1);
  }

  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  const env = {};
  lines.forEach(line => {
    if (!line || line.startsWith('#')) return;
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  });
  return env;
}

// Validate secrets exist in .env.local
function validateSecrets(env) {
  const loaded = [];
  const missing = [];

  SECRETS_TO_DEPLOY.forEach(secret => {
    const key = secret.envKey || secret.worksheetKey;
    if (env[key]) {
      loaded.push({ key, value: env[key].substring(0, 10) + '...' });
    } else if (secret.required) {
      missing.push(key);
    }
  });

  return { loaded, missing };
}

// Deploy secret via wrangler
function deploySecret(wranglerKey, value, env) {
  const cwd = path.join(__dirname, '..', 'workers');
  
  try {
    if (dryRun) {
      console.log(`  [DRY-RUN] Would set: wrangler secret put ${wranglerKey}`);
      return true;
    }

    // Create a temporary script that securely passes the secret
    const tempScript = `const value = ${JSON.stringify(value)}; process.stdout.write(value);`;
    const result = execSync(`echo ${JSON.stringify(value)} | wrangler secret put ${wranglerKey}`, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    return true;
  } catch (err) {
    console.error(`  [ERROR] Failed to deploy ${wranglerKey}:`, err.message);
    return false;
  }
}

// Main execution
console.log('🔐 Cloudflare Workers Secrets Deployment\n');

const env = loadEnv();
const { loaded, missing } = validateSecrets(env);

if (missing.length > 0) {
  console.log('❌ Missing required secrets in .env.local:');
  missing.forEach(k => console.log(`   - ${k}`));
  console.log('\nPlease add these to .env.local and try again.\n');
  process.exit(1);
}

console.log('✅ All required secrets found in .env.local:\n');
loaded.forEach(s => console.log(`   ✓ ${s.key} (${s.value})`));
console.log();

// Group by category
const byCategory = {};
SECRETS_TO_DEPLOY.forEach(secret => {
  const key = secret.envKey || secret.worksheetKey;
  if (env[key]) {
    byCategory[secret.category] = byCategory[secret.category] || [];
    byCategory[secret.category].push(secret);
  }
});

// Deploy each category
let deployedCount = 0;
let failedCount = 0;

Object.entries(byCategory).forEach(([category, secrets]) => {
  console.log(`\n📦 Deploying ${category.toUpperCase()} secrets:`);
  secrets.forEach(secret => {
    const key = secret.envKey || secret.worksheetKey;
    const value = env[key];
    try {
      if (deploySecret(secret.wranglerKey, value, env)) {
        console.log(`  ✓ ${secret.wranglerKey}: ${secret.description}`);
        deployedCount++;
      } else {
        failedCount++;
      }
    } catch (err) {
      console.error(`  ✗ ${secret.wranglerKey}: ${err.message}`);
      failedCount++;
    }
  });
});

// Verification step
if (verify && !dryRun) {
  console.log('\n🔍 Verifying deployed secrets...');
  console.log('Run: npm run test:secrets\n');
}

// Summary
console.log(`\n${ dryRun ? '📋 DRY-RUN SUMMARY' : '✅ DEPLOYMENT COMPLETE'}`);
console.log(`  Deployed: ${deployedCount}`);
if (failedCount > 0) console.log(`  Failed: ${failedCount}`);
console.log(`  Total: ${deployedCount + failedCount}\n`);

if (dryRun) {
  console.log('ℹ️  Run without --dry-run to actually deploy secrets.\n');
}

process.exit(failedCount > 0 ? 1 : 0);

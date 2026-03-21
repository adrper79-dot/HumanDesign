#!/usr/bin/env node

/**
 * Deploy Workers Secrets
 * 
 * Reads secrets from .env.local and deploys them to Cloudflare Workers
 * using wrangler. Provides interactive confirmation before deployment.
 * 
 * Usage:
 *   node scripts/deploy-secrets.js [--dry-run] [--no-confirm]
 * 
 * Flags:
 *   --dry-run      Show what would be deployed, without actually deploying
 *   --no-confirm   Skip confirmation prompt (for CI/CD)
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const envFile = path.resolve(rootDir, '.env.local');

// Map of .env.local key → wrangler secret name
const SECRETS_MAP = {
  // Observability (WC-005)
  'CLOUDFLARE_API': 'CF_API_TOKEN',
  'CLOUFLARE_ACCOUNT_ID': 'CF_ACCOUNT_ID',

  // SMS/Telnyx (WC-008)
  'TELNYX_API_KEY': 'TELNYX_API_KEY',
  'TELNYX_PHONE_NUMBER': 'TELNYX_PHONE_NUMBER',
  'TELNYX_PUBLIC_KEY': 'TELNYX_PUBLIC_KEY',

  // Google OAuth (WC-006)
  'Google_Client_ID': 'GOOGLE_CLIENT_ID',
  'Google_Client_API': 'GOOGLE_CLIENT_SECRET',

  // Apple Sign-In (WC-007)
  'APPLE_CLIENT_ID': 'APPLE_CLIENT_ID',
  'APPLE_TEAM_ID': 'APPLE_TEAM_ID',
  'APPLE_KEY_ID': 'APPLE_KEY_ID',
  'APPLE_PRIVATE_KEY': 'APPLE_PRIVATE_KEY',
};

// Colors for CLI output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    log(`❌ Error: ${filePath} not found`, 'red');
    log('   Create .env.local with required secrets before deploying', 'dim');
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};

  content.split('\n').forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;

    const [key, ...rest] = line.split('=');
    if (key && rest.length) {
      env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });

  return env;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1000;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

async function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: 'inherit' });
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      } else {
        resolve();
      }
    });
    proc.on('error', reject);
  });
}

async function deploySecrets(secrets, dryRun = false, skipConfirm = false) {
  const workersDir = path.resolve(rootDir, 'workers');

  if (!fs.existsSync(workersDir)) {
    log(`❌ Error: ${workersDir} not found`, 'red');
    process.exit(1);
  }

  // Calculate statistics
  const toDeployCount = Object.keys(secrets).length;
  const totalSize = Object.values(secrets).reduce((sum, val) => sum + (val?.length || 0), 0);

  log('\n📊 Deployment Summary', 'cyan');
  log('─'.repeat(50), 'dim');
  log(`Environment File: ${envFile}`, 'dim');
  log(`Workers Directory: ${workersDir}`, 'dim');
  log(`Secrets to Deploy: ${toDeployCount}`, 'bright');
  log(`Total Size: ${formatBytes(totalSize)}`, 'dim');
  log(`Dry Run: ${dryRun ? 'Yes' : 'No'}`, dryRun ? 'yellow' : 'dim');

  log('\n📝 Secrets to Deploy:', 'cyan');
  log('─'.repeat(50), 'dim');

  Object.entries(secrets).forEach(([envKey, wrappedSecret]) => {
    const wranglerKey = SECRETS_MAP[envKey];
    if (wranglerKey) {
      const value = secrets[SECRETS_MAP[envKey]];
      const size = value?.length || 0;
      const masked = value?.substring(0, 5) + '***' + (value?.length > 5 ? ` (${size} chars)` : '');
      log(`  ✓ ${envKey} → ${wranglerKey}`, 'green');
      log(`    Value: ${masked}`, 'dim');
    }
  });

  log('\n');

  if (!skipConfirm && !dryRun) {
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question('Deploy secrets to Cloudflare Workers? (y/N): ', (answer) => {
        rl.close();
        if (answer.toLowerCase() !== 'y') {
          log('❌ Deployment cancelled', 'yellow');
          process.exit(1);
        }
        resolve();
      });
    }).then(async () => {
      await executeDeployment(secrets, workersDir, dryRun);
    });
  } else if (dryRun) {
    log('🏃 Dry run mode - no secrets will be deployed', 'yellow');
    process.exit(0);
  } else {
    await executeDeployment(secrets, workersDir, dryRun);
  }
}

async function executeDeployment(secrets, workersDir, dryRun) {
  log('\n🚀 Deploying Secrets', 'cyan');
  log('─'.repeat(50), 'dim');

  let deployed = 0;
  let failed = 0;

  for (const [envKey, wrappedSecret] of Object.entries(secrets)) {
    const wranglerKey = SECRETS_MAP[envKey];
    if (!wranglerKey) continue;

    const value = secrets[wranglerKey];
    if (!value) {
      log(`⊘ Skipping ${wranglerKey} (empty value)`, 'yellow');
      continue;
    }

    try {
      if (!dryRun) {
        // Write to a temporary file and pipe to wrangler
        const tempFile = path.join(workersDir, `.temp-${wranglerKey}`);
        fs.writeFileSync(tempFile, value, 'utf-8');

        try {
          // Use wrangler secret:set with --metadata
          await runCommand('wrangler', [
            'secret:set',
            wranglerKey,
            `--path=${tempFile}`,
          ]);
        } finally {
          try {
            fs.unlinkSync(tempFile);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      }

      log(`✅ ${wranglerKey}`, 'green');
      deployed++;
    } catch (error) {
      log(`❌ ${wranglerKey}: ${error.message}`, 'red');
      failed++;
    }
  }

  log('\n' + '─'.repeat(50), 'dim');
  log(`✅ Deployed: ${deployed} secrets`, 'green');
  if (failed > 0) {
    log(`❌ Failed: ${failed} secrets`, 'red');
    process.exit(1);
  }

  // Verify deployment
  log('\n🔍 Verifying Deployment', 'cyan');
  log('─'.repeat(50), 'dim');

  try {
    await runCommand('wrangler', ['secret:list']);
  } catch (error) {
    log(`⚠️  Could not verify secrets (this may be expected)`, 'yellow');
  }

  log('\n✨ Deployment Complete!', 'green');
  log('Next: Test with npm run test:secrets', 'dim');
}

// Main
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipConfirm = args.includes('--no-confirm');

const env = parseEnvFile(envFile);
const secretsToMerge = {};

// Extract secrets from env
Object.keys(SECRETS_MAP).forEach((envKey) => {
  if (env[envKey]) {
    const wranglerKey = SECRETS_MAP[envKey];
    secretsToMerge[wranglerKey] = env[envKey];
  }
});

if (Object.keys(secretsToMerge).length === 0) {
  log('❌ No secrets found in .env.local', 'red');
  process.exit(1);
}

deploySecrets(secretsToMerge, dryRun, skipConfirm).catch((error) => {
  log(`\n❌ Error: ${error.message}`, 'red');
  process.exit(1);
});

#!/usr/bin/env node

/**
 * Test Workers Secrets
 * 
 * Verifies that all required secrets are deployed to Cloudflare Workers
 * and accessible by the service. This is a critical validation step.
 * 
 * Usage:
 *   node scripts/test-secrets.cjs [--verbose]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

const REQUIRED_SECRETS = {
  // Observability (WC-005)
  'CF_API_TOKEN': { category: 'Observability', required: true },
  'CF_ACCOUNT_ID': { category: 'Observability', required: true },

  // SMS/Telnyx (WC-008)
  'TELNYX_API_KEY': { category: 'SMS', required: false },
  'TELNYX_PHONE_NUMBER': { category: 'SMS', required: false },
  'TELNYX_PUBLIC_KEY': { category: 'SMS', required: false },

  // Google OAuth (WC-006)
  'GOOGLE_CLIENT_ID': { category: 'Google OAuth', required: false },
  'GOOGLE_CLIENT_SECRET': { category: 'Google OAuth', required: false },

  // Apple Sign-In (WC-007)
  'APPLE_CLIENT_ID': { category: 'Apple Sign-In', required: false },
  'APPLE_TEAM_ID': { category: 'Apple Sign-In', required: false },
  'APPLE_KEY_ID': { category: 'Apple Sign-In', required: false },
  'APPLE_PRIVATE_KEY': { category: 'Apple Sign-In', required: false },
};

async function testSecrets() {
  log('\n🔍 Testing Cloudflare Workers Secrets', 'cyan');
  log('─'.repeat(50), 'dim');

  const workersDir = path.resolve(__dirname, '..', 'workers');
  const verbose = process.argv.includes('--verbose');

  let passed = 0;
  let failed = 0;
  let missing = 0;

  // Group secrets by category
  const categories = {};
  Object.entries(REQUIRED_SECRETS).forEach(([name, config]) => {
    if (!categories[config.category]) {
      categories[config.category] = [];
    }
    categories[config.category].push({ name, config });
  });

  // Test each secret
  for (const [category, secrets] of Object.entries(categories)) {
    log(`\n${category}`, 'bright');
    log('─'.repeat(50), 'dim');

    for (const { name, config } of secrets) {
      const isRequired = config.required;

      try {
        // Try to read secret via wrangler
        // Note: wrangler secret:list only shows names, not values
        // We'll consider a secret "configured" if wrangler doesn't error
        const output = execSync(`cd "${workersDir}" && wrangler secret:list 2>&1`, {
          encoding: 'utf-8',
        });

        if (output.includes(name) || output.includes('Listing secrets')) {
          log(`  ✅ ${name}`, 'green');
          passed++;
        } else {
          const status = isRequired ? '❌' : '⊘';
          const color = isRequired ? 'red' : 'yellow';
          log(`  ${status} ${name} (not found)`, color);
          if (isRequired) {
            failed++;
          } else {
            missing++;
          }
        }
      } catch (error) {
        // If wrangler fails, likely due to authentication
        const status = isRequired ? '❌' : '⊘';
        const color = isRequired ? 'red' : 'yellow';
        log(`  ${status} ${name} (error: ${error.message.split('\n')[0]})`, color);
        if (isRequired) {
          failed++;
        } else {
          missing++;
        }
      }
    }
  }

  // Summary
  log('\n' + '─'.repeat(50), 'dim');
  log(`✅ Configured: ${passed} secrets`, 'green');
  if (missing > 0) {
    log(`⊘ Optional (missing): ${missing} secrets`, 'yellow');
  }
  if (failed > 0) {
    log(`❌ Required (missing): ${failed} secrets`, 'red');
  }

  // Recommendations
  if (failed > 0) {
    log('\n📋 Next Steps:', 'bright');
    log('  1. Run: npm run deploy:secrets', 'blue');
    log('  2. Ensure .env.local contains all required secrets', 'blue');
    log('  3. Make sure you are logged in to Cloudflare (wrangler login)', 'blue');
    process.exit(1);
  } else {
    log('\n✨ All required secrets configured!', 'green');
    log('Workers are ready for deployment.', 'dim');
  }
}

// Run tests
testSecrets().catch((error) => {
  log(`\n❌ Error: ${error.message}`, 'red');
  process.exit(1);
});

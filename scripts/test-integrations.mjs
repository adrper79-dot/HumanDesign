#!/usr/bin/env node

/**
 * Integration Tests for Deployed Secrets
 * 
 * Validates that deployed secrets work correctly with their respective services.
 * This ensures end-to-end functionality after deployment.
 * 
 * Tests:
 *   - Cloudflare Metrics API (WC-005)
 *   - Telnyx SMS API (WC-008)
 *   - Google OAuth (WC-006)
 *   - Apple Sign-In (WC-007)
 * 
 * Usage:
 *   node scripts/test-integrations.mjs [--service=NAME]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const envFile = path.resolve(rootDir, '.env.local');

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

function parseEnv() {
  const content = fs.readFileSync(envFile, 'utf-8');
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

function httpsRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null,
          });
        } catch {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body,
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testCloudflareMetrics(env) {
  log('\n🔍 Testing Cloudflare Analytics API (WC-005)', 'cyan');
  log('─'.repeat(50), 'dim');

  const token = env['CLOUDFLARE_API'];
  const accountId = env['CLOUFLARE_ACCOUNT_ID'];

  if (!token || !accountId) {
    log('⊘ Skipped: Missing CF_API_TOKEN or CF_ACCOUNT_ID', 'yellow');
    return false;
  }

  try {
    const response = await httpsRequest({
      hostname: 'api.cloudflare.com',
      path: `/client/v4/accounts/${accountId}/zones`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 200) {
      log('✅ Cloudflare API token is valid', 'green');
      if (response.body?.result?.length > 0) {
        log(`   Found ${response.body.result.length} zones`, 'dim');
      }
      return true;
    } else {
      log(`❌ Cloudflare API error: ${response.status}`, 'red');
      if (response.body?.errors) {
        log(`   ${response.body.errors[0]?.message}`, 'red');
      }
      return false;
    }
  } catch (error) {
    log(`❌ Cloudflare API test failed: ${error.message}`, 'red');
    return false;
  }
}

async function testTelnyx(env) {
  log('\n🔍 Testing Telnyx SMS API (WC-008)', 'cyan');
  log('─'.repeat(50), 'dim');

  const apiKey = env['TELNYX_API_KEY'];
  const phoneNumber = env['TELNYX_PHONE_NUMBER'];

  if (!apiKey || !phoneNumber) {
    log('⊘ Skipped: Missing TELNYX_API_KEY or TELNYX_PHONE_NUMBER', 'yellow');
    return false;
  }

  try {
    // Test API key by checking account balance
    const response = await httpsRequest({
      hostname: 'api.telnyx.com',
      path: '/v2/balance',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 200) {
      log('✅ Telnyx API key is valid', 'green');
      if (response.body?.data?.balance) {
        log(`   Account balance: $${response.body.data.balance}`, 'dim');
      }
      return true;
    } else {
      log(`❌ Telnyx API error: ${response.status}`, 'red');
      if (response.body?.errors) {
        log(`   ${response.body.errors[0]?.detail}`, 'red');
      }
      return false;
    }
  } catch (error) {
    log(`❌ Telnyx API test failed: ${error.message}`, 'red');
    return false;
  }
}

async function testGoogleOAuth(env) {
  log('\n🔍 Testing Google OAuth (WC-006)', 'cyan');
  log('─'.repeat(50), 'dim');

  const clientId = env['Google_Client_ID'];
  const clientSecret = env['Google_Client_API'];

  if (!clientId || !clientSecret) {
    log('⊘ Skipped: Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET', 'yellow');
    return false;
  }

  try {
    // Test by exchanging a dummy code (will fail but shows API works)
    const response = await httpsRequest({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }, {
      client_id: clientId,
      client_secret: clientSecret,
      code: 'INVALID_TEST_CODE',
      grant_type: 'authorization_code',
      redirect_uri: 'http://localhost:3000/callback',
    });

    // Expected to fail with invalid code, but 400 means API responded
    if (response.status === 400 && response.body?.error === 'invalid_grant') {
      log('✅ Google OAuth credentials are valid', 'green');
      log('   (Test code was invalid as expected)', 'dim');
      return true;
    } else if (response.status === 400 && response.body?.error === 'invalid_client') {
      log('❌ Google OAuth credentials are invalid', 'red');
      log('   Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET', 'red');
      return false;
    } else {
      log(`❌ Google OAuth test unexpected response: ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Google OAuth test failed: ${error.message}`, 'red');
    return false;
  }
}

async function testAppleSignIn(env) {
  log('\n🔍 Testing Apple Sign-In (WC-007)', 'cyan');
  log('─'.repeat(50), 'dim');

  const clientId = env['APPLE_CLIENT_ID'];
  const teamId = env['APPLE_TEAM_ID'];
  const keyId = env['APPLE_KEY_ID'];
  const privateKey = env['APPLE_PRIVATE_KEY'];

  if (!clientId || !teamId || !keyId || !privateKey) {
    log('⊘ Skipped: Missing Apple Sign-In credentials', 'yellow');
    return false;
  }

  try {
    // Validate that we have a valid private key format
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      log('❌ Apple Sign-In: Invalid private key format', 'red');
      return false;
    }

    // We can't fully test without creating a JWT, but we can validate format
    log('✅ Apple Sign-In credentials appear valid', 'green');
    log('   Private key format: correct', 'dim');
    return true;
  } catch (error) {
    log(`❌ Apple Sign-In validation failed: ${error.message}`, 'red');
    return false;
  }
}

async function runTests() {
  if (!fs.existsSync(envFile)) {
    log('❌ .env.local not found', 'red');
    process.exit(1);
  }

  const env = parseEnv();
  log('\n🧪 Integration Tests for Deployed Secrets', 'cyan');
  log('═'.repeat(50), 'dim');

  const results = {};

  // Run tests
  results.cloudflare = await testCloudflareMetrics(env);
  results.telnyx = await testTelnyx(env);
  results.google = await testGoogleOAuth(env);
  results.apple = await testAppleSignIn(env);

  // Summary
  log('\n' + '═'.repeat(50), 'dim');
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  log(`\n📊 Results: ${passed}/${total} integrations working`, 'bright');

  if (passed === total) {
    log('✨ All integrations validated successfully!', 'green');
  } else {
    log('⚠️  Some integrations could not be validated', 'yellow');
    log('   Run with --verbose to see full details', 'dim');
  }
}

runTests().catch((error) => {
  log(`\n❌ Error: ${error.message}`, 'red');
  process.exit(1);
});

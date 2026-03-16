#!/usr/bin/env node
/**
 * Set up early adopter promo codes
 * 
 * Usage:
 *   node setup-early-adopter-codes.js [ADMIN_TOKEN] [API_URL]
 * 
 * Example:
 *   node setup-early-adopter-codes.js "my-secret-token" "https://api.example.com"
 * 
 * Default API_URL: http://localhost:5173 (local dev)
 */

const http = require('http');
const https = require('https');

const adminToken = process.argv[2];
const apiUrl = process.argv[3] || 'http://localhost:5173';

if (!adminToken) {
  console.error('❌ Error: ADMIN_TOKEN is required as first argument');
  console.error('\nUsage: node setup-early-adopter-codes.js ADMIN_TOKEN [API_URL]');
  process.exit(1);
}

const EARLY_ADOPTER_CODES = [
  {
    code: 'EARLYBIRD30',
    discount_type: 'percentage',
    discount_value: 30,
    max_redemptions: 50,
    description: '30% off for early adopters (limit 50 uses)'
  },
  {
    code: 'LAUNCH25',
    discount_type: 'percentage',
    discount_value: 25,
    max_redemptions: 100,
    description: '25% off launch period (limit 100 uses)'
  },
  {
    code: 'WAITLIST20',
    discount_type: 'percentage',
    discount_value: 20,
    max_redemptions: 75,
    description: '20% off for beta testers & waitlist (limit 75 uses)',
    applicable_tiers: ['free', 'regular']
  },
  {
    code: 'AGENCY15',
    discount_type: 'percentage',
    discount_value: 15,
    max_redemptions: null,
    description: '15% off for agencies (unlimited)',
    applicable_tiers: ['agency']
  },
  {
    code: 'STARTUP30',
    discount_type: 'percentage',
    discount_value: 30,
    max_redemptions: 25,
    description: '30% off for startups (limit 25 uses)',
    applicable_tiers: ['regular', 'individual']
  }
];

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, apiUrl);
    const protocol = url.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken,
      }
    };
    
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function createCode(codeObj) {
  const { code, discount_type, discount_value, max_redemptions, applicable_tiers, description } = codeObj;
  
  const payload = {
    code,
    discount_type,
    discount_value,
    max_redemptions,
    applicable_tiers
  };
  
  try {
    const result = await makeRequest('POST', '/api/admin/promo', payload);
    
    if (result.status === 201) {
      console.log(`✅ ${code}`);
      console.log(`   ${description}`);
      if (applicable_tiers) {
        console.log(`   Tiers: ${applicable_tiers.join(', ')}`);
      }
      return true;
    } else if (result.status === 409) {
      console.log(`⚠️  ${code} (already exists — skipping)`);
      return false;
    } else {
      console.log(`❌ ${code}`);
      console.log(`   Error (${result.status}):`, result.data?.error || result.data);
      return false;
    }
  } catch (err) {
    console.log(`❌ ${code}`);
    console.log(`   Network error:`, err.message);
    return false;
  }
}

async function main() {
  console.log('\n🔧 Setting up early adopter promo codes...\n');
  console.log(`API URL: ${apiUrl}\n`);
  
  let created = 0;
  let skipped = 0;
  
  for (const codeObj of EARLY_ADOPTER_CODES) {
    const success = await createCode(codeObj);
    if (success) created++;
    else skipped++;
    console.log();
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`\n✅ Early adopter codes are ready!`);
  console.log(`\nUsers can now apply these codes at checkout:\n`);
  
  EARLY_ADOPTER_CODES.forEach(c => {
    const discount = c.discount_type === 'percentage' ? `${c.discount_value}% off` : `$${(c.discount_value / 100).toFixed(2)} off`;
    console.log(`  • ${c.code} — ${discount}`);
  });
  
  console.log();
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Verify Stripe Integration Setup
 * 
 * Checks that all Stripe integration components are configured correctly
 */

import { neonConfig, Pool } from '@neondatabase/serverless';

const CONNECTION_STRING = process.env.NEON_CONNECTION_STRING;

if (!CONNECTION_STRING) {
  console.error('❌ NEON_CONNECTION_STRING is not set. Set it via `export NEON_CONNECTION_STRING="..."` or `npx wrangler secret put NEON_CONNECTION_STRING` for Workers.');
  process.exit(1);
}

async function verify() {
  console.log('🔍 Verifying Stripe Integration Setup\n');
  
  const pool = new Pool({ connectionString: CONNECTION_STRING });
  
  let allGood = true;

  try {
    // 1. Check database tables
    console.log('📊 Checking database tables...');
    const tables = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname='public' 
        AND tablename IN ('subscriptions', 'payment_events', 'usage_records')
      ORDER BY tablename;
    `);
    
    const expectedTables = ['payment_events', 'subscriptions', 'usage_records'];
    const foundTables = tables.rows.map(r => r.tablename);
    
    expectedTables.forEach(table => {
      if (foundTables.includes(table)) {
        console.log(`   ✅ ${table}`);
      } else {
        console.log(`   ❌ ${table} - MISSING`);
        allGood = false;
      }
    });

    if (foundTables.length === 3) {
      // Check subscriptions table structure
      const subsColumns = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'subscriptions' 
        ORDER BY ordinal_position;
      `);
      console.log(`\n   subscriptions: ${subsColumns.rows.length} columns`);
      
      // Check indexes
      const indexes = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename IN ('subscriptions', 'payment_events', 'usage_records') 
        AND schemaname = 'public';
      `);
      console.log(`   Indexes: ${indexes.rows.length} created`);
    }

  } catch (error) {
    console.error('   ❌ Database check failed:', error.message);
    allGood = false;
  } finally {
    await pool.end();
  }

  // 2. Check worker deployment
  console.log('\n🚀 Checking worker deployment...');
  try {
    const response = await fetch('https://prime-self-api.adrper79.workers.dev/api/health?full=1');
    if (response.ok) {
      const data = await response.json();
      if (data.status !== 'ok') {
        console.log(`   ❌ Worker health returned unexpected status: ${data.status}`);
        allGood = false;
      } else {
        console.log(`   ✅ Worker is live (v${data.version})`);
      }
      if (data.db && data.db.ok === false) {
        console.log(`   ❌ Worker DB health failed: ${data.db.error || 'unknown error'}`);
        allGood = false;
      }
    } else {
      console.log(`   ❌ Worker returned status ${response.status}`);
      allGood = false;
    }
  } catch (error) {
    console.log(`   ❌ Worker not reachable: ${error.message}`);
    allGood = false;
  }

  // 3. Check Stripe checkout endpoint
  console.log('\n💳 Checking Stripe endpoints...');
  console.log('   ℹ️  Checkout endpoint: POST /api/checkout/create');
  console.log('   ℹ️  Portal endpoint: POST /api/checkout/portal');
  console.log('   ℹ️  Webhook endpoint: POST /api/webhook/stripe');

  // 4. Manual checks needed
  console.log('\n⏳ Manual Configuration Required:');
  console.log('   1. Webhook endpoint created in Stripe Dashboard');
  console.log('   2. STRIPE_WEBHOOK_SECRET set in Cloudflare Workers');
  console.log('   3. Products created (Explorer $12, Guide $60, Studio $149)');
  console.log('   4. Price IDs updated in wrangler.toml');
  console.log('   5. Worker redeployed with price IDs');

  // Summary
  console.log('\n' + '='.repeat(60));
  if (allGood) {
    console.log('✅ Automated setup complete!');
    console.log('\n📋 Next Steps:');
    console.log('   Follow QUICK_START_STRIPE.md Steps 2-5:');
    console.log('   - Create webhook endpoint');
    console.log('   - Create 3 products in Stripe');
    console.log('   - Update wrangler.toml with price IDs');
    console.log('   - Redeploy and test');
  } else {
    console.log('⚠️  Some checks failed - review errors above');
  }
  console.log('='.repeat(60) + '\n');
}

verify().catch(error => {
  console.error('Verification failed:', error);
  process.exit(1);
});

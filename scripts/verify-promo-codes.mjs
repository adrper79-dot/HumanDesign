#!/usr/bin/env node
/**
 * Verify Early Adopter Promo Codes
 * 
 * Shows current status of all early adopter codes and their redemption counts
 * 
 * Usage: node scripts/verify-promo-codes.mjs
 */

import { createQueryFn, QUERIES } from '../workers/src/lib/db.mjs';

async function verifyPromoCodes() {
  console.log('\n📊 Verifying Early Adopter Promo Codes...\n');
  
  const queryFn = createQueryFn();
  
  try {
    // Query all promo codes
    const result = await queryFn(`
      SELECT 
        code,
        discount_type,
        discount_value,
        redemptions,
        max_redemptions,
        valid_until,
        applicable_tiers,
        created_at
      FROM promo_codes
      WHERE code IN ('EARLYBIRD30', 'LAUNCH25', 'WAITLIST20', 'AGENCY15', 'STARTUP30')
      ORDER BY created_at DESC
    `, []);
    
    if (result.rows.length === 0) {
      console.log('❌ No early adopter codes found in database.');
      console.log('   Run: node scripts/setup-early-adopter-codes.mjs <ADMIN_TOKEN> <API_URL>\n');
      return;
    }
    
    console.log('✅ Found ' + result.rows.length + ' early adopter codes:\n');
    
    result.rows.forEach((row) => {
      const used = row.redemptions || 0;
      const limit = row.max_redemptions || '∞';
      const remaining = row.max_redemptions ? (row.max_redemptions - used) : '∞';
      const percentage = row.max_redemptions 
        ? Math.round((used / row.max_redemptions) * 100) 
        : 0;
      
      const discount = row.discount_type === 'percentage' 
        ? `${row.discount_value}%`
        : `$${(row.discount_value / 100).toFixed(2)}`;
      
      const validUntil = row.valid_until 
        ? new Date(row.valid_until).toLocaleDateString()
        : 'No expiry';
      
      const tiers = row.applicable_tiers && row.applicable_tiers.length > 0
        ? row.applicable_tiers.join(', ')
        : 'All tiers';
      
      console.log(`📌 ${row.code}`);
      console.log(`   Discount: ${discount}`);
      console.log(`   Usage: ${used}/${limit} (${percentage}%) | ${remaining} remaining`);
      console.log(`   Tiers: ${tiers}`);
      console.log(`   Valid: ${validUntil}`);
      console.log(`   Created: ${new Date(row.created_at).toLocaleString()}\n`);
    });
    
    // Show overall stats
    console.log('📈 Overall Stats:');
    const totalUsed = result.rows.reduce((sum, row) => sum + (row.redemptions || 0), 0);
    const totalLimit = result.rows.reduce((sum, row) => sum + (row.max_redemptions || 0), 0);
    console.log(`   Total redemptions: ${totalUsed}/${totalLimit || '∞'}\n`);
    
  } catch (error) {
    console.error('❌ Error querying promo codes:', error.message);
    console.error('\nMake sure:');
    console.error('  1. DATABASE_URL is set in .env or environment');
    console.error('  2. promo_codes table exists in database');
    console.error('  3. Early adopter codes have been created via setup-early-adopter-codes.mjs\n');
  }
}

verifyPromoCodes().catch(console.error);

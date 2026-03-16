#!/usr/bin/env node
/**
 * Bug Reporting System Setup Script
 * 
 * Run this to:
 * 1. Create all database tables from migration
 * 2. Create indexes for performance
 * 3. Initialize bug patterns for regression detection
 * 4. Verify tables exist
 * 
 * Usage:
 *   node scripts/setup-bug-reporting.mjs
 */

import { Client } from 'pg';
import fs from 'fs';

async function setupBugReporting() {
  console.log('\n📋 Setting up Bug Reporting System...\n');
  
  // Read secrets
  let secrets = {};
  try {
    const secretsFile = fs.readFileSync('./secrets', 'utf-8');
    secretsFile.split('\n').forEach(line => {
      const [key, ...rest] = line.split('=');
      if (key && rest.length) {
        secrets[key.trim()] = rest.join('=').trim();
      }
    });
  } catch (err) {
    console.error('❌ Could not read secrets file:', err.message);
    process.exit(1);
  }

  const dbUrl = secrets.NEON_CONNECT_STRING;
  if (!dbUrl) {
    console.error('❌ NEON_CONNECT_STRING not found in secrets');
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl });
  
  const queryFn = async (sql, params) => {
    return client.query(sql, params);
  };
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // 1. Create all tables
    console.log('1️⃣  Creating database tables...');
    
    // Read migration file
    const migrationPath = './workers/src/db/migrations/050_bug_reporting.sql';
    
    if (fs.existsSync(migrationPath)) {
      const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
      
      // Execute migration in chunks
      const statements = migrationSql.split(';').filter(s => s.trim().length > 0);
      
      for (const stmt of statements) {
        try {
          await queryFn(stmt);
        } catch (err) {
          // Ignore "already exists" errors
          if (!err.message.includes('already exists')) {
            throw err;
          }
        }
      }
      
      console.log('   ✅ Tables created successfully\n');
    } else {
      console.log('   ⚠️  Migration file not found at', migrationPath);
      console.log('   Create workers/src/db/migrations/050_bug_reporting.sql first\n');
      return;
    }
    
    // 2. Create indexes
    console.log('2️⃣  Creating indexes for performance...');
    
    const indexes = [
      'idx_bug_reports_user',
      'idx_bug_reports_status',
      'idx_bug_reports_severity',
      'idx_bug_reports_category',
      'idx_bug_reports_assigned',
      'idx_bug_reports_chart',
      'idx_bug_comments_bug',
      'idx_bug_comments_author',
      'idx_bug_validations_bug',
      'idx_bug_validations_result',
      'idx_bug_patterns_category',
      'idx_bug_audit_bug',
      'idx_bug_audit_user',
      'idx_bug_metrics_date'
    ];
    
    for (const idx of indexes) {
      try {
        const result = await queryFn(
          `SELECT indexname FROM pg_indexes WHERE indexname = $1`,
          [idx]
        );
        if (result.rows.length === 0) {
          console.log(`   Creating index: ${idx}`);
        }
      } catch (err) {
        // Index might not exist yet, that's ok
      }
    }
    
    console.log('   ✅ Indexes verified\n');
    
    // 3. Initialize bug patterns for regression detection
    console.log('3️⃣  Initializing regression patterns...');
    
    const patterns = [
      {
        name: 'Stripe webhook timeout',
        description: 'Stripe returns 504 or webhook processing timeout',
        regex_error: 'stripe.*timeout|webhook.*timeout',
        affected_categories: ['payment'],
        solution: 'Check Stripe webhook configuration and API rate limits'
      },
      {
        name: 'Timezone calculation error',
        description: 'Chart date off by hours due to timezone mismatch',
        regex_error: 'timezone|UTC|offset',
        affected_categories: ['chart_calc', 'transit'],
        solution: 'Verify birth_tz is used consistently, not server timezone'
      },
      {
        name: 'Authentication token expiry',
        description: 'User session expires unexpectedly',
        regex_error: 'token.*expired|unauthorized|401',
        affected_categories: ['auth'],
        solution: 'Check token refresh logic and expiration settings'
      },
      {
        name: 'CORS headers missing',
        description: 'Frontend blocked by browser CORS policy',
        regex_error: 'CORS|cross.origin|Access-Control',
        affected_categories: ['api', 'ui'],
        solution: 'Add Access-Control-Allow-Origin headers to API responses'
      },
      {
        name: 'Chart calculation precision',
        description: 'Calculation result differs from expected by > 0.1%',
        regex_error: 'precision|rounding|calculation',
        affected_categories: ['chart_calc'],
        solution: 'Review floating-point arithmetic and rounding in calculation engine'
      }
    ];
    
    for (const pattern of patterns) {
      try {
        await queryFn(
          `INSERT INTO bug_patterns (name, description, regex_error, affected_category, solution)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            pattern.name,
            pattern.description,
            pattern.regex_error,
            pattern.affected_categories,
            pattern.solution
          ]
        );
        console.log(`   ✅ Pattern: ${pattern.name}`);
      } catch (err) {
        // Ignore if already exists
        if (!err.message.includes('duplicate') && !err.message.includes('already exists')) {
          console.error(`   ⚠️  Pattern ${pattern.name}: ${err.message}`);
        }
      }
    }
    
    console.log();
    
    // 4. Verify tables exist
    console.log('4️⃣  Verifying table structure...');
    
    const requiredTables = [
      'bug_reports',
      'bug_comments',
      'bug_validations',
      'bug_patterns',
      'bug_audit_log',
      'bug_metrics'
    ];
    
    for (const table of requiredTables) {
      try {
        const result = await queryFn(
          `SELECT COUNT(*) FROM information_schema.tables WHERE table_name = $1`,
          [table]
        );
        
        if (result.rows[0].count > 0) {
          console.log(`   ✅ Table: ${table}`);
        } else {
          console.log(`   ❌ Table not found: ${table}`);
        }
      } catch (err) {
        console.log(`   ❌ Error checking table ${table}: ${err.message}`);
      }
    }
    
    console.log('\n✨ Bug Reporting System setup complete!\n');
    console.log('Next steps:');
    console.log('  1. Add "Report a Bug" button to navigation');
    console.log('  2. Create API routes: POST /api/bugs, GET /api/bugs');
    console.log('  3. Create admin page: /admin/bugs');
    console.log('  4. Deploy and test with a sample bug report');
    console.log('\nDocumentation: BUG_REPORTING_SYSTEM.md\n');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error(error.stack);
    console.error('\nTroubleshooting:');
    console.error('  1. Verify NEON_CONNECT_STRING is set in secrets file');
    console.error('  2. Check database credentials');
    console.error('  3. Ensure migration file exists at workers/src/db/migrations/050_bug_reporting.sql');
    console.error('  4. Make sure secrets file exists in project root\n');
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupBugReporting().catch(console.error);

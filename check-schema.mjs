import { Client } from 'pg';
import fs from 'fs';

async function checkSchema() {
  let secrets = {};
  try {
    const secretsFile = fs.readFileSync('/mnt/c/Users/Ultimate Warrior/My project/HumanDesign/secrets', 'utf-8');
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
  try {
    await client.connect();

    // Get users table structure
    console.log('\n📋 Users table schema:\n');
    const userSchema = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable, col_description(t.oid, a.attnum)
      FROM pg_class t
      JOIN pg_attribute a ON t.oid = a.attrelid
      JOIN information_schema.columns i ON a.attname = i.column_name AND t.relname = i.table_name
      WHERE t.relname = 'users'
      ORDER BY a.attnum
    `);
    
    userSchema.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type}`);
    });

    // Check constraints
    console.log('\n📌 Check constraints:\n');
    const constraintRes = await client.query(`
      SELECT constraint_name, check_clause
      FROM information_schema.check_constraints
      WHERE table_name = 'users'
    `);
    
    constraintRes.rows.forEach(row => {
      console.log(`${row.constraint_name}: ${row.check_clause}`);
    });

    // Get valid enum values
    console.log('\n🔍 Tier enum values (if applicable):\n');
    const enumRes = await client.query(`
      SELECT e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'tier_enum'
    `);
    
    if (enumRes.rows.length > 0) {
      enumRes.rows.forEach(row => console.log(`  - ${row.enumlabel}`));
    } else {
      console.log('  (No enum type found - tier might be VARCHAR with check constraint)');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkSchema();

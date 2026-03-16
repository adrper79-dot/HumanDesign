import { Client } from 'pg';
import fs from 'fs';

async function checkTiers() {
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

    // Get all distinct tier values
    console.log('\n📊 Distinct tier values in users table:\n');
    const tierRes = await client.query(`SELECT DISTINCT tier FROM users ORDER BY tier`);
    
    tierRes.rows.forEach(row => {
      console.log(`  - ${row.tier}`);
    });

    // Get constraint definition from pg_constraint
    console.log('\n📌 Check constraints on users table:\n');
    const constraintRes = await client.query(`
      SELECT c.conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_class r ON r.oid = c.conrelid
      WHERE r.relname = 'users' AND c.contype = 'c'
    `);
    
    constraintRes.rows.forEach(row => {
      console.log(`${row.conname}:`);
      console.log(`  ${row.pg_get_constraintdef}`);
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkTiers();

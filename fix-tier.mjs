import { Client } from 'pg';
import fs from 'fs';

async function fixTier() {
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
    console.log('\n🔧 Fixing ga.boi11@yahoo.com tier...\n');

    const updateRes = await client.query(
      `UPDATE users SET tier = 'practitioner' WHERE email = 'ga.boi11@yahoo.com' RETURNING email, tier`
    );

    if (updateRes.rows.length > 0) {
      console.log(`✅ Updated: ${updateRes.rows[0].email}`);
      console.log(`   Tier: ${updateRes.rows[0].tier}`);
    }

    // Verify both
    console.log('\n📋 Final verification:\n');
    const verifyRes = await client.query(`
      SELECT email, tier FROM users WHERE email IN ('adrper79@gmail.com', 'ga.boi11@yahoo.com') ORDER BY email
    `);

    verifyRes.rows.forEach(row => {
      console.log(`${row.email}: ${row.tier}`);
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixTier();

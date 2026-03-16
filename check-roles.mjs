import { Client } from 'pg';
import fs from 'fs';

async function checkRoles() {
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
    console.log('\n📊 Checking user roles...\n');

    // Check both users
    const emails = ['adrper79@gmail.com', 'ga.boi11@yahoo.com'];
    
    for (const email of emails) {
      const userRes = await client.query(
        `SELECT id, email, tier, created_at, updated_at FROM users WHERE email = $1`,
        [email]
      );

      if (userRes.rows.length === 0) {
        console.log(`❌ ${email}: NOT FOUND`);
      } else {
        const user = userRes.rows[0];
        console.log(`✅ ${email}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Tier: ${user.tier}`);
        console.log(`   Created: ${user.created_at}`);
      }
    }

    // Check if they have practitioner entries
    console.log('\n🔍 Checking practitioner entries...\n');
    for (const email of emails) {
      const practRes = await client.query(
        `SELECT id, email, is_admin FROM practitioners WHERE email = $1`,
        [email]
      );
      
      if (practRes.rows.length === 0) {
        console.log(`❌ ${email}: No practitioner entry`);
      } else {
        const pract = practRes.rows[0];
        console.log(`✅ ${email}: Practitioner entry found (is_admin: ${pract.is_admin})`);
      }
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkRoles();

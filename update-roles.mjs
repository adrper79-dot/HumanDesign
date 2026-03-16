import { Client } from 'pg';
import fs from 'fs';

async function updateRoles() {
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
    console.log('\n🔧 Updating user roles...\n');

    const emails = ['adrper79@gmail.com', 'ga.boi11@yahoo.com'];
    
    for (const email of emails) {
      // Update TO tier to admin (or higher tier)
      const updateRes = await client.query(
        `UPDATE users SET tier = 'admin' WHERE email = $1 RETURNING id, email, tier`,
        [email]
      );
      
      if (updateRes.rows.length === 0) {
        console.log(`❌ ${email}: User not found`);
      } else {
        const user = updateRes.rows[0];
        console.log(`✅ ${email}`);
        console.log(`   Updated to tier: ${user.tier}`);
      }
    }

    // Check practitioners table schema
    console.log('\n📋 Checking practitioners table schema...\n');
    const schemaRes = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'practitioners' ORDER BY ordinal_position`
    );
    
    console.log('Practitioners table columns:');
    schemaRes.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type}`);
    });

    // Now check and update practitioners
    console.log('\n👤 Checking practitioner entries...\n');
    for (const email of emails) {
      const userRes = await client.query(
        `SELECT id FROM users WHERE email = $1`,
        [email]
      );

      if (userRes.rows.length === 0) continue;
      
      const userId = userRes.rows[0].id;
      
      // Check if practitioner entry exists
      const practRes = await client.query(
        `SELECT id, user_id, is_admin FROM practitioners WHERE user_id = $1`,
        [userId]
      );

      if (practRes.rows.length === 0) {
        // Create practitioner entry
        await client.query(
          `INSERT INTO practitioners (user_id, is_admin) VALUES ($1, true)`,
          [userId]
        );
        console.log(`✅ ${email}: Created practitioner entry as admin`);
      } else {
        // Update existing
        await client.query(
          `UPDATE practitioners SET is_admin = true WHERE user_id = $1`,
          [userId]
        );
        console.log(`✅ ${email}: Updated practitioner entry to admin`);
      }
    }

    console.log('\n✅ All updates complete!');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

updateRoles();

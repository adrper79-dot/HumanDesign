import { Client } from 'pg';
import fs from 'fs';

async function setAdminPractitioners() {
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
    console.log('\n🔧 Updating users to admin practitioners...\n');

    const emails = ['adrper79@gmail.com', 'ga.boi11@yahoo.com'];
    
    for (const email of emails) {
      // 1. Update tier to practitioner
      const tierRes = await client.query(
        `UPDATE users SET tier = 'practitioner' WHERE email = $1 RETURNING id, email, tier`,
        [email]
      );
      
      if (tierRes.rows.length === 0) {
        console.log(`❌ ${email}: User not found`);
        continue;
      }

      const user = tierRes.rows[0];
      console.log(`✅ ${email}`);
      console.log(`   Tier updated to: ${user.tier}`);
      
      const userId = user.id;

      // 2. Check if practitioner entry exists
      const practRes = await client.query(
        `SELECT id, user_id, is_admin FROM practitioners WHERE user_id = $1`,
        [userId]
      );

      if (practRes.rows.length === 0) {
        // Create practitioner entry with is_admin=true
        await client.query(
          `INSERT INTO practitioners (user_id, is_admin) VALUES ($1, true)`,
          [userId]
        );
        console.log(`   Practitioner entry created with is_admin=true`);
      } else {
        // Update existing to is_admin=true
        await client.query(
          `UPDATE practitioners SET is_admin = true WHERE user_id = $1`,
          [userId]
        );
        console.log(`   Practitioner entry updated with is_admin=true`);
      }
    }

    console.log('\n✅ All updates complete! Both users are now admin practitioners.');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setAdminPractitioners();

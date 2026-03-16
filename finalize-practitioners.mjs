import { Client } from 'pg';
import fs from 'fs';

async function finalizePractitioners() {
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
    console.log('\n🔧 Setting up admin practitioners...\n');

    const emails = ['adrper79@gmail.com', 'ga.boi11@yahoo.com'];
    
    for (const email of emails) {
      // Get user
      const userRes = await client.query(
        `SELECT id, tier FROM users WHERE email = $1`,
        [email]
      );
      
      if (userRes.rows.length === 0) {
        console.log(`❌ ${email}: User not found`);
        continue;
      }

      const userId = userRes.rows[0].id;
      const currentTier = userRes.rows[0].tier;
      console.log(`✅ ${email}`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Tier: ${currentTier}`);

      // Check if practitioner entry exists
      const practRes = await client.query(
        `SELECT id FROM practitioners WHERE user_id = $1`,
        [userId]
      );

      if (practRes.rows.length === 0) {
        // Create practitioner entry
        const insertRes = await client.query(
          `INSERT INTO practitioners (id, user_id, is_public, tier, certified)
           VALUES (gen_random_uuid(), $1, true, 'premium', true)
           RETURNING id`,
          [userId]
        );
        console.log(`   ✅ Practitioner entry created`);
        console.log(`   Practitioner ID: ${insertRes.rows[0].id}`);
      } else {
        console.log(`   ✅ Practitioner entry already exists`);
      }
    }

    // Verify final state
    console.log('\n📋 Final Status:\n');
    for (const email of emails) {
      const verifyRes = await client.query(`
        SELECT 
          u.id, u.email, u.tier,
          p.id as pract_id, p.tier as pract_tier, p.certified
        FROM users u
        LEFT JOIN practitioners p ON u.id = p.user_id
        WHERE u.email = $1
      `, [email]);

      if (verifyRes.rows.length > 0) {
        const row = verifyRes.rows[0];
        console.log(`${email}:`);
        console.log(`  User tier: ${row.tier}`);
        console.log(`  Practitioner: ${row.pract_id ? 'YES' : 'NO'}`);
        if (row.pract_tier) console.log(`  Practitioner tier: ${row.pract_tier}`);
        if (row.certified) console.log(`  Certified: ${row.certified}`);
      }
    }

    console.log('\n✅ Setup complete! Both users are now admin practitioners.');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

finalizePractitioners();

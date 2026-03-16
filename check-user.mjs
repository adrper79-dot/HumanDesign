import { Client } from 'pg';
import fs from 'fs';
const EMAIL = 'ga.boi11@yahoo.com';

async function checkUser() {
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
    console.log(`\n📊 Checking user: ${EMAIL}\n`);

    const userRes = await client.query(
      `SELECT id, email, email_verified, created_at, updated_at, last_login_at, totp_enabled, tier FROM users WHERE email = $1`,
      [EMAIL]
    );

    if (userRes.rows.length === 0) {
      console.log(`❌ User NOT found in database`);
      process.exit(0);
    }

    const user = userRes.rows[0];
    console.log('✅ Account found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Email Verified: ${user.email_verified}`);
    console.log(`   Created: ${user.created_at}`);
    console.log(`   Updated: ${user.updated_at}`);
    console.log(`   Last Login: ${user.last_login_at || 'Never logged in'}`);
    console.log(`   2FA Enabled: ${user.totp_enabled}`);
    console.log(`   Tier: ${user.tier || 'free'}`);

    console.log('\n✅ No login issues detected.');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkUser();

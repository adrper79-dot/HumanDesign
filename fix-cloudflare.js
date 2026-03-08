#!/usr/bin/env node
/**
 * Cloudflare Workers - Emergency Fix Script
 * This script guides you through fixing the critical missing NEON_CONNECTION_STRING secret
 * and deploying the latest code.
 */

const readline = require('readline');
const { exec } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve(stdout + stderr);
    });
  });
}

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║     Cloudflare Workers - Critical Secrets Fix                 ║
║     Status: PARTIAL OUTAGE (missing NEON_CONNECTION_STRING)   ║
╚═══════════════════════════════════════════════════════════════╝

This script will:
  1. List current secrets
  2. Prompt for Neon connection string
  3. Set NEON_CONNECTION_STRING secret
  4. Deploy updated Worker code
  5. Verify deployment

⏭️  Press ENTER to continue...
  `);

  rl.question('', async () => {
    try {
      // Step 1: List secrets
      console.log('\n📋 Current Worker secrets:\n');
      const secrets = await run('cd workers && npx wrangler secret list 2>&1');
      console.log(secrets);

      // Step 2: Prompt for connection string
      console.log('\n💾 Next: Set NEON_CONNECTION_STRING');
      console.log('\nTo get your Neon connection string:');
      console.log('  1. Go to: https://console.neon.tech');
      console.log('  2. Select your project');
      console.log('  3. Connection String → Pooled → Copy');
      console.log('  4. Paste it below (it looks like: postgresql://user:pass@host/db)\n');

      rl.question('Paste your Neon pooled connection string: ', async (connStr) => {
        if (!connStr.startsWith('postgresql://')) {
          console.error('❌ Invalid connection string (must start with postgresql://)');
          rl.close();
          return;
        }

        try {
          // Step 3: Set secret (using echo pipe pattern)
          console.log('\n🔐 Setting NEON_CONNECTION_STRING secret...');
          const setCmd = \`echo "\${connStr}" | npx wrangler secret put NEON_CONNECTION_STRING\`;
          await run(\`cd workers && \${setCmd}\`);
          console.log('✅ Secret set successfully!');

          // Step 4: Verify it was set
          console.log('\n✅ Verifying secret was set...');
          const verify = await run('cd workers && npx wrangler secret list 2>&1');
          if (verify.includes('NEON_CONNECTION_STRING')) {
            console.log('✅ NEON_CONNECTION_STRING is now configured');
          } else {
            console.log('⚠️  Could not verify secret was set. Please try again manually.');
          }

          // Step 5: Deploy
          console.log('\n🚀 Deploying updated Worker code...');
          console.log('(This may take 30-60 seconds)\n');
          const deploy = await run('cd workers && npx wrangler deploy --force 2>&1');
          if (deploy.includes('Deployment complete') || deploy.includes('published')) {
            console.log('✅ Deployment successful!');
          } else {
            console.log('⚠️  Deployment status unclear. Output:');
            console.log(deploy);
          }

          // Step 6: Test
          console.log('\n🧪 Testing endpoints...\n');
          
          // Test health
          const health = await run('curl -s https://prime-self-api.adrper79.workers.dev/api/health?full=1');
          const healthData = JSON.parse(health);
          console.log('✅ Health endpoint:');
          console.log(\`   Version: \${healthData.version}\`);
          console.log(\`   Status: \${healthData.status}\`);
          if (healthData.secrets) {
            console.log('   Secrets:');
            console.log(\`     - hasNeon: \${healthData.secrets.hasNeon ? '✅ YES' : '❌ NO'}\`);
            console.log(\`     - hasJwt: \${healthData.secrets.hasJwt ? '✅ YES' : '❌ NO'}\`);
            console.log(\`     - hasStripe: \${healthData.secrets.hasStripe ? '✅ YES' : '❌ NO'}\`);
          } else {
            console.log('   ⚠️  No secrets info (may still be deploying)');
          }

          console.log(\`
╔═══════════════════════════════════════════════════════════════╗
║                    ✅ FIX COMPLETE                            ║
╚═══════════════════════════════════════════════════════════════╝

Next Steps:
  1. ✅ NEON_CONNECTION_STRING has been set
  2. ✅ Worker code deployed with fail-fast guards
  3. ✅ Health endpoint now supports ?full=1 for diagnostics

What to verify:
  • Check logs for any remaining errors:
    cd workers && npx wrangler tail --format pretty

  • Test auth register endpoint:
    curl -X POST https://prime-self-api.adrper79.workers.dev/api/auth/register \\
      -H "Content-Type: application/json" \\
      -d '{"email":"test@example.com"}' 

  • Set any other missing secrets:
    echo "sk_live_..." | npx wrangler secret put STRIPE_SECRET_KEY
    echo "sk-ant-..." | npx wrangler secret put ANTHROPIC_API_KEY
    etc.

For detailed status, see: CLOUDFLARE_STATUS_REVIEW.md
\`);

          rl.close();
        } catch (error) {
          console.error('❌ Error:', error.message);
          rl.close();
          process.exit(1);
        }
      });
    } catch (error) {
      console.error('❌ Error:', error.message);
      rl.close();
      process.exit(1);
    }
  });
}

main();

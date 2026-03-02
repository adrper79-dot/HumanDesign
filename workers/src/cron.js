/**
 * Scheduled Cron — Daily Transit Snapshot + Digest Delivery
 *
 * Runs via Cloudflare Workers Cron Triggers.
 * Configured in wrangler.toml: crons = ["0 6 * * *"] (6 AM UTC daily)
 *
 * Steps:
 *   1. Calculate today's transit positions (Layer 2 + 4)
 *   2. Store snapshot in transit_snapshots table
 *   3. For each opted-in user with a phone, generate + send SMS digest
 */

import { toJulianDay } from '../../src/engine/julian.js';
import { getAllPositions } from '../../src/engine/planets.js';
import { mapAllToGates } from '../../src/engine/gates.js';
import { createQueryFn, QUERIES } from './db/queries.js';
import { generateDigestForUser, sendSMS } from './handlers/sms.js';

/**
 * Main cron entry point.
 */
export async function runDailyTransitCron(env) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  const hour = now.getUTCHours();

  console.log(`[CRON] Starting daily transit snapshot for ${year}-${month}-${day}`);

  try {
    // ─── Step 1: Calculate today's transit positions ─────
    const jdn = toJulianDay(year, month, day, hour, 0, 0);
    const positions = getAllPositions(jdn);
    const gates = mapAllToGates(positions);

    const snapshotDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const positionsJson = JSON.stringify({
      positions,
      gates,
      calculatedAt: now.toISOString()
    });

    // ─── Step 2: Store in database ──────────────────────
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    await query(QUERIES.saveTransitSnapshot, [snapshotDate, positionsJson]);
    console.log(`[CRON] Transit snapshot saved for ${snapshotDate}`);

    // ─── Step 3: Send digests to opted-in users ─────────
    const usersResult = await query(
      `SELECT * FROM users WHERE sms_opted_in = true AND phone IS NOT NULL AND birth_date IS NOT NULL`
    );

    const users = usersResult.rows || [];
    console.log(`[CRON] ${users.length} users opted in for SMS digests`);

    let sent = 0, failed = 0;

    for (const user of users) {
      try {
        const digest = await generateDigestForUser(user, env);
        await sendSMS(user.phone, digest, env);
        sent++;

        // Small delay between sends to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.error(`[CRON] Digest send failed for user ${user.id}:`, err.message);
        failed++;
      }
    }

    console.log(`[CRON] Digest delivery complete: ${sent} sent, ${failed} failed`);

    return { snapshotDate, userCount: users.length, sent, failed };

  } catch (err) {
    console.error('[CRON] Fatal error:', err);
    throw err;
  }
}

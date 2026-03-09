/**
 * Scheduled Cron — Daily Transit Snapshot + Digest Delivery + Webhook Retries + Push Notifications + Alert Evaluation + Email Drip Campaigns + Token Cleanup
 *
 * Runs via Cloudflare Workers Cron Triggers.
 * Configured in wrangler.toml: crons = ["0 6 * * *"] (6 AM UTC daily)
 *
 * Steps:
 *   1. Calculate today's transit positions (Layer 2 + 4)
 *   2. Store snapshot in transit_snapshots table
 *   3. For each opted-in user with a phone, generate + send SMS digest
 *   4. Process failed webhook deliveries (retry queue)
 *   5. Send push notifications for daily transit digest
 *   6. Evaluate all active user transit alerts
 *   7. Send email drip campaigns (welcome series, re-engagement, upgrade nudges)
 */

import { toJulianDay } from '../../src/engine/julian.js';
import { getAllPositions } from '../../src/engine/planets.js';
import { mapAllToGates } from '../../src/engine/gates.js';
import { createQueryFn, QUERIES } from './db/queries.js';
import { generateDigestForUser, sendSMS } from './handlers/sms.js';
import { processWebhookRetries } from './lib/webhookDispatcher.js';
import { sendNotificationToUser } from './handlers/push.js';
import { evaluateUserAlerts } from './handlers/alerts.js';
import {
  sendWelcomeEmail2,
  sendWelcomeEmail3,
  sendWelcomeEmail4,
  sendReengagementEmail,
  sendUpgradeNudgeEmail
} from './lib/email.js';

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
    // BL-FIX: Use named query instead of SELECT * to avoid exposing password_hash in memory
    const usersResult = await query(
      QUERIES.getSmsSubscribedUsers + ` AND birth_date IS NOT NULL`
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

    // ─── Step 4: Process webhook retries ────────────────
    try {
      await processWebhookRetries(env);
      console.log('[CRON] Webhook retry processing complete');
    } catch (webhookErr) {
      console.error('[CRON] Webhook retry processing error:', webhookErr);
      // Don't throw - webhook failures shouldn't break the main cron
    }

    // ─── Step 4b: Refresh check-in streaks materialized view (BL-S15-H2) ───
    try {
      await query('SELECT refresh_checkin_streaks()');
      console.log('[CRON] Check-in streaks materialized view refreshed');
    } catch (streakErr) {
      console.error('[CRON] Streak refresh error:', streakErr);
      // Non-critical — streaks will be stale but functional
    }

    // ─── Step 5: Send push notifications ────────────────
    try {
      // Get users with active push subscriptions and transit_daily preference enabled
      const { rows: pushUsers } = await query(QUERIES.cronGetPushUsers);
      console.log(`[CRON] ${pushUsers.length} users to receive push notifications`);

      let pushSent = 0, pushFailed = 0;

      for (const user of pushUsers) {
        try {
          // Get today's key gates for notification
          const keyGates = gates.sun ? `Sun in Gate ${gates.sun.gate}` : 'Transit energy active';

          const notification = {
            title: '🌟 Your Daily Transit Energy',
            body: `${keyGates}. Open Prime Self to explore today's cosmic weather.`,
            icon: 'https://primeself.app/icon-192.png',
            badge: 'https://primeself.app/badge-72.png',
            tag: `transit-daily-${snapshotDate}`,
            data: {
              type: 'transit_daily',
              date: snapshotDate,
              url: '/app/transits'
            }
          };

          const success = await sendNotificationToUser(env, user.id, 'transit_daily', notification);
          if (success > 0) {
            pushSent++;
          } else {
            pushFailed++;
          }

          // Small delay between sends
          await new Promise(r => setTimeout(r, 100));
        } catch (pushErr) {
          console.error(`[CRON] Push notification failed for user ${user.id}:`, pushErr.message);
          pushFailed++;
        }
      }

      console.log(`[CRON] Push notifications sent: ${pushSent} success, ${pushFailed} failed`);
    } catch (pushErr) {
      console.error('[CRON] Push notification processing error:', pushErr);
      // Don't throw - push failures shouldn't break the main cron
    }

    // ─── Step 6: Evaluate transit alerts ────────────────
    try {
      // Get users with active transit alerts
      const { rows: alertUsers } = await query(QUERIES.cronGetAlertUsers);
      console.log(`[CRON] Evaluating alerts for ${alertUsers.length} users`);

      let alertsTriggered = 0;

      for (const user of alertUsers) {
        try {
          await evaluateUserAlerts(env, user, gates, positions, snapshotDate);
          alertsTriggered++;

          // Small delay to avoid overwhelming the system
          await new Promise(r => setTimeout(r, 50));
        } catch (alertErr) {
          console.error(`[CRON] Alert evaluation failed for user ${user.id}:`, alertErr.message);
        }
      }

      console.log(`[CRON] Alert evaluation complete: ${alertsTriggered} users processed`);
    } catch (alertErr) {
      console.error('[CRON] Alert evaluation processing error:', alertErr);
      // Don't throw - alert failures shouldn't break the main cron
    }

    // ─── Step 7: Email Drip Campaigns (BL-ENG-007) ─────
    try {
      console.log('[CRON] Starting email drip campaigns...');
      let emailsSent = 0, emailsFailed = 0;

      // Welcome Email #2 (24 hours after registration)
      const welcome2Users = await query(QUERIES.cronGetWelcome2Users);

      for (const user of (welcome2Users.rows || [])) {
        try {
          await sendWelcomeEmail2(
            user.email,
            user.email.split('@')[0],
            user.chart_type || 'Generator',
            env.RESEND_API_KEY,
            env.FROM_EMAIL
          );
          emailsSent++;
        } catch (err) {
          console.error(`Failed to send welcome email #2 to ${user.email}:`, err);
          emailsFailed++;
        }
      }

      // Welcome Email #3 (72 hours after registration)
      const welcome3Users = await query(QUERIES.cronGetWelcome3Users);

      for (const user of (welcome3Users.rows || [])) {
        try {
          await sendWelcomeEmail3(
            user.email,
            user.email.split('@')[0],
            user.authority || 'Sacral',
            env.RESEND_API_KEY,
            env.FROM_EMAIL
          );
          emailsSent++;
        } catch (err) {
          console.error(`Failed to send welcome email #3 to ${user.email}:`, err);
          emailsFailed++;
        }
      }

      // Welcome Email #4 (7 days after registration)
      const welcome4Users = await query(QUERIES.cronGetWelcome4Users);

      for (const user of (welcome4Users.rows || [])) {
        try {
          await sendWelcomeEmail4(
            user.email,
            user.email.split('@')[0],
            env.RESEND_API_KEY,
            env.FROM_EMAIL
          );
          emailsSent++;
        } catch (err) {
          console.error(`Failed to send welcome email #4 to ${user.email}:`, err);
          emailsFailed++;
        }
      }

      // Re-engagement Email (7 days inactive)
      const reengagementUsers = await query(QUERIES.cronGetReengagementUsers);

      for (const user of (reengagementUsers.rows || [])) {
        try {
          await sendReengagementEmail(
            user.email,
            user.email.split('@')[0],
            Math.floor(user.days_inactive || 7),
            env.RESEND_API_KEY,
            env.FROM_EMAIL
          );
          emailsSent++;
        } catch (err) {
          console.error(`Failed to send re-engagement email to ${user.email}:`, err);
          emailsFailed++;
        }
      }

      // Upgrade Nudge Email (30 days on free tier)
      const upgradeNudgeUsers = await query(QUERIES.cronGetUpgradeNudgeUsers);

      for (const user of (upgradeNudgeUsers.rows || [])) {
        try {
          await sendUpgradeNudgeEmail(
            user.email,
            user.email.split('@')[0],
            env.RESEND_API_KEY,
            env.FROM_EMAIL
          );
          emailsSent++;
        } catch (err) {
          console.error(`Failed to send upgrade nudge to ${user.email}:`, err);
          emailsFailed++;
        }
      }

      console.log(`[CRON] Email drip campaigns complete: ${emailsSent} sent, ${emailsFailed} failed`);
    } catch (emailErr) {
      console.error('[CRON] Email drip campaign processing error:', emailErr);
      // Don't throw - email failures shouldn't break the main cron
    }

    // ─── Step 8: Purge expired / old revoked refresh tokens ─
    try {
      await query(QUERIES.deleteExpiredRefreshTokens, []);
      console.log('[CRON] Expired refresh tokens purged');
    } catch (purgeErr) {
      console.error('[CRON] Refresh token purge error:', purgeErr);
    }

    return { snapshotDate, userCount: users.length, sent, failed };

  } catch (err) {
    console.error('[CRON] Fatal error:', err);
    throw err;
  }
}

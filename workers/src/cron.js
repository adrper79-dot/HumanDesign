/**
 * Scheduled Cron — Daily Transit Snapshot + Digest Delivery + Webhook Retries + Push Notifications + Alert Evaluation + Email Drip Campaigns + Token Cleanup + Subscription Downgrade
 *
 * Runs via Cloudflare Workers Cron Triggers.
 * Configured in wrangler.toml: crons = ["0 6 * * *"] (6 AM UTC daily)
 *
 * Steps:
 *   1. Calculate today's transit positions (Layer 2 + 4)
 *   2. Store snapshot in transit_snapshots table
 *   3. For each opted-in user with a phone, generate + send SMS digest
 *   4. Process failed webhook deliveries (retry queue)
 *   4b. Refresh check-in streaks materialized view
 *   5. Send push notifications for daily transit digest
 *   6. Evaluate all active user transit alerts
 *   7. Send email drip campaigns (welcome series, re-engagement, upgrade nudges)
 *   8. Purge expired/revoked refresh tokens
 *   9. Downgrade expired cancel-at-period-end subscriptions
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
import { createCronLogger } from './lib/logger.js';

/**
 * CIO-005: Race a promise against a hard timeout so a hung DB call in one
 * cron step cannot starve all subsequent steps.
 * @param {Promise} promise
 * @param {number} ms
 * @param {string} label — included in the timeout error message for tracing
 */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Cron step timed out after ${ms}ms: ${label}`)), ms)
    ),
  ]);
}

/**
 * Main cron entry point.
 */
export async function runDailyTransitCron(env) {
  const log = createCronLogger('cron');
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  const hour = now.getUTCHours();

  log.info('transit_snapshot_start', { date: `${year}-${month}-${day}` });

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

    await withTimeout(
      query(QUERIES.saveTransitSnapshot, [snapshotDate, positionsJson]),
      8000, 'saveTransitSnapshot'
    );
    log.info('transit_snapshot_saved', { snapshotDate });

    // ─── Step 3: Send digests to opted-in users ─────────
    // BL-FIX: Use named query instead of SELECT * to avoid exposing password_hash in memory
    const usersResult = await query(
      QUERIES.getSmsSubscribedUsers + ` AND birth_date IS NOT NULL`
    );

    const users = usersResult.rows || [];
    log.info('sms_digest_users', { count: users.length });

    let sent = 0, failed = 0;

    for (const user of users) {
      try {
        const digest = await generateDigestForUser(user, env);
        await sendSMS(user.phone, digest, env);
        sent++;

        // Small delay between sends to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        log.error('digest_send_failed', { userId: user.id, error: err.message });
        failed++;
      }
    }

    log.info('digest_delivery_complete', { sent, failed });

    // ─── Step 4: Process webhook retries ────────────────
    try {
      await withTimeout(processWebhookRetries(env), 20000, 'processWebhookRetries');
      log.info('webhook_retry_complete');
    } catch (webhookErr) {
      log.error('webhook_retry_error', { error: webhookErr?.message });
      // Don't throw - webhook failures shouldn't break the main cron
    }

    // ─── Step 4b: Refresh check-in streaks materialized view (BL-S15-H2) ───
    try {
      await withTimeout(query('SELECT refresh_checkin_streaks()'), 12000, 'refresh_checkin_streaks');
      log.info('streak_refresh_complete');
    } catch (streakErr) {
      log.error('streak_refresh_error', { error: streakErr?.message });
      // Non-critical — streaks will be stale but functional
    }

    // ─── Step 5: Send push notifications ────────────────
    try {
      // Get users with active push subscriptions and transit_daily preference enabled
      const { rows: pushUsers } = await query(QUERIES.cronGetPushUsers);
      log.info('push_notification_users', { count: pushUsers.length });

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
          log.error('push_notification_failed', { userId: user.id, error: pushErr.message });
          pushFailed++;
        }
      }

      log.info('push_notifications_sent', { sent: pushSent, failed: pushFailed });
    } catch (pushErr) {
      log.error('push_processing_error', { error: pushErr?.message });
      // Don't throw - push failures shouldn't break the main cron
    }

    // ─── Step 6: Evaluate transit alerts ────────────────
    try {
      // Get users with active transit alerts
      const { rows: alertUsers } = await query(QUERIES.cronGetAlertUsers);
      log.info('alert_evaluation_start', { count: alertUsers.length });

      let alertsTriggered = 0;

      for (const user of alertUsers) {
        try {
          await evaluateUserAlerts(env, user, gates, positions, snapshotDate);
          alertsTriggered++;

          // Small delay to avoid overwhelming the system
          await new Promise(r => setTimeout(r, 50));
        } catch (alertErr) {
          log.error('alert_evaluation_failed', { userId: user.id, error: alertErr.message });
        }
      }

      log.info('alert_evaluation_complete', { alertsTriggered });
    } catch (alertErr) {
      log.error('alert_processing_error', { error: alertErr?.message });
      // Don't throw - alert failures shouldn't break the main cron
    }

    // ─── Step 7: Email Drip Campaigns (BL-ENG-007) ─────
    try {
      log.info('drip_campaigns_start');
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
          log.error('welcome_email_2_failed', { userId: user.id, error: err.message });
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
          log.error('welcome_email_3_failed', { userId: user.id, error: err.message });
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
          log.error('welcome_email_4_failed', { userId: user.id, error: err.message });
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
          log.error('reengagement_email_failed', { userId: user.id, error: err.message });
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
          log.error('upgrade_nudge_failed', { userId: user.id, error: err.message });
          emailsFailed++;
        }
      }

      log.info('drip_campaigns_complete', { sent: emailsSent, failed: emailsFailed });
    } catch (emailErr) {
      log.error('drip_campaign_error', { error: emailErr?.message });
      // Don't throw - email failures shouldn't break the main cron
    }

    // ─── Step 8: Purge expired / old revoked refresh tokens ─
    try {
      await withTimeout(query(QUERIES.deleteExpiredRefreshTokens, []), 10000, 'deleteExpiredRefreshTokens');
      log.info('refresh_tokens_purged');
    } catch (purgeErr) {
      log.error('refresh_token_purge_error', { error: purgeErr?.message });
    }

    // ─── Step 9: Downgrade expired cancel-at-period-end subscriptions (TXN-014) ─
    try {
      const { rows: expiredSubs } = await withTimeout(
        query(QUERIES.getExpiredCancelledSubscriptions),
        10000, 'getExpiredCancelledSubscriptions'
      );
      log.info('subscription_expiry_check', { count: expiredSubs.length });

      let downgraded = 0;
      for (const sub of expiredSubs) {
        try {
          // CFO-005: Use conditional UPDATE (only fires if still active) so a
          // Stripe webhook that already canceled this subscription does not
          // trigger a redundant user-tier downgrade.
          await query.transaction(async (q) => {
            const { rows } = await q(QUERIES.cancelExpiredSubscription, [sub.id]);
            if (rows.length > 0) {
              await q(QUERIES.updateUserTier, ['free', sub.user_id]);
            }
          });
          downgraded++;
          log.info('subscription_downgraded', { userId: sub.user_id, fromTier: sub.tier, subscriptionId: sub.stripe_subscription_id });
        } catch (downErr) {
          log.error('subscription_downgrade_failed', { subscriptionId: sub.id, userId: sub.user_id, error: downErr.message });
        }
      }

      log.info('subscription_expiry_complete', { downgraded, total: expiredSubs.length });
    } catch (expErr) {
      log.error('subscription_expiry_error', { error: expErr?.message });
    }

    return { snapshotDate, userCount: users.length, sent, failed };

  } catch (err) {
    log.error('cron_fatal_error', { error: err?.message, stack: err?.stack?.split('\n').slice(0,3).join(' | ') });
    throw err;
  }
}

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
import { APNsClient } from './lib/apns-client.js';
import { FCMClient } from './lib/fcm-client.js';
import { evaluateUserAlerts } from './handlers/alerts.js';
import {
  sendEmail,
  sendWelcomeEmail2,
  sendWelcomeEmail3,
  sendWelcomeEmail4,
  sendReengagementEmail,
  sendUpgradeNudgeEmail,
  sendTrialEndingEmail,
  sendPractitionerWeeklyDigest,
  sendNurtureDay0,
  sendNurtureDay1,
  sendNurtureDay3,
  sendNurtureDay5,
  sendNurtureDay7,
  sendNurtureDay11,
  sendNurtureDay14,
  sendPaidOnboardingDay0,
  sendPaidOnboardingDay7,
  sendPaidOnboardingDay14,
  sendPaidOnboardingDay21,
  sendPaidOnboardingDay30,
} from './lib/email.js';
import { createCronLogger } from './lib/logger.js';
import { initSentry } from './lib/sentry.js';

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
  const sentry = initSentry(env);
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  const hour = now.getUTCHours();

  log.info('transit_snapshot_start', { date: `${year}-${month}-${day}` });

  try {
    // ─── Step 0: Purge expired rate-limit counters (SYS-003) ─
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    try {
      await withTimeout(query(QUERIES.purgeExpiredRateLimitCounters), 8000, 'purgeExpiredRateLimitCounters');
      log.info('rate_limit_counters_purged');
    } catch (purgeRlErr) {
      log.error('rate_limit_purge_error', { error: purgeRlErr?.message });
      // Non-critical — table growth is slow; retry next cron run
    }

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

    await withTimeout(
      query(QUERIES.saveTransitSnapshot, [snapshotDate, positionsJson]),
      8000, 'saveTransitSnapshot'
    );
    log.info('transit_snapshot_saved', { snapshotDate });

    // ─── Step 3: Send digests to opted-in users ─────────
    let digestUserCount = 0, digestSent = 0, digestFailed = 0;
    await withTimeout((async () => {
    const usersResult = await query(
      QUERIES.getSmsSubscribedUsersWithBirthDate
    );

    const smsUsers = usersResult.rows || [];
    digestUserCount = smsUsers.length;
    log.info('sms_digest_users', { count: smsUsers.length });

    for (const user of smsUsers) {
      try {
        const digest = await generateDigestForUser(user, env);
        await sendSMS(user.phone, digest, env);
        digestSent++;

        // Small delay between sends to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        log.error('digest_send_failed', { userId: user.id, error: err.message });
        digestFailed++;
      }
    }

    log.info('digest_delivery_complete', { sent: digestSent, failed: digestFailed });
    })(), 45000, 'sms_digest');

    // ─── Step 4: Process webhook retries ────────────────
    try {
      await withTimeout(processWebhookRetries(env), 20000, 'processWebhookRetries');
      log.info('webhook_retry_complete');
    } catch (webhookErr) {
      log.error('webhook_retry_error', { error: webhookErr?.message });
      sentry.captureException(webhookErr, { tags: { source: 'cron', step: 'webhook_retry' } });
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
      await withTimeout((async () => {
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
      })(), 45000, 'push_notifications');
    } catch (pushErr) {
      log.error('push_processing_error', { error: pushErr?.message });
      sentry.captureException(pushErr, { tags: { source: 'cron', step: 'push_notifications' } });
      // Don't throw - push failures shouldn't break the main cron
    }

    // ─── Step 5b: Retry failed native push notifications ────
    try {
      await withTimeout((async () => {
        const { rows: failures } = await query(QUERIES.getNotificationFailuresForRetry);
        if (failures.length === 0) return;

        log.info('native_push_retries_start', { count: failures.length });
        let retrySuccess = 0, retryFailed = 0;

        const keyGates = gates.sun ? `Sun in Gate ${gates.sun.gate}` : 'Transit energy active';
        const retryNotification = {
          title: '🌟 Your Daily Transit Energy',
          body: `${keyGates}. Open Prime Self to explore today's cosmic weather.`,
          tag: `transit-daily-retry-${snapshotDate}`,
          data: { type: 'transit_daily', date: snapshotDate, url: '/app/transits' },
        };

        for (const failure of failures) {
          const parts = failure.endpoint.split(':');
          const platform = parts[1];
          const token = parts.slice(2).join(':');

          try {
            let result;
            if (platform === 'apns') {
              result = await new APNsClient(env).send(token, retryNotification);
            } else if (platform === 'fcm') {
              result = await new FCMClient(env).send(token, retryNotification);
            } else {
              // Unknown platform — discard
              await query(QUERIES.deleteNotificationFailure, [failure.id]).catch(() => {});
              continue;
            }

            if (result.ok) {
              await query(QUERIES.deleteNotificationFailure, [failure.id]).catch(() => {});
              retrySuccess++;
            } else if (result.unregistered) {
              await query(QUERIES.deactivatePushSubscriptionByEndpoint, [failure.endpoint]).catch(() => {});
              await query(QUERIES.deleteNotificationFailure, [failure.id]).catch(() => {});
              retryFailed++;
            } else {
              await query(QUERIES.incrementNotificationFailureRetry, [failure.id]).catch(() => {});
              retryFailed++;
            }
          } catch (retryErr) {
            log.error('native_retry_item_failed', { failureId: failure.id, error: retryErr.message });
            await query(QUERIES.incrementNotificationFailureRetry, [failure.id]).catch(() => {});
            retryFailed++;
          }
        }

        log.info('native_push_retries_complete', { success: retrySuccess, failed: retryFailed });
      })(), 30000, 'native_push_retries');
    } catch (nativeRetryErr) {
      log.error('native_push_retry_error', { error: nativeRetryErr?.message });
      // Non-critical — retry will run again on next cron cycle
    }

    // ─── Step 6: Evaluate transit alerts ────────────────
    try {
      await withTimeout((async () => {
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
      })(), 30000, 'alert_evaluation');
    } catch (alertErr) {
      log.error('alert_processing_error', { error: alertErr?.message });
      sentry.captureException(alertErr, { tags: { source: 'cron', step: 'alert_evaluation' } });
      // Don't throw - alert failures shouldn't break the main cron
    }

    // ─── Step 7: Email Drip Campaigns (BL-ENG-007) ─────
    try {
      await withTimeout((async () => {
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
            env.FROM_EMAIL,
            env.COMPANY_ADDRESS || ''
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
            env.FROM_EMAIL,
            env.COMPANY_ADDRESS || ''
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
            env.FROM_EMAIL,
            env.COMPANY_ADDRESS || ''
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
            env.FROM_EMAIL,
            env.COMPANY_ADDRESS || ''
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
            env.FROM_EMAIL,
            env.COMPANY_ADDRESS || ''
          );
          emailsSent++;
        } catch (err) {
          log.error('upgrade_nudge_failed', { userId: user.id, error: err.message });
          emailsFailed++;
        }
      }

      log.info('drip_campaigns_complete', { sent: emailsSent, failed: emailsFailed });
      })(), 60000, 'drip_campaigns');
    } catch (emailErr) {
      log.error('drip_campaign_error', { error: emailErr?.message });
      sentry.captureException(emailErr, { tags: { source: 'cron', step: 'drip_campaigns' } });
      // Don't throw - email failures shouldn't break the main cron
    }

    // ─── Step 7b: Trial Ending Reminders (BL-P1-Trial-Reminder) ─
    try {
      await withTimeout((async () => {
      const { rows: trialEndingUsers } = await query(QUERIES.cronGetTrialEndingUsers);
      log.info('trial_ending_users', { count: trialEndingUsers.length });

      let trialRemindersSent = 0, trialRemindersFailed = 0;

      for (const user of (trialEndingUsers || [])) {
        try {
          const daysRemaining = Math.round(user.days_remaining) || 2; // default to 2 days if rounding
          await sendTrialEndingEmail(
            user.email,
            user.email.split('@')[0],
            daysRemaining,
            user.tier || 'Practitioner',
            env.RESEND_API_KEY,
            env.FROM_EMAIL,
            env.COMPANY_ADDRESS || ''
          );
          trialRemindersSent++;
        } catch (err) {
          log.error('trial_reminder_failed', { userId: user.id, error: err.message });
          trialRemindersFailed++;
        }
      }

      log.info('trial_reminders_complete', { sent: trialRemindersSent, failed: trialRemindersFailed });
      })(), 30000, 'trial_reminders');
    } catch (trialErr) {
      log.error('trial_reminder_error', { error: trialErr?.message });
      sentry.captureException(trialErr, { tags: { source: 'cron', step: 'trial_reminders' } });
      // Don't throw - trial reminder failures shouldn't break the main cron
    }

    // ─── Step 7c: Practitioner Trial Nurture Sequence (GTM-009) ──────────────
    try {
      await withTimeout((async () => {
      const NURTURE_DAYS = [0, 1, 3, 5, 7, 11, 14];
      const NURTURE_FNS = {
        0:  (e, n, k, f, a) => sendNurtureDay0(e, n, k, f, a),
        1:  (e, n, k, f, a) => sendNurtureDay1(e, n, k, f, a),
        3:  (e, n, k, f, a) => sendNurtureDay3(e, n, k, f, a),
        5:  (e, n, k, f, a) => sendNurtureDay5(e, n, k, f, a),
        7:  (e, n, k, f, a) => sendNurtureDay7(e, n, k, f, a),
        11: (e, n, k, f, a) => sendNurtureDay11(e, n, k, f, a),
        14: (e, n, k, t, f, a) => sendNurtureDay14(e, n, t, f, a),
      };

      const { rows: nurtureRows } = await query(QUERIES.cronGetNurturePractitioners);
      log.info('nurture_practitioners', { count: nurtureRows.length });

      let nurtureSent = 0, nurtureSkipped = 0, nurtureFailed = 0;

      for (const pract of nurtureRows) {
        const day = Math.floor(Number(pract.days_since_trial));
        if (!NURTURE_DAYS.includes(day)) continue;

        try {
          // Idempotency: skip if this day's email was already sent
          const { rows: alreadySent } = await query(QUERIES.getNurtureEmailSent, [pract.practitioner_id, day]);
          if (alreadySent.length > 0) { nurtureSkipped++; continue; }

          // Day 3: skip nudge if practitioner already has at least 1 client
          if (day === 3) {
            const { rows: clients } = await query(QUERIES.countPractitionerClients, [pract.practitioner_id]).catch(() => ({ rows: [] }));
            const count = parseInt(clients?.[0]?.count || '0', 10);
            if (count >= 1) {
              await query(QUERIES.insertNurtureEmailSent, [pract.practitioner_id, day]);
              nurtureSkipped++;
              continue;
            }
          }

          const fn = NURTURE_FNS[day];
          const displayName = pract.name || pract.email.split('@')[0];
          if (day === 14) {
            await fn(pract.email, displayName, pract.tier || 'Practitioner', env.RESEND_API_KEY, env.FROM_EMAIL, env.COMPANY_ADDRESS || '');
          } else {
            await fn(pract.email, displayName, env.RESEND_API_KEY, env.FROM_EMAIL, env.COMPANY_ADDRESS || '');
          }

          await query(QUERIES.insertNurtureEmailSent, [pract.practitioner_id, day]);
          nurtureSent++;
        } catch (err) {
          log.error('nurture_email_failed', { practitionerId: pract.practitioner_id, day, error: err.message });
          nurtureFailed++;
        }
      }

      log.info('nurture_complete', { sent: nurtureSent, skipped: nurtureSkipped, failed: nurtureFailed });
      })(), 45000, 'practitioner_nurture');
    } catch (nurtureErr) {
      log.error('nurture_error', { error: nurtureErr?.message });
      sentry.captureException(nurtureErr, { tags: { source: 'cron', step: 'practitioner_nurture' } });
    }

    // ─── Step 7d: Paid Practitioner Onboarding Sequence (GTM-012) ───────────
    try {
      await withTimeout((async () => {
      const PAID_ONBOARDING_DAYS = [0, 7, 14, 21, 30];
      const PAID_ONBOARDING_FNS = {
        0:  (e, n, k, f, a) => sendPaidOnboardingDay0(e, n, k, f, a),
        7:  (e, n, k, f, a) => sendPaidOnboardingDay7(e, n, k, f, a),
        14: (e, n, k, f, a) => sendPaidOnboardingDay14(e, n, k, f, a),
        21: (e, n, k, f, a) => sendPaidOnboardingDay21(e, n, k, f, a),
        30: (e, n, k, f, a) => sendPaidOnboardingDay30(e, n, k, f, a),
      };

      const { rows: onboardingRows } = await query(QUERIES.cronGetPaidOnboardingPractitioners);
      log.info('paid_onboarding_practitioners', { count: onboardingRows.length });

      let onboardingSent = 0, onboardingSkipped = 0, onboardingFailed = 0;

      for (const pract of onboardingRows) {
        const day = Math.floor(Number(pract.days_since_paid_start));
        if (!PAID_ONBOARDING_DAYS.includes(day)) continue;

        try {
          const { rows: alreadySent } = await query(QUERIES.getPaidOnboardingEmailSent, [pract.practitioner_id, day]);
          if (alreadySent.length > 0) { onboardingSkipped++; continue; }

          const fn = PAID_ONBOARDING_FNS[day];
          const displayName = pract.name || pract.email.split('@')[0];
          await fn(pract.email, displayName, env.RESEND_API_KEY, env.FROM_EMAIL, env.COMPANY_ADDRESS || '');

          await query(QUERIES.insertPaidOnboardingEmailSent, [pract.practitioner_id, day]);
          onboardingSent++;
        } catch (err) {
          log.error('paid_onboarding_email_failed', { practitionerId: pract.practitioner_id, day, error: err.message });
          onboardingFailed++;
        }
      }

      log.info('paid_onboarding_complete', { sent: onboardingSent, skipped: onboardingSkipped, failed: onboardingFailed });
      })(), 45000, 'paid_practitioner_onboarding');
    } catch (onboardingErr) {
      log.error('paid_onboarding_error', { error: onboardingErr?.message });
      sentry.captureException(onboardingErr, { tags: { source: 'cron', step: 'paid_practitioner_onboarding' } });
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

    // ─── Step 10: Dunning — escalate past_due subscriptions ────────
    try {
      const { rows: pastDueSubs } = await withTimeout(
        query(QUERIES.getPastDueSubscriptionsOlderThan, [7]),
        10000, 'getPastDueSubscriptions'
      );
      log.info('dunning_check', { count: pastDueSubs.length });

      for (const sub of pastDueSubs) {
        try {
          const daysPastDue = sub.days_past_due || 0;
          if (daysPastDue >= 14) {
            // 14+ days: downgrade to free
            await query.transaction(async (q) => {
              await q(QUERIES.updateUserTier, ['free', sub.user_id]);
              await q(QUERIES.updateSubscriptionStatus, [sub.stripe_subscription_id, 'canceled']);
            });
            log.warn({ action: 'dunning_downgrade', userId: sub.user_id, daysPastDue });
          } else if (env.RESEND_API_KEY && sub.email) {
            // 7-13 days: send escalating reminder
            const daysWord = daysPastDue === 7 ? 'one week' : `${daysPastDue} days`;
            await sendEmail({
              to: sub.email,
              subject: `Action required: Your Prime Self payment is ${daysWord} overdue`,
              html: `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2>Your payment needs attention</h2>
<p>Your Prime Self subscription payment has been past due for ${daysWord}. Your access will be suspended in ${14 - daysPastDue} days if payment is not resolved.</p>
<p><a href="https://selfprime.net/billing" style="background:#C9A84C;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">Update Payment Method →</a></p>
<p>Questions? Reply to this email.</p>
</body></html>`
            }, env.RESEND_API_KEY, env.FROM_EMAIL || 'Prime Self <hello@primeself.app>');
            log.info({ action: 'dunning_reminder_sent', userId: sub.user_id, daysPastDue });
          }
        } catch (dunningErr) {
          log.error({ action: 'dunning_step_failed', userId: sub.user_id, error: dunningErr.message });
        }
      }
      log.info('dunning_complete', { processed: pastDueSubs.length });
    } catch (dunningErr) {
      log.error('dunning_error', { error: dunningErr?.message });
    }

    // ─── Step 11: Practitioner weekly digest (CMO-013) — Mondays only ──────
    if (now.getUTCDay() === 1) {
      try {
        await withTimeout((async () => {
          log.info('practitioner_digest_start');
          const { rows: practitioners } = await query(QUERIES.getPractitionerWeeklyDigestList);
          log.info('practitioner_digest_practitioners', { count: practitioners.length });

          let digestSentCount = 0, digestFailedCount = 0;
          for (const p of practitioners) {
            try {
              await sendPractitionerWeeklyDigest(
                p.email,
                p.name,
                {
                  clientCount: p.client_count,
                  notesThisWeek: p.notes_this_week,
                  newChartsThisWeek: p.new_charts_this_week,
                },
                env.RESEND_API_KEY,
                env.FROM_EMAIL
              );
              digestSentCount++;
              await new Promise(r => setTimeout(r, 100));
            } catch (digestErr) {
              log.error('practitioner_digest_send_failed', { email: p.email, error: digestErr.message });
              digestFailedCount++;
            }
          }
          log.info('practitioner_digest_complete', { sent: digestSentCount, failed: digestFailedCount });
        })(), 60000, 'practitioner_weekly_digest');
      } catch (digestErr) {
        log.error('practitioner_digest_error', { error: digestErr?.message });
        // Non-critical — main cron should continue
      }
    }

    // ─── Step 12: Daily check-in reminders ──────────────────
    try {
      await withTimeout((async () => {
        const { rows: dueReminders } = await query(QUERIES.cronGetDueCheckinReminders);
        log.info('checkin_reminder_candidates', { count: dueReminders.length });

        let reminderSent = 0, reminderFailed = 0;
        for (const r of dueReminders) {
          try {
            const methods = Array.isArray(r.notification_method) ? r.notification_method : ['push'];
            if (methods.includes('push')) {
              await sendNotificationToUser(env, r.user_id, 'checkin_reminder', {
                title: '♥ Time for your daily check-in',
                body: 'Track your alignment, strategy, and energy. Keep the streak going!',
                icon: 'https://primeself.app/icon-192.png',
                badge: 'https://primeself.app/badge-72.png',
                tag: `checkin-reminder-${snapshotDate}`,
                data: { type: 'checkin_reminder', url: '/app/checkin' },
              });
            }
            await query(QUERIES.updateReminderLastSent, [r.user_id]);
            reminderSent++;
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (remErr) {
            log.error('checkin_reminder_send_failed', { userId: r.user_id, error: remErr.message });
            reminderFailed++;
          }
        }
        log.info('checkin_reminders_sent', { sent: reminderSent, failed: reminderFailed });
      })(), 30000, 'checkin_reminders');
    } catch (reminderErr) {
      log.error('checkin_reminder_error', { error: reminderErr?.message });
    }

    // Record successful cron completion — used by /api/health to detect stale cron
    if (env.CACHE) {
      await env.CACHE.put('cron:last_success', Date.now().toString(), { expirationTtl: 172800 }).catch(() => {});
    }

    return { snapshotDate, userCount: digestUserCount, sent: digestSent, failed: digestFailed };

  } catch (err) {
    log.error('cron_fatal_error', { error: err?.message, stack: err?.stack?.split('\n').slice(0,3).join(' | ') });
    sentry.captureException(err, { tags: { source: 'cron', step: 'fatal' } });
    // SYS-035: Alert admin on fatal cron failure (fire-and-forget)
    if (env.ADMIN_EMAIL && env.RESEND_API_KEY) {
      sendEmail({
        to: env.ADMIN_EMAIL,
        subject: `[ALERT] Prime Self cron fatal failure — ${new Date().toISOString()}`,
        html: `<p style="font-family:sans-serif">Cron job failed fatally:<br><pre style="background:#f4f4f4;padding:12px;border-radius:4px">${err?.message}\n${err?.stack?.split('\n').slice(0,5).join('\n')}</pre></p>`,
        companyAddress: env.COMPANY_ADDRESS || '',
      }, env.RESEND_API_KEY, env.FROM_EMAIL || 'Prime Self <hello@primeself.app>').catch(() => {});
    }
    throw err;
  }
}

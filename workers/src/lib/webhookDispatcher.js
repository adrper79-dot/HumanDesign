/**
 * Webhook Event Dispatcher
 * 
 * Handles dispatching events to user-configured webhook endpoints with:
 * - HMAC signature verification
 * - Retry logic with exponential backoff
 * - Delivery tracking and audit logging
 * 
 * Usage:
 *   import { dispatchWebhookEvent } from './lib/webhookDispatcher.js';
 *   
 *   await dispatchWebhookEvent(env, {
 *     userId: 123,
 *     eventType: 'chart.created',
 *     payload: { chartId: 'abc123', type: 'Generator', ... }
 *   });
 */

import { createQueryFn } from '../db/queries.js';

/**
 * Dispatch an event to all subscribed webhooks for a user.
 * 
 * @param {object} env - Cloudflare environment (DB binding)
 * @param {object} options - { userId, eventType, payload }
 */
export async function dispatchWebhookEvent(env, { userId, eventType, payload }) {
  if (!userId || !eventType || !payload) {
    console.error('[webhookDispatcher] Missing required params:', { userId, eventType, payload: !!payload });
    return;
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Find all active webhooks for this user subscribed to this event
    const { rows: webhookList } = await query(`
      SELECT id, url, events, secret
      FROM webhooks
      WHERE user_id = $1 AND active = true AND $2 = ANY(events)
    `, [userId, eventType]);

    if (!webhookList || webhookList.length === 0) {
      console.log(`[webhookDispatcher] No active webhooks for user ${userId} event ${eventType}`);
      return;
    }

    console.log(`[webhookDispatcher] Dispatching ${eventType} to ${webhookList.length} webhook(s)`);

    // Dispatch to each webhook (async, non-blocking)
    for (const webhook of webhookList) {
      try {
        await deliverWebhook(env, {
          webhookId: webhook.id,
          url: webhook.url,
          secret: webhook.secret,
          eventType,
          payload
        });
      } catch (error) {
        console.error(`[webhookDispatcher] Failed to deliver to webhook ${webhook.id}:`, error);
        // Continue to next webhook even if one fails
      }
    }

  } catch (error) {
    console.error('[webhookDispatcher] Error finding webhooks:', error);
  }
}

/**
 * Deliver a webhook event to a specific endpoint.
 * Creates delivery record and handles retry logic.
 */
async function deliverWebhook(env, { webhookId, url, secret, eventType, payload }) {
  const deliveryId = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  // Build payload
  const body = JSON.stringify({
    id: deliveryId,
    event: eventType,
    timestamp,
    data: payload
  });

  // Generate HMAC signature
  const signature = await generateSignature(secret, body);

  try {
    // Make HTTP POST request to webhook URL
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'PrimeSelf-Webhooks/1.0',
        'X-Prime-Signature': signature,
        'X-Prime-Event': eventType,
        'X-Prime-Delivery': deliveryId,
      },
      body,
      // Timeout after 15 seconds
      signal: AbortSignal.timeout(15000)
    });

    const responseBody = await response.text().catch(() => '');

    // Record delivery attempt
    await query(`
      INSERT INTO webhook_deliveries (
        id, webhook_id, event_type, payload, response_status, response_body, delivered_at, attempts
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 1)
    `, [
      deliveryId,
      webhookId,
      eventType,
      JSON.stringify(payload),
      response.status,
      responseBody.slice(0, 1000),
    ]);

    if (response.ok) {
      console.log(`[webhookDispatcher] ✅ Delivered ${eventType} to ${url} (${response.status})`);
    } else {
      console.warn(`[webhookDispatcher] ⚠️ Non-2xx response from ${url}: ${response.status}`);
      // Schedule retry for non-2xx responses
      await scheduleRetry(env, deliveryId, 1);
    }

  } catch (error) {
    console.error(`[webhookDispatcher] ❌ Failed to deliver to ${url}:`, error.message);

    // Record failed delivery attempt
    await query(`
      INSERT INTO webhook_deliveries (
        id, webhook_id, event_type, payload, response_status, response_body, attempts, next_retry_at
      ) VALUES ($1, $2, $3, $4, NULL, $5, 1, NOW() + INTERVAL '5 minutes')
    `, [
      deliveryId,
      webhookId,
      eventType,
      JSON.stringify(payload),
      error.message.slice(0, 1000)
    ]);

    // Schedule first retry in 5 minutes
    await scheduleRetry(env, deliveryId, 1);
  }
}

/**
 * Schedule a retry for a failed webhook delivery.
 * Uses exponential backoff: 5 min, 30 min, 6 hours.
 */
async function scheduleRetry(env, deliveryId, attemptNumber) {
  const retryDelays = [
    5 * 60,        // 5 minutes
    30 * 60,       // 30 minutes
    6 * 60 * 60    // 6 hours
  ];

  if (attemptNumber >= 3) {
    console.log(`[webhookDispatcher] Max retries reached for delivery ${deliveryId}`);
    return;
  }

  const delaySeconds = retryDelays[attemptNumber - 1] || retryDelays[2];
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  await query(`
    UPDATE webhook_deliveries
    SET next_retry_at = NOW() + ($1 * INTERVAL '1 second')
    WHERE id = $2
  `, [delaySeconds, deliveryId]);

  console.log(`[webhookDispatcher] Scheduled retry #${attemptNumber} for ${deliveryId} in ${delaySeconds}s`);
}

/**
 * Process webhook retries (called by cron job).
 * Finds all failed deliveries past their retry time and attempts redelivery.
 */
export async function processWebhookRetries(env) {
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Find deliveries ready to retry
    const { rows: retryList } = await query(`
      SELECT d.id, d.webhook_id, d.event_type, d.payload, d.attempts, w.url, w.secret
      FROM webhook_deliveries d
      JOIN webhooks w ON d.webhook_id = w.id
      WHERE d.next_retry_at <= NOW()
        AND d.response_status IS NULL
        AND d.attempts < 3
        AND w.active = true
      LIMIT 100
    `);

    if (!retryList || retryList.length === 0) {
      return;
    }

    console.log(`[webhookRetries] Processing ${retryList.length} retry(ies)`);

    for (const retry of retryList) {
      try {
        await retryWebhookDelivery(env, retry);
      } catch (error) {
        console.error(`[webhookRetries] Failed to retry delivery ${retry.id}:`, error);
      }
    }

  } catch (error) {
    console.error('[webhookRetries] Error processing retries:', error);
  }
}

/**
 * Retry a specific webhook delivery.
 */
async function retryWebhookDelivery(env, { id, webhook_id, event_type, payload, attempts, url, secret }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadObj = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  const body = JSON.stringify({
    id,
    event: event_type,
    timestamp,
    data: payloadObj
  });

  const signature = await generateSignature(secret, body);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'PrimeSelf-Webhooks/1.0',
        'X-Prime-Signature': signature,
        'X-Prime-Event': event_type,
        'X-Prime-Delivery': id,
        'X-Prime-Retry': attempts.toString(),
      },
      body,
      signal: AbortSignal.timeout(15000)
    });

    const responseBody = await response.text().catch(() => '');

    // Update delivery record
    if (response.ok) {
      await query(`
        UPDATE webhook_deliveries
        SET response_status = $1, response_body = $2, delivered_at = NOW(), 
            attempts = $3, next_retry_at = NULL
        WHERE id = $4
      `, [response.status, responseBody.slice(0, 1000), attempts + 1, id]);

      console.log(`[webhookRetries] ✅ Retry successful for ${id} (attempt ${attempts + 1})`);
    } else {
      await query(`
        UPDATE webhook_deliveries
        SET response_status = $1, response_body = $2, attempts = $3
        WHERE id = $4
      `, [response.status, responseBody.slice(0, 1000), attempts + 1, id]);

      console.warn(`[webhookRetries] ⚠️ Retry failed for ${id}: ${response.status}`);

      // Schedule next retry if under limit
      if (attempts + 1 < 3) {
        await scheduleRetry(env, id, attempts + 1);
      }
    }

  } catch (error) {
    console.error(`[webhookRetries] ❌ Retry error for ${id}:`, error.message);

    // Update attempts and schedule next retry
    await query(`
      UPDATE webhook_deliveries
      SET response_body = $1, attempts = $2
      WHERE id = $3
    `, [error.message.slice(0, 1000), attempts + 1, id]);

    if (attempts + 1 < 3) {
      await scheduleRetry(env, id, attempts + 1);
    }
  }
}

/**
 * Generate HMAC SHA-256 signature for webhook payload verification.
 * Uses Web Crypto API (native in Cloudflare Workers).
 * Recipient can verify signature using the same secret.
 */
async function generateSignature(secret, body) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(body);

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return `sha256=${hashArray.map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Verify webhook signature (for testing / recipient validation).
 */
export async function verifySignature(secret, body, signature) {
  const expectedSignature = await generateSignature(secret, body);
  return signature === expectedSignature;
}

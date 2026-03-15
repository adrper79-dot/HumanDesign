/**
 * Push Notification Management
 * Handles Web Push API subscriptions and sending notifications
 * 
 * Endpoints:
 * - POST /api/push/subscribe - Register push subscription
 * - DELETE /api/push/unsubscribe - Remove push subscription
 * - GET /api/push/vapid-key - Get public VAPID key for subscription
 * - POST /api/push/test - Send test notification
 * - GET /api/push/preferences - Get notification preferences
 * - PUT /api/push/preferences - Update notification preferences
 * - GET /api/push/history - Get notification delivery history
 */

import { getUserFromRequest } from '../middleware/auth.js';
import { createQueryFn, QUERIES } from '../db/queries.js';

// ─── Web Push Protocol Helpers (RFC 8030 / RFC 8291) ─────────────────────

/** Base64URL encode a buffer */
function b64url(buffer) {
  const bytes = new Uint8Array(buffer instanceof ArrayBuffer ? buffer : buffer.buffer || buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/** Base64URL decode to Uint8Array */
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Concatenate Uint8Arrays */
function concatBytes(...arrays) {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) { result.set(arr, offset); offset += arr.length; }
  return result;
}

/** HKDF-SHA256 extract + expand (RFC 5869, single block) */
async function hkdf(salt, ikm, info, length) {
  const prkKey = await crypto.subtle.importKey(
    'raw', salt.length ? salt : new Uint8Array(32),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, ikm));
  const expandKey = await crypto.subtle.importKey(
    'raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const expanded = new Uint8Array(await crypto.subtle.sign(
    'HMAC', expandKey, concatBytes(info, new Uint8Array([1]))
  ));
  return expanded.slice(0, length);
}

/** Create VAPID Authorization header (ES256 JWT) */
async function createVapidAuth(endpoint, vapidSubject, vapidPublicKey, vapidPrivateKey) {
  const url = new URL(endpoint);
  const aud = `${url.protocol}//${url.host}`;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;

  const headerB64 = b64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claimsB64 = b64url(new TextEncoder().encode(JSON.stringify({ aud, exp, sub: vapidSubject })));
  const signingInput = new TextEncoder().encode(`${headerB64}.${claimsB64}`);

  // VAPID public key = 65-byte uncompressed P-256, private key = 32-byte raw scalar
  const pubBytes = b64urlDecode(vapidPublicKey);
  const privBytes = b64urlDecode(vapidPrivateKey);

  const key = await crypto.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256',
    x: b64url(pubBytes.slice(1, 33)),
    y: b64url(pubBytes.slice(33, 65)),
    d: b64url(privBytes)
  }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);

  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, signingInput);
  const jwt = `${headerB64}.${claimsB64}.${b64url(sig)}`;

  return `vapid t=${jwt}, k=${vapidPublicKey}`;
}

/** Encrypt payload per RFC 8291 (aes128gcm content encoding) */
async function encryptPayload(clientPublicKeyB64, clientAuthB64, payload) {
  const clientPubBytes = b64urlDecode(clientPublicKeyB64);
  const clientAuth = b64urlDecode(clientAuthB64);
  const plaintext = new TextEncoder().encode(typeof payload === 'string' ? payload : JSON.stringify(payload));

  // Ephemeral ECDH key pair
  const serverKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );
  const serverPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeys.publicKey));

  // Import client p256dh key
  const clientKey = await crypto.subtle.importKey(
    'raw', clientPubBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientKey }, serverKeys.privateKey, 256
  ));

  // IKM: HKDF(auth, shared_secret, "WebPush: info\0" || client_pub || server_pub)
  const keyInfo = concatBytes(new TextEncoder().encode('WebPush: info\0'), clientPubBytes, serverPubRaw);
  const ikm = await hkdf(clientAuth, sharedSecret, keyInfo, 32);

  // Random salt for this message
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Content encryption key + nonce
  const cek = await hkdf(salt, ikm, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, new TextEncoder().encode('Content-Encoding: nonce\0'), 12);

  // Pad: payload || 0x02 (single-record delimiter)
  const padded = concatBytes(plaintext, new Uint8Array([2]));

  // AES-128-GCM encrypt
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, aesKey, padded
  ));

  // aes128gcm header: salt(16) || rs(4, uint32 BE) || idlen(1) || keyid(65 = server pub)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);

  return {
    body: concatBytes(salt, rs, new Uint8Array([65]), serverPubRaw, encrypted),
    contentEncoding: 'aes128gcm'
  };
}

/**
 * Main handler for push notification routes
 */
export async function handlePush(request, env, path) {
  const method = request.method;

  // Public endpoint - get VAPID public key
  if (path === '/vapid-key' && method === 'GET') {
    return getVapidKey(env);
  }

  // All other routes require authentication
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Route handlers
  if (path === '/subscribe' && method === 'POST') {
    return subscribe(request, env, user);
  } else if (path === '/unsubscribe' && method === 'DELETE') {
    return unsubscribe(request, env, user);
  } else if (path === '/test' && method === 'POST') {
    return sendTestNotification(request, env, user);
  } else if (path === '/preferences' && method === 'GET') {
    return getPreferences(request, env, user);
  } else if (path === '/preferences' && method === 'PUT') {
    return updatePreferences(request, env, user);
  } else if (path === '/history' && method === 'GET') {
    return getNotificationHistory(request, env, user);
  }

  return new Response(JSON.stringify({ ok: false, error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Get VAPID public key for client-side subscription
 * PUBLIC endpoint - no auth required
 */
async function getVapidKey(env) {
  // VAPID keys should be stored in environment variables
  // Generate with: npx web-push generate-vapid-keys
  const publicKey = env.VAPID_PUBLIC_KEY;

  if (!publicKey) {
    console.error('[PUSH] VAPID_PUBLIC_KEY not configured');
    return Response.json({
      ok: false,
      error: 'Push notifications not configured'
    }, { status: 500 });
  }

  return Response.json({
    ok: true,
    publicKey
  });
}

/**
 * Subscribe to push notifications
 * Stores Web Push subscription endpoint and keys
 */
async function subscribe(request, env, user) {
  try {
    const { endpoint, keys } = await request.json();

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return Response.json({
        ok: false,
        error: 'Missing required fields: endpoint, keys.p256dh, keys.auth'
      }, { status: 400 });
    }

    // Input length validation
    if (endpoint.length > 2048) {
      return Response.json({ ok: false, error: 'endpoint exceeds maximum length of 2048 characters' }, { status: 400 });
    }

    // SSRF prevention: only allow HTTPS push service endpoints
    try {
      const epUrl = new URL(endpoint);
      if (epUrl.protocol !== 'https:') {
        return Response.json({ ok: false, error: 'Push endpoint must use HTTPS' }, { status: 400 });
      }
    } catch {
      return Response.json({ ok: false, error: 'Invalid push endpoint URL' }, { status: 400 });
    }

    if (keys.p256dh.length > 256 || keys.auth.length > 256) {
      return Response.json({ ok: false, error: 'keys exceed maximum length of 256 characters' }, { status: 400 });
    }

    // Get user agent for tracking
    const userAgent = request.headers.get('User-Agent') || 'Unknown';

    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Check if subscription already exists
    const { rows: existingRows } = await query(QUERIES.getPushSubscriptionByEndpoint, [endpoint]);
    const existing = existingRows[0] || null;

    if (existing) {
      // Update last_used timestamp
      await query(QUERIES.updatePushSubscriptionLastUsed, [endpoint]);

      return Response.json({
        ok: true,
        message: 'Subscription already registered',
        subscriptionId: existing.id
      });
    }

    // Insert new subscription
    const { rows: insertRows } = await query(QUERIES.insertPushSubscription, [user.id, endpoint, keys.p256dh, keys.auth, userAgent]);
    const result = insertRows[0];

    // Create default notification preferences if not exists
    const { rows: prefsRows } = await query(QUERIES.getNotificationPrefsById, [user.id]);

    if (prefsRows.length === 0) {
      await query(QUERIES.insertDefaultNotificationPrefs, [user.id]);
    }

    console.log(`[PUSH] New subscription registered for user ${user.id}: ${result.id}`);

    return Response.json({
      ok: true,
      subscription: {
        id: result.id,
        endpoint: result.endpoint,
        active: result.active,
        subscribedAt: result.subscription_time
      }
    });
  } catch (error) {
    console.error('[PUSH] Subscribe error:', error);
    return Response.json({
      ok: false,
      error: 'Failed to register subscription'
    }, { status: 500 });
  }
}

/**
 * Unsubscribe from push notifications
 */
async function unsubscribe(request, env, user) {
  try {
    const { endpoint } = await request.json();

    if (!endpoint) {
      return Response.json({
        ok: false,
        error: 'Missing endpoint'
      }, { status: 400 });
    }

    // Delete subscription (cascade will delete notification logs)
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const { rows } = await query(QUERIES.deletePushSubscription, [user.id, endpoint]);

    if (rows.length === 0) {
      return Response.json({
        ok: false,
        error: 'Subscription not found'
      }, { status: 404 });
    }

    console.log(`[PUSH] Subscription removed for user ${user.id}: ${endpoint}`);

    return Response.json({
      ok: true,
      message: 'Unsubscribed successfully'
    });
  } catch (error) {
    console.error('[PUSH] Unsubscribe error:', error);
    return Response.json({
      ok: false,
      error: 'Failed to unsubscribe'
    }, { status: 500 });
  }
}

/**
 * Send test notification
 */
async function sendTestNotification(request, env, user) {
  try {
    // Get user's active subscriptions
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const { rows: subRows } = await query(QUERIES.getActivePushSubscriptions, [user.id]);

    if (subRows.length === 0) {
      return Response.json({
        ok: false,
        error: 'No active push subscriptions found. Please subscribe first.'
      }, { status: 404 });
    }

    // Send test notification to all subscriptions
    const notification = {
      title: '🌟 Prime Self Test Notification',
      body: 'Your push notifications are working! You\'ll receive daily transit updates and cycle alerts here.',
      icon: 'https://primeself.app/icon-192.png',
      badge: 'https://primeself.app/badge-72.png',
      tag: 'test-notification',
      data: {
        type: 'test',
        url: '/app'
      }
    };

    const results = [];
    for (const sub of subRows) {
      const success = await sendPushNotification(env, sub, notification);
      results.push({
        subscriptionId: sub.id,
        endpoint: sub.endpoint.substring(0, 50) + '...',
        success
      });
    }

    const successCount = results.filter(r => r.success).length;

    return Response.json({
      ok: true,
      message: `Test notification sent to ${successCount}/${results.length} subscriptions`,
      results
    });
  } catch (error) {
    console.error('[PUSH] Test notification error:', error);
    return Response.json({
      ok: false,
      error: 'Failed to send test notification'
    }, { status: 500 });
  }
}

/**
 * Get notification preferences
 */
async function getPreferences(request, env, user) {
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const { rows } = await query(QUERIES.getNotificationPreferences, [user.id]);
    const prefs = rows[0] || null;

    if (!prefs) {
      // Return defaults
      return Response.json({
        ok: true,
        preferences: {
          transitDaily: true,
          gateActivation: true,
          cycleApproaching: true,
          transitAlert: true,
          weeklyDigest: true,
          quietHoursStart: null,
          quietHoursEnd: null,
          timezone: 'UTC',
          dailyDigestTime: '06:00',
          weeklyDigestDay: 1
        }
      });
    }

    return Response.json({
      ok: true,
      preferences: {
        transitDaily: prefs.transit_daily,
        gateActivation: prefs.gate_activation,
        cycleApproaching: prefs.cycle_approaching,
        transitAlert: prefs.transit_alert,
        weeklyDigest: prefs.weekly_digest,
        quietHoursStart: prefs.quiet_hours_start,
        quietHoursEnd: prefs.quiet_hours_end,
        timezone: prefs.timezone,
        dailyDigestTime: prefs.daily_digest_time,
        weeklyDigestDay: prefs.weekly_digest_day
      }
    });
  } catch (error) {
    console.error('[PUSH] Get preferences error:', error);
    return Response.json({
      ok: false,
      error: 'Failed to get preferences'
    }, { status: 500 });
  }
}

/**
 * Update notification preferences
 */
async function updatePreferences(request, env, user) {
  try {
    const updates = await request.json();

    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // DYNAMIC: builds SET clause at runtime — cannot centralise into QUERIES
    // Build UPDATE query dynamically
    const fields = [];
    const values = [];
    let paramIdx = 1;

    if (typeof updates.transitDaily === 'boolean') {
      fields.push(`transit_daily = $${paramIdx++}`);
      values.push(updates.transitDaily);
    }
    if (typeof updates.gateActivation === 'boolean') {
      fields.push(`gate_activation = $${paramIdx++}`);
      values.push(updates.gateActivation);
    }
    if (typeof updates.cycleApproaching === 'boolean') {
      fields.push(`cycle_approaching = $${paramIdx++}`);
      values.push(updates.cycleApproaching);
    }
    if (typeof updates.transitAlert === 'boolean') {
      fields.push(`transit_alert = $${paramIdx++}`);
      values.push(updates.transitAlert);
    }
    if (typeof updates.weeklyDigest === 'boolean') {
      fields.push(`weekly_digest = $${paramIdx++}`);
      values.push(updates.weeklyDigest);
    }
    if (updates.quietHoursStart !== undefined) {
      fields.push(`quiet_hours_start = $${paramIdx++}`);
      values.push(updates.quietHoursStart);
    }
    if (updates.quietHoursEnd !== undefined) {
      fields.push(`quiet_hours_end = $${paramIdx++}`);
      values.push(updates.quietHoursEnd);
    }
    if (updates.timezone) {
      fields.push(`timezone = $${paramIdx++}`);
      values.push(updates.timezone);
    }
    if (updates.dailyDigestTime) {
      fields.push(`daily_digest_time = $${paramIdx++}`);
      values.push(updates.dailyDigestTime);
    }
    if (updates.weeklyDigestDay) {
      fields.push(`weekly_digest_day = $${paramIdx++}`);
      values.push(updates.weeklyDigestDay);
    }

    if (fields.length === 0) {
      return Response.json({
        ok: false,
        error: 'No valid fields to update'
      }, { status: 400 });
    }

    fields.push('updated_at = NOW()');
    values.push(user.id);

    // Upsert preferences
    await query(`
      INSERT INTO notification_preferences (user_id)
      VALUES ($${paramIdx++})
      ON CONFLICT (user_id) DO UPDATE SET ${fields.join(', ')}
    `, values);

    console.log(`[PUSH] Preferences updated for user ${user.id}`);

    return Response.json({
      ok: true,
      message: 'Preferences updated successfully'
    });
  } catch (error) {
    console.error('[PUSH] Update preferences error:', error);
    return Response.json({
      ok: false,
      error: 'Failed to update preferences'
    }, { status: 500 });
  }
}

/**
 * Get notification delivery history
 */
async function getNotificationHistory(request, env, user) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 100);  // BL-R-M15
    const offset = Math.min(parseInt(url.searchParams.get('offset')) || 0, 10000);  // BL-R-M15

    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    const { rows: notifRows } = await query(QUERIES.getPushNotificationHistory, [user.id, limit, offset]);

    const { rows: totalRows } = await query(QUERIES.countPushNotifications, [user.id]);
    const total = totalRows[0];

    return Response.json({
      ok: true,
      notifications: notifRows.map(n => ({
        id: n.id,
        type: n.notification_type,
        title: n.title,
        body: n.body,
        sentAt: n.sent_at,
        success: n.success
      })),
      pagination: {
        total: total.count,
        limit,
        offset,
        hasMore: offset + limit < total.count
      }
    });
  } catch (error) {
    console.error('[PUSH] History error:', error);
    return Response.json({
      ok: false,
      error: 'Failed to get notification history'
    }, { status: 500 });
  }
}

/**
 * Send push notification using Web Push API
 * Called by cron jobs and event handlers
 * 
 * @param {object} env - Worker environment
 * @param {object} subscription - Push subscription with endpoint, p256dh, auth
 * @param {object} notification - Notification payload { title, body, icon, badge, tag, data }
 * @returns {boolean} - True if sent successfully
 */
export async function sendPushNotification(env, subscription, notification) {
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    // Web Push requires web-push library or manual implementation
    // For Cloudflare Workers, we'll use the Web Push protocol directly
    
    // VAPID keys from environment
    const vapidPublicKey = env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = env.VAPID_PRIVATE_KEY;
    const vapidSubject = env.VAPID_SUBJECT || 'mailto:support@primeself.app';

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('[PUSH] VAPID keys not configured');
      
      // Log failed notification
      await query(QUERIES.insertPushNotification, [
        subscription.id,
        subscription.user_id,
        notification.data?.type || 'unknown',
        notification.title,
        notification.body,
        500,
        'VAPID keys not configured',
        false
      ]);
      
      return false;
    }

    // Payload
    const payload = JSON.stringify(notification);

    // Encrypt payload using subscriber's p256dh and auth keys
    const encrypted = await encryptPayload(subscription.p256dh, subscription.auth, payload);

    // Generate VAPID authorization header
    const authorization = await createVapidAuth(
      subscription.endpoint, vapidSubject, vapidPublicKey, vapidPrivateKey
    );

    // Send to push service
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Encoding': encrypted.contentEncoding,
        'Content-Type': 'application/octet-stream',
        'TTL': '86400',
        'Urgency': 'normal'
      },
      body: encrypted.body
    });

    const responseBody = response.ok ? '' : await response.text().catch(() => '');
    const success = response.status >= 200 && response.status < 300;

    // If 410 Gone, subscription expired — deactivate it
    if (response.status === 410 || response.status === 404) {
      await query(QUERIES.deactivatePushSubscription, [subscription.id]).catch(err => console.error('[PUSH] Failed to deactivate subscription:', err.message));
      console.log(`[PUSH] Subscription ${subscription.id} expired, deactivated`);
    }
    
    // Log notification result
    await query(QUERIES.insertPushNotificationFull, [
      subscription.id,
      subscription.user_id || 0,
      notification.data?.type || 'unknown',
      notification.title,
      notification.body,
      notification.icon || null,
      notification.badge || null,
      notification.tag || null,
      JSON.stringify(notification.data || {}),
      response.status,
      responseBody || null,
      success
    ]);

    return success;
  } catch (error) {
    console.error('[PUSH] Send notification error:', error);
    
    // Log failed notification
    try {
      const query = createQueryFn(env.NEON_CONNECTION_STRING);
      await query(QUERIES.insertPushNotification, [
        subscription.id,
        subscription.user_id || 0,
        notification.data?.type || 'unknown',
        notification.title,
        notification.body,
        500,
        error.message,
        false
      ]);
    } catch (logError) {
      console.error('[PUSH] Failed to log notification error:', logError);
    }
    
    return false;
  }
}

/**
 * Send notification to all of a user's active subscriptions
 * 
 * @param {object} env - Worker environment
 * @param {number} userId - User ID
 * @param {string} notificationType - Type of notification
 * @param {object} notification - Notification payload
 * @returns {number} - Number of successful sends
 */
export async function sendNotificationToUser(env, userId, notificationType, notification) {
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    // Check user's notification preferences
    const { rows: prefRows } = await query(QUERIES.getNotificationPreferences, [userId]);
    const prefs = prefRows[0] || null;

    // Check if user has disabled this notification type
    if (prefs) {
      const typeMap = {
        'transit_daily': 'transit_daily',
        'gate_activation': 'gate_activation',
        'cycle_approaching': 'cycle_approaching',
        'transit_alert': 'transit_alert',
        'weekly_digest': 'weekly_digest'
      };
      
      const prefKey = typeMap[notificationType];
      if (prefKey && prefs[prefKey] === false) {
        console.log(`[PUSH] User ${userId} has disabled ${notificationType} notifications`);
        return 0;
      }

      // Check quiet hours
      if (prefs.quiet_hours_start != null && prefs.quiet_hours_end != null && prefs.timezone) {
        try {
          const now = new Date();
          // Get current hour in user's timezone
          const userHour = parseInt(
            new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: prefs.timezone }).format(now)
          );
          const start = prefs.quiet_hours_start;  // e.g., 22 (10 PM)
          const end = prefs.quiet_hours_end;        // e.g., 7 (7 AM)

          const inQuietHours = start <= end
            ? (userHour >= start && userHour < end)      // e.g., 9-17 (same day)
            : (userHour >= start || userHour < end);     // e.g., 22-7 (overnight)

          if (inQuietHours) {
            console.log(`[PUSH] User ${userId} in quiet hours (${start}:00-${end}:00, current: ${userHour}:00)`);
            return 0;
          }
        } catch (tzError) {
          console.warn(`[PUSH] Quiet hours check failed for user ${userId}:`, tzError.message);
          // Continue sending if timezone conversion fails
        }
      }
    }

    // Get all active subscriptions for user
    const { rows: subRows } = await query(QUERIES.getActivePushSubscriptionsFull, [userId]);

    if (subRows.length === 0) {
      console.log(`[PUSH] No active subscriptions for user ${userId}`);
      return 0;
    }

    // Add notification type to data
    notification.data = notification.data || {};
    notification.data.type = notificationType;

    // Send to all subscriptions
    let successCount = 0;
    for (const sub of subRows) {
      const success = await sendPushNotification(env, sub, notification);
      if (success) successCount++;
    }

    console.log(`[PUSH] Sent ${notificationType} to ${successCount}/${subRows.length} subscriptions for user ${userId}`);
    return successCount;
  } catch (error) {
    console.error(`[PUSH] Error sending notification to user ${userId}:`, error);
    return 0;
  }
}

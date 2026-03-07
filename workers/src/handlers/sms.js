/**
 * SMS Handler — Telnyx Integration
 *
 *   POST /api/sms/webhook     – Inbound Telnyx webhook (incoming SMS)
 *   POST /api/sms/send-digest – Manually trigger digest send for a user
 *
 * Inbound SMS: processes opt-in/out commands, quick queries.
 * Outbound SMS: transit digest delivery via Telnyx REST API.
 */

import { buildDigestPrompt } from '../../../src/prompts/digest.js';
import { calculateFullChart } from '../../../src/engine/index.js';
import { getCurrentTransits } from '../../../src/engine/transits.js';
import { createQueryFn, QUERIES } from '../db/queries.js';
import { callLLM } from '../lib/llm.js';
import { enforceFeatureAccess } from '../middleware/tierEnforcement.js';

// ─── Telnyx Webhook Signature Verification ───────────────────

/**
 * Verify Telnyx webhook signature using their public key.
 * Telnyx signs webhooks with ed25519; headers: telnyx-signature-ed25519 + telnyx-timestamp.
 * @see https://developers.telnyx.com/docs/v2/development/api-guide/webhooks#webhook-signing
 */
async function verifyTelnyxSignature(request, env) {
  const publicKeyBase64 = env.TELNYX_PUBLIC_KEY;
  if (!publicKeyBase64) {
    // If no public key configured, log warning and skip verification
    console.warn('TELNYX_PUBLIC_KEY not configured — skipping webhook verification');
    return true;
  }

  const signature = request.headers.get('telnyx-signature-ed25519');
  const timestamp = request.headers.get('telnyx-timestamp');

  if (!signature || !timestamp) {
    return false;
  }

  // Tolerance: reject events older than 5 minutes (replay protection)
  const tolerance = 300; // seconds
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > tolerance) {
    return false;
  }

  try {
    // Import the ed25519 public key
    const keyBytes = Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'Ed25519', namedCurve: 'Ed25519' },
      false,
      ['verify']
    );

    // Telnyx signs: timestamp + "|" + raw body
    const body = await request.clone().text();
    const signedPayload = `${timestamp}|${body}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(signedPayload);

    // Decode hex signature
    const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));

    return await crypto.subtle.verify('Ed25519', cryptoKey, sigBytes, data);
  } catch (err) {
    console.error('Telnyx signature verification failed:', err);
    return false;
  }
}

// ─── Telnyx API ──────────────────────────────────────────────

/**
 * Send an SMS via Telnyx REST API v2.
 */
async function sendSMS(to, body, env) {
  const apiKey = env.TELNYX_API_KEY;
  const from = env.TELNYX_PHONE_NUMBER;

  if (!apiKey || !from) {
    throw new Error('Telnyx credentials not configured');
  }

  const payload = {
    from,
    to,
    text: body,
    type: 'SMS'
  };

  // Include messaging_profile_id if set (routes via Telnyx connection)
  if (env.TELNYX_CONNECTION_ID) {
    payload.messaging_profile_id = env.TELNYX_CONNECTION_ID;
  }

  const response = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Telnyx send failed: ${response.status} ${err}`);
  }

  return response.json();
}

/**
 * Call LLM for SMS digest generation — with Anthropic → Grok → Groq failover.
 */
async function callDigestLLM(prompt, env) {
  return callLLM(prompt, env);
}

// ─── Route Handler ───────────────────────────────────────────

export async function handleSMS(request, env, path) {
  if (path === '/api/sms/webhook' && request.method === 'POST') {
    return handleWebhook(request, env);
  }

  if (path === '/api/sms/send-digest' && request.method === 'POST') {
    return handleSendDigest(request, env);
  }

  if (path === '/api/sms/subscribe' && request.method === 'POST') {
    // Check if user has SMS digest feature
    const featureCheck = await enforceFeatureAccess(request, env, 'smsDigests');
    if (featureCheck) return featureCheck;
    return handleSubscribe(request, env);
  }

  if (path === '/api/sms/unsubscribe' && request.method === 'POST') {
    return handleUnsubscribe(request, env);
  }

  return Response.json({ error: 'SMS route not found' }, { status: 404 });
}

// ─── Inbound Webhook ─────────────────────────────────────────

/**
 * POST /api/sms/webhook
 *
 * Telnyx sends inbound SMS events here.
 * Processes commands: START, STOP, STATUS, and free-text queries.
 */
async function handleWebhook(request, env) {
  // Verify Telnyx webhook signature
  const isValid = await verifyTelnyxSignature(request, env);
  if (!isValid) {
    return Response.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Telnyx webhook format
  const event = payload.data;
  if (!event || event.event_type !== 'message.received') {
    // Acknowledge non-message events
    return Response.json({ ok: true });
  }

  const inboundPayload = event.payload;
  const from = inboundPayload?.from?.phone_number;
  const text = (inboundPayload?.text || '').trim().toUpperCase();

  if (!from) {
    return Response.json({ ok: true });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  // Command processing
  if (text === 'STOP' || text === 'UNSUBSCRIBE' || text === 'QUIT') {
    // Opt-out: mark user as unsubscribed
    try {
      await query(
        `UPDATE users SET sms_opted_in = false WHERE phone = $1`,
        [from]
      );
      await sendSMS(from, 'You\'ve been unsubscribed from Prime Self transit digests. Text START to re-subscribe.', env);
    } catch (err) {
      console.error('Opt-out error:', err);
    }
    return Response.json({ ok: true, action: 'opt-out' });
  }

  if (text === 'START' || text === 'SUBSCRIBE' || text === 'YES') {
    // Opt-in
    try {
      await query(
        `UPDATE users SET sms_opted_in = true WHERE phone = $1`,
        [from]
      );
      await sendSMS(from, 'Welcome to Prime Self transit digests! You\'ll receive daily transit insights based on your chart. Text STOP to unsubscribe.', env);
    } catch (err) {
      console.error('Opt-in error:', err);
    }
    return Response.json({ ok: true, action: 'opt-in' });
  }

  if (text === 'STATUS' || text === 'TODAY') {
    // Quick status — send today's digest on demand
    try {
      const userResult = await query(QUERIES.getUserByPhone, [from]);
      const user = userResult.rows?.[0];

      if (!user) {
        await sendSMS(from, 'No account found for this number. Visit primeSelf.app to set up your chart.', env);
        return Response.json({ ok: true, action: 'no-user' });
      }

      const digest = await generateDigestForUser(user, env);
      await sendSMS(from, digest, env);
    } catch (err) {
      console.error('Status request error:', err);
      await sendSMS(from, 'Unable to generate your transit update right now. Try again later.', env);
    }
    return Response.json({ ok: true, action: 'status' });
  }

  // Unknown command — acknowledge
  try {
    await sendSMS(from, 'Prime Self: Text TODAY for your transit update, or STOP to unsubscribe.', env);
  } catch (err) {
    console.error('Reply error:', err);
  }

  return Response.json({ ok: true, action: 'unknown-command' });
}

// ─── Digest Sending ──────────────────────────────────────────

/**
 * POST /api/sms/send-digest
 *
 * Manually trigger a digest send for a specific user or all subscribed users.
 *
 * Body: { userId?: string, phone?: string, all?: boolean }
 */
async function handleSendDigest(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }
  
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  if (body.all) {
    // Require practitioner tier or above for mass SMS
    const userTier = request._user?.tier || request._tier || 'free';
    if (!['practitioner', 'admin'].includes(userTier)) {
      return Response.json(
        { error: 'Mass SMS requires practitioner tier or above' },
        { status: 403 }
      );
    }
    // Send to all opted-in users
    const usersResult = await query(
      `SELECT * FROM users WHERE sms_opted_in = true AND phone IS NOT NULL`
    );

    const users = usersResult.rows || [];
    let sent = 0, failed = 0;

    for (const user of users) {
      try {
        const digest = await generateDigestForUser(user, env);
        await sendSMS(user.phone, digest, env);
        sent++;
      } catch (err) {
        console.error(`Digest send failed for ${user.phone}:`, err);
        failed++;
      }
    }

    return Response.json({
      ok: true,
      sent,
      failed,
      total: users.length
    });
  }

  if (body.userId || body.phone) {
    // Single user
    const sql = body.userId ? QUERIES.getUserById : QUERIES.getUserByPhone;
    const param = body.userId || body.phone;
    const userResult = await query(sql, [param]);
    const user = userResult.rows?.[0];

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.phone) {
      return Response.json({ error: 'User has no phone number' }, { status: 400 });
    }

    const digest = await generateDigestForUser(user, env);
    await sendSMS(user.phone, digest, env);

    return Response.json({
      ok: true,
      phone: user.phone,
      digest
    });
  }

  return Response.json(
    { error: 'Provide userId, phone, or all:true' },
    { status: 400 }
  );
}

/**
 * Generate a transit digest for a specific user.
 */
async function generateDigestForUser(user, env) {
  // Parse user birth data
  const [year, month, day] = String(user.birth_date).split('-').map(Number);
  const [hour, minute] = String(user.birth_time || '12:00').split(':').map(Number);
  const lat = parseFloat(user.birth_lat);
  const lng = parseFloat(user.birth_lng);

  // Calculate their chart + current transits
  const chart = calculateFullChart({
    year, month, day, hour, minute, second: 0,
    lat, lng,
    includeTransits: true
  });

  // Build digest prompt
  const prompt = buildDigestPrompt(chart, chart.transits);

  // Call Haiku
  let digestText = await callDigestLLM(prompt, env);

  // Enforce character limit
  if (digestText.length > 320) {
    digestText = digestText.substring(0, 317) + '...';
  }

  return digestText;
}

/**
 * POST /api/sms/subscribe
 *
 * Subscribe to SMS digests via HTTP API (web/app-based).
 * Body: { phone } - E.164 format (e.g., +14155551234)
 * Requires authentication.
 */
async function handleSubscribe(request, env) {
  const userId = request._user?.sub;  // BL-R-H5: JWT payload uses 'sub', not 'userId'
  
  if (!userId) {
    return Response.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { phone } = body;

  if (!phone) {
    return Response.json(
      { error: 'Missing required field: phone' },
      { status: 400 }
    );
  }

  // Validate E.164 format
  if (!/^\+[1-9]\d{1,14}$/.test(phone)) {
    return Response.json(
      { error: 'Invalid phone format. Use E.164 format (e.g., +14155551234)' },
      { status: 400 }
    );
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    
    // Update user's phone and SMS opt-in status
    await query(
      `UPDATE users 
       SET phone = $1, sms_opted_in = true 
       WHERE id = $2`,
      [phone, userId]
    );

    // Send confirmation SMS
    if (env.TELNYX_API_KEY) {
      try {
        await sendSMS(
          phone,
          'You\'re now subscribed to Prime Self daily transit digests! Text STOP anytime to unsubscribe.',
          env
        );
      } catch (smsErr) {
        // Log but don't fail the subscription if SMS fails
        console.error('Confirmation SMS failed:', smsErr);
      }
    }

    return Response.json({
      ok: true,
      message: 'Successfully subscribed to SMS digests',
      phone
    });
  } catch (err) {
    console.error('SMS subscribe error:', err);
    return Response.json(
      { error: 'Failed to subscribe' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sms/unsubscribe
 *
 * Unsubscribe from SMS digests via HTTP API.
 * Requires authentication.
 */
async function handleUnsubscribe(request, env) {
  const userId = request._user?.sub;  // BL-R-H5: JWT payload uses 'sub', not 'userId'
  
  if (!userId) {
    return Response.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    
    // Get user's phone for confirmation SMS
    const userResult = await query(
      `SELECT phone FROM users WHERE id = $1`,
      [userId]
    );

    const phone = userResult.rows?.[0]?.phone;

    // Update SMS opt-in status
    await query(
      `UPDATE users 
       SET sms_opted_in = false 
       WHERE id = $1`,
      [userId]
    );

    // Send confirmation SMS if phone exists
    if (phone && env.TELNYX_API_KEY) {
      try {
        await sendSMS(
          phone,
          'You\'ve been unsubscribed from Prime Self transit digests. Text START anytime to re-subscribe.',
          env
        );
      } catch (smsErr) {
        // Log but don't fail the unsubscribe if SMS fails
        console.error('Confirmation SMS failed:', smsErr);
      }
    }

    return Response.json({
      ok: true,
      message: 'Successfully unsubscribed from SMS digests'
    });
  } catch (err) {
    console.error('SMS unsubscribe error:', err);
    return Response.json(
      { error: 'Failed to unsubscribe' },
      { status: 500 }
    );
  }
}

// Export for cron usage
export { generateDigestForUser, sendSMS };

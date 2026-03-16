/**
 * Webhook Management Handler
 * 
 * Routes:
 *   POST   /api/webhooks          - Register new webhook
 *   GET    /api/webhooks          - List user's webhooks
 *   GET    /api/webhooks/:id      - Get webhook details
 *   DELETE /api/webhooks/:id      - Delete webhook
 *   POST   /api/webhooks/:id/test - Test webhook delivery
 *   GET    /api/webhooks/:id/deliveries - View delivery history
 */

import { getUserFromRequest } from '../middleware/auth.js';
import { createQueryFn, QUERIES } from '../db/queries.js';
import { enforceFeatureAccess } from '../middleware/tierEnforcement.js';
import { dispatchWebhookEvent } from '../lib/webhookDispatcher.js';
import { reportHandledRouteError } from '../lib/routeErrors.js';

/**
 * Main webhook handler router
 */
export async function handleWebhooks(request, env, path) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const method = request.method;

  // POST /api/webhooks - Register new webhook
  if (path === '/' && method === 'POST') {
    return registerWebhook(request, env, user);
  }

  // GET /api/webhooks - List webhooks
  if (path === '/' && method === 'GET') {
    return listWebhooks(request, env, user);
  }

  // GET /api/webhooks/:id - Get webhook details
  if (path.match(/^\/[a-f0-9-]+$/) && method === 'GET') {
    const webhookId = path.slice(1);
    return getWebhook(request, env, user, webhookId);
  }

  // DELETE /api/webhooks/:id - Delete webhook
  if (path.match(/^\/[a-f0-9-]+$/) && method === 'DELETE') {
    const webhookId = path.slice(1);
    return deleteWebhook(request, env, user, webhookId);
  }

  // POST /api/webhooks/:id/test - Test webhook
  if (path.match(/^\/[a-f0-9-]+\/test$/) && method === 'POST') {
    const webhookId = path.split('/')[1];
    return testWebhook(request, env, user, webhookId);
  }

  // GET /api/webhooks/:id/deliveries - Delivery history
  if (path.match(/^\/[a-f0-9-]+\/deliveries$/) && method === 'GET') {
    const webhookId = path.split('/')[1];
    return getDeliveryHistory(request, env, user, webhookId);
  }

  return Response.json({ ok: false, error: 'Not found' }, { status: 404 });
}

/**
 * POST /api/webhooks - Register new webhook
 * 
 * Body: {
 *   url: string (HTTPS only),
 *   events: string[] (e.g., ['chart.created', 'profile.generated'])
 * }
 */
async function registerWebhook(request, env, user) {
  // Enforce Practitioner tier (webhooks are a premium feature)
  // BL-FIX: enforceFeatureAccess expects (request, env, feature) — not (user, feature)
  const tierCheck = await enforceFeatureAccess(request, env, 'practitionerTools');
  if (tierCheck) return tierCheck;

  try {
    const body = await request.json();
    const { url, events } = body;

    // Validate URL
    if (!url || !url.startsWith('https://')) {
      return Response.json({
        ok: false,
        error: 'Invalid URL. Webhook URLs must use HTTPS.'
      }, { status: 400 });
    }

    if (url.length > 2048) {
      return Response.json({
        ok: false,
        error: 'URL exceeds maximum length of 2048 characters'
      }, { status: 400 });
    }

    // Validate events array
    const validEvents = [
      'chart.created',
      'chart.updated',
      'profile.generated',
      'transit.alert',
      'client.added',
      'client.removed',
      'subscription.updated',
      'cycle.approaching'
    ];

    if (!events || !Array.isArray(events) || events.length === 0) {
      return Response.json({
        ok: false,
        error: 'Events array is required and must not be empty.',
        validEvents
      }, { status: 400 });
    }

    const invalidEvents = events.filter(e => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      return Response.json({
        ok: false,
        error: 'Invalid event types',
        invalidEvents,
        validEvents
      }, { status: 400 });
    }

    // Generate random secret for HMAC signatures
    const secretBytes = new Uint8Array(32);
    crypto.getRandomValues(secretBytes);
    const secret = Array.from(secretBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    // Create webhook
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const { rows } = await query(QUERIES.insertWebhook, [
      user.id,
      url,
      JSON.stringify(events),
      secret
    ]);
    const result = rows[0];

    return Response.json({
      ok: true,
      webhook: {
        id: result.id,
        url: result.url,
        events: typeof result.events === 'string' ? JSON.parse(result.events) : result.events,
        secret: result.secret,
        active: result.active,
        createdAt: result.created_at
      },
      message: 'Webhook registered successfully. Save your secret for signature verification.'
    });

  } catch (error) {
    return reportHandledRouteError({
      request,
      env,
      error,
      source: 'webhooks_register',
      fallbackMessage: 'Failed to register webhook',
      extra: { userId: user.id, webhookAction: 'register' },
    });
  }
}

/**
 * GET /api/webhooks - List user's webhooks
 */
async function listWebhooks(request, env, user) {
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const { rows } = await query(QUERIES.listWebhooks, [user.id]);

    return Response.json({
      ok: true,
      webhooks: rows.map(w => ({
        id: w.id,
        url: w.url,
        events: typeof w.events === 'string' ? JSON.parse(w.events) : w.events,
        active: w.active,
        createdAt: w.created_at,
        stats: {
          totalDeliveries: w.delivery_count,
          successfulDeliveries: w.successful_count,
          successRate: w.delivery_count > 0 
            ? Math.round((w.successful_count / w.delivery_count) * 100) 
            : null
        }
      }))
    });

  } catch (error) {
    return reportHandledRouteError({
      request,
      env,
      error,
      source: 'webhooks_list',
      fallbackMessage: 'Failed to list webhooks',
      extra: { userId: user.id, webhookAction: 'list' },
    });
  }
}

/**
 * GET /api/webhooks/:id - Get webhook details
 */
async function getWebhook(request, env, user, webhookId) {
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const { rows } = await query(QUERIES.getWebhookById, [webhookId, user.id]);
    const webhook = rows[0] || null;

    if (!webhook) {
      return Response.json({
        ok: false,
        error: 'Webhook not found'
      }, { status: 404 });
    }

    return Response.json({
      ok: true,
      webhook: {
        id: webhook.id,
        url: webhook.url,
        events: typeof webhook.events === 'string' ? JSON.parse(webhook.events) : webhook.events,
        // BL-R-H4: secret omitted — HMAC signing secret shown once at creation only
        active: webhook.active,
        createdAt: webhook.created_at
      }
    });

  } catch (error) {
    return reportHandledRouteError({
      request,
      env,
      error,
      source: 'webhooks_get',
      fallbackMessage: 'Failed to get webhook',
      extra: { userId: user.id, webhookId, webhookAction: 'get' },
    });
  }
}

/**
 * DELETE /api/webhooks/:id - Delete webhook
 */
async function deleteWebhook(request, env, user, webhookId) {
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const { rows } = await query(QUERIES.deleteWebhook, [webhookId, user.id]);

    if (rows.length === 0) {
      return Response.json({
        ok: false,
        error: 'Webhook not found'
      }, { status: 404 });
    }

    return Response.json({
      ok: true,
      message: 'Webhook deleted successfully'
    });

  } catch (error) {
    return reportHandledRouteError({
      request,
      env,
      error,
      source: 'webhooks_delete',
      fallbackMessage: 'Failed to delete webhook',
      extra: { userId: user.id, webhookId, webhookAction: 'delete' },
    });
  }
}

/**
 * POST /api/webhooks/:id/test - Send test event
 */
async function testWebhook(request, env, user, webhookId) {
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const { rows } = await query(QUERIES.getWebhookForTest, [webhookId, user.id]);
    const webhook = rows[0] || null;

    if (!webhook) {
      return Response.json({
        ok: false,
        error: 'Webhook not found'
      }, { status: 404 });
    }

    // Dispatch test event

    // Send test event
    await dispatchWebhookEvent(env, {
      userId: user.id,
      eventType: 'webhook.test',
      payload: {
        message: 'This is a test webhook delivery from Prime Self',
        timestamp: new Date().toISOString(),
        webhookId: webhook.id
      }
    });

    return Response.json({
      ok: true,
      message: 'Test webhook dispatched. Check your endpoint logs.'
    });

  } catch (error) {
    return reportHandledRouteError({
      request,
      env,
      error,
      source: 'webhooks_test',
      fallbackMessage: 'Failed to send test webhook',
      extra: { userId: user.id, webhookId, webhookAction: 'test' },
    });
  }
}

/**
 * GET /api/webhooks/:id/deliveries - Get delivery history
 */
async function getDeliveryHistory(request, env, user, webhookId) {
  try {
    // Verify webhook ownership
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const { rows: webhookRows } = await query(QUERIES.checkWebhookOwnership, [webhookId, user.id]);

    if (webhookRows.length === 0) {
      return Response.json({
        ok: false,
        error: 'Webhook not found'
      }, { status: 404 });
    }

    // Get deliveries with pagination
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 100);  // BL-R-M15
    const offset = Math.min(parseInt(url.searchParams.get('offset')) || 0, 10000);  // BL-R-M15

    const { rows: deliveryRows } = await query(QUERIES.getWebhookDeliveries, [webhookId, limit, offset]);

    const { rows: totalRows } = await query(QUERIES.countWebhookDeliveries, [webhookId]);
    const total = totalRows[0];

    return Response.json({
      ok: true,
      deliveries: deliveryRows.map(d => ({
        id: d.id,
        eventType: d.event_type,
        status: d.response_status,
        deliveredAt: d.delivered_at,
        attempts: d.attempts,
        createdAt: d.created_at,
        success: d.response_status >= 200 && d.response_status < 300
      })),
      pagination: {
        total: total.count,
        limit,
        offset,
        hasMore: offset + limit < total.count
      }
    });

  } catch (error) {
    return reportHandledRouteError({
      request,
      env,
      error,
      source: 'webhooks_deliveries',
      fallbackMessage: 'Failed to get delivery history',
      extra: { userId: user.id, webhookId, webhookAction: 'deliveries' },
    });
  }
}

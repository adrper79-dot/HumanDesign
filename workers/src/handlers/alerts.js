/**
 * Transit Alert Management
 * Allows users to create, manage, and monitor custom transit alerts
 * 
 * Endpoints:
 * - GET /api/alerts - List user's alerts
 * - POST /api/alerts - Create new alert
 * - GET /api/alerts/:id - Get alert details
 * - PUT /api/alerts/:id - Update alert
 * - DELETE /api/alerts/:id - Delete alert
 * - GET /api/alerts/templates - List alert templates
 * - POST /api/alerts/from-template/:id - Create alert from template
 * - GET /api/alerts/history - Get alert delivery history
 */

import { getUserFromRequest } from '../middleware/auth.js';
import { createQueryFn, QUERIES } from '../db/queries.js';
import { dispatchWebhookEvent } from '../lib/webhookDispatcher.js';
import { sendNotificationToUser } from './push.js';
import { normalizeTierName } from '../lib/stripe.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('alerts');

/**
 * Main handler for alert routes
 */
export async function handleAlerts(request, env, path) {
  const method = request.method;

  // All routes require authentication
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Route handlers
  if (path === '/' && method === 'GET') {
    return listAlerts(request, env, user);
  } else if (path === '/' && method === 'POST') {
    return createAlert(request, env, user);
  } else if (path === '/templates' && method === 'GET') {
    return listTemplates(request, env, user);
  } else if (path.match(/^\/from-template\/[a-f0-9-]+$/) && method === 'POST') {
    const templateId = path.split('/')[2];
    return createAlertFromTemplate(request, env, user, templateId);
  } else if (path === '/history' && method === 'GET') {
    return getAlertHistory(request, env, user);
  } else if (path.match(/^\/[a-f0-9-]+$/) && method === 'GET') {
    const alertId = path.substring(1);
    return getAlert(request, env, user, alertId);
  } else if (path.match(/^\/[a-f0-9-]+$/) && method === 'PUT') {
    const alertId = path.substring(1);
    return updateAlert(request, env, user, alertId);
  } else if (path.match(/^\/[a-f0-9-]+$/) && method === 'DELETE') {
    const alertId = path.substring(1);
    return deleteAlert(request, env, user, alertId);
  }

  return new Response(JSON.stringify({ ok: false, error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * List user's alerts
 */
async function listAlerts(request, env, user) {
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const { rows } = await query(QUERIES.listUserAlerts, [user.id]);

    return Response.json({
      ok: true,
      alerts: rows.map(a => ({
        id: a.id,
        type: a.alert_type,
        config: typeof a.config === 'string' ? JSON.parse(a.config) : a.config,
        name: a.name,
        description: a.description,
        active: a.active,
        notifyPush: a.notify_push,
        notifyWebhook: a.notify_webhook,
        createdAt: a.created_at,
        stats: {
          triggerCount: a.trigger_count,
          lastTriggered: a.last_triggered
        }
      })),
      count: rows.length
    });
  } catch (error) {
    createLogger('alerts').error('list_error', { error: error?.message || String(error) });
    return Response.json({
      ok: false,
      error: 'Failed to list alerts'
    }, { status: 500 });
  }
}

/**
 * Create new alert
 */
async function createAlert(request, env, user) {
  try {
    const { type, config, name, description, notifyPush, notifyWebhook } = await request.json();

    // Input length validation
    if (name && typeof name === 'string' && name.length > 200) {
      return Response.json({ ok: false, error: 'name exceeds maximum length of 200 characters' }, { status: 400 });
    }
    if (description && typeof description === 'string' && description.length > 1000) {
      return Response.json({ ok: false, error: 'description exceeds maximum length of 1000 characters' }, { status: 400 });
    }

    // Validate alert type
    const validTypes = ['gate_activation', 'aspect', 'cycle', 'gate_deactivation'];
    if (!validTypes.includes(type)) {
      return Response.json({
        ok: false,
        error: 'Invalid alert type',
        validTypes
      }, { status: 400 });
    }

    // Validate config based on type
    const configError = validateAlertConfig(type, config);
    if (configError) {
      return Response.json({
        ok: false,
        error: configError
      }, { status: 400 });
    }

    // Check alert limit per tier — normalize to handle legacy aliases
    // (e.g. 'guide' → 'practitioner', 'studio' / 'white_label' → 'agency')
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const { rows: countRows } = await query(QUERIES.countUserAlerts, [user.id]);
    const existingCount = countRows[0];

    const canonicalTier = normalizeTierName(user.tier);
    const tierLimits = { free: 3, individual: 10, practitioner: 25, agency: Infinity };
    const limit = tierLimits[canonicalTier] ?? 3;

    if (existingCount.count >= limit) {
      return Response.json({
        ok: false,
        error: `Alert limit reached for ${user.tier} tier`,
        limit,
        current: existingCount.count
      }, { status: 403 });
    }

    // Insert alert
    const { rows: insertRows } = await query(QUERIES.insertAlert, [
      user.id,
      type,
      JSON.stringify(config),
      name || null,
      description || null,
      notifyPush !== false,
      notifyWebhook === true
    ]);
    const result = insertRows[0];

    log.info('alert_created', { alertId: result.id, userId: user.id, type });

    return Response.json({
      ok: true,
      alert: {
        id: result.id,
        type: result.alert_type,
        config: typeof result.config === 'string' ? JSON.parse(result.config) : result.config,
        name: result.name,
        description: result.description,
        notifyPush: result.notify_push,
        notifyWebhook: result.notify_webhook,
        active: result.active,
        createdAt: result.created_at
      }
    });
  } catch (error) {
    createLogger('alerts').error('create_error', { error: error?.message || String(error) });
    return Response.json({
      ok: false,
      error: 'Failed to create alert'
    }, { status: 500 });
  }
}

/**
 * Get single alert
 */
async function getAlert(request, env, user, alertId) {
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const { rows } = await query(QUERIES.getAlertById, [alertId, user.id]);
    const alert = rows[0] || null;

    if (!alert) {
      return Response.json({
        ok: false,
        error: 'Alert not found'
      }, { status: 404 });
    }

    return Response.json({
      ok: true,
      alert: {
        id: alert.id,
        type: alert.alert_type,
        config: typeof alert.config === 'string' ? JSON.parse(alert.config) : alert.config,
        name: alert.name,
        description: alert.description,
        notifyPush: alert.notify_push,
        notifyWebhook: alert.notify_webhook,
        active: alert.active,
        createdAt: alert.created_at
      }
    });
  } catch (error) {
    createLogger('alerts').error('get_error', { alertId, error: error?.message || String(error) });
    return Response.json({
      ok: false,
      error: 'Failed to get alert'
    }, { status: 500 });
  }
}

/**
 * Update alert
 */
async function updateAlert(request, env, user, alertId) {
  try {
    const updates = await request.json();
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // DYNAMIC: builds SET clause at runtime — cannot centralise into QUERIES
    // Build dynamic UPDATE query
    const fields = [];
    const values = [];
    let paramIdx = 1;

    if (updates.config) {
      const configError = validateAlertConfig(updates.type, updates.config);
      if (configError) {
        return Response.json({ ok: false, error: configError }, { status: 400 });
      }
      fields.push(`config = $${paramIdx++}`);
      values.push(JSON.stringify(updates.config));
    }
    if (updates.name !== undefined) {
      fields.push(`name = $${paramIdx++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramIdx++}`);
      values.push(updates.description);
    }
    if (typeof updates.active === 'boolean') {
      fields.push(`active = $${paramIdx++}`);
      values.push(updates.active);
    }
    if (typeof updates.notifyPush === 'boolean') {
      fields.push(`notify_push = $${paramIdx++}`);
      values.push(updates.notifyPush);
    }
    if (typeof updates.notifyWebhook === 'boolean') {
      fields.push(`notify_webhook = $${paramIdx++}`);
      values.push(updates.notifyWebhook);
    }

    if (fields.length === 0) {
      return Response.json({
        ok: false,
        error: 'No valid fields to update'
      }, { status: 400 });
    }

    fields.push('updated_at = NOW()');
    values.push(alertId, user.id);

    const { rows } = await query(`
      UPDATE transit_alerts
      SET ${fields.join(', ')}
      WHERE id = $${paramIdx++} AND user_id = $${paramIdx++}
      RETURNING id
    `, values);

    if (rows.length === 0) {
      return Response.json({
        ok: false,
        error: 'Alert not found'
      }, { status: 404 });
    }

    log.info('alert_updated', { alertId, userId: user.id });

    return Response.json({
      ok: true,
      message: 'Alert updated successfully'
    });
  } catch (error) {
    createLogger('alerts').error('update_error', { alertId, error: error?.message || String(error) });
    return Response.json({
      ok: false,
      error: 'Failed to update alert'
    }, { status: 500 });
  }
}

/**
 * Delete alert
 */
async function deleteAlert(request, env, user, alertId) {
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const { rows } = await query(QUERIES.deleteAlert, [alertId, user.id]);

    if (rows.length === 0) {
      return Response.json({
        ok: false,
        error: 'Alert not found'
      }, { status: 404 });
    }

    log.info('alert_deleted', { alertId, userId: user.id });

    return Response.json({
      ok: true,
      message: 'Alert deleted successfully'
    });
  } catch (error) {
    createLogger('alerts').error('delete_error', { alertId, error: error?.message || String(error) });
    return Response.json({
      ok: false,
      error: 'Failed to delete alert'
    }, { status: 500 });
  }
}

/**
 * List alert templates
 */
async function listTemplates(request, env, user) {
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    // Get user's natal chart to personalize templates
    const { rows: chartRows } = await query(QUERIES.getLatestChart, [user.id]);
    const chart = chartRows[0] || null;

    const chartData = chart ? (typeof chart.hd_json === 'string' ? JSON.parse(chart.hd_json) : chart.hd_json) : null;
    const natalGates = chartData ? chartData.gates : {};

    // Get templates appropriate for user's tier
    const { rows: templateRows } = await query(QUERIES.getAlertTemplates, [user.tier || 'free']);

    return Response.json({
      ok: true,
      templates: templateRows.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        type: t.alert_type,
        config: personalizeTemplate(typeof t.config_template === 'string' ? JSON.parse(t.config_template) : t.config_template, natalGates),
        tierRequired: t.tier_required,
        popularity: t.popularity
      }))
    });
  } catch (error) {
    createLogger('alerts').error('list_templates_error', { error: error?.message || String(error) });
    return Response.json({
      ok: false,
      error: 'Failed to list templates'
    }, { status: 500 });
  }
}

/**
 * Create alert from template
 */
async function createAlertFromTemplate(request, env, user, templateId) {
  try {
    // Get template
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const { rows: templateRows } = await query(QUERIES.getAlertTemplateById, [templateId]);
    const template = templateRows[0] || null;

    if (!template) {
      return Response.json({
        ok: false,
        error: 'Template not found'
      }, { status: 404 });
    }

    // Check tier requirement — normalize to handle legacy aliases
    const tierHierarchy = { free: 0, individual: 1, practitioner: 2, agency: 3 };
    const requiredTier = tierHierarchy[normalizeTierName(template.tier_required)] ?? 0;
    const userTier = tierHierarchy[normalizeTierName(user.tier)] ?? 0;

    if (userTier < requiredTier) {
      return Response.json({
        ok: false,
        error: `This template requires ${template.tier_required} tier`,
        requiredTier: template.tier_required,
        currentTier: user.tier
      }, { status: 403 });
    }

    // Get user's natal chart
    const { rows: chartRows } = await query(QUERIES.getLatestChart, [user.id]);
    const chart = chartRows[0] || null;

    if (!chart) {
      return Response.json({
        ok: false,
        error: 'Natal chart required to create alert from template'
      }, { status: 400 });
    }

    const chartData = typeof chart.hd_json === 'string' ? JSON.parse(chart.hd_json) : chart.hd_json;
    const natalGates = chartData.gates;

    // Personalize template config
    const templateConfig = typeof template.config_template === 'string' ? JSON.parse(template.config_template) : template.config_template;
    const config = personalizeTemplate(templateConfig, natalGates);

    // Create alert
    const { rows: insertRows } = await query(QUERIES.insertAlert, [
      user.id,
      template.alert_type,
      JSON.stringify(config),
      template.name,
      template.description,
      true,
      false
    ]);
    const result = insertRows[0];

    // Increment template popularity
    await query(QUERIES.incrementTemplatePopularity, [templateId]);

    log.info('alert_created_from_template', { templateId, userId: user.id });

    return Response.json({
      ok: true,
      alert: {
        id: result.id,
        type: result.alert_type,
        config: typeof result.config === 'string' ? JSON.parse(result.config) : result.config,
        name: result.name,
        createdAt: result.created_at
      }
    });
  } catch (error) {
    createLogger('alerts').error('create_from_template_error', { templateId, error: error?.message || String(error) });
    return Response.json({
      ok: false,
      error: 'Failed to create alert from template'
    }, { status: 500 });
  }
}

/**
 * Get alert delivery history
 */
async function getAlertHistory(request, env, user) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 100);  // BL-R-M15
    const offset = Math.min(parseInt(url.searchParams.get('offset')) || 0, 10000);  // BL-R-M15

    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    const { rows: deliveryRows } = await query(QUERIES.getAlertDeliveryHistory, [user.id, limit, offset]);

    const { rows: totalRows } = await query(QUERIES.countAlertDeliveries, [user.id]);
    const total = totalRows[0];

    return Response.json({
      ok: true,
      deliveries: deliveryRows.map(d => ({
        id: d.id,
        triggeredAt: d.triggered_at,
        triggerDate: d.trigger_date,
        type: d.alert_type,
        config: typeof d.config === 'string' ? JSON.parse(d.config) : d.config,
        transitData: d.transit_data ? (typeof d.transit_data === 'string' ? JSON.parse(d.transit_data) : d.transit_data) : null,
        pushSent: d.push_sent,
        webhookSent: d.webhook_sent,
        alertName: d.alert_name
      })),
      pagination: {
        total: total.count,
        limit,
        offset,
        hasMore: offset + limit < total.count
      }
    });
  } catch (error) {
    createLogger('alerts').error('history_error', { error: error?.message || String(error) });
    return Response.json({
      ok: false,
      error: 'Failed to get alert history'
    }, { status: 500 });
  }
}

/**
 * Validate alert configuration
 */
function validateAlertConfig(type, config) {
  if (!config) return 'Config is required';

  switch (type) {
    case 'gate_activation':
    case 'gate_deactivation':
      if (!config.gate || config.gate < 1 || config.gate > 64) {
        return 'Valid gate number (1-64) required';
      }
      if (!config.planet) {
        return 'Planet is required';
      }
      break;

    case 'aspect':
      if (!config.planet || !config.natalPlanet) {
        return 'Both planet and natalPlanet required';
      }
      const validAspects = ['conjunction', 'opposition', 'trine', 'square', 'sextile'];
      if (!validAspects.includes(config.aspect)) {
        return `Aspect must be one of: ${validAspects.join(', ')}`;
      }
      break;

    case 'cycle':
      if (!config.cycle) {
        return 'Cycle name is required';
      }
      break;

    default:
      return 'Invalid alert type';
  }

  return null;
}

/**
 * Personalize template config with user's natal data
 */
function personalizeTemplate(template, natalGates) {
  // Replace placeholders like {{natal_mars_gate}}
  const placeholderRegex = /\{\{([^}]+)\}\}/g;

  // BL-R-M16: JSON.stringify replacer produces a new string — parse it back
  const serialized = JSON.stringify(template, (key, value) => {
    if (typeof value === 'string') {
      return value.replace(placeholderRegex, (match, placeholder) => {
        if (placeholder === 'natal_mars_gate') {
          return natalGates?.mars?.gate || 34; // Default to Gate 34 if not found
        }
        if (placeholder === 'natal_sun_gate') {
          return natalGates?.sun?.gate || 1;
        }
        // Add more placeholder types as needed
        return match;
      });
    }
    return value;
  });

  return JSON.parse(serialized);
}

/**
 * Evaluate all active alerts for a user (called by cron)
 */
export async function evaluateUserAlerts(env, user, transitGates, transitPositions, today) {
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    // Get user's active alerts
    const { rows: alertRows } = await query(QUERIES.getUserActiveAlerts, [user.id]);

    for (const alert of alertRows) {
      const config = typeof alert.config === 'string' ? JSON.parse(alert.config) : alert.config;
      let triggered = false;
      let transitData = {};

      // Evaluate based on alerttype
      switch (alert.alert_type) {
        case 'gate_activation':
          const planetGate = transitGates[config.planet.toLowerCase()];
          if (planetGate && planetGate.gate === config.gate) {
            triggered = true;
            transitData = { planet: config.planet, gate: config.gate, position: transitPositions[config.planet.toLowerCase()] };
          }
          break;

        case 'aspect': {
          // Requires natal planet longitude from user's chart
          // config: { transitPlanet, natalPlanet, aspectType, orb }
          // Aspect types: conjunction (0°), opposition (180°), trine (120°), square (90°), sextile (60°)
          const aspectAngles = { conjunction: 0, opposition: 180, trine: 120, square: 90, sextile: 60 };
          const targetAngle = aspectAngles[config.aspectType];
          if (targetAngle == null) break;

          const transitLon = transitPositions[config.transitPlanet?.toLowerCase()]?.longitude;
          if (transitLon == null) break;

          // Get natal planet longitude from user's chart
          if (!user._natalPositions) {
            const { rows: chartRows } = await query(QUERIES.getLatestChart, [user.id]);
            const chartData = chartRows[0]?.hd_json;
            const parsed = chartData ? (typeof chartData === 'string' ? JSON.parse(chartData) : chartData) : null;
            user._natalPositions = parsed?.planets || {};  // Cache on user object for this eval cycle
          }

          const natalLon = user._natalPositions[config.natalPlanet?.toLowerCase()]?.longitude;
          if (natalLon == null) break;

          // Calculate angular separation and check orb (default ±2°)
          const orb = config.orb || 2;
          let separation = Math.abs(transitLon - natalLon);
          if (separation > 180) separation = 360 - separation;
          const diff = Math.abs(separation - targetAngle);

          if (diff <= orb) {
            triggered = true;
            transitData = {
              transitPlanet: config.transitPlanet,
              natalPlanet: config.natalPlanet,
              aspectType: config.aspectType,
              exactAngle: targetAngle,
              actualSeparation: separation,
              orb: diff
            };
          }
          break;
        }

        case 'cycle': {
          // Planetary return / cycle alerts
          // config: { cycleType, planet, orb }
          // cycleType: 'return' (transit conjunct natal), 'opposition' (transit opposite natal)
          const cyclePlanet = (config.planet || '').toLowerCase();
          const transitLonC = transitPositions[cyclePlanet]?.longitude;
          if (transitLonC == null) break;

          // Get natal position
          if (!user._natalPositions) {
            const { rows: chartRows } = await query(QUERIES.getLatestChart, [user.id]);
            const chartData = chartRows[0]?.hd_json;
            const parsed = chartData ? (typeof chartData === 'string' ? JSON.parse(chartData) : chartData) : null;
            user._natalPositions = parsed?.planets || {};
          }

          const natalLonC = user._natalPositions[cyclePlanet]?.longitude;
          if (natalLonC == null) break;

          const cycleAngle = config.cycleType === 'opposition' ? 180 : 0;  // Return = conjunction
          const orbC = config.orb || 3;  // Wider orb for cycles
          let sepC = Math.abs(transitLonC - natalLonC);
          if (sepC > 180) sepC = 360 - sepC;
          const diffC = Math.abs(sepC - cycleAngle);

          if (diffC <= orbC) {
            triggered = true;
            transitData = {
              planet: config.planet,
              cycleType: config.cycleType || 'return',
              exactAngle: cycleAngle,
              actualSeparation: sepC,
              orb: diffC
            };
          }
          break;
        }

        case 'gate_deactivation':
          // Check if planet is NOT in the gate anymore (requires state tracking)
          break;
      }

      if (triggered) {
        // Check if already delivered today
        const { rows: existingRows } = await query(QUERIES.checkAlertDeliveredToday, [alert.id, today]);
        const existing = existingRows[0] || null;

        if (!existing) {
          // Record delivery
          const { rows: deliveryRows } = await query(QUERIES.insertAlertDelivery, [
            alert.id,
            user.id,
            today,
            alert.alert_type,
            typeof alert.config === 'string' ? alert.config : JSON.stringify(alert.config),
            JSON.stringify(transitData)
          ]);
          const delivery = deliveryRows[0];

          // Send notifications
          if (alert.notify_push) {
            // Build alert-type-specific notification body
            let body = '';
            switch (alert.alert_type) {
              case 'gate_activation':
                body = `${config.planet} has entered Gate ${config.gate}!`;
                break;
              case 'aspect':
                body = `${transitData.transitPlanet} is ${transitData.aspectType} your natal ${transitData.natalPlanet} (${transitData.orb.toFixed(1)}° orb)`;
                break;
              case 'cycle':
                body = `${transitData.planet} ${transitData.cycleType === 'return' ? 'return' : 'opposition'} approaching (${transitData.orb.toFixed(1)}° orb)`;
                break;
              default:
                body = `Transit alert triggered`;
            }

            const notification = {
              title: `🔔 ${alert.name || 'Transit Alert'}`,
              body,
              icon: 'https://primeself.app/icon-192.png',
              badge: 'https://primeself.app/badge-72.png',
              tag: `alert-${alert.id}-${today}`,
              data: {
                type: 'transit_alert',
                alertId: alert.id,
                url: '/app/transits'
              }
            };

            const success = await sendNotificationToUser(env, user.id, 'transit_alert', notification);
            
            if (success > 0) {
              await query(QUERIES.markAlertDeliveryPush, [delivery.id]);
            }
          }

          if (alert.notify_webhook) {
            await dispatchWebhookEvent(env, {
              userId: user.id,
              eventType: 'transit.alert',
              payload: {
                alertId: alert.id,
                alertName: alert.name,
                type: alert.alert_type,
                config,
                transitData,
                triggeredAt: new Date().toISOString()
              }
            });

            await query(QUERIES.markAlertDeliveryWebhook, [delivery.id]);
          }

          log.info('alert_triggered', { alertId: alert.id, userId: user.id, type: alert.alert_type });
        }
      }
    }
  } catch (error) {
    createLogger('alerts').error('evaluate_user_alerts_error', { userId: user.id, error: error?.message || String(error) });
  }
}

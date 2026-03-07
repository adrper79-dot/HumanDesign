/**
 * Transit Alert Trigger
 * Fires when a transit alert is triggered for a user
 */

const perform = async (z, bundle) => {
  // Poll the alert deliveries endpoint for recent triggers
  const response = await z.request({
    url: 'https://primeself.app/api/alerts/history',
    method: 'GET',
    params: {
      limit: 100,
      sort: 'triggered_at',
      order: 'desc',
      since: bundle.meta.page ? bundle.meta.page : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    }
  });

  const deliveries = response.json;

  // Transform alert delivery data for Zapier
  return deliveries.map(delivery => ({
    id: delivery.id,
    triggered_at: delivery.triggered_at,
    alert_id: delivery.alert_id,
    alert_name: delivery.alert_name,
    alert_type: delivery.alert_type,
    alert_description: delivery.alert_description,
    // Transit data snapshot
    planet: delivery.transit_data?.planet,
    gate: delivery.transit_data?.gate,
    position: delivery.transit_data?.position,
    // Delivery status
    push_sent: delivery.push_sent,
    webhook_sent: delivery.webhook_sent,
    // User context
    user_id: delivery.user_id,
    // Alert configuration
    config: JSON.stringify(delivery.config),
    // Computed fields
    message: formatAlertMessage(delivery),
    alert_url: `https://primeself.app/app/alerts/${delivery.alert_id}`
  }));
};

// Helper to format alert messages
const formatAlertMessage = (delivery) => {
  const { alert_type, transit_data, config } = delivery;
  
  if (alert_type === 'gate_activation') {
    return `${transit_data.planet} has entered Gate ${transit_data.gate}`;
  }
  
  if (alert_type === 'aspect') {
    return `${config.planet} ${config.aspect} ${config.natalPlanet} (${config.orb}° orb)`;
  }
  
  if (alert_type === 'cycle') {
    return `${config.cycle} is approaching (${config.daysBeforeAlert} days alert window)`;
  }
  
  if (alert_type === 'gate_deactivation') {
    return `${transit_data.planet} has left Gate ${transit_data.gate}`;
  }
  
  return delivery.alert_name || 'Transit alert triggered';
};

module.exports = {
  key: 'transitAlert',
  noun: 'Transit Alert',
  
  display: {
    label: 'Transit Alert Triggered',
    description: 'Triggers when a transit alert fires (planet enters gate, aspect forms, cycle approaches).',
    important: true
  },

  operation: {
    type: 'polling',
    
    perform: perform,
    
    // Sample data for Zapier editor
    sample: {
      id: 'uuid-456',
      triggered_at: '2024-01-15T08:00:00Z',
      alert_id: 'uuid-alert-123',
      alert_name: 'Mars in Power Gate',
      alert_type: 'gate_activation',
      alert_description: 'Mars enters your natal Mars gate',
      planet: 'Mars',
      gate: 51,
      position: 51.3,
      push_sent: true,
      webhook_sent: true,
      user_id: 789,
      config: '{"gate": 51, "planet": "Mars"}',
      message: 'Mars has entered Gate 51',
      alert_url: 'https://primeself.app/app/alerts/uuid-alert-123'
    },

    // Output fields for mapping
    outputFields: [
      { key: 'id', label: 'Delivery ID', type: 'string' },
      { key: 'triggered_at', label: 'Triggered At', type: 'datetime' },
      { key: 'alert_id', label: 'Alert ID', type: 'string' },
      { key: 'alert_name', label: 'Alert Name', type: 'string' },
      { key: 'alert_type', label: 'Alert Type', type: 'string' },
      { key: 'alert_description', label: 'Alert Description', type: 'string' },
      { key: 'planet', label: 'Planet', type: 'string' },
      { key: 'gate', label: 'Gate Number', type: 'integer' },
      { key: 'position', label: 'Zodiac Position', type: 'number' },
      { key: 'push_sent', label: 'Push Notification Sent', type: 'boolean' },
      { key: 'webhook_sent', label: 'Webhook Sent', type: 'boolean' },
      { key: 'user_id', label: 'User ID', type: 'integer' },
      { key: 'config', label: 'Alert Configuration (JSON)', type: 'string' },
      { key: 'message', label: 'Alert Message', type: 'string' },
      { key: 'alert_url', label: 'Alert URL', type: 'string' }
    ]
  }
};

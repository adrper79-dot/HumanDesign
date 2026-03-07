/**
 * Send Transit Digest Action
 * Generates and optionally sends a transit forecast/digest
 */

const perform = async (z, bundle) => {
  const { chart_id, forecast_days, delivery_method, recipient_email } = bundle.inputData;

  // Call the transit forecast endpoint
  const response = await z.request({
    url: 'https://primeself.app/api/transits/forecast',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chart_id: chart_id,
      forecast_days: parseInt(forecast_days) || 7,
      delivery_method: delivery_method || 'return',
      recipient_email: recipient_email
    })
  });

  const forecast = response.json;

  return {
    id: forecast.id,
    chart_id: forecast.chart_id,
    generated_at: forecast.generated_at,
    forecast_start_date: forecast.forecast_start_date,
    forecast_end_date: forecast.forecast_end_date,
    forecast_days: forecast.forecast_days,
    // Current transits
    current_sun_gate: forecast.current_transits?.sun?.gate,
    current_earth_gate: forecast.current_transits?.earth?.gate,
    current_moon_gate: forecast.current_transits?.moon?.gate,
    current_mercury_gate: forecast.current_transits?.mercury?.gate,
    // Digest content
    digest_summary: forecast.digest_summary,
    digest_full: forecast.digest_full,
    // Notable events
    gate_activations: Array.isArray(forecast.gate_activations) ? forecast.gate_activations.map(a => 
      `${a.planet} enters Gate ${a.gate} on ${a.date}`
    ).join('; ') : '',
    significant_aspects: Array.isArray(forecast.significant_aspects) ? forecast.significant_aspects.map(a =>
      `${a.planet1}-${a.planet2} ${a.aspect} on ${a.date}`
    ).join('; ') : '',
    // Delivery status
    delivery_method: forecast.delivery_method,
    email_sent: forecast.email_sent || false,
    email_sent_to: forecast.email_sent_to,
    // Links
    forecast_url: `https://primeself.app/app/transits?forecast=${forecast.id}`,
    chart_url: `https://primeself.app/app/chart/${forecast.chart_id}`
  };
};

module.exports = {
  key: 'sendTransitDigest',
  noun: 'Transit Digest',
  
  display: {
    label: 'Send Transit Digest',
    description: 'Generates a transit forecast/digest for a chart and optionally emails it.',
    important: true
  },

  operation: {
    perform: perform,
    
    // Input fields
    inputFields: [
      {
        key: 'chart_id',
        label: 'Chart ID',
        type: 'string',
        required: true,
        helpText: 'The chart to generate transit forecast for',
        dynamic: 'chartCreated.id.name' // Allow selecting from created charts
      },
      {
        key: 'forecast_days',
        label: 'Forecast Days',
        type: 'integer',
        required: false,
        default: '7',
        helpText: 'Number of days to forecast (1-30)',
        choices: {
          '1': '1 day',
          '3': '3 days',
          '7': '7 days (week)',
          '14': '14 days (2 weeks)',
          '30': '30 days (month)'
        }
      },
      {
        key: 'delivery_method',
        label: 'Delivery Method',
        type: 'string',
        required: false,
        default: 'return',
        choices: {
          'return': 'Return Data Only (no email)',
          'email': 'Send Email to Chart Owner',
          'email_custom': 'Send Email to Custom Recipient'
        },
        helpText: 'How to deliver the digest'
      },
      {
        key: 'recipient_email',
        label: 'Recipient Email',
        type: 'string',
        required: false,
        helpText: 'Email address (only used if delivery_method is email_custom)'
      }
    ],
    
    // Sample output
    sample: {
      id: 'uuid-forecast-555',
      chart_id: 'uuid-chart-123',
      generated_at: '2024-01-15T14:00:00Z',
      forecast_start_date: '2024-01-15',
      forecast_end_date: '2024-01-22',
      forecast_days: 7,
      current_sun_gate: 41,
      current_earth_gate: 31,
      current_moon_gate: 19,
      current_mercury_gate: 30,
      digest_summary: 'The Sun in Gate 41 brings a sense of anticipation...',
      digest_full: '# Your Transit Forecast (Jan 15-22)\n\n## Current Energies\n\nThe Sun in Gate 41...',
      gate_activations: 'Sun enters Gate 30 on 2024-01-19; Mars enters Gate 51 on 2024-01-21',
      significant_aspects: 'Sun-Saturn conjunction on 2024-01-17; Moon-Mars square on 2024-01-20',
      delivery_method: 'email',
      email_sent: true,
      email_sent_to: 'user@example.com',
      forecast_url: 'https://primeself.app/app/transits?forecast=uuid-forecast-555',
      chart_url: 'https://primeself.app/app/chart/uuid-chart-123'
    },

    // Output fields
    outputFields: [
      { key: 'id', label: 'Forecast ID', type: 'string' },
      { key: 'chart_id', label: 'Chart ID', type: 'string' },
      { key: 'generated_at', label: 'Generated At', type: 'datetime' },
      { key: 'forecast_start_date', label: 'Start Date', type: 'string' },
      { key: 'forecast_end_date', label: 'End Date', type: 'string' },
      { key: 'forecast_days', label: 'Forecast Days', type: 'integer' },
      { key: 'current_sun_gate', label: 'Current Sun Gate', type: 'integer' },
      { key: 'current_earth_gate', label: 'Current Earth Gate', type: 'integer' },
      { key: 'current_moon_gate', label: 'Current Moon Gate', type: 'integer' },
      { key: 'current_mercury_gate', label: 'Current Mercury Gate', type: 'integer' },
      { key: 'digest_summary', label: 'Digest Summary', type: 'text' },
      { key: 'digest_full', label: 'Full Digest (Markdown)', type: 'text' },
      { key: 'gate_activations', label: 'Gate Activations', type: 'string' },
      { key: 'significant_aspects', label: 'Significant Aspects', type: 'string' },
      { key: 'delivery_method', label: 'Delivery Method', type: 'string' },
      { key: 'email_sent', label: 'Email Sent', type: 'boolean' },
      { key: 'email_sent_to', label: 'Email Sent To', type: 'string' },
      { key: 'forecast_url', label: 'Forecast URL', type: 'string' },
      { key: 'chart_url', label: 'Chart URL', type: 'string' }
    ]
  }
};

/**
 * Chart Created Trigger
 * Fires when a new chart is calculated in Prime Self
 */

const perform = async (z, bundle) => {
  // Poll the charts endpoint for new charts
  const response = await z.request({
    url: 'https://primeself.app/api/charts',
    method: 'GET',
    params: {
      limit: 100,
      sort: 'created_at',
      order: 'desc',
      since: bundle.meta.page ? bundle.meta.page : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    }
  });

  const charts = response.json;

  // Transform chart data for Zapier
  return charts.map(chart => ({
    id: chart.id,
    created_at: chart.created_at,
    name: chart.name,
    birth_date: chart.birth_date,
    birth_time: chart.birth_time,
    birth_location: chart.birth_location,
    type: chart.type,
    profile: chart.profile,
    authority: chart.authority,
    definition: chart.definition,
    incarnation_cross: chart.incarnation_cross,
    chart_url: `https://primeself.app/app/chart/${chart.id}`,
    // Include gates for additional filtering
    gates_personality: chart.gates_personality,
    gates_design: chart.gates_design,
    // User info if practitioner created it for client
    user_id: chart.user_id,
    client_name: chart.client_name || chart.name
  }));
};

module.exports = {
  key: 'chartCreated',
  noun: 'Chart',
  
  display: {
    label: 'New Chart Created',
    description: 'Triggers when a new Energy Blueprint chart is calculated.',
    important: true
  },

  operation: {
    type: 'polling',
    
    perform: perform,
    
    // Sample data for Zapier editor
    sample: {
      id: 'uuid-123',
      created_at: '2024-01-15T10:30:00Z',
      name: 'John Doe',
      birth_date: '1985-03-21',
      birth_time: '14:30',
      birth_location: 'New York, NY',
      type: 'Generator',
      profile: '5/1',
      authority: 'Sacral',
      definition: 'Single',
      incarnation_cross: 'Right Angle Cross of Planning',
      chart_url: 'https://primeself.app/app/chart/uuid-123',
      gates_personality: [1, 13, 25, 51, 62],
      gates_design: [2, 14, 27, 46, 59],
      user_id: 456,
      client_name: 'John Doe'
    },

    // Output fields for mapping
    outputFields: [
      { key: 'id', label: 'Chart ID', type: 'string' },
      { key: 'created_at', label: 'Created At', type: 'datetime' },
      { key: 'name', label: 'Name', type: 'string' },
      { key: 'birth_date', label: 'Birth Date', type: 'string' },
      { key: 'birth_time', label: 'Birth Time', type: 'string' },
      { key: 'birth_location', label: 'Birth Location', type: 'string' },
      { key: 'type', label: 'Type', type: 'string' },
      { key: 'profile', label: 'Profile', type: 'string' },
      { key: 'authority', label: 'Authority', type: 'string' },
      { key: 'definition', label: 'Definition', type: 'string' },
      { key: 'incarnation_cross', label: 'Incarnation Cross', type: 'string' },
      { key: 'chart_url', label: 'Chart URL', type: 'string' },
      { key: 'gates_personality', label: 'Personality Gates', type: 'string' },
      { key: 'gates_design', label: 'Design Gates', type: 'string' },
      { key: 'user_id', label: 'User ID', type: 'integer' },
      { key: 'client_name', label: 'Client Name', type: 'string' }
    ]
  }
};

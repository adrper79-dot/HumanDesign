/**
 * Client Added Trigger
 * Fires when a practitioner adds a new client
 */

const perform = async (z, bundle) => {
  // Poll the clients endpoint for new clients
  const response = await z.request({
    url: 'https://primeself.app/api/clients',
    method: 'GET',
    params: {
      limit: 100,
      sort: 'created_at',
      order: 'desc',
      since: bundle.meta.page ? bundle.meta.page : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    }
  });

  const clients = response.json;

  // Transform client data for Zapier
  return clients.map(client => ({
    id: client.id,
    created_at: client.created_at,
    name: client.name,
    email: client.email,
    phone: client.phone,
    birth_date: client.birth_date,
    birth_time: client.birth_time,
    birth_location: client.birth_location,
    notes: client.notes,
    tags: Array.isArray(client.tags) ? client.tags.join(', ') : client.tags,
    // Chart info if calculated
    chart_id: client.chart_id,
    type: client.type,
    profile: client.profile,
    authority: client.authority,
    // Practitioner context
    practitioner_id: client.practitioner_id,
    // Links
    client_url: `https://primeself.app/app/clients/${client.id}`,
    chart_url: client.chart_id ? `https://primeself.app/app/chart/${client.chart_id}` : null
  }));
};

module.exports = {
  key: 'clientAdded',
  noun: 'Client',
  
  display: {
    label: 'New Client Added',
    description: 'Triggers when a practitioner adds a new client to their account.',
    important: true
  },

  operation: {
    type: 'polling',
    
    perform: perform,
    
    // Sample data for Zapier editor
    sample: {
      id: 'uuid-client-789',
      created_at: '2024-01-15T11:00:00Z',
      name: 'Sarah Johnson',
      email: 'sarah@example.com',
      phone: '+1-555-0123',
      birth_date: '1990-07-15',
      birth_time: '09:45',
      birth_location: 'Austin, TX',
      notes: 'Interested in career reading',
      tags: 'career, new-client',
      chart_id: 'uuid-chart-101',
      type: 'Manifestor',
      profile: '3/5',
      authority: 'Emotional',
      practitioner_id: 456,
      client_url: 'https://primeself.app/app/clients/uuid-client-789',
      chart_url: 'https://primeself.app/app/chart/uuid-chart-101'
    },

    // Output fields for mapping
    outputFields: [
      { key: 'id', label: 'Client ID', type: 'string' },
      { key: 'created_at', label: 'Created At', type: 'datetime' },
      { key: 'name', label: 'Name', type: 'string' },
      { key: 'email', label: 'Email', type: 'string' },
      { key: 'phone', label: 'Phone', type: 'string' },
      { key: 'birth_date', label: 'Birth Date', type: 'string' },
      { key: 'birth_time', label: 'Birth Time', type: 'string' },
      { key: 'birth_location', label: 'Birth Location', type: 'string' },
      { key: 'notes', label: 'Notes', type: 'text' },
      { key: 'tags', label: 'Tags', type: 'string' },
      { key: 'chart_id', label: 'Chart ID', type: 'string' },
      { key: 'type', label: 'Type', type: 'string' },
      { key: 'profile', label: 'Profile', type: 'string' },
      { key: 'authority', label: 'Authority', type: 'string' },
      { key: 'practitioner_id', label: 'Practitioner ID', type: 'integer' },
      { key: 'client_url', label: 'Client URL', type: 'string' },
      { key: 'chart_url', label: 'Chart URL', type: 'string' }
    ]
  }
};

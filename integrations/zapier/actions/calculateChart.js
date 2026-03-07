/**
 * Calculate Chart Action
 * Calculates a new Human Design chart from birth data
 */

const perform = async (z, bundle) => {
  const { name, birth_date, birth_time, birth_location, save_as_client } = bundle.inputData;

  // Call the chart calculation endpoint
  const response = await z.request({
    url: 'https://primeself.app/api/chart/calculate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: name,
      birth_date: birth_date,
      birth_time: birth_time,
      birth_location: birth_location,
      save: save_as_client === 'true' || save_as_client === true
    })
  });

  const chart = response.json;

  return {
    id: chart.id,
    created_at: chart.created_at,
    name: chart.name,
    birth_date: chart.birth_date,
    birth_time: chart.birth_time,
    birth_location: chart.birth_location,
    // Core chart data
    type: chart.type,
    profile: chart.profile,
    authority: chart.authority,
    definition: chart.definition,
    incarnation_cross: chart.incarnation_cross,
    // Centers (stringified for Zapier)
    centers_defined: Array.isArray(chart.centers_defined) ? chart.centers_defined.join(', ') : chart.centers_defined,
    centers_undefined: Array.isArray(chart.centers_undefined) ? chart.centers_undefined.join(', ') : chart.centers_undefined,
    // Gates
    gates_personality: Array.isArray(chart.gates_personality) ? chart.gates_personality.join(', ') : chart.gates_personality,
    gates_design: Array.isArray(chart.gates_design) ? chart.gates_design.join(', ') : chart.gates_design,
    // Channels
    channels: Array.isArray(chart.channels) ? chart.channels.map(c => `${c.gate1}-${c.gate2}`).join(', ') : chart.channels,
    // Variables
    phs: chart.phs,
    determination: chart.determination,
    cognition: chart.cognition,
    environment: chart.environment,
    perspective: chart.perspective,
    motivation: chart.motivation,
    // Links
    chart_url: `https://primeself.app/app/chart/${chart.id}`,
    // Flag if saved
    saved_as_client: chart.saved || false
  };
};

module.exports = {
  key: 'calculateChart',
  noun: 'Chart',
  
  display: {
    label: 'Calculate Human Design Chart',
    description: 'Calculates a Human Design chart from birth data (date, time, location).',
    important: true
  },

  operation: {
    perform: perform,
    
    // Input fields
    inputFields: [
      {
        key: 'name',
        label: 'Name',
        type: 'string',
        required: true,
        helpText: 'Full name of the person'
      },
      {
        key: 'birth_date',
        label: 'Birth Date',
        type: 'string',
        required: true,
        helpText: 'Birth date in YYYY-MM-DD format (e.g., 1985-03-21)'
      },
      {
        key: 'birth_time',
        label: 'Birth Time',
        type: 'string',
        required: true,
        helpText: 'Birth time in HH:MM format, 24-hour (e.g., 14:30)'
      },
      {
        key: 'birth_location',
        label: 'Birth Location',
        type: 'string',
        required: true,
        helpText: 'Birth location (city, state/country for geocoding)'
      },
      {
        key: 'save_as_client',
        label: 'Save as Client',
        type: 'boolean',
        required: false,
        default: 'false',
        helpText: 'Save this chart to your clients list (Practitioner tier only)'
      }
    ],
    
    // Sample output
    sample: {
      id: 'uuid-chart-789',
      created_at: '2024-01-15T13:00:00Z',
      name: 'Emily Brown',
      birth_date: '1992-11-08',
      birth_time: '16:20',
      birth_location: 'Seattle, WA',
      type: 'Projector',
      profile: '2/4',
      authority: 'Splenic',
      definition: 'Split',
      incarnation_cross: 'Left Angle Cross of Confrontation',
      centers_defined: 'Spleen, G, Throat',
      centers_undefined: 'Head, Ajna, Sacral, Solar Plexus, Ego, Root',
      gates_personality: '48, 57, 32, 50, 28',
      gates_design: '18, 58, 38, 54, 53',
      channels: '48-16, 57-20',
      phs: 'Taste',
      determination: 'Consecutive',
      cognition: 'Smell',
      environment: 'Caves',
      perspective: 'Personal',
      motivation: 'Hope',
      chart_url: 'https://primeself.app/app/chart/uuid-chart-789',
      saved_as_client: true
    },

    // Output fields
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
      { key: 'centers_defined', label: 'Defined Centers', type: 'string' },
      { key: 'centers_undefined', label: 'Undefined Centers', type: 'string' },
      { key: 'gates_personality', label: 'Personality Gates', type: 'string' },
      { key: 'gates_design', label: 'Design Gates', type: 'string' },
      { key: 'channels', label: 'Channels', type: 'string' },
      { key: 'phs', label: 'PHS (Primary Health System)', type: 'string' },
      { key: 'determination', label: 'Determination', type: 'string' },
      { key: 'cognition', label: 'Cognition', type: 'string' },
      { key: 'environment', label: 'Environment', type: 'string' },
      { key: 'perspective', label: 'Perspective', type: 'string' },
      { key: 'motivation', label: 'Motivation', type: 'string' },
      { key: 'chart_url', label: 'Chart URL', type: 'string' },
      { key: 'saved_as_client', label: 'Saved as Client', type: 'boolean' }
    ]
  }
};

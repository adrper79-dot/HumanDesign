/**
 * Cycle Approaching Trigger
 * Fires when a life cycle event is approaching (Saturn return, Jupiter return, Solar return, etc.)
 */

const perform = async (z, bundle) => {
  // Poll the cycles endpoint for upcoming cycles
  const response = await z.request({
    url: 'https://primeself.app/api/cycles/upcoming',
    method: 'GET',
    params: {
      limit: 100,
      days_ahead: bundle.inputData.days_ahead || 30, // Default to 30 days
      cycle_types: bundle.inputData.cycle_types || 'all' // Filter by cycle types
    }
  });

  const cycles = response.json;

  // Transform cycle data for Zapier
  return cycles.map(cycle => ({
    id: cycle.id,
    cycle_type: cycle.cycle_type,
    cycle_name: cycle.cycle_name,
    approaching_date: cycle.approaching_date,
    days_until: cycle.days_until,
    exact_date: cycle.exact_date,
    // Cycle details
    planet: cycle.planet,
    natal_position: cycle.natal_position,
    current_position: cycle.current_position,
    is_exact: cycle.is_exact,
    orb: cycle.orb,
    // Computed
    is_first_occurrence: cycle.is_first_occurrence,
    occurrence_number: cycle.occurrence_number,
    // User context
    user_id: cycle.user_id,
    user_name: cycle.user_name,
    birth_date: cycle.birth_date,
    // Links
    cycle_url: `https://primeself.app/app/cycles`,
    // Message
    message: formatCycleMessage(cycle)
  }));
};

// Helper to format cycle messages
const formatCycleMessage = (cycle) => {
  const { cycle_type, days_until, is_exact, cycle_name } = cycle;
  
  if (is_exact) {
    return `${cycle_name} is exact today!`;
  }
  
  if (days_until === 0) {
    return `${cycle_name} is happening today`;
  }
  
  if (days_until === 1) {
    return `${cycle_name} is tomorrow`;
  }
  
  if (days_until <= 7) {
    return `${cycle_name} in ${days_until} days`;
  }
  
  return `${cycle_name} approaching in ${days_until} days`;
};

module.exports = {
  key: 'cycleApproaching',
  noun: 'Life Cycle',
  
  display: {
    label: 'Life Cycle Approaching',
    description: 'Triggers when a significant life cycle is approaching (Saturn return, Solar return, etc.).',
    important: true
  },

  operation: {
    type: 'polling',
    
    perform: perform,
    
    // Input fields for filtering
    inputFields: [
      {
        key: 'days_ahead',
        label: 'Days Ahead',
        type: 'integer',
        helpText: 'How many days in advance to trigger (default: 30)',
        default: '30',
        required: false
      },
      {
        key: 'cycle_types',
        label: 'Cycle Types',
        type: 'string',
        helpText: 'Comma-separated cycle types to monitor (e.g., "saturn_return,jupiter_return") or "all"',
        default: 'all',
        required: false,
        list: false,
        choices: {
          'all': 'All Cycles',
          'saturn_return': 'Saturn Return',
          'jupiter_return': 'Jupiter Return',
          'solar_return': 'Solar Return',
          'lunar_return': 'Lunar Return',
          'chiron_return': 'Chiron Return',
          'uranus_opposition': 'Uranus Opposition',
          'neptune_square': 'Neptune Square'
        }
      }
    ],
    
    // Sample data for Zapier editor
    sample: {
      id: 'uuid-cycle-999',
      cycle_type: 'saturn_return',
      cycle_name: 'Saturn Return',
      approaching_date: '2024-02-14T00:00:00Z',
      days_until: 30,
      exact_date: '2024-02-14T12:34:56Z',
      planet: 'Saturn',
      natal_position: 285.5,
      current_position: 283.2,
      is_exact: false,
      orb: 2.3,
      is_first_occurrence: true,
      occurrence_number: 1,
      user_id: 123,
      user_name: 'Alice Smith',
      birth_date: '1995-03-15',
      cycle_url: 'https://primeself.app/app/cycles',
      message: 'Saturn Return approaching in 30 days'
    },

    // Output fields for mapping
    outputFields: [
      { key: 'id', label: 'Cycle ID', type: 'string' },
      { key: 'cycle_type', label: 'Cycle Type', type: 'string' },
      { key: 'cycle_name', label: 'Cycle Name', type: 'string' },
      { key: 'approaching_date', label: 'Approaching Date', type: 'datetime' },
      { key: 'days_until', label: 'Days Until', type: 'integer' },
      { key: 'exact_date', label: 'Exact Date', type: 'datetime' },
      { key: 'planet', label: 'Planet', type: 'string' },
      { key: 'natal_position', label: 'Natal Position', type: 'number' },
      { key: 'current_position', label: 'Current Position', type: 'number' },
      { key: 'is_exact', label: 'Is Exact', type: 'boolean' },
      { key: 'orb', label: 'Orb (degrees)', type: 'number' },
      { key: 'is_first_occurrence', label: 'First Occurrence', type: 'boolean' },
      { key: 'occurrence_number', label: 'Occurrence Number', type: 'integer' },
      { key: 'user_id', label: 'User ID', type: 'integer' },
      { key: 'user_name', label: 'User Name', type: 'string' },
      { key: 'birth_date', label: 'Birth Date', type: 'string' },
      { key: 'cycle_url', label: 'Cycle URL', type: 'string' },
      { key: 'message', label: 'Message', type: 'string' }
    ]
  }
};

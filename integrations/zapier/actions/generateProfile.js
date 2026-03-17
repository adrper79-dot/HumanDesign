/**
 * Generate Profile Action
 * Creates a comprehensive Energy Blueprint profile narrative
 */

const perform = async (z, bundle) => {
  const { chart_id, sections, audience } = bundle.inputData;

  // Call the profile generation endpoint
  const response = await z.request({
    url: 'https://primeself.app/api/profile/generate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chart_id: chart_id,
      sections: sections ? sections.split(',').map(s => s.trim()) : ['all'],
      audience: audience || 'self',
      format: 'markdown'
    })
  });

  const profile = response.json;

  return {
    id: profile.id,
    chart_id: profile.chart_id,
    generated_at: profile.generated_at,
    // Profile sections
    narrative: profile.narrative,
    type_description: profile.type_description,
    profile_description: profile.profile_description,
    authority_description: profile.authority_description,
    centers_description: profile.centers_description,
    gates_description: profile.gates_description,
    channels_description: profile.channels_description,
    incarnation_cross_description: profile.incarnation_cross_description,
    // Metadata
    word_count: profile.word_count,
    sections_included: Array.isArray(profile.sections_included) ? profile.sections_included.join(', ') : profile.sections_included,
    // Links
    profile_url: `https://primeself.app/app/profile/${profile.id}`,
    chart_url: `https://primeself.app/app/chart/${profile.chart_id}`
  };
};

module.exports = {
  key: 'generateProfile',
  noun: 'Profile',
  
  display: {
    label: 'Generate Energy Blueprint Profile',
    description: 'Creates a comprehensive narrative profile from an Energy Blueprint chart.',
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
        helpText: 'The ID of the chart to generate a profile for',
        dynamic: 'chartCreated.id.name' // Allow selecting from created charts
      },
      {
        key: 'sections',
        label: 'Sections to Include',
        type: 'string',
        required: false,
        helpText: 'Comma-separated sections (e.g., "type,profile,authority") or leave blank for all',
        default: 'all',
        list: false,
        choices: {
          'all': 'All Sections',
          'type': 'Type Only',
          'profile': 'Profile Only',
          'authority': 'Authority Only',
          'centers': 'Centers Only',
          'gates': 'Gates Only',
          'channels': 'Channels Only',
          'cross': 'Incarnation Cross Only'
        }
      },
      {
        key: 'audience',
        label: 'Audience',
        type: 'string',
        required: false,
        default: 'self',
        choices: {
          'self': 'Self (first-person)',
          'client': 'Client (second-person)',
          'practitioner': 'Practitioner (analytical)'
        },
        helpText: 'The intended audience for the narrative'
      }
    ],
    
    // Sample output
    sample: {
      id: 'uuid-profile-123',
      chart_id: 'uuid-chart-456',
      generated_at: '2024-01-15T12:00:00Z',
      narrative: 'You are a Generator with a 5/1 Profile...',
      type_description: 'As a Generator, your strategy is to respond...',
      profile_description: 'The 5/1 Profile combines the Heretic and the Investigator...',
      authority_description: 'Your Sacral Authority guides you through gut responses...',
      centers_description: 'You have 5 defined centers...',
      gates_description: 'Your personality gates include 1, 13, 25...',
      channels_description: 'The Channel of Discovery (29-46) connects...',
      incarnation_cross_description: 'Your Right Angle Cross of Planning...',
      word_count: 2500,
      sections_included: 'type, profile, authority, centers, gates, channels, cross',
      profile_url: 'https://primeself.app/app/profile/uuid-profile-123',
      chart_url: 'https://primeself.app/app/chart/uuid-chart-456'
    },

    // Output fields
    outputFields: [
      { key: 'id', label: 'Profile ID', type: 'string' },
      { key: 'chart_id', label: 'Chart ID', type: 'string' },
      { key: 'generated_at', label: 'Generated At', type: 'datetime' },
      { key: 'narrative', label: 'Full Narrative', type: 'text' },
      { key: 'type_description', label: 'Type Description', type: 'text' },
      { key: 'profile_description', label: 'Profile Description', type: 'text' },
      { key: 'authority_description', label: 'Authority Description', type: 'text' },
      { key: 'centers_description', label: 'Centers Description', type: 'text' },
      { key: 'gates_description', label: 'Gates Description', type: 'text' },
      { key: 'channels_description', label: 'Channels Description', type: 'text' },
      { key: 'incarnation_cross_description', label: 'Incarnation Cross', type: 'text' },
      { key: 'word_count', label: 'Word Count', type: 'integer' },
      { key: 'sections_included', label: 'Sections Included', type: 'string' },
      { key: 'profile_url', label: 'Profile URL', type: 'string' },
      { key: 'chart_url', label: 'Chart URL', type: 'string' }
    ]
  }
};

/**
 * Authentication for Prime Self Zapier Integration
 * Uses API Key authentication (JWT token from Prime Self)
 */

const testAuth = async (z, bundle) => {
  // Test authentication by calling /api/auth/me endpoint
  const response = await z.request({
    url: 'https://primeself.app/api/auth/me',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${bundle.authData.apiKey}`
    }
  });

  // If successful, return user details
  if (response.status === 200) {
    const user = response.json;
    return {
      id: user.id,
      email: user.email,
      tier: user.tier
    };
  }

  throw new z.errors.Error('Invalid API key. Please check your credentials.', 'AuthenticationError', 401);
};

module.exports = {
  type: 'custom',
  
  // Fields for authentication
  fields: [
    {
      key: 'apiKey',
      label: 'API Key',
      required: true,
      type: 'string',
      helpText: 'Your Prime Self API key (JWT token). Get it from Settings > Integrations in your Prime Self account.'
    }
  ],

  // Test function to verify authentication
  test: testAuth,

  // Connection label (shown in Zapier UI)
  connectionLabel: '{{email}} ({{tier}} tier)'
};

/**
 * Prime Self Zapier Integration
 * 
 * Enables users to connect Prime Self charts, transits, and alerts
 * to 5,000+ apps via Zapier automation workflows.
 * 
 * Version: 1.0.0
 */

const authentication = require('./authentication');
const ChartCreatedTrigger = require('./triggers/chartCreated');
const TransitAlertTrigger = require('./triggers/transitAlert');
const ClientAddedTrigger = require('./triggers/clientAdded');
const CycleApproachingTrigger = require('./triggers/cycleApproaching');
const GenerateProfileAction = require('./actions/generateProfile');
const CalculateChartAction = require('./actions/calculateChart');
const SendTransitDigestAction = require('./actions/sendTransitDigest');

const App = {
  // App version and metadata
  version: require('./package.json').version,
  platformVersion: require('zapier-platform-core').version,

  // Authentication configuration
  authentication: authentication,

  // Before request middleware
  beforeRequest: [
    (request, z, bundle) => {
      // Add authentication header
      if (bundle.authData.apiKey) {
        request.headers.Authorization = `Bearer ${bundle.authData.apiKey}`;
      }
      return request;
    }
  ],

  // After response middleware
  afterResponse: [
    (response, z, bundle) => {
      // Handle common error cases
      if (response.status === 401) {
        throw new z.errors.RefreshAuthError('Session expired. Please reconnect Prime Self.');
      }
      if (response.status === 403) {
        throw new z.errors.Error('Access forbidden. Check your Prime Self tier permissions.', 'ForbiddenError', 403);
      }
      return response;
    }
  ],

  // Triggers: Events that start a Zap
  triggers: {
    [ChartCreatedTrigger.key]: ChartCreatedTrigger,
    [TransitAlertTrigger.key]: TransitAlertTrigger,
    [ClientAddedTrigger.key]: ClientAddedTrigger,
    [CycleApproachingTrigger.key]: CycleApproachingTrigger
  },

  // Actions: Operations that can be performed
  actions: {
    [GenerateProfileAction.key]: GenerateProfileAction,
    [CalculateChartAction.key]: CalculateChartAction,
    [SendTransitDigestAction.key]: SendTransitDigestAction
  },

  // Resources (not used in this integration, but required by Zapier)
  resources: {},

  // Hydrators (for deferred data loading)
  hydrators: {}
};

module.exports = App;

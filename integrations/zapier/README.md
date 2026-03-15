# Prime Self Zapier Integration

Connect Prime Self to 5,000+ apps with Zapier automation workflows.

## Overview

This Zapier integration enables users to automate Human Design workflows by connecting Prime Self charts, transits, alerts, and profiles to thousands of popular apps like Gmail, Slack, Google Sheets, HubSpot, and more.

**Platform Version**: Zapier Platform v15.0.0  
**Status**: Code Complete - Pending Deployment  
**Tier Requirement**: Practitioner-capable account for client-related triggers; keep terminology aligned with the canonical `practitioner` / `agency` tier model.

## Features

### Triggers (Events that Start a Zap)

- **New Chart Created** - Fires when a Human Design chart is calculated
- **Transit Alert Triggered** - Fires when a transit alert occurs (gate activation, aspect, cycle)
- **Client Added** - Fires when a practitioner-capable account adds a new client
- **Life Cycle Approaching** - Fires when a significant cycle is approaching (Saturn return, etc.)

### Actions (Operations Zapier Can Perform)

- **Generate Profile** - Creates a comprehensive Human Design narrative from a chart
- **Calculate Chart** - Calculates a new Human Design chart from birth data
- **Send Transit Digest** - Generates and optionally emails a transit forecast

## Setup & Deployment

### Prerequisites

1. **Zapier Developer Account**: Sign up at https://developer.zapier.com
2. **Zapier CLI**: Install globally
   ```bash
   npm install -g zapier-platform-cli
   ```
3. **Prime Self API Access**: Ensure these endpoints are implemented:
   - `/api/auth/me` - User authentication validation
   - `/api/charts` - Chart listing (for chartCreated trigger)
   - `/api/alerts/history` - Alert delivery log (for transitAlert trigger)
   - `/api/clients` - Client listing (for clientAdded trigger)
   - `/api/cycles/upcoming` - Upcoming cycles (for cycleApproaching trigger)
   - `/api/profile/generate` - Profile generation (for generateProfile action)
   - `/api/chart/calculate` - Chart calculation (for calculateChart action)
   - `/api/transits/forecast` - Transit forecast (for sendTransitDigest action)

### Installation

1. **Clone Repository** (if not already done):
   ```bash
   cd integrations/zapier
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Login to Zapier CLI**:
   ```bash
   zapier login
   ```
   This will open a browser for authentication.

4. **Register App** (first time only):
   ```bash
   zapier register "Prime Self"
   ```

### Development

**Validate Code**:
```bash
zapier validate
```
Checks for syntax errors and schema issues.

**Run Tests**:
```bash
zapier test
```
Runs automated tests for triggers and actions.

**Test Locally**:
```bash
zapier invoke auth.test
zapier invoke triggers.chartCreated
zapier invoke actions.generateProfile --inputData '{"chart_id": "test-123", "sections": "all", "audience": "self"}'
```

### Deployment

**Push to Zapier**:
```bash
zapier push
```
This deploys your app to Zapier as a new version.

**Promote Version to Public**:
```bash
zapier promote 1.0.0
```
Makes the version available to users (initially private, then submit for public listing).

**Submit for App Directory Listing**:
After testing and validation, submit your app for Zapier's review process:
1. Go to https://developer.zapier.com
2. Navigate to your app
3. Click "Submit for Review"
4. Approval typically takes 1-2 weeks

### Environment Variables

Set these in Zapier Developer Platform (not in `.env` file):

- `PRIMESELF_API_BASE_URL` - Base URL for Prime Self API (default: `https://primeself.app`)
- `PRIMESELF_WEBHOOK_SECRET` - (Optional) Secret for webhook validation

## Authentication

**Method**: API Key (JWT token)

Users authenticate by providing their Prime Self API key, which they can generate from:
- Settings > Integrations > "Generate API Key"

The integration validates the key by calling `/api/auth/me` and displays the connection as:
```
Connected: user@example.com (Practitioner tier)
```

## Use Case Examples

### 1. Practitioner CRM Sync
```
Trigger: Client Added
  ↓
Action: Create Contact in HubSpot
  ↓
Action: Generate Profile
  ↓
Action: Send Email via Gmail (with profile attached)
```

### 2. Automated Transit Alerts
```
Trigger: Transit Alert
  ↓
Filter: alert_type = "gate_activation"
  ↓
Action: Send Slack Message ("Mars just entered Gate 51!")
```

### 3. Batch Chart Processing
```
Trigger: New Row in Google Sheets
  ↓
Action: Calculate Chart (using row data)
  ↓
Action: Generate Profile
  ↓
Action: Update Row (with chart URL and profile)
```

### 4. Life Cycle Reminders
```
Trigger: Cycle Approaching (30 days ahead)
  ↓
Filter: cycle_type = "saturn_return"
  ↓
Action: Create Task in Asana
  ↓
Action: Send Transit Digest (30-day forecast)
```

## File Structure

```
integrations/zapier/
├── package.json                          # Dependencies and scripts
├── index.js                              # Main app definition
├── authentication.js                     # API key authentication
├── triggers/
│   ├── chartCreated.js                   # New chart trigger
│   ├── transitAlert.js                   # Transit alert trigger
│   ├── clientAdded.js                    # Client added trigger
│   └── cycleApproaching.js               # Life cycle trigger
└── actions/
    ├── generateProfile.js                # Profile generation action
    ├── calculateChart.js                 # Chart calculation action
    └── sendTransitDigest.js              # Transit digest action
```

## Testing Checklist

Before deploying to production:

- [ ] `zapier validate` passes with no errors
- [ ] `zapier test` runs all tests successfully
- [ ] Authentication test connects to Prime Self API
- [ ] All triggers return sample data in correct format
- [ ] All actions successfully call Prime Self endpoints
- [ ] Error messages are user-friendly and informative
- [ ] Sample data matches actual API response structure
- [ ] Tier permissions enforced (Client triggers require Practitioner)

## Troubleshooting

**"Invalid API key" error**:
- Ensure user has generated API key in Prime Self Settings
- Verify `/api/auth/me` endpoint is accessible
- Check that JWT token is being passed correctly in Authorization header

**"Access forbidden" error**:
- Check user's tier level - some triggers require Practitioner tier
- Verify tier enforcement in Prime Self API

**Trigger not firing**:
- Zapier polls every 1-5 minutes (not instant)
- Check that polling endpoint returns data in correct format
- Verify `since` parameter is being used correctly to fetch new items only

**Action fails with validation error**:
- Check input field format (dates must be YYYY-MM-DD, times must be HH:MM)
- Ensure required fields are provided
- Verify sample data matches actual API expectations

## Support & Resources

- **Zapier Platform Docs**: https://platform.zapier.com/
- **Zapier CLI Reference**: https://github.com/zapier/zapier-platform/blob/main/packages/cli/README.md
- **Prime Self API Docs**: Located in `docs/API.md` and `docs/API_SPEC.md`
- **BUILD_LOG Entry**: See BUILD_LOG.md section BL-INT-003 for implementation details

## Future Enhancements

- [ ] Add webhook-based triggers (instant vs polling)
- [ ] Implement composite chart trigger/action
- [ ] Add "Update Client" action
- [ ] Add "Create Alert from Template" action
- [ ] Add search/lookup actions for dynamic dropdowns
- [ ] Create 10+ pre-built Zap templates
- [ ] Add pagination for high-volume polling
- [ ] Implement rate limiting handling

## License

See main project LICENSE file.

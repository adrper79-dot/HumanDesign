# API Marketplace Guide

**Last Reviewed**: 2026-03-14

Prime Self exposes programmatic access for integrations, embeds, practitioner workflows, and agency distribution surfaces.

This document is intentionally practical. It explains how to think about API access in the current product model without freezing pricing or channel details that may change.

---

## Positioning

Prime Self is practitioner-first B2B2C software. The API supports that model in three ways:

1. Raw chart and related data for external integrations
2. Direct integration with practitioner and agency workflows
3. Distribution surfaces such as embeds, API keys, and white-label-adjacent capabilities

The API is a product surface, not the whole product story.

---

## Access Paths

### Marketplace / Developer Access

Best for:

- raw chart data access
- experimentation
- simple third-party integrations

### Direct Prime Self Access

Best for:

- practitioner workflows
- agency integrations
- API key management
- embed and distribution use cases

For current commercial packaging, validate against:

- [../frontend/pricing.html](../frontend/pricing.html)
- [../workers/src/lib/stripe.js](../workers/src/lib/stripe.js)
- [../audits/TIER_BILLING_WHITE_LABEL_AUDIT_2026-03-14.md](../audits/TIER_BILLING_WHITE_LABEL_AUDIT_2026-03-14.md)

---

## Authentication

API requests use API keys.

Header:

```http
X-API-Key: ps_your_api_key_here
```

Security guidance:

- never commit API keys
- keep separate keys for development and production
- rotate keys periodically
- scope or revoke unused keys quickly

---

## Core Use Cases

### Chart Calculation

Use `POST /api/chart/calculate` to generate structured chart output from birth data.

### Profile Generation

Use `POST /api/profile/generate` for AI-assisted narrative output tied to chart data and user context.

### Transits and Forecasting

Use transit endpoints for current or forecast overlays on chart data.

### Practitioner and Agency Workflows

Use authenticated API access where the integration needs to connect with:

- client rosters
- practitioner profiles
- embeds
- agency seats
- API key lifecycle
- white-label or distribution capabilities

---

## Channel Guidance

| Channel | Best Use |
|---|---|
| Marketplace / external developer access | Raw chart data and lightweight experimentation |
| Direct Prime Self API access | Practitioner and agency workflows with authenticated product context |

Keep the channel split simple: marketplace access is for external consumption, while direct Prime Self access is for product-connected commercial workflows.

---

## Recommended References

- API overview: [API.md](API.md)
- Detailed spec: [API_SPEC.md](API_SPEC.md)
- Embed guide: [../EMBED_WIDGET_GUIDE.md](../EMBED_WIDGET_GUIDE.md)
- Tier enforcement: [TIER_ENFORCEMENT.md](TIER_ENFORCEMENT.md)
- Practitioner roadmap: [PRACTITIONER_FIRST_90_DAY_ROADMAP.md](PRACTITIONER_FIRST_90_DAY_ROADMAP.md)

---

## Documentation Rule

Do not treat this file as a frozen pricing or packaging contract. If channel strategy, pricing, or white-label semantics change, update this file together with:

- [../frontend/pricing.html](../frontend/pricing.html)
- [TIER_ENFORCEMENT.md](TIER_ENFORCEMENT.md)
- [../EMBED_WIDGET_GUIDE.md](../EMBED_WIDGET_GUIDE.md)
- [../audits/TIER_BILLING_WHITE_LABEL_AUDIT_2026-03-14.md](../audits/TIER_BILLING_WHITE_LABEL_AUDIT_2026-03-14.md)

Get current and upcoming transits affecting a chart.

**Endpoint:** `POST /api/transits/forecast`

**Request:**
```json
{
  "chartId": "chart_abc123",
  "forecastDays": 7,
  "includeAspects": true
}
```

**Response:**
```json
{
  "success": true,
  "forecast": {
    "chartId": "chart_abc123",
    "startDate": "2024-01-15",
    "endDate": "2024-01-22",
    "currentTransits": [
      {
        "planet": "Sun",
        "gate": 41,
        "line": 2,
        "startDate": "2024-01-14",
        "endDate": "2024-01-19",
        "impact": "activates fantasy and imagination gates",
        "channelFormed": null
      },
      {
        "planet": "Moon",
        "gate": 7,
        "line": 5,
        "startDate": "2024-01-15T08:00:00Z",
        "endDate": "2024-01-15T14:30:00Z",
        "impact": "forms Channel 7-31 (Alpha) - Leadership",
        "channelFormed": "7-31"
      }
    ],
    "upcomingTransits": [
      {
        "planet": "Mercury",
        "gate": 30,
        "line": 1,
        "startDate": "2024-01-17T10:00:00Z",
        "endDate": "2024-01-20T16:00:00Z",
        "impact": "activates emotional intensity"
      }
    ],
    "aspects": [
      {
        "transit": "Sun",
        "natal": "Moon",
        "aspect": "conjunction",
        "orb": 1.2,
        "date": "2024-01-16T14:30:00Z"
      }
    ]
  }
}
```
      
### 4. Gate Information

Retrieve detailed information about a specific gate.

**Endpoint:** `GET /api/gates/:number`

**Example:** `GET /api/gates/64`

**Response:**
```json
{
  "success": true,
  "gate": {
    "number": 64,
    "name": "Confusion / Before Completion",
    "center": "head",
    "circuit": "individual knowing",
    "keynote": "Confusion as the prelude to understanding",
    "description": "The pressure to make sense of the past...",
    "lines": [
      { "line": 1, "name": "Conditioned", "description": "..." },
      { "line": 2, "name": "Quality", "description": "..." },
      // ...all 6 lines
    ],
    "geneKey": {
      "shadow": "Confusion",
      "gift": "Imagination",
      "siddhi": "Illumination"
    },
    "channels": [
      { "number": "64-47", "name": "Abstraction", "design": "mental circuit" }
    ]
  }
}
```

### 5. Life Cycle Calculations

Calculate major life cycles (Saturn Return, Chiron Return, etc.)

**Endpoint:** `GET /api/cycles/:chartId`

**Query params:** `?type=all` (all, saturn_return, chiron_return, uranus_opposition, nodal_return)

**Response:**
```json
{
  "success": true,
  "chartId": "chart_abc123",
  "cycles": [
    {
      "type": "saturn_return",
      "name": "First Saturn Return",
      "exactDate": "2019-03-15T10:30:00Z",
      "windowStart": "2018-09-15",
      "windowEnd": "2019-09-15",
      "age": 29,
      "description": "A major life restructuring period...",
      "status": "past"
    },
    {
      "type": "chiron_return",
      "name": "Chiron Return",
      "exactDate": "2040-06-20T14:00:00Z",
      "windowStart": "2039-12-20",
      "windowEnd": "2040-12-20",
      "age": 50,
      "description": "The wounded healer archetype...",
      "status": "upcoming",
      "daysUntil": 5840
    }
  ]
}
```

## 💡 Use Cases & Examples

### Use Case 1: Automated Chart Generation for CRM

Integrate HD chart generation into your CRM when new clients are added:

```javascript
// Node.js example with Salesforce integration
const axios = require('axios');

async function generateChartForNewClient(salesforceContact) {
  const chart = await axios.post('https://api.primeself.app/api/chart/calculate', {
    birthDate: salesforceContact.BirthDate__c,
    birthTime: salesforceContact.BirthTime__c,
    birthLocation: {
      city: salesforceContact.BirthCity__c,
      country: salesforceContact.BirthCountry__c,
      latitude: salesforceContact.BirthLat__c,
      longitude: salesforceContact.BirthLong__c,
      timezone: salesforceContact.Timezone__c
    },
    name: salesforceContact.Name
  }, {
    headers: { 'X-API-Key': process.env.PRIMESELF_API_KEY }
  });

  // Store chart ID in Salesforce
  await updateSalesforceContact(salesforceContact.Id, {
    HDChartId__c: chart.data.chart.id,
    HDType__c: chart.data.chart.design.type,
    HDProfile__c: chart.data.chart.design.profile,
    HDAuthority__c: chart.data.chart.design.authority
  });

  return chart.data;
}
```

### Use Case 2: Transit Alerts for Email Marketing

Send automated transit forecast emails to your subscribers:

```python
# Python example with SendGrid
import requests
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

def send_weekly_transit_forecast(subscriber):
    # Get forecast from Prime Self API
    response = requests.post(
        'https://api.primeself.app/api/transits/forecast',
        json={
            'chartId': subscriber['chart_id'],
            'forecastDays': 7
        },
        headers={'X-API-Key': os.environ['PRIMESELF_API_KEY']}
    )
    
    forecast = response.json()['forecast']
    
    # Format email
    message = Mail(
        from_email='transits@yourapp.com',
        to_emails=subscriber['email'],
        subject=f'Your Weekly Transit Forecast',
        html_content=format_forecast_email(forecast)
    )
    
    # Send via SendGrid
    sg = SendGridAPIClient(os.environ['SENDGRID_API_KEY'])
    sg.send(message)
```

### Use Case 3: Batch Processing from Spreadsheet

Calculate charts for a list of people from Google Sheets:

```javascript
// Google Apps Script example
function batchCalculateCharts() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) { // Skip header row
    const row = data[i];
    
    const response = UrlFetchApp.fetch('https://api.primeself.app/api/chart/calculate', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'X-API-Key': PropertiesService.getScriptProperties().getProperty('PRIMESELF_API_KEY')
      },
      payload: JSON.stringify({
        name: row[0],
        birthDate: Utilities.formatDate(row[1], 'GMT', 'yyyy-MM-dd'),
        birthTime: row[2],
        birthLocation: {
          city: row[3],
          country: row[4],
          latitude: row[5],
          longitude: row[6],
          timezone: row[7]
        }
      })
    });
    
    const chart = JSON.parse(response.getContentText());
    
    // Write results back to sheet
    sheet.getRange(i + 1, 9).setValue(chart.chart.design.type);
    sheet.getRange(i + 1, 10).setValue(chart.chart.design.profile);
    sheet.getRange(i + 1, 11).setValue(chart.chart.design.authority);
    
    Utilities.sleep(500); // Rate limiting
  }
}
```

### Use Case 4: Mobile App Integration

Integrate HD charts into your React Native app:

```javascript
// React Native example
import axios from 'axios';

const PrimeSelfAPI = axios.create({
  baseURL: 'https://api.primeself.app',
  headers: {
    'X-API-Key': process.env.PRIMESELF_API_KEY
  }
});

export async function calculateChart(birthData) {
  try {
    const response = await PrimeSelfAPI.post('/api/chart/calculate', birthData);
    return response.data.chart;
  } catch (error) {
    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please upgrade your plan.');
    }
    throw error;
  }
}

export async function getDailyTransits(chartId) {
  const response = await PrimeSelfAPI.post('/api/transits/forecast', {
    chartId,
    forecastDays: 1
  });
  return response.data.forecast.currentTransits;
}

// Usage in component
function ChartScreen({ birthData }) {
  const [chart, setChart] = useState(null);
  
  useEffect(() => {
    calculateChart(birthData).then(setChart);
  }, [birthData]);
  
  return <ChartView chart={chart} />;
}
```

## 🛡️ Rate Limiting & Error Handling

### Rate Limits

Rate limits are enforced per API key:

- **Hourly limit:** Resets every hour from first request
- **Daily limit:** Resets at midnight UTC

**Headers returned:**
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1705334400
```

### Error Responses

**429 Too Many Requests:**
```json
{
  "error": "Rate limit exceeded. 1,000 requests per day. Resets in 3600 seconds.",
  "code": "RATE_LIMIT_EXCEEDED",
  "limit": 1000,
  "window": "day",
  "resetIn": 3600,
  "upgrade": "Upgrade to Pro tier for 10,000 requests/day"
}
```

**401 Unauthorized:**
```json
{
  "error": "API key is missing",
  "code": "API_KEY_MISSING",
  "message": "Include X-API-Key header with your API key"
}
```

**400 Bad Request:**
```json
{
  "error": "Validation error",
  "code": "VALIDATION_ERROR",
  "details": {
    "birthTime": "Must be in HH:MM format",
    "birthLocation.latitude": "Must be between -90 and 90"
  }
}
```

### Best Practices

**Retry logic:**
```javascript
async function apiRequestWithRetry(endpoint, data, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await axios.post(endpoint, data, {
        headers: { 'X-API-Key': process.env.PRIMESELF_API_KEY }
      });
    } catch (error) {
      if (error.response?.status === 429) {
        const resetIn = parseInt(error.response.headers['x-rateimit-reset']);
        await new Promise(resolve => setTimeout(resolve, resetIn * 1000));
        continue;
      }
      throw error;
    }
  }
}
```

## 📖 OpenAPI Specification

Full OpenAPI 3.0 specification available at:
- **JSON:** https://api.primeself.app/openapi.json
- **Interactive docs:** https://api.primeself.app/docs

Import into Postman, Insomnia, or any OpenAPI-compatible tool.

## 🆘 Support & Resources

- **Documentation:** https://docs.primeself.app/api
- **API Status:** https://status.primeself.app
- **Community Forum:** https://community.primeself.app
- **Email Support:** api@primeself.app
- **Discord:** https://discord.gg/primeself

**Response times:**
- Free tier: 48 hours
- Basic/Pro: 24 hours
- Enterprise: 4 hours (SLA)

## 🔄 Changelog

### v1.0.0 (2024-01-15)
- Initial API release
- Chart calculation, profile generation, transit forecasts
- Gene Keys integration
- Astrology and numerology modules

## 📜 Terms of Service

- Do not resell raw chart data without adding significant value
- Rate limits are strictly enforced; abuse will result in key revocation
- Credit Prime Self in consumer-facing applications: "Powered by Prime Self"
- See full terms at https://primeself.app/terms

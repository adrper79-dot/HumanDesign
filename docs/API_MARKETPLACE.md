# API Marketplace Guide

**Prime Self API** provides programmatic access to Human Design chart calculations, profile generation, transit forecasts, and more. Perfect for developers, researchers, and businesses building HD-powered applications.

## 🚀 Quick Start

### Option 1: RapidAPI Marketplace (Recommended)

1. Visit [Prime Self API on RapidAPI](https://rapidapi.com/primeself/api/primeself-human-design)
2. Subscribe to a plan (Free, Basic, Pro, or Enterprise)
3. Copy your RapidAPI key from the dashboard
4. Make your first request:

```bash
curl --request POST \
  --url https://primeself-human-design.p.rapidapi.com/api/chart/calculate \
  --header 'Content-Type: application/json' \
  --header 'X-RapidAPI-Key: YOUR_RAPIDAPI_KEY' \
  --header 'X-RapidAPI-Host: primeself-human-design.p.rapidapi.com' \
  --data '{
    "birthDate": "1990-01-15",
    "birthTime": "14:30",
    "birthLocation": {
      "city": "Los Angeles",
      "country": "USA",
      "latitude": 34.0522,
      "longitude": -118.2437,
      "timezone": "America/Los_Angeles"
    }
  }'
```

### Option 2: Direct API Access

1. Sign up at [primeself.app](https://primeself.app)
2. Navigate to **Settings > API Keys**
3. Generate a new API key
4. Make requests directly to `https://api.primeself.app`:

```bash
curl --request POST \
  --url https://api.primeself.app/api/chart/calculate \
  --header 'Content-Type: application/json' \
  --header 'X-API-Key: YOUR_API_KEY' \
  --data '{
    "birthDate": "1990-01-15",
    "birthTime": "14:30",
    "birthLocation": {
      "city": "Los Angeles",
      "country": "USA",
      "latitude": 34.0522,
      "longitude": -118.2437,
      "timezone": "America/Los_Angeles"
    }
  }'
```

## 📊 Pricing Tiers

| Tier | Price | Requests/Hour | Requests/Day | Best For |
|------|-------|---------------|--------------|----------|
| **Free** | $0 | 10 | 100 | Testing, personal projects |
| **Basic** | $9/mo | 100 | 1,000 | Small apps, prototypes |
| **Pro** | $29/mo | 1,000 | 10,000 | Production apps, businesses |
| **Enterprise** | Custom | 10,000+ | 100,000+ | High-volume, custom SLAs |

All tiers include:
- ✅ Chart calculation (Human Design, astrology, numerology)
- ✅ Profile generation with AI narratives
- ✅ Transit forecasts and alerts
- ✅ Gene Keys integration
- ✅ CORS support for browser apps
- ✅ JSON/REST API with OpenAPI spec
- ✅ 99.9% uptime SLA (Pro and above)

## 🔑 Authentication

All API requests require authentication via API key:

```http
X-API-Key: ps_your_64_character_api_key_here
```

**Security best practices:**
- Never commit API keys to version control
- Use environment variables: `process.env.PRIMESELF_API_KEY`
- Rotate keys periodically (Settings > API Keys)
- Use different keys for development and production

## 📚 Core Endpoints

### 1. Calculate Chart

Generate a complete Human Design chart from birth data.

**Endpoint:** `POST /api/chart/calculate`

**Request:**
```json
{
  "birthDate": "1990-01-15",
  "birthTime": "14:30",
  "birthLocation": {
    "city": "Los Angeles",
    "country": "USA",
    "latitude": 34.0522,
    "longitude": -118.2437,
    "timezone": "America/Los_Angeles"
  },
  "name": "John Doe" // optional
}
```

**Response:**
```json
{
  "success": true,
  "chart": {
    "id": "chart_abc123",
    "name": "John Doe",
    "birthData": { ... },
    "design": {
      "type": "Manifestor",
      "profile": "3/5",
      "authority": "Emotional",
      "strategy": "Inform before acting",
      "definition": "Split",
      "centers": {
        "head": { "defined": true, "gates": [64] },
        "ajna": { "defined": true, "gates": [47, 24] },
        "throat": { "defined": false, "gates": [] },
        "g": { "defined": true, "gates": [7, 13] },
        "ego": { "defined": false, "gates": [] },
        "sacral": { "defined": false, "gates": [] },
        "emotionalSolar": { "defined": true, "gates": [36, 22] },
        "spleen": { "defined": false, "gates": [] },
        "root": { "defined": true, "gates": [53] }
      },
      "gates": [
        { "number": 64, "line": 3, "planet": "Sun", "type": "personality" },
        { "number": 47, "line": 4, "planet": "Earth", "type": "personality" },
        // ...all 26 gates
      ],
      "channels": [
        { "number": "64-47", "name": "Abstraction", "design": "mental circuit" }
      ]
    },
    "astrology": {
      "sun": { "sign": "Capricorn", "degree": 24.5, "house": 10 },
      "moon": { "sign": "Pisces", "degree": 12.3, "house": 12 },
      // ...all planets
      "ascendant": { "sign": "Aries", "degree": 5.2 },
      "aspects": [
        { "planet1": "Sun", "planet2": "Moon", "aspect": "sextile", "orb": 2.1 }
      ]
    },
    "numerology": {
      "lifePath": 7,
      "expression": 5,
      "soulUrge": 11,
      "personality": 3,
      "birthday": 6
    },
    "geneKeys": {
      "lifeWork": { "gate": 7, "geneKey": 7, "shadow": "Division", "gift": "Guidance", "siddhi": "Virtue" },
      "evolution": { "gate": 13, "geneKey": 13, "shadow": "Discord", "gift": "Discernment", "siddhi": "Empathy" },
      // ...all 4 prime keys
    }
  }
}
```

### 2. Generate Profile

Create an AI-powered narrative profile from a chart.

**Endpoint:** `POST /api/profile/generate`

**Request:**
```json
{
  "chartId": "chart_abc123",
  "sections": ["overview", "type", "authority", "profile", "gates"],
  "audience": "self", // "self" | "practitioner" | "simple"
  "length": "medium" // "brief" | "medium" | "comprehensive"
}
```

**Response:**
```json
{
  "success": true,
  "profile": {
    "id": "profile_xyz789",
    "chartId": "chart_abc123",
    "narrative": "You are a Manifestor with a 3/5 profile...",
    "sections": {
      "overview": "Your Human Design chart reveals...",
      "type": "As a Manifestor, you are here to initiate...",
      "authority": "Your Emotional Authority means...",
      "profile": "The 3/5 profile is known as the Martyr/Heretic...",
      "gates": "Your defined gates create unique patterns..."
    },
    "wordCount": 2847,
    "generatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### 3. Transit Forecast

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

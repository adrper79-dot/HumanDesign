# API Reference — Prime Self

**Base URL:** `https://prime-self-api.adrper79.workers.dev`

All responses are `application/json`. Protected endpoints require `Authorization: Bearer <accessToken>`.

---

## Authentication

### `POST /api/auth/register`
Create a new account.

**Request**
```json
{ "email": "user@example.com", "password": "s3cr3t!", "name": "Alex" }
```
**Response 201**
```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>",
  "user": { "id": 42, "email": "user@example.com", "name": "Alex" }
}
```
**Errors:** 400 missing fields · 409 email taken

---

### `POST /api/auth/login`
Exchange credentials for tokens.

**Request**
```json
{ "email": "user@example.com", "password": "s3cr3t!" }
```
**Response 200**
```json
{ "accessToken": "<jwt>", "refreshToken": "<jwt>", "user": { ... } }
```
**Errors:** 400 missing fields · 401 wrong password · 404 not found

---

### `POST /api/auth/refresh`
Issue a new access token.

**Request**
```json
{ "refreshToken": "<jwt>" }
```
**Response 200**
```json
{ "accessToken": "<jwt>" }
```
**Errors:** 401 invalid / expired refresh token

---

### `GET /api/auth/me` 🔒
Return the authenticated user's profile.

**Response 200**
```json
{ "id": 42, "email": "user@example.com", "name": "Alex", "isPractitioner": false }
```

---

## Geocoding

### `GET /api/geocode?q=<city>` (public)
Convert a city/location string to lat/lng and IANA timezone. Results are cached in Workers KV for 30 days.

**Query params**

| Param | Required | Description |
|---|---|---|
| `q` | yes | Location string (minimum 2 characters) — e.g. `Tampa, FL, USA` |

**Response 200**
```json
{
  "lat": 27.9506,
  "lng": -82.4572,
  "timezone": "America/New_York",
  "displayName": "Tampa, Hillsborough County, Florida, United States"
}
```
**Errors:** 400 `q` missing or too short · 404 location not found · 502 upstream geocoder unavailable

---

## Chart Calculation

### `POST /api/chart/calculate` (public)
Calculate a complete Human Design + Astrology chart. Does not require authentication; the result is not saved unless the user calls the save endpoint.

**Request**
```json
{
  "birthDate": "1979-08-05",
  "birthTime": "18:51",
  "lat": 27.9506,
  "lng": -82.4572,
  "timezone": "America/New_York"
}
```
**Response 200** — full chart object (abbreviated):
```json
{
  "type": "Projector",
  "profile": "6/2",
  "authority": "Emotional – Solar Plexus",
  "cross": "Left Angle Cross of Refinement (33/19 | 2/1)",
  "definedCenters": ["Solar Plexus", "Sacral", "Root"],
  "channels": [{ "channel": "19-49", "name": "Synthesis" }],
  "gates": { "conscious": [19, 33, 2], "unconscious": [50, 1, 49] },
  "planets": { "sun": { "sign": "Leo", "degree": 12.5, "gate": 33, "line": 6 } },
  "aspects": [{ "planet1": "sun", "planet2": "moon", "type": "conjunction", "orb": 2.1 }]
}
```
**Errors:** 400 missing / invalid fields

---

### `POST /api/chart/save` 🔒
Save a calculated chart to the authenticated user's history.

**Request:** same body as `/api/chart/calculate` plus the calculated `chartData`.
```json
{
  "birthDate": "1979-08-05",
  "birthTime": "18:51",
  "lat": 27.9506,
  "lng": -82.4572,
  "timezone": "America/New_York",
  "cityName": "Tampa, FL, USA",
  "chartData": { /* full chart object */ }
}
```
**Response 201**
```json
{ "chartId": 7 }
```

---

### `GET /api/chart/history` 🔒
List the authenticated user's saved charts (newest first).

**Response 200**
```json
[
  { "id": 7, "birthDate": "1979-08-05", "cityName": "Tampa, FL, USA", "createdAt": "2025-01-15T12:00:00Z" }
]
```

---

### `GET /api/chart/:id` 🔒
Retrieve a single saved chart by ID. The chart must belong to the authenticated user.

**Response 200** — full chart row including `raw_json`.

---

## Profiles (Prime Self Profile)

### `POST /api/profile/generate` 🔒
Generate an AI-synthesised Prime Self profile from a saved chart. LLM failover: Anthropic → Grok → Groq.

**Request**
```json
{
  "chartId": 7,
  "birthDate": "1979-08-05",
  "birthTime": "18:51",
  "lat": 27.9506,
  "lng": -82.4572,
  "timezone": "America/New_York"
}
```
**Response 200**
```json
{
  "profileId": 3,
  "archetype": "The Catalyst",
  "profile": {
    "forgeArchetype": "...",
    "knowledgeProfile": "...",
    "decisionArchitecture": "...",
    "currentActivation": "...",
    "practiceRecommendations": ["..."]
  },
  "pdfUrl": "https://r2.example.com/profiles/42/3.pdf"
}
```
**Errors:** 400 missing fields · 404 chart not found or not owned

---

### `GET /api/profile/list` 🔒
List all profiles for the authenticated user.

**Response 200** — array of profile summaries (id, archetype, createdAt).

---

### `GET /api/profile/:id` 🔒
Retrieve a single profile by ID.

**Response 200** — full profile including `raw_json`.

---

## Transits

### `GET /api/transits/today` (public)
Current planetary positions with HD gate and line activations.

**Query params (optional)**

| Param | Description |
|---|---|
| `lat` | Observer latitude (for precise local time) |
| `lng` | Observer longitude |
| `natalChartId` | Chart ID — if provided, also returns natal aspects |

**Response 200**
```json
{
  "timestamp": "2025-07-09T14:30:00Z",
  "transits": {
    "sun": { "sign": "Cancer", "degree": 17.4, "gate": 52, "line": 4 },
    "moon": { "sign": "Scorpio", "degree": 3.1, "gate": 44, "line": 2 }
  },
  "natalAspects": [ /* if natalChartId provided */ ]
}
```

---

### `GET /api/transits/forecast` (public)
Transit forecast: day-by-day gate ingresses and key aspects over a date range.

**Query params**

| Param | Required | Description |
|---|---|---|
| `startDate` | yes | ISO date `YYYY-MM-DD` |
| `days` | no | Number of days (default 7, max 30) |
| `lat` | no | Observer latitude |
| `lng` | no | Observer longitude |

**Response 200** — array of daily transit objects.

---

## Practitioners

### `POST /api/practitioner/register` 🔒
Register the authenticated user as a practitioner.

**Request**
```json
{ "bio": "Certified HDS analyst...", "specialties": ["Projector", "Generator"], "isPublic": true }
```
**Response 201** — practitioner record.

---

### `GET /api/practitioner/clients` 🔒
List clients associated with the authenticated practitioner.

---

### `POST /api/practitioner/client` 🔒
Add a client (by email) to the practitioner's roster.

**Request**
```json
{ "clientEmail": "client@example.com" }
```

---

### `GET /api/practitioner/client/:clientId/charts` 🔒
Retrieve a client's charts. Practitioner must have the client in their roster.

---

## Clusters

### `GET /api/cluster/list` 🔒
List all clusters.

### `GET /api/cluster/:id` 🔒
Get cluster details and member list.

### `POST /api/cluster/join` 🔒
Join a cluster.
```json
{ "clusterId": 2 }
```

### `POST /api/cluster/leave` 🔒
Leave a cluster.
```json
{ "clusterId": 2 }
```

---

## Onboarding

### `GET /api/onboarding/story` 🔒
Return the personalised Savannah story arc for the authenticated user's Forge archetype.

---

## SMS

### `POST /api/sms/subscribe` 🔒
Subscribe the authenticated user to daily transit SMS digests.
```json
{ "phoneNumber": "+18005551234" }
```

### `POST /api/sms/unsubscribe` 🔒
Unsubscribe from SMS digests.

### `POST /api/sms/send-digest` (internal / cron)
Triggered by the daily cron to send SMS digests.

---

## Health

### `GET /api/health` (public)
Liveness check. Always returns 200.

```json
{ "status": "ok", "endpoints": 32, "version": "0.5.0" }
```

---

## Error Response Format

All error responses use a consistent shape:

```json
{ "error": "Human-readable message", "code": "MACHINE_CODE" }
```

Common HTTP status codes:

| Code | Meaning |
|---|---|
| 400 | Bad request — missing or invalid fields |
| 401 | Unauthorised — missing or invalid token |
| 403 | Forbidden — resource exists but not accessible to you |
| 404 | Not found |
| 409 | Conflict — e.g. email already registered |
| 429 | Rate limited — too many requests |
| 502 | Upstream service unavailable |
| 500 | Internal server error |

---

## Rate Limits

| Endpoint group | Limit |
|---|---|
| `/api/auth/*` | 10 req / minute per IP |
| `/api/profile/generate` | 5 req / minute per user |
| `/api/geocode` | 30 req / minute per IP |
| All other endpoints | 60 req / minute per IP |

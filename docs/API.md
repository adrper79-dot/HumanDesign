# Prime Self API Reference

## Base URL

```
https://prime-self-api.<your-account>.workers.dev
```

## Authentication

Protected endpoints require a JWT Bearer token:

```
Authorization: Bearer <token>
```

Tokens are HS256 JWTs signed with the `JWT_SECRET` environment variable.

**Public endpoints** do not require auth. **Protected endpoints** are marked below.

---

## Endpoints

### Health Check

```
GET /api/health
```

**Auth:** None

**Response:**

```json
{ "status": "ok", "version": "0.2.0" }
```

---

### Calculate Chart

```
POST /api/chart/calculate
```

**Auth:** None

Runs Layers 1–7 (Julian Day → Planets → Design → Gates → Chart → Astrology → Transits).

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `birthDate` | string | Yes | `YYYY-MM-DD` |
| `birthTime` | string | Yes | `HH:MM` (local time) |
| `birthTimezone` | string | No | IANA timezone (e.g. `America/New_York`). Omit for UTC. |
| `lat` | number | Yes | Birth latitude (+N / -S) |
| `lng` | number | Yes | Birth longitude (+E / -W) |

**Example:**

```json
{
  "birthDate": "1979-08-05",
  "birthTime": "18:51",
  "birthTimezone": "America/New_York",
  "lat": 27.9506,
  "lng": -82.4572
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "birth": { "year": 1979, "month": 8, "day": 5, "hour": 22, "minute": 51, "jdn": 2444091.452 },
    "design": { "date": "...", "jdn": 2444000.0 },
    "personalityGates": { "conscious": { "sun": { "gate": 33, "line": 6 }, ... } },
    "designGates": { "unconscious": { "sun": { "gate": 2, "line": 2 }, ... } },
    "chart": {
      "type": "Projector",
      "authority": "Emotional - Solar Plexus",
      "profile": "6/2",
      "definition": "Split",
      "cross": { "gates": [33, 19, 2, 1], "type": "Left Angle" },
      "definedCenters": [...],
      "undefinedCenters": [...],
      "activeChannels": [{ "channel": "...", "gates": [...], "centers": [...] }]
    },
    "astrology": {
      "placements": [...],
      "houses": [...],
      "aspects": [...],
      "ascendant": { "sign": "...", "degrees": 0.0 },
      "midheaven": { "sign": "...", "degrees": 0.0 }
    },
    "transits": { ... }
  },
  "meta": { "utcInput": { ... }, "calculatedAt": "2025-01-01T00:00:00.000Z" }
}
```

---

### Get Chart History

```
GET /api/chart/history
```

**Auth:** Required (JWT)

Retrieves all saved charts for the authenticated user, with caching via Cloudflare KV.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | int | 20 | Max results |
| `offset` | int | 0 | Pagination offset |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "chart-uuid",
      "birth": { "date": "1979-08-05", "time": "18:51:00", "timezone": "America/New_York" },
      "location": { "lat": 27.9506, "lng": -82.4572, "city": "Tampa, FL" },
      "chart": { "type": "Projector", "authority": "Emotional", "profile": "6/2", "definition": "Split", "cross": { "gates": [33, 19, 2, 1], "type": "Left Angle" } },
      "calculatedAt": "2025-01-15T10:30:00Z"
    }
  ],
  "pagination": { "limit": 20, "offset": 0, "total": 45 }
}
```

---

### Get Chart by ID

```
GET /api/chart/:id
```

**Auth:** Required (JWT) — Owner-only access

Retrieves a specific chart by ID with full detail (cached).

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "chart-uuid",
    "hdChart": { "type": "Projector", "chart": { ... }, "astrology": { ... }, "transits": { ... } },
    "astroChart": { "placements": [...], "houses": [...], "aspects": [...] },
    "calculatedAt": "2025-01-15T10:30:00Z"
  }
}
```

---

### Generate Profile


```
POST /api/profile/generate
```

**Auth:** Required (JWT)

Runs full chart calculation + LLM synthesis via Claude (Opus for full profiles, Sonnet for queries). Includes dual-pass grounding validation.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `birthDate` | string | Yes | `YYYY-MM-DD` |
| `birthTime` | string | Yes | `HH:MM` |
| `birthTimezone` | string | No | IANA timezone |
| `lat` | number | Yes | Birth latitude |
| `lng` | number | Yes | Birth longitude |
| `question` | string | No | Specific question for quick query mode |

**Response:**

```json
{
  "success": true,
  "profile": { ... },
  "chart": { "type": "...", "authority": "...", "profile": "...", "definition": "...", "cross": { ... } },
  "meta": {
    "groundingAudit": { ... },
    "partialGrounding": false,
    "validationErrors": [],
    "model": "claude-opus-4-20250514",
    "calculatedAt": "..."
  }
}
```

---

### List Profiles

```
GET /api/profile/list
```

**Auth:** Required (JWT)

Retrieve all saved AI profiles for the authenticated user.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | int | 20 | Max results |
| `offset` | int | 0 | Pagination offset |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "profile-uuid",
      "chartId": "chart-uuid",
      "chart": { "type": "Projector", "authority": "Emotional", "profile": "6/2", "definition": "Split", "cross": { "gates": [33, 19, 2, 1], "type": "Left Angle" } },
      "createdAt": "2025-01-15T10:30:00Z",
      "modelUsed": "claude-opus-4-20250514"
    }
  ],
  "pagination": { "limit": 20, "offset": 0, "total": 12 }
}
```

---

### Get Profile by ID

```
GET /api/profile/:id
```

**Auth:** Required (JWT) — Owner-only access

Retrieve a specific profile with full synthesis data (cached).

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "profile-uuid",
    "chartId": "chart-uuid",
    "profile": {
      "quickStartGuide": { "yourType": "...", "yourAuthority": "...", "yourPurpose": "..." },
      "technicalInsights": { "activationSequence": [...]  ,"dominantTheme": "..." },
      "relationships": { "compatibility": "..."  ,"dynamics": "..." }
    },
    "modelUsed": "claude-opus-4-20250514",
    "groundingAudit": { "inconsistencies": [], "confidence": 0.98 },
    "createdAt": "2025-01-15T10:30:00Z"
  }
}
```

---

### Current Transits

```
GET /api/transits/today
```

**Auth:** None

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `lat` | number | No | Observer latitude |
| `lng` | number | No | Observer longitude |
| `birthDate` | string | No | For natal comparison (`YYYY-MM-DD`) |
| `birthTime` | string | No | For natal comparison (`HH:MM`) |

**Response:**

```json
{
  "success": true,
  "date": "2025-01-01",
  "transits": {
    "positions": { ... },
    "gateActivations": { ... },
    "aspects": [ ... ],
    "natalMatches": [ ... ]
  }
}
```

---

### Transit Forecast

```
GET /api/transits/forecast
```

**Auth:** None

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `birthDate` | string | Yes | `YYYY-MM-DD` |
| `birthTime` | string | Yes | `HH:MM` |
| `lat` | number | Yes | Birth latitude |
| `lng` | number | Yes | Birth longitude |
| `days` | number | No | Forecast window 1–90 (default 30) |
| `startDate` | string | No | `YYYY-MM-DD` (default today) |

**Response:**

```json
{
  "success": true,
  "range": { "start": "...", "end": "...", "days": 30 },
  "events": [
    { "date": "...", "type": "gate_ingress", "planet": "Sun", "toGate": 33 },
    { "date": "...", "type": "exact_aspect", "planet1": "...", "planet2": "...", "aspectType": "..." }
  ],
  "summary": { "totalEvents": 0, "ingresses": 0, "aspects": 0 }
}
```

---

### Composite / Relationship Chart

```
POST /api/composite
```

**Auth:** Required (JWT)

Overlays two full bodygraphs to identify electromagnetic connections, dominance channels, companionship, and compromise dynamics.

**Request Body:**

```json
{
  "personA": {
    "birthDate": "1979-08-05",
    "birthTime": "18:51",
    "birthTimezone": "America/New_York",
    "lat": 27.9506,
    "lng": -82.4572
  },
  "personB": {
    "birthDate": "1985-03-15",
    "birthTime": "08:00",
    "lat": 40.7128,
    "lng": -74.0060
  }
}
```

**Response:**

```json
{
  "success": true,
  "composite": {
    "electromagnetic": [{ "channel": "1-8", "gates": [1, 8], "centers": ["G", "Throat"], "type": "electromagnetic" }],
    "dominanceA": [ ... ],
    "dominanceB": [ ... ],
    "companionship": [ ... ],
    "compromise": [ ... ],
    "combinedDefinition": "Single",
    "combinedCenters": ["G", "Throat", ...],
    "personA": { "type": "Projector", "authority": "...", "profile": "6/2", "forge": "Perception", ... },
    "personB": { "type": "Generator", ... },
    "dynamics": [
      { "area": "decision-making", "note": "..." },
      { "area": "attraction", "note": "..." },
      { "area": "energy-dynamic", "note": "..." }
    ]
  }
}
```

---

### Birth-Time Rectification

```
POST /api/rectify
```

**Auth:** Required (JWT)

Initiate a sensitivity analysis across a time window showing which chart elements change. Returns immediately with rectification ID; results are computed and available for polling.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `birthDate` | string | Yes | `YYYY-MM-DD` |
| `birthTime` | string | Yes | `HH:MM` approximate time |
| `birthTimezone` | string | No | IANA timezone |
| `lat` | number | Yes | Birth latitude |
| `lng` | number | Yes | Birth longitude |
| `windowMinutes` | number | No | ± window (default 30, max 120) |
| `stepMinutes` | number | No | Step interval (default 5, min 1, max 15) |

**Response:**

```json
{
  "ok": true,
  "rectificationId": "uuid",
  "percentComplete": 100,
  "result": {
    "ok": true,
    "baseChart": {
      "type": "Guide Pattern",
      "authority": "Emotional",
      "profile": "6/2",
      "definition": "Single",
      "cross": { "gates": [1, 2, 3], "type": "Right Angle Cross" },
      "ascendant": "Aries",
      "sunGate": 1,
      "moonGate": 2
    },
    "sensitivity": {
      "window": "±30 minutes",
      "step": "5 minutes",
      "totalSnapshots": 13,
      "stableRange": "-15 min to +10 min (6 steps, all chart elements stable)",
      "criticalChangePoints": 0,
      "highChangePoints": 1
    },
    "snapshots": [
      {
        "offset": -30,
        "label": "-30 min",
        "time": "22:21 UTC",
        "type": "Guide Pattern",
        "authority": "Emotional",
        "profile": "6/2",
        "changes": 0
      },
      {
        "offset": 25,
        "label": "+25 min",
        "time": "23:16 UTC",
        "type": "Guide Pattern",
        "profile": "6/3",
        "changes": 1,
        "diffs": [
          {
            "field": "profile",
            "base": "6/2",
            "test": "6/3",
            "severity": "high"
          }
        ]
      }
    ],
    "guidance": [
      "Your chart is highly time-sensitive...",
      "Consider: life events that validate your Strategy and Authority..."
    ],
    "meta": {
      "calculatedAt": "2026-03-18T14:30:45.123Z"
    }
  }
}
```

#### Get Rectification Progress

```
GET /api/rectify/:rectificationId
```

**Auth:** Required (JWT)

Poll for progress and result of an in-flight rectification analysis.

**Response:**

```json
{
  "ok": true,
  "rectificationId": "uuid",
  "percentComplete": 45,
  "status": "in_progress"
}
```

When complete:

```json
{
  "ok": true,
  "rectificationId": "uuid",
  "percentComplete": 100,
  "status": "completed",
  "result": { ... }
}
```

If error:

```json
{
  "ok": true,
  "rectificationId": "uuid",
  "percentComplete": 0,
  "status": "failed",
  "error": "Invalid birth data"
}
```

---

### Create Cluster

```
POST /api/cluster/create
```

**Auth:** Required (JWT)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Cluster name |
| `challenge` | string | Yes | Shared challenge or goal |
| `createdBy` | string | No | User ID of creator |

**Response:**

```json
{
  "success": true,
  "cluster": { "id": "uuid", "name": "...", "challenge": "...", "createdAt": "..." }
}
```

---

### Join Cluster

```
POST /api/cluster/:id/join
```

**Auth:** Required (JWT)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | Yes | User ID |
| `birthDate` | string | Yes | `YYYY-MM-DD` |
| `birthTime` | string | Yes | `HH:MM` |
| `lat` | number | Yes | Birth latitude |
| `lng` | number | Yes | Birth longitude |

**Response:**

```json
{
  "success": true,
  "member": {
    "userId": "...",
    "type": "Projector",
    "authority": "Emotional - Solar Plexus",
    "profile": "6/2",
    "forgeRole": { "forge": "Perception", "role": "Guide", "brings": "Seeing the other, direction, efficiency" }
  }
}
```

---

### Get Cluster

```
GET /api/cluster/:id
```

**Auth:** Required (JWT)

**Response:**

```json
{
  "success": true,
  "clusterId": "...",
  "members": [{ "userId": "...", "email": "...", "forgeRole": { ... } }],
  "composition": {
    "forges": ["Perception", "Mastery"],
    "missingForges": ["Forge of Power", "Forge of Mirrors"],
    "typeCount": { "Guide": 1, "Builder": 1 },
    "insights": ["No Manifestor — the cluster may struggle to initiate..."]
  }
}
```

---

### Cluster Synthesis

```
POST /api/cluster/:id/synthesize
```

**Auth:** Required (JWT)

Runs LLM-based group dynamics synthesis (Claude Sonnet).

**Request Body:**

```json
{
  "challenge": "Launch our product",
  "members": [
    { "name": "Alice", "birthDate": "1979-08-05", "birthTime": "18:51", "lat": 27.95, "lng": -82.46 },
    { "name": "Bob", "birthDate": "1985-03-15", "birthTime": "08:00", "lat": 40.71, "lng": -74.01 }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "synthesis": {
    "groupDynamic": "...",
    "forgeInterplay": "...",
    "blindSpots": ["..."],
    "actionPlan": ["..."],
    "communicationStrategy": "...",
    "warning": "..."
  },
  "composition": { ... },
  "members": [{ "name": "Alice", "type": "Projector", "forge": "Perception", "role": "Guide" }]
}
```

---

### SMS Webhook (Telnyx Inbound)

```
POST /api/sms/webhook
```

**Auth:** None (Telnyx signs webhooks)

Processes inbound SMS commands: `START`, `STOP`, `TODAY`, `STATUS`.

---

### Send Digest

```
POST /api/sms/send-digest
```

**Auth:** Required (JWT)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | No | Send to one user by ID |
| `phone` | string | No | Send to one user by phone |
| `all` | boolean | No | Send to all opted-in users |

---

### Subscribe to SMS Digest

```
POST /api/sms/subscribe
```

**Auth:** Required (JWT)

Subscribe the authenticated user to daily SMS digests.

**Request Body:**

```json
{
  "phone": "+14155551234"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "userId": "user-uuid",
    "phone": "+14155551234",
    "subscribed": true,
    "nextDigestAt": "2025-01-16T06:00:00Z"
  }
}
```

**Error Codes:**
- `400`: Invalid phone number (must be E.164 format)
- `409`: Already subscribed to this phone

---

### Unsubscribe from SMS Digest

```
POST /api/sms/unsubscribe
```

**Auth:** Required (JWT)

Unsubscribe the authenticated user from SMS digests.

**Response:**

```json
{
  "success": true,
  "data": {
    "userId": "user-uuid",
    "subscribed": false,
    "unsubscribedAt": "2025-01-15T14:22:00Z"
  }
}
```

---

## Push Notifications (Phase 3+)

### Subscribe to Push

```
POST /api/push/subscribe
```

**Auth:** Required (JWT)

Saves a Web Push subscription for a user. Required before sending push notifications.

**Request Body:**

```json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": {
      "p256dh": "base64-url-encoded-public-key",
      "auth": "base64-url-encoded-auth"
    }
  }
}
```

**Response:**

```json
{
  "success": true,
  "subscriptionId": "uuid"
}
```

---

### Send Notification

```
POST /api/push/send
```

**Auth:** Required (JWT)

Sends a push notification immediately. Respects user's quiet hours preference.

**Request Body:**

```json
{
  "userId": "user-id",
  "notificationType": "achievement | alert | digest | system",
  "title": "Achievement Unlocked",
  "body": "You've reached 100 chart readings!",
  "icon": "https://..."
}
```

**Response:**

```json
{
  "success": true,
  "sent": 1,
  "failed": 0
}
```

---

## Alerts (Phase 3+)

### Create Alert

```
POST /api/alerts
```

**Auth:** Required (JWT)

Creates a transit alert for the authenticated user's natal chart. Supported alert types: `gate_activation`, `aspect`, `cycle`.

**Request Body:**

```json
{
  "type": "aspect",
  "planet": "mercury",
  "aspect": "opposition",
  "orb": 1.5,
  "webhookUrl": "https://your-app.example.com/webhook"
}
```

**Response:**

```json
{
  "success": true,
  "alert": {
    "id": "uuid",
    "type": "aspect",
    "planet": "mercury",
    "aspect": "opposition",
    "createdAt": "2026-03-08T12:00:00Z"
  }
}
```

---

### List Alerts

```
GET /api/alerts
```

**Auth:** Required (JWT)

Returns all active transit alerts for the authenticated user.

**Response:**

```json
{
  "success": true,
  "alerts": [
    {
      "id": "uuid",
      "type": "aspect",
      "planet": "mercury",
      "aspect": "opposition",
      "orb": 1.5,
      "status": "active",
      "createdAt": "2026-03-08T12:00:00Z"
    }
  ]
}
```

---

### Evaluate Alerts

```
POST /api/alerts/evaluate
```

**Auth:** None (runs cron on schedule)

Evaluates all active alerts against current transits. Called by Cloudflare Cron at 06:00 UTC daily. Notifies users via push or webhook when alert criteria are met.

**Response:**

```json
{
  "success": true,
  "evaluated": 1250,
  "triggered": 37,
  "notifications_sent": 37
}
```

---

## Achievements (Phase 3+)

### Get Achievements

```
GET /api/achievements
```

**Auth:** Required (JWT)

Returns all available achievements and user's progress toward each.

**Response:**

```json
{
  "success": true,
  "achievements": [
    {
      "id": "reading_master",
      "name": "Reading Master",
      "description": "Read 100 charts",
      "criteria": {
        "type": "event_count",
        "event": "chart_read",
        "threshold": 100
      },
      "unlockedAt": null,
      "progress": {
        "current": 47,
        "target": 100,
        "percentage": 47
      },
      "reward": {
        "type": "points",
        "amount": 500
      }
    }
  ]
}
```

---

### Track Achievement Event

```
POST /api/achievements/track
```

**Auth:** Required (JWT)

Records a user action (e.g., chart read, profile generated) and checks for achievement unlocks or milestone progress.

**Request Body:**

```json
{
  "event": "chart_read",
  "data": { "chartId": "uuid" }
}
```

**Response:**

```json
{
  "success": true,
  "unlocked": ["reading_master"],
  "milestones": [
    {
      "achievement": "reading_master",
      "milestone": 50,
      "progress": 50
    }
  ]
}
```

---

## Diary (Phase 3+)

### Create Diary Entry

```
POST /api/diary
```

**Auth:** Required (JWT)

Creates a diary entry and automatically calculates transits for that date.

**Request Body:**

```json
{
  "title": "Major life event",
  "description": "Started new job",
  "eventDate": "2026-03-08",
  "emotionalTone": "excited",
  "location": {
    "lat": 40.7128,
    "lng": -74.0060
  }
}
```

**Response:**

```json
{
  "success": true,
  "entry": {
    "id": "uuid",
    "title": "Major life event",
    "eventDate": "2026-03-08",
    "createdAt": "2026-03-08T12:00:00Z",
    "transits": {
      "planets": {
        "sun": { "gate": 33, "degrees": 148.25 },
        "moon": { "gate": 2, "degrees": 25.00 }
      },
      "activeGates": [33, 2, 5, 12],
      "aspects": [
        {
          "planet1": "sun",
          "planet2": "mercury",
          "angle": 120,
          "type": "trine"
        }
      ]
    }
  }
}
```

---

### Get Diary Entries

```
GET /api/diary?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

**Auth:** Required (JWT)

Returns diary entries within a date range, with transit data for each entry.

**Response:**

```json
{
  "success": true,
  "entries": [
    {
      "id": "uuid",
      "title": "Major life event",
      "eventDate": "2026-03-08",
      "transits": { ... },
      "createdAt": "2026-03-08T12:00:00Z"
    }
  ]
}
```

---

## Celebrity Comparison

### List Categories

```
GET /api/compare/categories
```

**Auth:** None (public)

Returns all available celebrity categories with counts.

**Response:**

```json
{
  "ok": true,
  "categories": [
    { "name": "actors", "count": 42 },
    { "name": "musicians", "count": 38 }
  ],
  "total": 150
}
```

### Browse Category

```
GET /api/compare/category/:category
```

**Auth:** None (public)

Returns celebrities within a specific category.

### List All Celebrities

```
GET /api/compare/list
```

**Auth:** None (public)

Returns all celebrities in the database.

### Search Celebrities

```
GET /api/compare/search?q=einstein
```

**Auth:** None (public)

Searches celebrities by name. Minimum 2 characters.

### Get Celebrity Matches

```
GET /api/compare/celebrities
```

**Auth:** Required (JWT)

Returns celebrities ranked by chart similarity to the authenticated user.

**Response:**

```json
{
  "ok": true,
  "matches": [
    {
      "celebrity": { "id": "...", "name": "...", "type": "Generator" },
      "similarity": 0.87,
      "sharedGates": [1, 13, 25],
      "sharedChannels": ["1-8"]
    }
  ]
}
```

### Get Celebrity Match Detail

```
GET /api/compare/celebrities/:id
```

**Auth:** Required (JWT)

Returns detailed comparison between authenticated user and a specific celebrity.

---

## Authentication

### Get Current User

```
GET /api/auth/me
```

**Auth:** Required (JWT)

Returns the authenticated user's profile information.

**Response 200:**

```json
{
  "ok": true,
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "Alex",
    "tier": "individual",
    "email_verified": true,
    "totp_enabled": false,
    "created_at": "2026-01-15T10:30:00Z",
    "updated_at": "2026-03-17T14:22:00Z"
  }
}
```

**Errors:** 401 Unauthorized · 404 User not found

---

## Chart Management

### Save Chart

```
POST /api/chart/save
```

**Auth:** Required (JWT)

Saves the current chart to user's library for later access.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chart_data` | object | Yes | Full chart object from `/api/chart/calculate` |
| `label` | string | No | User-friendly name for this chart (e.g., "My Chart", "Partner's Chart", "Client: Sarah") |

**Example:**

```json
{
  "chart_data": { "type": "Projector", "profile": "6/2", ... },
  "label": "My Energy Blueprint"
}
```

**Response 201:**

```json
{
  "ok": true,
  "chart_id": "chart-456",
  "saved_at": "2026-03-17T14:25:00Z"
}
```

**Errors:** 400 Invalid chart data · 401 Unauthorized · 507 Storage error

---

### Get Chart History

```
GET /api/chart/history
```

**Auth:** Required (JWT)

Returns list of charts saved by the authenticated user.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | number | No | Maximum results (default: 20) |
| `offset` | number | No | Pagination offset (default: 0) |

**Response 200:**

```json
{
  "ok": true,
  "charts": [
    {
      "chart_id": "chart-456",
      "label": "My Energy Blueprint",
      "chart_type": "Projector",
      "profile": "6/2",
      "saved_at": "2026-03-17T14:25:00Z"
    },
    {
      "chart_id": "chart-457",
      "label": "Partner's Chart",
      "chart_type": "Generator",
      "profile": "3/6",
      "saved_at": "2026-03-16T09:10:00Z"
    }
  ],
  "total": 2,
  "limit": 20,
  "offset": 0
}
```

**Errors:** 401 Unauthorized

---

## Cluster Management

### List Clusters

```
GET /api/cluster/list
```

**Auth:** Required (JWT)

Returns all clusters the authenticated user is a member of.

**Response 200:**

```json
{
  "ok": true,
  "clusters": [
    {
      "cluster_id": "fam-789",
      "name": "Family Circle",
      "members_count": 4,
      "role": "owner",
      "created_at": "2026-02-01T08:00:00Z"
    },
    {
      "cluster_id": "team-890",
      "name": "Work Team",
      "members_count": 12,
      "role": "member",
      "created_at": "2026-01-10T11:30:00Z"
    }
  ]
}
```

**Errors:** 401 Unauthorized

---

### Leave Cluster

```
POST /api/cluster/leave
```

**Auth:** Required (JWT)

Removes the authenticated user from a cluster. If user is the owner and cluster has other members, ownership transfers to the longest-standing member.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cluster_id` | string | Yes | ID of the cluster to leave |

**Example:**

```json
{
  "cluster_id": "fam-789"
}
```

**Response 200:**

```json
{
  "ok": true,
  "message": "You have left the cluster 'Family Circle'"
}
```

**Errors:** 400 cluster_id required · 401 Unauthorized · 404 Cluster not found

---

## SMS Notifications

### Subscribe to SMS

```
POST /api/sms/subscribe
```

**Auth:** Required (JWT)

Subscribes user to SMS notifications.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phone_number` | string | Yes | E.164 format (e.g., `+12015551234`) |
| `notification_type` | string | No | Type of SMS to receive (e.g., `transit_alerts`, `daily_digest`). Default: all types |

**Example:**

```json
{
  "phone_number": "+12015551234",
  "notification_type": "transit_alerts"
}
```

**Response 201:**

```json
{
  "ok": true,
  "phone_number": "+12015551234",
  "subscribed_at": "2026-03-17T14:30:00Z"
}
```

**Errors:** 400 Invalid phone number · 401 Unauthorized · 409 Already subscribed

---

### Unsubscribe from SMS

```
POST /api/sms/unsubscribe
```

**Auth:** Required (JWT)

Unsubscribes user from SMS notifications.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phone_number` | string | Yes | E.164 format (e.g., `+12015551234`) |

**Example:**

```json
{
  "phone_number": "+12015551234"
}
```

**Response 200:**

```json
{
  "ok": true,
  "message": "Unsubscribed from SMS notifications"
}
```

**Errors:** 400 Invalid phone number · 401 Unauthorized · 404 Not subscribed

---

## Account Management

### Delete Account

```
DELETE /api/auth/account
```

**Auth:** Required (JWT)
**Rate Limit:** 3 requests / minute

Permanently deletes the user's account and all associated data. Stripe subscription is cancelled first. An audit record is logged for GDPR compliance.

### Export User Data

```
GET /api/auth/export
```

**Auth:** Required (JWT)

Returns all user data as JSON for GDPR data portability.

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/api/auth/delete-account` | 3 requests / minute |
| `/api/chart/calculate` | 60 requests / minute |
| `/api/profile/generate` | 10 requests / minute |
| `/api/transits/*` | 120 requests / minute |
| `/api/transits/forecast` | 30 requests / minute |
| All other `/api/*` | 60 requests / minute |

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1700000000
```

---

## Error Responses

All errors return JSON:

```json
{
  "ok": false,
  "error": "Error Type",
  "message": "Detailed description"
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request — missing or invalid fields |
| 401 | Unauthorized — missing or invalid JWT |
| 404 | Not found — unknown route |
| 429 | Rate limited — too many requests |
| 500 | Internal server error |
| 502 | Bad gateway — LLM API call failed |

---

## CORS

All responses include CORS headers allowing cross-origin requests. Preflight `OPTIONS` requests are handled automatically.

---

## Environment Secrets

Set via `wrangler secret put <NAME>`:

| Secret | Description |
|--------|-------------|
| `NEON_CONNECTION_STRING` | Neon PostgreSQL pooled connection string |
| `ANTHROPIC_API_KEY` | Claude API key |
| `TELNYX_API_KEY` | Telnyx API key for SMS |
| `TELNYX_PHONE_NUMBER` | Outbound SMS phone number |
| `JWT_SECRET` | HS256 JWT signing secret |
| `AI_GATEWAY_URL` | Cloudflare AI Gateway URL |

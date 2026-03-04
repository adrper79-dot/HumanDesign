# API Reference — Prime Self

**Base URL:** `https://prime-self-api.adrper79.workers.dev`

All responses are `application/json`. Protected endpoints require `Authorization: Bearer <accessToken>`.

> **Spec Accuracy Notice (2026-03-03 audit):**
> This spec has drifted from the actual implementation. The following endpoints are **documented below but NOT yet implemented** in the router:
> - `GET /api/auth/me` — not implemented
> - `POST /api/chart/save` — not implemented (auto-save in calculate is dead code per BL-C5)
> - `GET /api/chart/history` — not implemented
> - `GET /api/cluster/list` — not implemented
> - `POST /api/cluster/leave` — not implemented
> - `POST /api/sms/subscribe` — not implemented (opt-in only via inbound "START" SMS)
> - `POST /api/sms/unsubscribe` — not implemented (opt-out only via inbound "STOP" SMS)
>
> The following endpoints **exist in the router but are NOT documented below**:
> - `GET /api/profile/:id/pdf` — PDF export with R2 caching
> - `POST /api/cluster/create` — create a cluster
> - `POST /api/cluster/:id/synthesize` — cluster LLM synthesis
> - `GET /api/onboarding/intro` — public intro to 5 Forges
> - `GET /api/onboarding/forge` — personalized forge arc
> - `GET /api/onboarding/forge/:key` — specific forge arc
> - `GET /api/onboarding/chapter/:key/:n` — chapter content
> - `GET /api/onboarding/progress` — user chapter progress
> - `POST /api/onboarding/advance` — mark chapter read
> - `GET /api/practitioner/profile` — get practitioner profile
> - `DELETE /api/practitioner/clients/:id` — remove client (CORS-blocked per BL-C4)
>
> See [BACKLOG.md](../BACKLOG.md) items BL-M1 for details.

---

## Authentication

### `POST /api/auth/register`
Create a new account.

**Use this when:** A user signs up for the first time. This creates their account and returns access tokens so they can immediately use authenticated features without needing to login separately.

**What you get:** An access token (valid for 1 hour) and a refresh token (valid for 7 days). The user object includes their ID, email, and name. Store the access token for API requests and the refresh token to get new access tokens when they expire.

**Request**
```json
{
  "email": "user@example.com",    // Must be unique, will be checked
  "password": "s3cr3t!",           // Minimum 8 characters (enforced server-side)
  "name": "Alex"                   // Display name for the user
}
```
**Response 201**
```json
{
  "accessToken": "<jwt>",          // Include in Authorization header for protected endpoints
  "refreshToken": "<jwt>",          // Store securely - use to get new access tokens
  "user": {
    "id": 42,                       // Unique user ID - reference for all user data
    "email": "user@example.com",
    "name": "Alex"
  }
}
```
**Errors:** 400 missing fields · 409 email taken

**Example scenario:**
```
New user fills out signup form → POST /api/auth/register
→ Store accessToken in memory, refreshToken in secure storage
→ Redirect to "Calculate Your Chart" page
→ All subsequent API calls include "Authorization: Bearer <accessToken>"
```

---

### `POST /api/auth/login`
Exchange credentials for tokens.

**Use this when:** A returning user wants to access their saved charts and profiles. This verifies their password and issues fresh tokens.

**What you get:** New access and refresh tokens (previous tokens remain valid until expiry). You can replace old tokens with these to maintain session continuity.

**Request**
```json
{
  "email": "user@example.com",
  "password": "s3cr3t!"
}
```
**Response 200**
```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>",
  "user": { "id": 42, "email": "user@example.com", "name": "Alex" }
}
```
**Errors:** 400 missing fields · 401 wrong password · 404 not found

**Example scenario:**
```
User enters email + password → POST /api/auth/login
→ Store tokens → Fetch saved charts with GET /api/profile/list
→ Display "Welcome back, Alex! You have 3 saved profiles."
```

---

### `POST /api/auth/refresh`
Issue a new access token.

**Use this when:** Your access token expires (after 1 hour). Instead of forcing the user to login again, use their refresh token to get a new access token seamlessly in the background.

**What you get:** A fresh access token valid for another hour. The refresh token itself doesn't change.

**Request**
```json
{
  "refreshToken": "<jwt>"           // The refresh token from /register or /login
}
```
**Response 200**
```json
{
  "accessToken": "<jwt>"            // New access token - replace the old one
}
**Errors:** 401 invalid / expired refresh token

**Example scenario:**
```
User is browsing for 2 hours → Next API call returns 401 Unauthorized
→ Automatically POST /api/auth/refresh with stored refreshToken
→ Get new accessToken → Retry original request → User unaware of token refresh
```

---

### `GET /api/auth/me` 🔒 — ⚠️ NOT IMPLEMENTED
Return the authenticated user's profile. *(Planned but no route handler exists.)*

**Response 200**
```json
{ "id": 42, "email": "user@example.com", "name": "Alex", "isPractitioner": false }
```

---

## Geocoding

### `GET /api/geocode?q=<city>` (public)
Convert a city/location string to lat/lng and IANA timezone.

**Use this when:** User enters a birth location as text (like "Portland, OR" or "Tokyo, Japan"). You need coordinates and timezone to calculate an accurate chart.

**What you get:** Precise latitude/longitude for planetary calculations, the IANA timezone name (like "America/Los_Angeles"), and a formatted display name for showing back to the user.

**Why it matters:** Energy Blueprint calculations require knowing the exact rotation of Earth at birth time. Coordinates place the user geographically, and timezone converts their local birth time to UTC for astronomical calculations.

**Query params**

| Param | Required | Description |
|---|---|---|
| `q` | yes | Location string (minimum 2 characters) — e.g. `Tampa, FL, USA` or `London, UK` |

**Response 200**
```json
{
  "lat": 27.9506,                  // Latitude for chart calculation
  "lng": -82.4572,                 // Longitude for chart calculation
  "timezone": "America/New_York",  // IANA timezone for UTC conversion
  "displayName": "Tampa, Hillsborough County, Florida, United States"  // Show this to user
}
```
**Errors:** 400 `q` missing or too short · 404 location not found · 502 upstream geocoder unavailable

**Example scenario:**
```
User types "Seattle" in location field → onClick "Look Up"
→ GET /api/geocode?q=Seattle → Returns lat/lng/timezone
→ Auto-fill hidden lat/lng fields, set timezone dropdown
→ Display "✓ Seattle, Washington, USA · 47.6062°N, 122.3321°W · America/Los_Angeles"
→ User clicks "Calculate My Chart" with confidence that location is correct
```

**Caching:** Results cached in Workers KV for 30 days to reduce upstream geocoding API costs.

---

## Chart Calculation

### `POST /api/chart/calculate` (public)
Calculate a complete Energy Blueprint + Astrology chart from birth data.

**Use this when:** User has entered their birth date, time, and location and wants to see their chart. This is the core engine call that powers everything else. You can call this without authentication to show anonymous charts, or with authentication to enable saving.

**What you get:** A complete multi-system energy profile including:
- **Energy Blueprint data:** Type (Manifestor/Generator/Projector/Reflector), Profile (1/3, 2/4, etc.), Authority (decision-making strategy), Incarnation Cross (life purpose), defined Centers, Channels, and Gates with line activations
- **Astrology data:** Sun, Moon, and all planets with zodiac signs, degrees, houses, and major aspects
- **Timing:** Personality (birth time) and Design (88 days before birth) positions
- **Gene Keys:** Shadow/Gift/Siddhi for each gate activation

This is pure calculation data - no AI interpretation yet. Use the output as input for `/api/profile/generate` to get human-readable insights.

**Why it matters:** The chart is the foundation. All other features (profiles, transits, compatibility, rectification) depend on this calculation being accurate. We use Swiss Ephemeris for astronomical precision and an 8-layer calculation engine for Energy Blueprint logic.

**Request**
```json
{
  "birthDate": "1979-08-05",       // YYYY-MM-DD format
  "birthTime": "18:51",            // HH:mm 24-hour format - precision matters (chart changes every ~2 hours)
  "lat": 27.9506,                  // From /api/geocode or manual entry
  "lng": -82.4572,                 // From /api/geocode or manual entry
  "timezone": "America/New_York"   // IANA timezone - required for UTC conversion
}
```
**Response 200** — full chart object (abbreviated, actual response includes ~200 data points):
```json
{
  "type": "Projector",                           // Your energetic type (how you operate in the world)
  "profile": "6/2",                              // Life theme (conscious/unconscious roles)
  "authority": "Emotional – Solar Plexus",       // How you make correct decisions
  "cross": "Left Angle Cross of Refinement (33/19 | 2/1)",  // Your life purpose/direction
  "definedCenters": ["Solar Plexus", "Sacral", "Root"],     // Consistent energy sources
  "channels": [
    { "channel": "19-49", "name": "Synthesis" }  // Activated pathways between centers
  ],
  "gates": {
    "conscious": [19, 33, 2],                    // Gates active at birth time
    "unconscious": [50, 1, 49]                   // Gates active 88 days before birth (Design)
  },
  "planets": {
    "sun": {
      "sign": "Leo",                             // Zodiac sign
      "degree": 12.5,                            // Precise position in sign
      "gate": 33,                                // HD Gate number (1-64 from I Ching)
      "line": 6                                  // Specific line activation (1-6)
    }
    // ...moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto, nodes
  },
  "aspects": [
    {
      "planet1": "sun",
      "planet2": "moon",
      "type": "conjunction",                     // conjunction, opposition, trine, square, sextile
      "orb": 2.1                                 // Degrees away from exact aspect
    }
  ]
}
```
**Errors:** 400 missing / invalid fields

**Example scenario:**
```
Anonymous user → Enters birth data → POST /api/chart/calculate → Render chart visually
→ User sees "You're a 6/2 Projector with Emotional Authority"
→ Prompt: "Sign up to save your chart and get a full AI profile"
→ After signup → Automatically save chart → Redirect to profile generation
```

**Note:** Currently this endpoint does NOT save charts even for authenticated users due to a routing bug (see BL-C5). Charts are ephemeral unless explicitly saved via a future `/api/chart/save` endpoint.

---

### `POST /api/chart/save` 🔒 — ⚠️ NOT IMPLEMENTED
Save a calculated chart to the authenticated user's history. *(Auto-save in `/api/chart/calculate` exists but is dead code — see BL-C5.)*

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

### `GET /api/chart/history` 🔒 — ⚠️ NOT IMPLEMENTED
List the authenticated user's saved charts (newest first). *(No route handler exists.)*

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

### `POST /api/composite` (public)
Generate a relationship/compatibility chart between two people.

**Use this when:** Analyzing dynamics between partners, friends, family members, or team members. This shows how two energy systems interact - where you harmonize, where you create friction, and how to navigate differences.

**What you get:** A composite analysis showing:
- **Electromagnetic connections:** Which gates/channels activate between you (these create magnetic attraction and chemistry)
- **Companionship channels:** Complete channels formed by combining charts (shared strengths)
- **Defined/undefined overlaps:** Where both have definition (potential rigidity) vs. where one conditions the other (learning opportunities)
- **Authority clashes:** If both Emotional, need to wait together; if Sacral + Emotional, Sacral must wait for partner
- **Type dynamics:** Manifestor-Generator partnerships differ from Projector-Reflector ones

**Why it matters:** Understanding relationship mechanics prevents blame and creates compassion. "They're not wrong, they're just wired differently." Shows best practices for communication, decision-making as a unit, and leveraging complementary strengths.

**Request**
```json
{
  "personA": {
    "birthDate": "1979-08-05",
    "birthTime": "18:51",
    "lat": 27.9506,
    "lng": -82.4572,
    "timezone": "America/New_York"
  },
  "personB": {
    "birthDate": "1985-12-20",
    "birthTime": "06:30",
    "lat": 34.0522,
    "lng": -118.2437,
    "timezone": "America/Los_Angeles"
  }
}
```

**Response 200**
```json
{
  "personA": { /* full chart for Person A */ },
  "personB": { /* full chart for Person B */ },
  "composite": {
    "electromagneticConnections": [
      { "personA_gate": 5, "personB_gate": 15, "channel": "5-15", "theme": "Rhythm" }
    ],
    "companionshipChannels": [
      { "channel": "19-49", "definedBy": "both" }
    ],
    "authorityDynamics": "Person A: Emotional | Person B: Sacral → A must ride wave, B learns patience",
    "typeDynamics": "Generator + Projector → Generator provides energy, Projector guides/directs"
  }
}
```

**Example scenario:**
```
Couple signs up together → Each calculates their chart → Navigate to "Check Compatibility" tab
→ POST /api/composite with both birth data → Render split-screen showing both charts + connections highlighted
→ Display: "You have 3 electromagnetic channels - strong chemistry!"
→ Display: "Sarah is Emotional Authority - wait 24-48 hours for clarity on big decisions"
→ Relationship coaching prompt: "Book a couples reading to dive deeper"
```

---

### `POST /api/rectify` (public)
Birth time rectification - find the most accurate birth time when exact time is unknown.

**Use this when:** User knows approximate birth time but not exact time (e.g., "sometime in the afternoon" or "around 2pm"). This analyzes how the chart changes across a time window and helps narrow down the most likely birth time.

**What you get:** A breakdown showing how key chart elements (Type, Authority, Profile, Cross) change across the time window. For each time increment you get:
- Chart snapshot (what would your chart be at this time?)
- Change flags (did Type/Authority/Profile change compared to previous increment?)
- Stability score (how many elements stayed consistent?)

This helps identify "stable windows" where chart stays consistent vs. "transition windows" where small time shifts cause major chart changes.

**Why it matters:** Energy Blueprint charts shift every ~2 hours as gates change. If your birth time is off by 30 minutes, you might have the wrong Type, Authority, or Profile - making the entire reading inaccurate. Rectification helps you test different times and choose the one that "feels right" based on your lived experience.

**How to use results:** Generate charts for each time increment → Read descriptions → Choose the one that resonates most with your personality and life patterns → Use that time for your official chart.

**Request**
```json
{
  "birthDate": "1990-06-15",
  "birthTime": "14:30",              // Approximate time (best guess)
  "lat": 40.7128,
  "lng": -74.0060,
  "windowMinutes": 30,               // Check 30 minutes before and after (total 1 hour window)
  "stepMinutes": 5                   // Check every 5 minutes (12 snapshots total)
}
```

**Response 200**
```json
{
  "snapshots": [
    {
      "time": "14:00",               // This snapshot's birth time
      "type": "Projector",
      "authority": "Splenic",
      "profile": "6/2",
      "cross": "Right Angle Cross of Explanation",
      "changesFromPrevious": {       // What changed since last time increment?
        "type": false,               // Same type as 13:55
        "authority": false,
        "profile": false,
        "cross": true                // Cross changed!
      }
    },
    {
      "time": "14:05",
      "type": "Projector",
      "authority": "Splenic",
      "profile": "6/2",
      "cross": "Right Angle Cross of Explanation",
      "changesFromPrevious": {
        "type": false,
        "authority": false,
        "profile": false,
        "cross": false               // Stable - no changes
      }
    }
    // ...more snapshots
  ],
  "summary": {
    "mostStableTime": "14:05",       // Time with fewest changes
    "stabilityScore": 0.92,          // 92% of elements remained consistent
    "criticalTransitions": [
      "13:58 - Type changed from Generator to Projector",
      "14:23 - Authority changed from Sacral to Splenic"
    ]
  }
}
```

**Example scenario:**
```
User: "I was born around 2:30pm but I'm not sure exactly"
→ Fill rectify form: date, ~2:30pm, location, window=60 min, step=10 min
→ POST /api/rectify → Loading: "Analyzing 13 time windows..."
→ Display table: 1:30pm (Generator/Sacral), 1:40pm (Generator/Sacral), 1:50pm (Projector/Splenic) ← transition
→ User reads Generator description: "Doesn't resonate, I don't have consistent energy"
→ User reads Projector description: "Yes! I'm here to guide, not do the work"
→ User chooses 1:50pm as their official birth time → Recalculate chart with corrected time
```

**Performance:** Typical rectification (60 min window, 5 min steps = 13 calculations) takes 2-3 seconds.

---

## Profiles (Prime Self Profile)

### `POST /api/profile/generate` 🔒
Generate an AI-synthesized Prime Self profile from birth data.

**Use this when:** User wants a human-readable interpretation of their chart. Raw chart data (gates, channels, aspects) is technical - this endpoint transforms it into actionable insights using AI synthesis across multiple knowledge systems.

**What you get:** A comprehensive written profile (typically 600-1200 words) that integrates:
- **Forge Archetype:** Your role in the Prime Self narrative (Savannah mythos)
- **Knowledge Profile:** Your learning style and information processing approach
- **Decision Architecture:** How to make aligned choices using your Authority
- **Current Activation:** What energies are most active in your life right now
- **Practice Recommendations:** Concrete techniques for embodying your design

Plus a PDF URL for downloading and sharing the profile.

**Why it matters:** This turns abstract chart patterns into practical life guidance. The AI synthesis uses RAG (Retrieval-Augmented Generation) to ground insights in verified Energy Blueprint, Gene Keys, Astrology, and Numerology knowledge - not generic ChatGPT fluff.

**How it works:** LLM failover cascade (Anthropic Claude → Grok → Groq) ensures 99%+ uptime. The synthesis prompt includes all chart data + knowledge base excerpts + grounding audit rules to prevent hallucination.

**Request**
```json
{
  "chartId": 7,                      // Optional - if provided, loads chart from DB
  "birthDate": "1979-08-05",         // Required if chartId not provided
  "birthTime": "18:51",
  "lat": 27.9506,
  "lng": -82.4572,
  "timezone": "America/New_York",
  "question": "What is my life purpose?"  // Optional - focus synthesis on specific question
}
```
**Response 200**
```json
{
  "profileId": 3,                    // Database ID for this profile
  "archetype": "The Catalyst",       // High-level Prime Self archetype
  "profile": {
    "forgeArchetype": "...",         // Your role in the Forge mythology (e.g., Lightbringer, Architect)
    "knowledgeProfile": "...",       // How you learn and process information
    "decisionArchitecture": "...",   // Step-by-step guide to your Authority
    "currentActivation": "...",      // Gates/channels most active in your chart
    "practiceRecommendations": ["..."]  // Daily practices aligned with your design
  },
  "pdfUrl": "https://r2.example.com/profiles/42/3.pdf"  // Download link (cached in R2)
}
```
**Errors:** 400 missing fields · 404 chart not found or not owned · 429 rate limited (5 requests/minute)

**Example scenario:**
```
User calculates chart → Sees basic type/profile
→ Clicks "Get Full Profile" → POST /api/profile/generate with chartId
→ Loading state "Synthesizing your Prime Self profile..." (10-30 seconds)
→ Profile renders → Sections expandable → "Download PDF" button
→ User reads: "As a 6/2 Projector with Emotional Authority, you're here to guide others..."
→ Shares PDF with friends: "This is scarily accurate"
```

**Performance:** Average generation time 15 seconds. Profiles cached in DB - regenerating same chart returns cached version.

---

### `GET /api/profile/list` 🔒
List all profiles for the authenticated user.

**Use this when:** User wants to see their saved profiles, or you're building a "My Charts" dashboard.

**What you get:** Array of profile summaries (id, archetype, birth date, creation timestamp). Each item can be expanded by calling `/api/profile/:id`.

**Response 200** — array of profile summaries (id, archetype, createdAt).

**Example scenario:**
```
User logs in → Automatically GET /api/profile/list
→ Display: "You have 3 saved profiles"
→ Show list: "Your Chart (2024-01-15), Mom's Chart (2024-02-10), Partner Chart (2024-03-01)"
→ Click on any → GET /api/profile/:id → Show full profile
```

---

### `GET /api/profile/:id` 🔒
Retrieve a single profile by ID.

**Use this when:** User clicks on a saved profile from their list, or you're loading a specific profile by URL (e.g., `/dashboard/profile/123`).

**What you get:** Full profile including all sections (`forgeArchetype`, `knowledgeProfile`, etc.) plus metadata (birth data, archetype name, PDF URL, creation date).

**Response 200** — full profile including `raw_json`.

---

## Transits

### `GET /api/transits/today` (public)
Current planetary positions with Energy Blueprint gate/line activations.

**Use this when:** User wants to see "today's energy" or understand current cosmic weather. Also useful for practitioners analyzing client charts in the context of current transits.

**What you get:** Real-time positions of all 10 planets (Sun through Pluto) plus North/South Nodes, each with:
- Zodiac sign and degree (Western Astrology)
- Energy Blueprint Gate (1-64) and Line (1-6)
- Gene Key activation (Shadow/Gift/Siddhi themes)

If you provide a `natalChartId`, you also get aspects between current transits and the natal chart (e.g., "Transit Jupiter conjunct your natal Sun").

**Why it matters:** Understanding current planetary activations helps you:
- Time important decisions (e.g., wait for emotional clarity if the Moon is transiting your Solar Plexus)
- Recognize why certain themes are showing up in your life
- Identify high-energy periods vs. rest periods
- See how transits interact with your birth chart

**Query params (optional)**

| Param | Description |
|---|---|
| `lat` | Observer latitude — for precise local time (usually unnecessary, since transits are global) |
| `lng` | Observer longitude |
| `natalChartId` | Chart ID — if provided, also returns aspects between transits and natal positions |

**Response 200**
```json
{
  "timestamp": "2025-07-09T14:30:00Z",      // Exact calculation time (UTC)
  "transits": {
    "sun": {
      "sign": "Cancer",                     // Zodiac sign
      "degree": 17.4,                       // Precise degree in sign
      "gate": 52,                           // HD Gate (Stillness/Mountain)
      "line": 4                             // Line 4 - specific sub-theme
    },
    "moon": {
      "sign": "Scorpio",
      "degree": 3.1,
      "gate": 44,                           // Gate 44 (Alertness/Coming to Meet)
      "line": 2
    }
    // ...all planets
  },
  "natalAspects": [                         // Only if natalChartId provided
    {
      "transitPlanet": "jupiter",
      "natalPlanet": "sun",
      "type": "trine",                      // Harmonious aspect
      "orb": 1.2                            // Degrees from exact
    }
  ]
}
```

**Example scenario:**
```
User opens app → GET /api/transits/today → Display at top of screen:
"☀️ Sun in Gate 52 (Stillness) - Time to pause and find center"
"🌙 Moon in Gate 44 (Alertness) - Trust your instincts today"
→ Premium feature: "Check how this affects YOUR chart" → GET /api/transits/today?natalChartId=123
→ Display: "Jupiter trine your Sun - Expansion and opportunities this month"
```

---

### `GET /api/transits/forecast` (public)
Transit forecast: day-by-day gate ingresses and key aspects over a date range.

**Use this when:** User wants to plan ahead - see what energies are coming in the next week, month, or for a specific event date. Great for scheduling important activities or understanding cycles.

**What you get:** A daily breakdown showing:
- When planets change gates (gate ingresses)
- Major aspects forming each day
- Peak energy days vs. rest days
- Lunar gates (Moon changes gates every ~2 hours, shows daily summary)

**Why it matters:**
- **Timing decisions:** Launch a project when Sun enters a gate aligned with your strategy
- **Event planning:** Choose dates for weddings, business launches, etc. based on favorable transits
- **Cycle awareness:** Understand 13-day Sun gate cycles, 28-day lunar cycles, slower Planet cycles
- **Preparation:** Know when challenging aspects are coming (e.g., Saturn square your Chart) and prepare mentally

**Query params**

| Param | Required | Description |
|---|---|---|
| `startDate` | yes | ISO date `YYYY-MM-DD` - beginning of forecast window |
| `days` | no | Number of days to forecast (default 7, max 30) |
| `lat` | no | Observer latitude (usually not needed - transits are global) |
| `lng` | no | Observer longitude |

**Response 200** — array of daily transit objects showing gate changes and aspects.

**Example scenario:**
```
User planning next month → GET /api/transits/forecast?startDate=2025-08-01&days=30
→ Render calendar view: Each day shows Sun gate, major aspects
→ Highlight: "Aug 7: Sun enters Gate 33 (Retreat) - Good for reflection"
→ Highlight: "Aug 15: Venus trine Jupiter - Great day for relationships/money"
→ User books vacation Aug 7-10 to align with Retreat energy
```

---

## Practitioners

### `POST /api/practitioner/register` 🔒
Register the authenticated user as a practitioner.

**Use this when:** A certified Energy Blueprint analyst, astrologer, or coach wants to manage multiple client charts and readings within the platform. This unlocks practitioner features like client roster management and professional dashboard.

**What you get:** Practitioner status on your account, which enables:
- Client roster (add/remove clients)
- Access to client charts (with permission)
- Professional profile listing (if `isPublic: true`)
- Bulk chart generation tools
- Session notes and case history

**Request**
```json
{
  "bio": "Certified Energy Blueprint analyst with 5 years experience...",  // Public bio for profile
  "specialties": ["Projector", "Generator", "Relationships"],              // Your focus areas
  "isPublic": true                                                         // Show in practitioner directory?
}
```
**Response 201** — practitioner record with ID and status.

**Example scenario:**
```
Professional analyst signs up → Account settings → "Become a Practitioner"
→ POST /api/practitioner/register → Dashboard unlocks "Clients" tab
→ Can now add clients → Generate charts for clients → Track sessions
→ If isPublic=true → Listed in "Find a Practitioner" directory with bio
```

---

### `GET /api/practitioner/clients` 🔒
List clients associated with the authenticated practitioner.

**Use this when:** Practitioner wants to see their full client roster or build a client management dashboard.

**What you get:** Array of clients with names, email (if consented), chart count, and last session date.

**Example scenario:**
```
Practitioner logs in → Dashboard shows: "You have 23 active clients"
→ GET /api/practitioner/clients → Display client list
→ Click client → GET /api/practitioner/client/:id/charts → See all their charts
```

---

### `POST /api/practitioner/client` 🔒
Add a client (by email) to the practitioner's roster.

**Use this when:** Practitioner wants to track a new client. The client must have an account (they'll be notified of the connection request).

**What you get:** Client relationship created. Client receives notification: "Jane Smith (Practitioner) added you to their roster - Accept?"

**Request**
```json
{
  "clientEmail": "client@example.com",   // Client must have existing account
  "notes": "Initial reading 2025-07-09"  // Optional session notes
}
```

**Example scenario:**
```
In-person session → Client creates account → Provides email
→ Practitioner adds client → POST /api/practitioner/client
→ Client approves → Practitioner can now view/generate charts for client
→ Session notes stored: "Discussed Emotional Authority, recommended 48hr decisions"
```

---

### `GET /api/practitioner/client/:clientId/charts` 🔒
Retrieve a client's charts. Practitioner must have the client in their roster.

**Use this when:** Preparing for a client session and need to review their birth chart or previously generated profiles.

**What you get:** All of the client's calculated charts and generated profiles (requires client consent).

**Example scenario:**
```
Session tomorrow → GET /api/practitioner/client/47/charts
→ Display: Client has 2 charts (natal + partner composite)
→ Load natal chart → Review Gene Keys, current transits
→ Prepare session notes: "Discuss Gate 5 (patience) + current Solar Plexus transits"
```

---

## Clusters

Clusters analyze group dynamics for teams, families, communities, or any collection of people. The system calculates how multiple energy systems interact and where the group has collective strengths/blindspots.

### `GET /api/cluster/list` 🔒 — ⚠️ NOT IMPLEMENTED
List all clusters. *(No route handler exists.)*

**Use this when:** Building a "My Groups" dashboard for users who belong to multiple clusters.

---

### `POST /api/cluster/create` 🔒
Create a new cluster (team/family/community group).

**Use this when:** User wants to analyze their team, family, friend group, or community. This creates a container for adding members and generating group analysis.

**What you get:** A cluster ID and initial settings. You can then add members (each needs a chart) and generate group synthesis.

**Request**
```json
{
  "name": "Marketing Team",           // Cluster name
  "description": "Q1 2025 Product Launch Squad",  // Optional context
  "type": "team"                      // "team" | "family" | "community" | "other"
}
```

**Response 201**
```json
{
  "clusterId": 42,
  "name": "Marketing Team",
  "memberCount": 0,                   // Initially empty - add members next
  "createdAt": "2025-07-09T14:30:00Z"
}
```

**Example scenario:**
```
Team manager → "Analyze My Team" → Create cluster
→ POST /api/cluster/create with team name
→ Add team members (by email or profileId)
→ Generate group synthesis → Display: "Your team has strong Manifestor energy (3 of 6) - initiate boldly!"
```

---

### `GET /api/cluster/:id` 🔒
Get cluster details, member list, and group chart summary.

**Use this when:** Loading a cluster dashboard or preparing to add members. Shows who's in the cluster and basic collective statistics.

**What you get:**
- Cluster metadata (name, description, creation date)
- Member list (names, types, profiles)
- Collective statistics:
  - Type breakdown (e.g., "2 Generators, 3 Projectors, 1 Manifestor")
  - Most common defined centers
  - Group authority dynamics
  - Potential friction points

**Response 200**
```json
{
  "id": 42,
  "name": "Marketing Team",
  "description": "Q1 2025 Product Launch Squad",
  "members": [
    { "userId": 7, "name": "Alex", "type": "Generator", "profile": "5/1", "definedCenters": ["Sacral", "Throat"] },
    { "userId": 12, "name": "Jamie", "type": "Projector", "profile": "2/4", "definedCenters": ["Ajna", "Throat"] }
    // ...more members
  ],
  "statistics": {
    "typeBreakdown": { "Generator": 2, "Projector": 3, "Manifestor": 1 },
    "mostDefinedCenters": ["Throat", "Ajna"],  // Centers defined in most members
    "collectiveChannels": ["Throat-Ajna"],     // Channels formed between members
    "authorityMix": ["Emotional", "Splenic", "Sacral"]  // Decision-making styles present
  }
}
```

**Example scenario:**
```
User clicks cluster from list → GET /api/cluster/42
→ Display member cards: "Alex (Generator 5/1), Jamie (Projector 2/4)..."
→ Show stats: "60% of team is Sacral (doers), 40% non-Sacral (guides)"
→ Recommendation: "Let Generators respond, Projectors guide strategy"
```

---

### `POST /api/cluster/join` 🔒
Join an existing cluster (requires invite code or approval).

**Use this when:** User receives a cluster invite link or wants to join a public community cluster.

**What you get:** Membership confirmation. Your chart is now included in the cluster's group analysis.

**Request**
```json
{
  "clusterId": 2,
  "inviteCode": "xyz789"    // Optional - required for private clusters
}
```

**Example scenario:**
```
User clicks invite link: primeself.app/clusters/42?invite=xyz789
→ POST /api/cluster/join with clusterId + inviteCode
→ Confirmation: "You joined Marketing Team!"
→ Your chart now contributes to team dynamics analysis
```

---

### `POST /api/cluster/:id/synthesize` 🔒
Generate AI synthesis of group dynamics.

**Use this when:** Cluster has members added and you want written insights about how the group functions together.

**What you get:** AI-generated report (500-800 words) analyzing:
- Collective strengths (e.g., "Strong intuitive center - trust group hunches")
- Potential challenges (e.g., "No defined Sacral - group lacks sustainable work energy")
- Communication strategies (e.g., "3 Emotional authorities - never make rush decisions")
- Role optimization (e.g., "Let Sarah (Manifestor) initiate, others respond")
- Decision-making process (e.g., "Wait for Jamie's emotional clarity before finalizing")

**Request**
```json
{
  "clusterId": 42,
  "question": "How should we make major decisions?"  // Optional - focus synthesis
}
```

**Response 200**
```json
{
  "synthesis": "Your Marketing Team combines powerful manifestation energy (2 Manifestors) with strategic guidance (3 Projectors)...",
  "keyInsights": [
    "Let Alex and Jamie initiate - they're built to start things",
    "Wait for Sam's emotional clarity on big calls - Emotional Authority",
    "Projectors need recognition - invite their input explicitly"
  ],
  "decisionProtocol": "1. Manifestors inform what they'll initiate → 2. Generators respond → 3. Wait for Emotional wave → 4. Projectors synthesize final strategy"
}
```

**Example scenario:**
```
Team forming stage → All members added → Manager clicks "Analyze Group Dynamics"
→ POST /api/cluster/42/synthesize
→ Render report: "Your team's secret weapon is..."
→ Team meeting: Review insights together → Establish working agreements based on design
→ Result: 40% reduction in decision fatigue, clearer roles, better communication
```

---

### `POST /api/cluster/leave` 🔒 — ⚠️ NOT IMPLEMENTED
Leave a cluster. *(No route handler exists.)*

**Use this when:** User wants to exit a cluster they've joined.

```json
{ "clusterId": 2 }
```

---

## Onboarding

### `GET /api/onboarding/story` 🔒
Return the personalised Savannah story arc for the authenticated user's Forge archetype.

---

## SMS

### `POST /api/sms/subscribe` 🔒 — ⚠️ NOT IMPLEMENTED
Subscribe the authenticated user to daily transit SMS digests. *(SMS opt-in currently only works via inbound "START" text.)*
```json
{ "phoneNumber": "+18005551234" }
```

### `POST /api/sms/unsubscribe` 🔒 — ⚠️ NOT IMPLEMENTED
Unsubscribe from SMS digests. *(SMS opt-out currently only works via inbound "STOP" text.)*

### `POST /api/sms/send-digest` (internal / cron)
Triggered by the daily cron to send SMS digests.

---

## Health

### `GET /api/health` (public)
Liveness check. Always returns 200.

```json
{ "status": "ok", "endpoints": 32, "version": "0.5.0" }
```

> **Note (BL-m2):** The `version` and `endpoints` values are hardcoded and stale. Actual package version is `0.2.0` and actual route count is 33.

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

> **⚠️ Spec/implementation mismatch (BL-M13):** The values below are the *intended* limits. The actual code in `rateLimit.js` uses different values: `calculate=60/min, profile=10/min, transits=120/min`. Auth and geocode have no dedicated rate limits in code (fall through to default 60/min).

| Endpoint group | Limit (spec) | Limit (actual code) |
|---|---|---|
| `/api/auth/*` | 10 req / minute per IP | 60 (default) |
| `/api/profile/generate` | 5 req / minute per user | 10 / minute |
| `/api/geocode` | 30 req / minute per IP | 60 (default) |
| `/api/chart/calculate` | 60 req / minute per IP | 60 / minute |
| `/api/transits/*` | 60 req / minute per IP | 120 / minute |
| All other endpoints | 60 req / minute per IP | 60 (default) |

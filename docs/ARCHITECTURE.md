# Architecture — Prime Self

## System Overview

```
Browser / SPA
     │  HTTPS
     ▼
Cloudflare Workers (Edge — global PoP)
     │  Workers KV  ─────────── chart cache / geocode cache (30-day TTL)
     │  R2           ─────────── PDF exports
     │  Cron trigger ─────────── daily transit snapshot (06:00 UTC)
     │
     ├── Neon PostgreSQL (pooled connection string)
     │       users, charts, profiles, practitioners,
     │       practitioner_clients, clusters, cluster_members,
     │       transit_snapshots, _migrations
     │
     ├── Anthropic Claude API  ──── Primary LLM (Layer 8 synthesis)
     ├── xAI Grok API          ──── Failover LLM 2
     └── Groq API              ──── Failover LLM 3
```

All network I/O happens inside the Worker. The frontend is a static single-file SPA deployed to Cloudflare Pages; it calls the Worker API over HTTPS.

---

## Request Lifecycle

```
1. Browser → Worker
2. CORS middleware (allow configured origins)
3. Rate-limit middleware (per-route limits via KV counters)
4. Public route check  → skip auth
   Protected route     → verify JWT (HS256, 24h TTL)
5. Route handler (one module per endpoint group)
6. Handler may call:
   a. Engine (pure JS — no network)
   b. Neon DB (via `@neondatabase/serverless`)
   c. LLM (Anthropic → Grok → Groq failover)
   d. Workers KV (read/write cache)
   e. R2 (PDF generation/retrieval)
7. JSON response → browser
```

---

## Calculation Engine — Layers 1–8

All deterministic astronomical and HD calculations live in `src/engine/`. Layer 8 hands off to the LLM.

| Layer | Module | What it computes |
|---|---|---|
| 1 | `julian.js` | Julian Day Number + Sun longitude (Meeus Ch. 7, 25) |
| 2 | `planets.js` | All planetary longitudes + nodes (JPL Keplerian + Meeus lunar) |
| 3 | `design.js` | Design-side JDN (−88° solar arc) + design planetary positions |
| 4 | `gates.js` | Ecliptic longitude → HD gate/line/color/tone/base (64-gate wheel) |
| 5 | `chart.js` | Centers, channels, type, authority, profile, definition, cross |
| 6 | `astro.js` | Western astrology — signs, Placidus houses, aspects, ASC/MC |
| 7 | `transits.js` | Current transit positions, gate activations, transit-to-natal aspects |
| 8 | `synthesis.js` (LLM) | Natural-language Prime Self profile from structured chart data |
| — | `numerology.js` | Life Path, Personal Year/Month/Day, Tarot Birth Card |

Entry point: `src/engine/index.js` — exports `calculateFullChart({ year, month, day, hour, minute, second, lat, lng })` (all times UTC) and returns the full structured payload consumed by handlers.

### Transit calculation

`src/engine/transits.js` exports:
- `getCurrentTransits(natalChart, natalAstro, nowJDN?)` — current planetary positions + gate activations + transit-to-natal aspects
- `getTransitForecast(natalChart, natalAstro, startDate, endDate, options?)` — daily gate ingresses + key aspects over a date range (max 366 days)

---

## Database Schema

Managed via `workers/src/db/migrate.sql` (canonical DDL) and `workers/src/db/migrate.js` (runner). All timestamps are UTC.

```sql
users                   -- email, password_hash, phone, birth_date, birth_time, birth_tz, lat, lng
charts                  -- user_id, hd_json (JSONB), astro_json (JSONB), numerology_json (JSONB)
profiles                -- user_id, chart_id, profile_json (JSONB), model_used, grounding_audit (JSONB)
practitioners           -- user_id (FK), certified, tier
practitioner_clients    -- practitioner_id, client_user_id
clusters                -- name, created_by, challenge
cluster_members         -- cluster_id, user_id, forge_role
transit_snapshots       -- snapshot_date (UNIQUE), positions_json (JSONB)
sms_messages            -- user_id, phone, message_type, status, telnyx_message_id
```

Foreign keys with `ON DELETE CASCADE` on user-owned rows. Chart and profile data stored as `JSONB`.

> **Known issue (BL-C3):** `migrate.js` and `migrate.sql` have drifted — see [BACKLOG.md](../BACKLOG.md#bl-c3--schema-drift-between-migratejs-and-migratesql).

---

## Authentication Flow

```
POST /api/auth/register
  → PBKDF2-SHA256 hash (100 000 iterations, 32-byte salt, 64-byte dk)
  → INSERT users
  → return {accessToken (24h), refreshToken (30d)}

POST /api/auth/login
  → fetch user, verify PBKDF2
  → return tokens

POST /api/auth/refresh
  → validate refreshToken, issue new accessToken

Middleware (workers/src/middleware/auth.js)
  → parse Authorization: Bearer <jwt>
  → verify HS256 signature (JWT_SECRET)
  → attach userId to request context
```

---

## LLM Failover

```javascript
// workers/src/lib/llm.js
providers = [
  { name: 'anthropic', key: env.ANTHROPIC_API_KEY, models: { opus: 'claude-opus-4-20250514', sonnet: 'claude-sonnet-4-20250514', haiku: 'claude-3-5-haiku-20241022' } },
  { name: 'grok',      key: env.GROK_API_KEY,      model: 'grok-beta'                  },
  { name: 'groq',      key: env.GROQ_API_KEY,      model: 'llama-3.3-70b-versatile'    },
]
// Tries each in order; on 4xx/5xx or network error, moves to next provider.
// Throws only if all three fail.
```

Optionally routes through a Cloudflare AI Gateway URL for caching + observability.

---

## Known Issues & Technical Debt

For the full itemized backlog, see [BACKLOG.md](../BACKLOG.md).

**Critical (blocking production):**
- Neon HTTP query driver uses an incorrect API pattern — all DB operations fail (BL-C1)
- `migrate.js` doesn't `await` its async `getClient()` call (BL-C2)
- Schema drift between `migrate.js` and `migrate.sql` (BL-C3)
- CORS `Access-Control-Allow-Methods` missing `DELETE` (BL-C4)
- Chart auto-save is dead code — route is public so `request._user` is always undefined (BL-C5)
- `parseToUTC` produces negative minutes for some timezone offsets (BL-C6)

**Architectural debt:**
- Duplicate JWT implementation in `handlers/auth.js` and `middleware/auth.js` (BL-M9)
- Duplicate RAG logic in `synthesis.js` and `rag.js` (BL-M8)
- `engine-compat.js` only injects 9 of 20+ data files into Workers runtime (BL-M12)
- 7 documented API endpoints not implemented; 10+ implemented endpoints not documented (BL-M1)
- Gene Keys knowledgebase 59% complete (38/64) (BL-M5)

**Test coverage gaps:**
- 190 tests pass for engine + handler validation
- Zero coverage for: middleware, DB layer, LLM failover, cron, SMS, practitioner, cluster, onboarding, PDF handlers

---

## Geocoding

`GET /api/geocode?q=<city>` (public route, no auth)

1. Check KV key `geo:{q.toLowerCase()}` — return cached result if present (TTL 30 days)
2. `fetch` OpenStreetMap Nominatim → get `lat`, `lng`, `display_name`
3. `fetch` BigDataCloud `/api/get-timezone-by-location` → get IANA timezone string
4. Fallback: `longitudeTimezone(lng)` — longitude-band heuristic if BigDataCloud unavailable
5. Store in KV; return `{lat, lng, timezone, displayName}`

Both upstream APIs are free with no key required. Nominatim requires a `User-Agent` header (set to `prime-self-worker/1.0`).

---

## Cron / Scheduled Tasks

`wrangler.toml` schedules:
```toml
[triggers]
crons = ["0 6 * * *"]
```

The `scheduled()` handler in `workers/src/index.js`:
- Calculates current transit snapshot (no natal reference)
- Stores in `transit_snapshots` table keyed by UTC date
- Optionally fires SMS digest via Telnyx to subscribed users

---

## File Storage (R2)

PDF exports of profiles are generated in-worker and stored in the `prime-self-pdfs` R2 bucket. The key pattern is `profiles/{userId}/{profileId}.pdf`. A time-limited signed R2 URL is returned to the client.

---

## Edge Caching Strategy

| Data type | Cache location | TTL |
|---|---|---|
| Geocode results | Workers KV | 30 days |
| Today's transits | Workers KV | 1 hour |
| Chart calculations | Workers KV | Permanent (deterministic) |
| LLM profiles | Neon DB (`profiles.raw_json`) | Permanent |
| PDF exports | R2 | Permanent |

---

## Verification & Testing

### Dual Verification Anchors

All chart calculations are validated against two reference cases:

**AP** (Aug 5, 1979, 22:51 UTC, Tampa FL)
- Life Role: 6/2, Pattern: Guide, Decision Style: Emotional Wave Navigation
- P Sun: Gene Key 33 Line 6 (high-line boundary test)
- Full planetary verification across all 9 bodies + nodes

**0921** (Sep 21, 1983, 21:30 UTC, Naples FL)
- Life Role: 1/3, Pattern: Builder-Initiator, Decision Style: Emotional Wave Navigation
- P Sun: Gene Key 46 Line 1 (low-line boundary test)
- Cross-validated against professional reference chart

Both anchors are tested in `tests/engine.test.js` and verified on every deployment.

### Accuracy Guarantees

- **Sun longitude**: ±0.01° (Meeus Ch. 25 low-accuracy method)
- **Moon**: ±0.3° (50-term truncated ELP2000)
- **Planets**: ±0.05° for inner planets, ±0.5° for outer planets (JPL Keplerian elements)
- **Line boundaries**: 0.9375° per line; edge cases within ±0.0001° resolve deterministically

See [Lessons Learned](LESSONS_LEARNED.md) for debugging methodology and common issues.

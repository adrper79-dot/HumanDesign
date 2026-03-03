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
| 1 | `jde.js` | Julian Day Number + ΔT correction |
| 2 | `solar.js` | Sun/Earth orbital mechanics (longitude, latitude, distance) |
| 3 | `planets.js` | All 9 HD bodies via VSOP87 truncated series |
| 4 | `hd_gates.js` | Zodiac degree → HD gate + line (64-gate wheel) |
| 5 | `hd_centers.js` | Gate activations → defined/undefined centers |
| 6 | `hd_channels.js` | Paired gates → channels → type/authority derivation |
| 7 | `aspects.js` | Western astrology aspects (conjunction through quincunx) |
| 8 | `synthesis.js` (LLM) | Natural-language profile from structured chart data |

Entry point: `src/engine/index.js` — exports `calculateFullChart(dateUtc, lat, lng)` and returns the full structured payload consumed by handlers.

### Transit calculation

`src/engine/transits.js` exports:
- `getCurrentTransits(lat, lng)` — current planetary positions + gate activations + aspects to natal (when natal provided)
- `forecastTransits(startDate, days, natal)` — daily gate ingresses + key aspects over a range

---

## Database Schema

Managed via `workers/src/db/migrate.js`. All timestamps are UTC.

```sql
users                   -- email, hashed_password, name, practitioner_flag
charts                  -- user_id, birth_date, lat, lng, city_name, raw_json
profiles                -- chart_id, user_id, archetype, raw_json, pdf_r2_key
practitioners           -- user_id (FK), bio, specialties, public_flag
practitioner_clients    -- practitioner_id, client_user_id
clusters                -- name, archetype, description
cluster_members         -- cluster_id, user_id
transit_snapshots       -- snapshot_date, raw_json (written by cron)
_migrations             -- migration_id, applied_at
```

Foreign keys with `ON DELETE CASCADE` on user-owned rows. `charts.raw_json` and `profiles.raw_json` are `JSONB`.

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
  { name: 'anthropic', key: env.ANTHROPIC_API_KEY, model: 'claude-3-5-sonnet-20241022' },
  { name: 'grok',      key: env.GROK_API_KEY,      model: 'grok-beta'                  },
  { name: 'groq',      key: env.GROQ_API_KEY,      model: 'llama-3.3-70b-versatile'    },
]
// Tries each in order; on 4xx/5xx or network error, moves to next provider.
// Throws only if all three fail.
```

Optionally routes through a Cloudflare AI Gateway URL for caching + observability.

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

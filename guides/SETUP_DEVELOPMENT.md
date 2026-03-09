# Setup Development Environment

Complete step-by-step guide to get Prime Self running locally.

**Time**: ~10 minutes  
**Prerequisites**: macOS, Linux, or Windows with WSL2

---

## Prerequisites

Ensure you have:
- **Node.js 18+** (`node --version`)
- **npm 9+** (`npm --version`)
- **Git** (`git --version`)
- **A code editor** (VS Code recommended)

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/adrper79-dot/HumanDesign.git
cd HumanDesign
```

---

## Step 2: Install Dependencies

```bash
npm install
```

This installs:
- Frontend dependencies (Vite, etc.)
- Worker dependencies (Wrangler, esbuild)
- Test dependencies (Vitest)

---

## Step 3: Configure Secrets & Environment

See **[ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)** for the complete reference.

### Minimal Setup (For Local Development)

For local testing without external services, you only need:

```bash
# Create .env file (optional for local-only testing)
# Most Worker secrets are only required for deployment
```

### Full Setup (To Test Integrations Locally)

If you want to test Stripe, SMS, or LLM features locally:

1. **Neon PostgreSQL** (database)
   - Create account: https://neon.tech
   - Create project → copy "Pooled connection string"
   - Set secret: `npx wrangler secret put NEON_CONNECTION_STRING`

2. **Anthropic API** (LLM synthesis)
   - Create account: https://console.anthropic.com
   - Create API key
   - Set secret: `npx wrangler secret put ANTHROPIC_API_KEY`

3. **Stripe** (payments) — Optional, see [STRIPE_INTEGRATION.md](STRIPE_INTEGRATION.md)

4. **Telnyx** (SMS) — Optional, see [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md#telnyx)

---

## Step 4: Run the Development Server

### Frontend Only (Static UI Development)

```bash
# From project root
npm run dev
```

Opens: http://localhost:5173 (or assigned port)

**Note**: API calls will fail without a backend. To test the full stack, follow "Full Stack Development" below.

### Full Stack Development (Frontend + Worker)

You'll need to run both servers simultaneously.

**Terminal 1 — Frontend**:
```bash
npm run dev
# Runs on http://localhost:5173
```

**Terminal 2 — Worker (Backend)**:
```bash
cd workers
npx wrangler dev
# Runs on http://localhost:8787
```

Frontend will auto-proxy API requests to `http://localhost:8787`.

---

## Step 5: Verify Everything Works

### Frontend Only
- Open http://localhost:5173 in browser
- Check console (F12) for errors
- Page should load without 404s

### Full Stack
- Open http://localhost:5173
- Try generating a chart (requires API)
- Check both terminal outputs for errors

**Expected Response** (from `/api/health`):
```json
{ "status": "ok", "version": "0.2.0" }
```

---

## Running Tests

```bash
npm test
```

Runs all tests in `tests/` using Vitest.

**Expected**: 207/207 tests passing ✅

---

## Database Setup (Optional)

If you set `NEON_CONNECTION_STRING`, you can run migrations:

```bash
cd workers
npm run migrate
```

This creates all tables in your Neon database. Safe to run multiple times (idempotent).

---

## Troubleshooting

### "npm install" fails with package conflicts
```bash
# Clear cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Frontend shows "Cannot find module" errors
```bash
# Rebuild dependency graph
npm run build
npm run dev
```

### Worker won't start (port 8787 already in use)
```bash
npx wrangler dev --port 8788
```

### Tests fail with "sqlite3 not found"
```bash
# SQLite is for local testing; install it
npm install --save-dev better-sqlite3
npm test
```

### Cannot connect to Neon database
1. Check that `NEON_CONNECTION_STRING` is set correctly
2. Verify database exists in Neon console
3. Try connection string from Neon dashboard directly:
   ```bash
   psql "postgresql://user:pass@host/dbname"
   ```

---

## Next Steps

Once everything is working:

1. **For Stripe setup**: See [STRIPE_INTEGRATION.md](STRIPE_INTEGRATION.md)
2. **For background video**: See [BACKGROUND_VIDEO.md](BACKGROUND_VIDEO.md)
3. **For PWA features**: See [PWA_CONFIGURATION.md](PWA_CONFIGURATION.md)
4. **To understand architecture**: See [../ARCHITECTURE.md](../ARCHITECTURE.md)

---

## Common Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start frontend dev server |
| `cd workers && npx wrangler dev` | Start backend worker |
| `npm test` | Run all tests |
| `npm run build` | Build for production |
| `npm run lint` | Check code style |

---

**See Also**: [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md), [../ARCHITECTURE.md](../ARCHITECTURE.md), [../DEPLOY.md](../DEPLOY.md)


# Third-Party API Setup Guide
> All social auth and messaging integrations for Prime Self
> Last updated: 2026-03-10

This document covers external API keys for social login (Google, Apple) and X/Twitter messaging. Facebook login was removed from production on 2026-03-10.

---

## Quick Reference

| Service | Keys Needed | Free Tier | Time |
|---------|------------|-----------|------|
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Yes — unlimited | 5 min |
| Apple Sign In | `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | Yes (Dev account $99/yr) | 30 min |
| X/Twitter Messaging | `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`, `X_BEARER_TOKEN` | Partial (Basic $100/mo for DMs) | 15 min |

After obtaining each key, set it in your Cloudflare Worker:
```bash
cd workers
npx wrangler secret put SECRET_NAME
# Paste value when prompted — it is never stored in code
```

---

## 1. Google OAuth 2.0

**What it enables:** "Continue with Google" button. Users sign in without a password. You get their email and name automatically.

### Step-by-step

**1. Create a Google Cloud project**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown (top left) → **New Project**
3. Name it `Prime Self` → Create
4. Wait ~30 seconds for it to provision

**2. Enable the APIs**
1. In the left sidebar: **APIs & Services** → **Library**
2. Search for `Google People API` → Enable
3. Search for `Google Identity` (or `Google+ API`) → Enable

**3. Configure the OAuth consent screen**
1. **APIs & Services** → **OAuth consent screen**
2. User type: **External** → Create
3. App name: `Prime Self`
4. User support email: your email
5. Developer contact: your email
6. Click **Save and Continue** through all steps (no extra scopes needed)
7. Add test users (your email) while in Testing mode — or submit for verification to go public

**4. Create OAuth credentials**
1. **APIs & Services** → **Credentials** → **+ Create Credentials** → **OAuth 2.0 Client ID**
2. Application type: **Web application**
3. Name: `Prime Self Web`
4. **Authorized redirect URIs** — add both:
   ```
   https://prime-self-api.adrper79.workers.dev/api/auth/oauth/google/callback
   http://localhost:8787/api/auth/oauth/google/callback
   ```
5. Click **Create**
6. Copy **Client ID** and **Client Secret**

**5. Set secrets**
```bash
npx wrangler secret put GOOGLE_CLIENT_ID
# paste Client ID

npx wrangler secret put GOOGLE_CLIENT_SECRET
# paste Client Secret
```

**6. Test**
Open: `https://prime-self-api.adrper79.workers.dev/api/auth/oauth/google`
→ Should redirect to Google login screen
→ After approving, should redirect back to your frontend with `?oauth=success`

---

## 2. Apple Sign In

**What it enables:** "Continue with Apple" button. Required for App Store submission. Privacy-conscious users strongly prefer it. Apple hides the user's real email behind a relay address (optional).

**Prerequisite:** Active Apple Developer Program membership ($99/year) at [developer.apple.com](https://developer.apple.com).

### Step-by-step

**1. Create an App ID (if you don't have one)**
1. [developer.apple.com](https://developer.apple.com) → **Account** → **Certificates, IDs & Profiles**
2. **Identifiers** → **+** → Select **App IDs** → Continue
3. Type: **App** → Continue
4. Description: `Prime Self`
5. Bundle ID (Explicit): `net.selfprime.app` (or your domain reversed)
6. Scroll down → check **Sign In with Apple** → Continue → Register

**2. Create a Services ID** (this is your web OAuth client)
1. **Identifiers** → **+** → Select **Services IDs** → Continue
2. Description: `Prime Self Web`
3. Identifier: `net.selfprime.web` — **this becomes `APPLE_CLIENT_ID`**
4. Register
5. Click the newly created Services ID → enable **Sign In with Apple** → Configure
6. Primary App ID: select the App ID you created above
7. **Domains and Subdomains**: `prime-self-api.adrper79.workers.dev`
8. **Return URLs**:
   ```
   https://prime-self-api.adrper79.workers.dev/api/auth/oauth/apple/callback
   ```
9. Save → Continue → Save

**3. Create a private key**
1. **Keys** → **+**
2. Key Name: `Prime Self Sign In`
3. Check **Sign In with Apple** → Configure → select your App ID → Save
4. Continue → Register
5. **Download** the `.p8` file immediately — **Apple only lets you download it once**
6. Note the **Key ID** from the filename (e.g., `AuthKey_ABC1234XYZ.p8` → Key ID is `ABC1234XYZ`)

**4. Find your Team ID**
Top-right corner of the developer portal, next to your name — a 10-character alphanumeric string.

**5. Set secrets**
```bash
npx wrangler secret put APPLE_CLIENT_ID
# net.selfprime.web

npx wrangler secret put APPLE_TEAM_ID
# your 10-char team ID

npx wrangler secret put APPLE_KEY_ID
# 10-char key ID from .p8 filename

npx wrangler secret put APPLE_PRIVATE_KEY
# paste the ENTIRE contents of the .p8 file including:
# -----BEGIN PRIVATE KEY-----
# (key contents)
# -----END PRIVATE KEY-----
# Newlines must be real newlines, not \n
```

**Tip for pasting the private key:** On Windows, run:
```bash
cat path/to/AuthKey_XXXXXXX.p8 | npx wrangler secret put APPLE_PRIVATE_KEY
```

**6. Test**
Open: `https://prime-self-api.adrper79.workers.dev/api/auth/oauth/apple`
→ Should redirect to Apple sign-in page
→ After approving, Apple POSTs to your callback and you are redirected to the frontend

---

## 3. Facebook Login (disabled)

Facebook login was removed from production auth routes and UI on 2026-03-10.

- Removed endpoint: `/api/auth/oauth/facebook`
- Removed endpoint: `/api/auth/oauth/facebook/callback`
- Removed UI control: `Continue with Facebook`

If Facebook login is reintroduced later, add a new section with fresh setup instructions and re-enable the routes in `workers/src/index.js` and `workers/src/handlers/oauthSocial.js`.

---

## 4. X (Twitter) API — for Messaging

> **This is separate from social login.** These keys enable reading DMs/mentions and sending replies from within the Prime Self app. See `docs/X_MESSAGING_INTEGRATION.md` for the full feature design.

**Pricing reality:** The X API free tier does **not** include DM access. You need **Basic** ($100/month) or higher.

| Plan | Cost | What you get |
|------|------|-------------|
| Free | $0 | Tweet posting only (1,500/month). No DM read/write. |
| Basic | $100/mo | DM read/write, 3,000 tweets/month, 1M tweet reads/month. Sufficient for an inbox feature. |
| Pro | $5,000/mo | High-volume. Not needed at launch. |

### Step-by-step (Basic tier)

**1. Create a Developer account**
1. Go to [developer.twitter.com](https://developer.twitter.com)
2. Sign in with the **@primeself** X account (or whichever account is the brand)
3. Apply for access — describe your use case: "Customer support inbox for a wellness SaaS platform. We read DMs and mentions sent to our brand account and reply from within our app."
4. Verify your phone number if prompted

**2. Subscribe to Basic**
1. [developer.twitter.com/en/portal/products/basic](https://developer.twitter.com/en/portal/products/basic)
2. Add payment — $100/month, cancel anytime

**3. Create a Project and App**
1. **Developer Portal** → **Projects & Apps** → **New Project**
2. Project name: `Prime Self Social`
3. Use case: `Making a bot` (closest option — you'll clarify in Review)
4. Create a new App inside: `Prime Self Inbox`

**4. Configure App permissions**
1. In your App → **Settings** → **User authentication settings** → **Set up**
2. App permissions: **Read and write and Direct Messages**
3. Type of App: **Web App**
4. Callback URI: `https://prime-self-api.adrper79.workers.dev/api/auth/oauth/x/callback`
5. Website URL: `https://selfprime.net`
6. Save

**5. Get your keys**
1. **App** → **Keys and Tokens** tab
2. **API Key and Secret** (under Consumer Keys) → copy both → **regenerate if needed**
3. **Bearer Token** → Generate → copy
4. **Access Token and Secret** (under Authentication Tokens) → Generate → copy both
   - These are for the **@primeself brand account** acting as the app identity

**6. Register an Account Activity webhook** (for real-time DM/mention events)
1. Your Worker needs a public HTTPS endpoint — it already has one
2. In the Developer Portal → **Products** → **Account Activity API**
3. Register webhook: `https://prime-self-api.adrper79.workers.dev/api/x/webhook`
4. X will send a CRC challenge — your handler must respond with `sha256_hash` — see `X_MESSAGING_INTEGRATION.md`

**7. Set secrets**
```bash
npx wrangler secret put X_API_KEY
# Consumer Key / API Key

npx wrangler secret put X_API_SECRET
# Consumer Secret / API Key Secret

npx wrangler secret put X_ACCESS_TOKEN
# Access Token (for @primeself account)

npx wrangler secret put X_ACCESS_TOKEN_SECRET
# Access Token Secret

npx wrangler secret put X_BEARER_TOKEN
# Bearer Token

npx wrangler secret put X_WEBHOOK_SECRET
# Any random string you choose — used to validate incoming webhook events
```

---

## Summary Checklist

```
GOOGLE OAUTH
[ ] Google Cloud project created
[ ] People API enabled
[ ] OAuth consent screen configured
[ ] OAuth 2.0 Client ID created with correct redirect URIs
[ ] GOOGLE_CLIENT_ID set in wrangler
[ ] GOOGLE_CLIENT_SECRET set in wrangler
[ ] End-to-end test passes

APPLE SIGN IN
[ ] Apple Developer account active ($99/yr)
[ ] App ID created with Sign In with Apple enabled
[ ] Services ID created (net.selfprime.web or similar)
[ ] Correct Return URL registered
[ ] Private key (.p8) downloaded and secured
[ ] APPLE_CLIENT_ID set in wrangler
[ ] APPLE_TEAM_ID set in wrangler
[ ] APPLE_KEY_ID set in wrangler
[ ] APPLE_PRIVATE_KEY set in wrangler
[ ] End-to-end test passes

X MESSAGING (OPTIONAL — requires $100/mo Basic plan)
[ ] X Developer account with Basic subscription
[ ] App created with Read+Write+DM permissions
[ ] Account Activity API webhook registered
[ ] All 6 X secrets set in wrangler
[ ] CRC challenge response working
[ ] Webhook receiving test events
```

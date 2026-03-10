# X (Twitter) Messaging Integration
> Respond to DMs and @mentions from within Prime Self
> Status: Designed — not yet built | Requires X Basic API ($100/mo)

---

## What This Enables

A **Social Inbox** tab in the Prime Self app (admin/brand account only) where you can:

1. **See incoming DMs** sent to @primeself on X
2. **See @mentions** of @primeself (users sharing their charts, asking questions)
3. **Reply directly** from the app without opening X
4. **Auto-tag conversations** by type (chart share, question, support)
5. *(Future)* Auto-respond to chart shares with a personalized reply using their HD type

This is a practitioner-adjacent feature — it makes running the brand's X presence sustainable as the community grows.

---

## How X Messaging Works (Architecture)

```
User DMs @primeself on X
          ↓
X sends webhook event to:
  POST /api/x/webhook (your Worker)
          ↓
Worker verifies HMAC signature (X_WEBHOOK_SECRET)
          ↓
Worker stores message in x_messages table
          ↓
Admin sees it in Social Inbox tab
          ↓
Admin types reply → POST /api/x/reply
          ↓
Worker calls X API to send DM or reply tweet
```

---

## X API Cost Reality

| What you want | Plan needed | Cost |
|---|---|---|
| Read @mentions timeline | Free | $0 |
| Post tweets / reply to tweets | Free | $0 (1,500/month limit) |
| Read DMs received by @primeself | **Basic** | **$100/month** |
| Send DMs from @primeself | **Basic** | **$100/month** |
| Real-time webhook (Account Activity API) | **Basic** | **$100/month** |

**Decision point:** If you only want to reply to mentions (tweets), you can do that on the Free tier. If you want DM access, you need Basic.

**Recommended approach for launch:** Start with mentions-only (free), add DM access when volume justifies $100/month.

---

## What Needs to Be Built

### Backend (Workers)

**New handler: `workers/src/handlers/xMessaging.js`**

Routes:
```
GET  /api/x/webhook               — CRC challenge verification (required by X)
POST /api/x/webhook               — Receive events (DMs, mentions) from X
GET  /api/x/inbox                 — List stored messages (admin only)
POST /api/x/reply                 — Send a reply (admin only)
POST /api/x/mark-read             — Mark message as handled
```

**New migration: `023_x_messages.sql`**

```sql
CREATE TABLE IF NOT EXISTS x_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  x_message_id    TEXT UNIQUE NOT NULL,     -- X's event ID
  type            TEXT NOT NULL,            -- 'dm' | 'mention'
  sender_id       TEXT,                     -- X user ID who sent it
  sender_handle   TEXT,                     -- @handle
  sender_name     TEXT,                     -- Display name
  body            TEXT NOT NULL,            -- Message/tweet text
  tweet_id        TEXT,                     -- For mentions: the tweet ID to reply to
  dm_conv_id      TEXT,                     -- For DMs: conversation ID
  status          TEXT DEFAULT 'unread',    -- 'unread' | 'read' | 'replied'
  reply_text      TEXT,                     -- What was sent back
  replied_at      TIMESTAMPTZ,
  received_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_x_messages_status ON x_messages (status);
CREATE INDEX IF NOT EXISTS idx_x_messages_type   ON x_messages (type);
```

### CRC Challenge (required to register webhook)

When you register your webhook URL, X sends a GET request with `?crc_token=...`. Your handler must respond with the HMAC-SHA256 of that token signed with your `X_WEBHOOK_SECRET`.

```js
// GET /api/x/webhook
async function handleXCRCChallenge(request, env) {
  const url = new URL(request.url);
  const crcToken = url.searchParams.get('crc_token');
  if (!crcToken) return new Response('Missing crc_token', { status: 400 });

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.X_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(crcToken));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));

  return Response.json({ response_token: `sha256=${b64}` });
}
```

### Receiving Events

X POSTs events as JSON. A DM event looks like:
```json
{
  "direct_message_events": [{
    "id": "...",
    "type": "message_create",
    "message_create": {
      "sender_id": "12345",
      "target": { "recipient_id": "YOUR_ACCOUNT_ID" },
      "message_data": { "text": "What does my Human Design mean?" }
    }
  }],
  "users": {
    "12345": { "name": "Jane Smith", "screen_name": "janesmith" }
  }
}
```

A mention event looks like:
```json
{
  "tweet_create_events": [{
    "id_str": "...",
    "text": "@primeself just got my chart! I'm a Generator 2/4 🌟",
    "user": { "screen_name": "janedoe", "name": "Jane Doe" }
  }]
}
```

### Sending Replies

**Reply to a mention (tweet):**
```js
await fetch('https://api.twitter.com/2/tweets', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.X_BEARER_TOKEN}`,
    // OR: OAuth 1.0a header for user-context (more powerful)
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    text: `@${handle} ${replyText}`,
    reply: { in_reply_to_tweet_id: tweetId }
  })
});
```

**Send a DM:**
```js
await fetch(`https://api.twitter.com/2/dm_conversations/${dmConvId}/messages`, {
  method: 'POST',
  headers: {
    'Authorization': `OAuth ...`, // OAuth 1.0a user context required for DMs
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ text: replyText })
});
```

**Note:** DMs require **OAuth 1.0a user-context** (signed with your `X_ACCESS_TOKEN` and `X_ACCESS_TOKEN_SECRET`), not just a Bearer token. The OAuth 1.0a signature generation is ~30 lines of crypto code in the Worker.

### Frontend (Social Inbox tab)

Add a new tab to the sidebar under the admin/practitioner section:

```
Social Inbox
├── Unread (badge count)
├── DMs section
│   └── [sender] [preview] [time] [Reply] [Mark done]
└── Mentions section
    └── [tweet text] [time] [Reply] [Mark done]
```

Reply flow:
1. Click Reply on a message → text input expands
2. Type reply → click Send
3. Worker sends to X API → updates `x_messages.status` to 'replied'
4. Message moves to Replied section

---

## Auto-Response Opportunity

When a user mentions @primeself with their HD type in the tweet, the AI can generate a personalized response:

**Trigger:** Tweet contains "Generator" or "Projector" or "Manifester" or known HD terms
**Action:** Call Claude (Haiku — low cost) with: *"Generate a warm, 240-character reply acknowledging a {Type} sharing their chart. Include one practical insight."*
**Send:** Reply via X API

This creates a viral loop: user shares chart → @primeself replies with a personalized insight → their followers see the exchange → some click through.

**Cost:** Claude Haiku is ~$0.0004 per response. At 100 auto-replies/day = $1.20/month.

**Guard:** Only auto-reply if:
- Account has ≥ 50 followers (filters bots)
- Reply hasn't already been sent to this account today
- Tweet contains confirmed HD terminology

---

## Implementation Order

1. **Run migration 023** — create x_messages table
2. **Build CRC challenge handler** — register webhook with X
3. **Build webhook receiver** — store incoming DMs and mentions
4. **Build admin inbox UI** — read-only list of messages
5. **Build reply endpoint + UI** — send replies from app
6. **Add auto-response** (optional, after manual flow is tested)

---

## Secrets Required

Set these after completing setup in `docs/OAUTH_API_SETUP.md` §4:

```bash
npx wrangler secret put X_API_KEY
npx wrangler secret put X_API_SECRET
npx wrangler secret put X_ACCESS_TOKEN
npx wrangler secret put X_ACCESS_TOKEN_SECRET
npx wrangler secret put X_BEARER_TOKEN
npx wrangler secret put X_WEBHOOK_SECRET
```

---

## Limitations to Know

| Limitation | Detail |
|---|---|
| Webhook subscription | Only 1 environment can receive events at a time (dev vs. prod conflict — use separate apps) |
| Rate limits (Basic) | 500 requests per 15 min per endpoint |
| DM read | You can only read DMs sent TO @primeself — not from other accounts |
| Tweet replies | You can reply from @primeself, but the reply appears publicly |
| Re-subscription | If your Worker restarts and webhook re-registers, old events are not replayed |
| X API stability | X has changed API terms and pricing multiple times. Budget for maintenance. |

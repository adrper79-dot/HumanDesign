# Implementation Guide — WC-004: APNs & FCM Native Push Delivery

**Status:** Implementation Framework (Code Skeleton Ready)  
**Effort:** 2-3 days  
**Owner:** Backend Engineer  
**Priority:** P1  
**Dependencies:** Capacitor native iOS/Android app (GAP-005)

---

## Current State

**Completed:**
- ✅ Web Push (RFC 8030) fully implemented in `workers/src/handlers/push.js`
- ✅ Database schema supports multiple platforms (`push_subscriptions` table with platform field)
- ✅ Endpoint accepts native tokens: `POST /api/push/native-subscribe` with `{nativeToken, platform}`
- ✅ Frontend Service Worker handles encrypted payloads

**Missing:**
- ❌ APNs certificate management & token refresh
- ❌ FCM OAuth2 token generation
- ❌ Native platform delivery layer
- ❌ Token expiration handling
- ❌ Delivery retry logic

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│ Mobile App (iOS/Android via Capacitor)          │
│ - Device Boot → Get APNs/FCM device token       │
│ - POST /api/push/native-subscribe               │
│   { deviceToken, platform: 'apns'|'fcm' }       │
└───────────────────┬──────────────────────────────┘
                    │
    ┌───────────────▼────────────────┐
    │ Workers: push.js handler       │
    │ - Store token in DB            │
    │ - Test delivery                │
    └───────────────┬────────────────┘
                    │
    ┌───────────────▼────────────────┐
    │ workers/src/lib/                │
    │   ├── apns-client.js (NEW)      │
    │   └── fcm-client.js (NEW)       │
    │                                 │
    │ sendNotificationToNativeUser()  │
    │ - Check platform                │
    │ - Route to APNs or FCM          │
    │ - Handle retries                │
    │ - Track delivery                │
    └───────────────┬────────────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
    ┌────────┐ ┌────────┐ ┌──────┐
    │ APNs   │ │ FCM    │ │ DB   │
    │(Apple) │ │(Google)│ │      │
    └────────┘ └────────┘ └──────┘
```

---

## Implementation Steps

### Phase 1: APNs Setup (Apple Push Notification Service)

#### 1a. Apple Developer Account Configuration

**Prerequisites:**
- Apple Developer membership ($99/year)
- Access to Apple Developer Program portal

**Steps:**
1. Create App ID: `Development` and `Production` (must support Push Notifications)
2. Generate: APNs Certificate (or Key)
   - For certificate-based auth (simpler for MVP): generate `.cer` file
   - Download → Convert to `.p8` using: `openssl pkcs12 -in cert.p12 -out key.p8 -nodes -nocerts`
3. Create: APNs Auth Key (`AuthKey_*.p8`) — valid for 10 years (preferred)

**Store in Secrets:**
- `APPLE_TEAM_ID` — from Developer Account
- `APPLE_KEY_ID` — from generated key
- `APPLE_PRIVATE_KEY` — full PEM-encoded key content (multi-line, preserve newlines with `\n`)

#### 1b. Create APNs Client (`workers/src/lib/apns-client.js`)

```javascript
import { createHmac } from 'crypto';

/**
 * APNs (Apple Push Notification service) Client
 * Uses token-based authentication (preferred over certificates)
 * 
 * Spec: https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server
 */
class APNsClient {
  constructor(env) {
    this.teamId = env.APPLE_TEAM_ID;
    this.keyId = env.APPLE_KEY_ID;
    this.privateKey = env.APPLE_PRIVATE_KEY;
    this.bundleId = env.APPLE_BUNDLE_ID || 'com.primeself.app';
    
    // APNs endpoints
    this.endpoints = {
      production: 'https://api.push.apple.com:443/3/device/',
      sandbox: 'https://api.sandbox.push.apple.com:443/3/device/',
    };
  }

  /**
   * Generate JWT token for APNs (valid 1 hour)
   */
  generateJWT(isProduction = true) {
    const header = {
      alg: 'ES256',
      kid: this.keyId,
      typ: 'JWT',
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.teamId,
      iat: now,
      exp: now + 3600,  // 1 hour
    };

    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const message = `${headerB64}.${payloadB64}`;

    // Sign with ES256 (ECDSA)
    // NOTE: Cloudflare Workers don't have native crypto for EC, so use jose:
    // const { SignJWT } = await import('jose');
    // ... use jose instead of manual crypto
    
    // This simplified example uses jose library:
    // const token = await new SignJWT(payload)
    //   .setProtectedHeader(header)
    //   .sign(importedPrivateKey);
    
    return message;  // placeholder
  }

  /**
   * Send notification to device
   */
  async sendNotification(deviceToken, notification, options = {}) {
    const {
      isProduction = true,
      priority = 10,  // high = 10, low = 1
      expiration = Math.floor(Date.now() / 1000) + 3600,
    } = options;

    const endpoint = isProduction ? this.endpoints.production : this.endpoints.sandbox;

    const payload = {
      aps: {
        alert: {
          title: notification.title,
          body: notification.body,
        },
        sound: 'default',
        badge: 1,
        'content-available': 1,  // for background processing
        'mutable-content': 1,    // allow notification extension
      },
      // Custom data
      data: notification.data || {},
    };

    try {
      const jwt = this.generateJWT(isProduction);

      const response = await fetch(`${endpoint}${deviceToken}`, {
        method: 'POST',
        headers: {
          'apns-topic': this.bundleId,
          'apns-priority': String(priority),
          'apns-expiration': String(expiration),
          'authorization': `bearer ${jwt}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`APNs error: ${error.reason}`);
      }

      return { success: true, deviceToken };
    } catch (error) {
      console.error('APNs send failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate device token format
   */
  isValidToken(token) {
    // APNs tokens are 64 hex characters
    return /^[a-f0-9]{64}$/.test(token);
  }
}

export default APNsClient;
```

### Phase 2: FCM Setup (Firebase Cloud Messaging)

#### 2a. Firebase Configuration

**Prerequisites:**
- Google Firebase account (free tier OK)
- Android app published or in internal testing

**Steps:**
1. Create Firebase Project
2. Create Android app in Firebase console
3. Generate Service Account Key (JSON) in Firebase Console
   - Settings → Service Accounts → Firebase Admin SDK → Generate New Private Key
   - Download JSON key file

**Extract & Store in Secrets:**
```bash
# From downloaded JSON:
FIREBASE_PROJECT_ID=your-project-xxx
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@xxxx.iam.gserviceaccount.com
```

#### 2b. Create FCM Client (`workers/src/lib/fcm-client.js`)

```javascript
/**
 * FCM (Firebase Cloud Messaging) Client
 * 
 * Uses HTTP v1 API (newer, more flexible than legacy HTTP API)
 * Spec: https://firebase.google.com/docs/cloud-messaging/send-message
 */
class FCMClient {
  constructor(env) {
    this.projectId = env.FIREBASE_PROJECT_ID;
    this.privateKey = env.FIREBASE_PRIVATE_KEY;
    this.clientEmail = env.FIREBASE_CLIENT_EMAIL;
  }

  /**
   * Generate OAuth2 access token for FCM API
   * Tokens valid 1 hour
   */
  async generateAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 3600;

    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const payload = {
      iss: this.clientEmail,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: expiresAt,
      iat: now,
    };

    // NOTE: Cloudflare Workers use SubtleCrypto for RSA signing
    // Import 'jose' or use SubtleCrypto API:
    // const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', ...);
    
    // With jose:
    // const { SignJWT } = await import('jose');
    // const token = await new SignJWT(payload)
    //   .setProtectedHeader(header)
    //   .sign(privateKey);

    // Mock implementation:
    const jwtToken = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwtToken,
      }),
    });

    if (!response.ok) throw new Error('FCM auth failed');
    
    const data = await response.json();
    return data.access_token;
  }

  /**
   * Send notification via FCM HTTP v1 API
   */
  async sendNotification(registrationToken, notification, options = {}) {
    const {
      ttl = 2419200,  // 28 days default
      priority = 'high',
    } = options;

    try {
      const accessToken = await this.generateAccessToken();

      const message = {
        token: registrationToken,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data || {},
        android: {
          ttl: `${ttl}s`,
          priority: priority,
          notification: {
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            sound: 'default',
          },
        },
        webpush: {
          // Fallback for web version
          notification: {
            title: notification.title,
            body: notification.body,
          },
        },
      };

      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ message }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`FCM error: ${error}`);
      }

      return { success: true, registrationToken };
    } catch (error) {
      console.error('FCM send failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate device token format (Android FCM token ~ 152+ chars)
   */
  isValidToken(token) {
    return token && token.length > 100;
  }
}

export default FCMClient;
```

### Phase 3: Unified Delivery Layer

#### 3a. Update `workers/src/handlers/push.js`

```javascript
// Add imports at top:
import APNsClient from '../lib/apns-client.js';
import FCMClient from '../lib/fcm-client.js';

// In the handlePush router, add:

export async function sendNotificationToNativeUser(userId, notification, env, db) {
  try {
    // Get user's native subscriptions
    const subscriptions = await db.query(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1 AND endpoint LIKE $2',
      [userId, 'native:%']  // Matches native:apns:* and native:fcm:*
    );

    if (subscriptions.rows.length === 0) {
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions.rows) {
      const [platform, token] = sub.endpoint.split(':').slice(1);
      
      let result;
      if (platform === 'apns') {
        const apns = new APNsClient(env);
        result = await apns.sendNotification(token, notification, {
          isProduction: env.ENVIRONMENT === 'production',
        });
      } else if (platform === 'fcm') {
        const fcm = new FCMClient(env);
        result = await fcm.sendNotification(token, notification);
      } else {
        continue;  // Unknown platform
      }

      if (result.success) {
        sent++;
      } else {
        failed++;
        // Log failure for retry queue
        await db.query(
          'INSERT INTO notification_failures (user_id, endpoint, reason, created_at) VALUES ($1, $2, $3, NOW())',
          [userId, sub.endpoint, result.error]
        );
      }
    }

    return { sent, failed };
  } catch (error) {
    console.error('sendNotificationToNativeUser error:', error);
    return { sent: 0, failed: subscriptions.rows.length, error: error.message };
  }
}

// Add endpoint:  POST /api/push/notification/test (admin)

['POST /api/push/notification/test', handlePushTest] :

async function handlePushTest(req, env, db) {
  //  Requires authentication + admin privileges
  const userId = req.user.id;

  const notification = {
    title: 'Test Notification',
    body: 'This is a test push notification',
    data: { test: 'true', timestamp: new Date().toISOString() },
  };

  const result = await sendNotificationToNativeUser(userId, notification, env, db);
  return json({ result }, 200);
}
```

### Phase 4: Database & Retry Logic

#### 4a. Update Database Schema

```sql
-- Add notification_failures table for retry logic
CREATE TABLE IF NOT EXISTS notification_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint VARCHAR(2048),
  reason TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  last_retry_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_notification_failures_user_id ON notification_failures(user_id);
CREATE INDEX idx_notification_failures_retry_count ON notification_failures(retry_count);
```

#### 4b. Cron Job for Retries

In `workers/src/handlers/cron.js`, add retry logic:

```javascript
export async function handleCronTransitDigest(env, db) {
  // ... existing transit logic ...

  // Retry failed notifications
  console.log('Retrying failed notifications...');
  const failedSubs = await db.query(
    `SELECT id, user_id, endpoint FROM notification_failures 
     WHERE retry_count < 3 AND created_at > NOW() - INTERVAL '24 hours'
     ORDER BY last_retry_at ASC NULLS FIRST
     LIMIT 100`
  );

  for (const failure of failedSubs.rows) {
    const [platform, token] = failure.endpoint.split(':').slice(1);
    
    // Retry notification
    let result;
    if (platform === 'apns') {
      const apns = new APNsClient(env);
      result = await apns.sendNotification(token, { 
        title: 'Retry: Transit Digest',
        body: 'Your personal transit digest'
      });
    } else if (platform === 'fcm') {
      const fcm = new FCMClient(env);
      result = await fcm.sendNotification(token, { 
        title: 'Retry: Transit Digest',
        body: 'Your personal transit digest'
      });
    }

    if (result.success) {
      await db.query('DELETE FROM notification_failures WHERE id = $1', [failure.id]);
    } else {
      await db.query(
        'UPDATE notification_failures SET retry_count = retry_count + 1, last_retry_at = NOW() WHERE id = $1',
        [failure.id]
      );
    }
  }
}
```

---

## Testing

### Local Testing

```bash
# 1. Deploy to staging
npm run deploy --env staging

# 2. Get a real APNs/FCM token from live app
# (or mock one for testing)

# 3. Subscribe device
curl -X POST https://prime-self-api-staging.adrper79.workers.dev/api/push/native-subscribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{"nativeToken":"abc123def456...","platform":"apns"}'

# 4. Send test notification
curl -X POST https://prime-self-api-staging.adrper79.workers.dev/api/push/notification/test \
  -H "Authorization: Bearer $JWT"
```

### Production Testing

1. Deploy to 1% of users (canary) via Stripe checkout flag
2. Monitor: delivery success rate, failure logs, latency
3. Roll out to 100% if >95% success rate

---

## Success Criteria

- [ ] APNs client sends & receives notifications on iOS
- [ ] FCM client sends & receives notifications on Android
- [ ] Failed notifications tracked & retried automatically
- [ ] Delivery latency <5s average
- [ ] Retry succeeds >80% of failures within 24h
- [ ] Tokens refreshed before expiry (APNs tokens are long-lived)
- [ ] No unhandled errors in production logs
- [ ] E2E test: subscribe phone → app receives notification

---

## Files to Create/Modify

| File | Action | Lines |
|------|--------|-------|
| [workers/src/lib/apns-client.js](workers/src/lib/apns-client.js) | CREATE | ~150 |
| [workers/src/lib/fcm-client.js](workers/src/lib/fcm-client.js) | CREATE | ~150 |
| [workers/src/handlers/push.js](workers/src/handlers/push.js) | MODIFY | Add sendNotificationToNativeUser(), test endpoint |
| [workers/src/handlers/cron.js](workers/src/handlers/cron.js) | MODIFY | Add retry logic |
| [workers/src/db/migrations/XXX_notification_failures.sql](workers/src/db/migrations/) | CREATE | ~15 |

---

## Timeline

- **Day 1:** Set up Apple Developer + Firebase accounts, create clients
- **Day 2:** Wire clients into handlers, add DB schema, test locally
- **Day 3:** E2E testing with real devices, fix edge cases, deploy to staging

**Total: 2-3 days**

---

## Notes

- APNs tokens are long-lived; no regular refresh needed (unlike Firebase)
- FCM tokens expire occasionally; app should re-register on token refresh
- For Cloudflare Workers, use `jose` library for JWT/RSA signing (native crypto support limited)
- Monitor Apple & Google service status pages during deployment
- Set up error alerts in Sentry for failed deliveries

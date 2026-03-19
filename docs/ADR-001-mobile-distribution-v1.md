# ADR-001: Mobile Distribution v1 — iOS Wrapper Path

**Issue:** WC-P1-4  
**Status:** ACTIVE — Partially resolved; deep link scheme pending (see §Open Questions)  
**Date:** 2026-03-19  
**Updated:** 2026-03-19  
**Author:** Prime Self Engineering  

---

## Context

Prime Self is a PWA (Progressive Web App) running on Cloudflare Workers + a static frontend. It has:
- `frontend/manifest.webmanifest` — installable PWA manifest  
- `frontend/service-worker.js` — caching, push notifications  
- VAPID-based push subscription via `workers/src/handlers/push.js`  
- Auth via HttpOnly refresh cookie + in-memory access token  
- No native-only business logic  

Distribution gap: PWA install rates on iOS are low and discoverability via the App Store is blocked. Android TWA (Trusted Web Activity) can distribute the current PWA to Google Play with minimal code change. iOS requires a WKWebView wrapper.

---

## Decision

**v1 scope: iOS App Store + Android Google Play simultaneously (TWA for Android).**

✅ Owner confirmed: Apple Developer account is active.

- The wrapper must **not fork business logic** from the web app. All logic stays in `workers/` and `frontend/`.
- The wrapper must maintain existing **auth/session continuity** (HttpOnly cookie must persist across WebView sessions).
- The wrapper must maintain **push notification compatibility** (VAPID subscription registered by the service worker inside the WebView, or via native push bridge if needed).
- Store listing copy must be claim-safe and feature-accurate — no features listed that are not live.

---

## Technology Choice

### iOS — Capacitor (Ionic)
**Recommended.** Capacitor wraps the existing web app in a WKWebView with native plugin bridge. It does not require rewriting any application code.

Alternatives considered:
| Option | Notes |
|---|---|
| Raw WKWebView (Swift/Objective-C) | More control, but requires native developer. Not recommended for v1. |
| Cordova | Older, deprecated by Ionic in favour of Capacitor. Not recommended. |
| React Native WebView | Overkill; adds React Native build pipeline for no benefit. Not recommended. |
| Capacitor ✓ | Minimal native code, NPM-based toolchain, good PWA bridge. **Recommended.** |

### Android — TWA (Trusted Web Activity)
**Recommended.** TWA wraps the existing PWA in a Chrome Custom Tab verified by Digital Asset Links. Zero JS code changes needed. Push already works via the web push subscription.

✅ **Decisions resolved:**
1. ~~Target iOS App Store only~~ — **iOS + Android simultaneously confirmed**
2. Apple Developer account — **confirmed active, owner identified**
3. Capacitor — **confirmed** (recommended; no alternative needed)

---

## Implementation Checklist

### Pre-conditions (must resolve before store submission)

- [x] ✅ Apple Developer account active — confirmed
- [ ] ⚠️ Google Play Console account active — owner: ________________
- [ ] Auth review: confirm `SameSite=None; Secure` HttpOnly cookie persists in WKWebView sessions (test on real device)
- [x] ✅ Push bridge wired — `_isCapacitorNative()` / `_subscribeCapacitorNativePush()` in `frontend/js/app.js`; backend `/api/push/native-subscribe` accepts APNs/FCM tokens (VAPID attempted first; native bridge fires on failure)
- [ ] ⚠️ Deep link scheme: **pending owner decision** — see Open Questions §4 for pros/cons

### iOS Build Steps

1. `npm install @capacitor/core @capacitor/cli @capacitor/ios`
2. `npx cap init PrimeSelf app.primeself.ios`
3. `npx cap add ios`
4. Point `webDir` in `capacitor.config.json` to the built `frontend/` dist
5. Configure `Info.plist`: `NSAppTransportSecurity` (allow API domain), face/touch ID if added later
6. Configure `AppDelegate.swift` for deep link handling
7. Add `/.well-known/apple-app-site-association` to Workers static routes (JSON file mapping app bundle ID to paths)
8. Test on physical device (iOS Simulator does not support push or camera)
9. Archive and submit via Xcode / Transporter

### Android TWA Steps

1. Create Android Studio project with TWA template (`bubblewrap init`)
2. Set `host` to `primeself.app`, `startUrl` to `/`
3. Generate `assetlinks.json` and deploy to `/.well-known/assetlinks.json` via Workers static routes
4. Build signed APK / AAB
5. Submit to Google Play internal track → beta → production

---

## Store Assets Required

⚠️ Owner must supply before submission:

| Asset | iOS | Android |
|---|---|---|
| App icon | 1024×1024 PNG (no transparency) | 512×512 PNG |
| Screenshots | Min 3 (6.7" and 5.5" iPhone) | Min 2 (phone, tablet optional) |
| Feature graphic | — | 1024×500 PNG |
| App name | "Prime Self" | "Prime Self" |
| Subtitle (iOS) | "Energy Blueprint & Sessions" | — |
| Short description | — | ≤80 chars |
| Full description | ≤4000 chars | ≤4000 chars |
| Privacy policy URL | https://primeself.app/privacy.html | same |
| Support URL | https://primeself.app | same |

---

## Auth / Deep Link / Push Test Matrix

| Scenario | Expected | Test Method |
|---|---|---|
| Fresh install → sign in | Cookie set, token in memory, auto-refresh works | Manual on real device |
| Background → foreground | Token still valid OR silent refresh fires | Manual on real device |
| Push opt-in flow | Permission dialog appears, VAPID sub registered | Manual on real device |
| Push delivered (cron) | Notification appears in tray | Trigger test via `/api/push/test` |
| Deep link `primeself://transits` | Opens app to transits tab | Test via Notes app link |
| App Store update | Auth persists (no forced re-login) | Manual upgrade test |
| Push after update | Existing subscription still active | Verify via `/api/push/history` |

---

## Success KPIs (tracked from day one)

All events to be emitted via `trackEvent('distribution', ...)` and queryable from Plausible / analytics:

| KPI | Event | Target (30 days post-launch) |
|---|---|---|
| App Store installs | `app_install` (tracked via App Store Connect) | — |
| Install → chart generated | `distribution_install_to_chart` | ≥ 50% |
| Install → signup | `distribution_install_to_signup` | ≥ 30% |
| Install → profile generated | `distribution_install_to_profile` | ≥ 20% |
| Push opt-in rate | `push_optin_accepted` / `push_optin_shown` | ≥ 40% |
| D7 retention | Sessions on day 7 post-install | ≥ 25% |
| D30 retention | Sessions on day 30 post-install | ≥ 15% |

---

## Rollback Strategy

v1 wrapper is **additive** — no existing web user is affected. Rollback = remove app from store listing. Web app continues unchanged. No database migrations required.

---

## Open Questions

1. ~~Scope~~ — ✅ iOS + Android simultaneously
2. ~~Apple Developer account~~ — ✅ Confirmed active
3. ~~Wrapper~~ — ✅ Capacitor confirmed
4. ~~Deep link scheme~~ — ✅ **Option C selected**: Universal / App Links externally, `primeself://` internally
5. ~~Push bridge~~ — ✅ Wired (`@capacitor/push-notifications` via `_subscribeCapacitorNativePush()`)

Remaining implementation inputs for store verification:
- Apple Team ID for `apple-app-site-association`
- Final iOS bundle ID (ADR currently assumes `app.primeself.ios`)
- Final Android package name
- Android signing certificate SHA-256 fingerprint for `assetlinks.json`

---

### Deep Link Scheme — Pros & Cons

#### Option A: Universal Links only (iOS) / App Links only (Android)

| | |
|---|---|
| ✅ | Uses `https://` — same URL works in browser AND in the app |
| ✅ | If app isn't installed, link opens the website (graceful fallback) |
| ✅ | Recommended by Apple and Google; required for App Clips / Instant Apps |
| ✅ | No ambiguous "Open in…?" dialog when following a link |
| ✅ | Harder to hijack (ownership verified via `/.well-known/` JSON file) |
| ❌ | Requires deploying `apple-app-site-association` + `assetlinks.json` to the Workers static routes |
| ❌ | Deep links from inside other apps (cross-app) can fall through to browser if the app isn't running |
| ❌ | Slightly more setup (~30 min) |

#### Option B: Custom URL scheme only (`primeself://`)

| | |
|---|---|
| ✅ | Trivial to implement in Capacitor — one line in `capacitor.config.json` |
| ✅ | Works from any context, even when app is not the default browser |
| ✅ | Reliable deep linking between native apps in an ecosystem |
| ❌ | Any app can claim `primeself://` — link hijacking is possible |
| ❌ | If app isn't installed, link shows an error dialog (no web fallback) |
| ❌ | iOS 9+ / Chrome on Android shows an "Open in primeself?" dialog |
| ❌ | Apple may reject apps that rely solely on custom schemes in App Review |

#### Option C: Both (recommended default)

Universal Links as the primary scheme for everything shared externally (emails, social, QR codes). Custom scheme `primeself://` as an internal fallback for cross-screen navigation within the app only.

**Selected.** Implement both — Universal Links for all external surfaces, custom scheme for in-app routing only. This takes ~1 hour of extra setup and maximises compatibility.

---

## References

- [Capacitor docs](https://capacitorjs.com/docs)
- [Apple Universal Links](https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app)
- [TWA (Bubblewrap)](https://github.com/GoogleChromeLabs/bubblewrap)
- [Digital Asset Links](https://developer.android.com/training/app-links/verify-android-applinks)

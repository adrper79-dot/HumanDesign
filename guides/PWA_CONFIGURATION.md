# Progressive Web App (PWA) Configuration

Enable offline support, home screen installation, and app-like experience.

**Time to complete**: 15 minutes  
**Prerequisites**: Completed SETUP_DEVELOPMENT.md

---

## What is a PWA?

A Progressive Web App provides:
- ✅ **Installable** on mobile home screen (no app store)
- ✅ **Offline access** to cached pages and data
- ✅ **Fast loading** via service worker caching
- ✅ **App-like feel** with full-screen mode

Prime Self is already PWA-enabled. This guide helps you verify and customize settings.

---

## Step 1: Verify Service Worker

Service worker handles caching and offline support.

### Check Service Worker is Registered

1. Open http://localhost:5173 in browser
2. Press F12 (Developer Tools)
3. Go to **Application** tab → **Service Workers**
4. Should show:
   ```
   ✅ https://localhost:5173/ (running)
   ```

If offline:
```bash
cd workers
npx wrangler deploy  # Re-deploy service worker
```

### Check Caching

Still in DevTools → **Application** tab:

- **Cache Storage**: Shows cached files
- Should see: `prime-self-cache-v12` (or latest version)

If cache is stale, clear it:
```javascript
// In browser console:
caches.keys().then(names => names.forEach(name => caches.delete(name)));
location.reload();
```

---

## Step 2: Configure Web App Manifest

The manifest tells browsers how to install your app.

File: [../frontend/manifest.json](../frontend/manifest.json)

### Current Manifest

```json
{
  "name": "Prime Self",
  "short_name": "PrimeSelf",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1a1a",
  "theme_color": "#8b5cf6",
  "scope": "/",
  "icons": [
    {
      "src": "icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

### Customization (Optional)

Edit [../frontend/manifest.json](../frontend/manifest.json):

```json
{
  "name": "Your App Name",                    // App title (max 45 chars)
  "short_name": "YourApp",                   // Home screen label (max 12 chars)
  "start_url": "/forge/timeline",            // Page to open when launched
  "display": "standalone",                   // 'standalone' = app-like, 'minimal-ui' = browser controls
  "background_color": "#1a1a1a",             // Splash screen background
  "theme_color": "#8b5cf6",                  // Browser chrome color (Android)
  "scope": "/"                               // Accessible URLs
}
```

---

## Step 3: Verify Icons Exist

Icons are required for installation. Check:

```bash
ls -lh frontend/icons/
```

Should show:
- ✅ `icon-192x192.png` (192×192 pixels)
- ✅ `icon-512x512.png` (512×512 pixels)

Size must be exact. If missing, create them:

```bash
# Generate from logo (requires ImageMagick)
convert logo.png -resize 192x192 frontend/icons/icon-192x192.png
convert logo.png -resize 512x512 frontend/icons/icon-512x512.png
```

Or use an online tool: https://convertio.co/png-ico/

---

## Step 4: Test PWA Installation

### On Desktop (Chrome)

1. Open http://localhost:5173
2. Click address bar → **Install** button (usually appears after 10 sec)
3. Click **Install**
4. App opens in separate window

### On Android (Chrome)

1. Open http://localhost:5173 on mobile
2. Tap **⋮** (three dots) → **Install app**
3. Confirm installation
4. App appears on home screen

### On iOS (Safari)

1. Open https://selfprime.net in Safari
2. Tap **Share** → **Add to Home Screen**
3. Confirm
4. App appears on home screen

**Note**: iOS has limited PWA support (no service worker, limited caching).

---

## Step 5: Configure Offline Support

The service worker caches:
- HTML pages (for offline browsing)
- CSS/JavaScript (for app shell)
- Images & fonts (for visual consistency)

### Cache Strategy (for developers)

File: [../frontend/service-worker.js](../frontend/service-worker.js)

Cache version is bumped when files change:
```javascript
const CACHE_VERSION = 'prime-self-cache-v12';  // Change to v13 to force refresh
```

**When to bump cache version:**
- CSS files changed (`frontend/css/`)
- JavaScript changed (`frontend/js/`)
- Images changed (`frontend/icons/`)

**Don't bump for:**
- API changes (API calls always check server first)
- HTML structure changes (users will get fresh content)

### Clear Cache (Debug)

Force users to re-download everything:

1. Edit `service-worker.js`
2. Change version: `v12` → `v13`
3. Deploy: `npm run build && npm run deploy`

Users will get fresh cache next reload.

---

## Step 6: Verify Offline Mode (Testing)

### Test Offline Access

1. Open app in DevTools
2. Go to **Network** tab
3. Check **Offline** checkbox
4. Refresh page
5. Page should still load (from cache)

If blank page in offline mode:
- Cache version is wrong
- Service worker not registered
- Try hard refresh in DevTools (Ctrl+Shift+R)

---

## Step 7: Verify HTTPS (Required for PWA)

PWAs only work over HTTPS (not HTTP).

### Development (localhost)
- ✅ Works without HTTPS (special case)

### Production
- 🚨 **MUST be HTTPS** or PWA won't work

Check current site:
```bash
curl -I https://selfprime.net
```

Expected: `HTTP/2 200` (HTTPS connection)

If HTTP (not HTTPS):
1. Check DNS points to correct server
2. Verify SSL certificate is valid
3. Configure HTTPS redirect in web server

---

## Advanced: Custom Offline Page

When user is offline and navigates to uncached page, show fallback:

Edit `service-worker.js`:

```javascript
// Add offline fallback
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request)
      .catch(() => caches.match('/offline.html'))  // Fallback page
  );
});
```

Create `frontend/offline.html`:
```html
<!DOCTYPE html>
<html>
<head><title>Offline</title></head>
<body>
  <h1>You're Offline</h1>
  <p>This page requires an internet connection.</p>
</body>
</html>
```

---

## Troubleshooting

### "Install button doesn't appear"
- Check manifest.json exists and is valid
- Ensure served over HTTPS (or localhost)
- Icons must be exactly 192×192 and 512×512

### "App crashes on launch"
- Check `start_url` points to valid page
- Verify service worker loads without errors (F12)
- Clear cache and reinstall

### "App goes blank offline"
- Ensure pages are cached (check DevTools → Cache)
- Bump service worker version to force re-cache
- Check JavaScript paths are relative (not absolute)

### "PWA works on desktop but not mobile"
- iOS PWA support is limited (use Safari, not Chrome)
- Android requires `display: standalone` in manifest
- Ensure `theme_color` contrasts with icon

---

## PWA Features Checklist

- [ ] Service worker registered (DevTools → Application)
- [ ] Manifest.json configured and valid
- [ ] Icons exist (192×192, 512×512)
- [ ] Site accessible over HTTPS
- [ ] Install button appears in browser
- [ ] Offline mode works
- [ ] App launches from home screen
- [ ] Cache version matches current code

---

## Next Steps

- **Deployment**: See [../DEPLOY.md](../DEPLOY.md)
- **Performance testing**: Use Lighthouse (DevTools → Lighthouse tab)
- **Advanced caching**: See [../frontend/service-worker.js](../frontend/service-worker.js)

---

## See Also

- [../frontend/manifest.json](../frontend/manifest.json) — App manifest
- [../frontend/service-worker.js](../frontend/service-worker.js) — Service worker code
- [SETUP_DEVELOPMENT.md](SETUP_DEVELOPMENT.md) — Development setup
- [../DEPLOY.md](../DEPLOY.md) — Production deployment


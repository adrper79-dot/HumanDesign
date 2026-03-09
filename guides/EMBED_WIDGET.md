# Embed Widget Guide

Host the Prime Self chart widget on external websites.

**Time to complete**: 15 minutes  
**Complexity**: Medium  
**Includes**: Widget setup, CORS configuration, authentication

---

## Overview

Prime Self provides an embeddable widget that:
- ✅ Displays on third-party websites
- ✅ Allows visitors to generate charts without leaving site
- ✅ Supports white-label styling
- ✅ Handles authentication securely

**Use cases:**
- Embed on astrology blogs
- Include in coaching platforms
- Add to wellness apps
- Partner integrations

---

## Step 1: Get Widget Files

Widget files are in `frontend/`:

```bash
ls -lh frontend/embed.*
```

Should show:
- ✅ `embed.html` — Standalone widget page
- ✅ `embed.js` — Widget script for external sites

---

## Step 2: Host Widget Files

### Option A: Deploy on Cloudflare Pages (Easiest)

Widget is auto-deployed when you deploy frontend:

```bash
npm run deploy
```

Live URL: `https://selfprime.net/embed.html`

### Option B: Host on Your Own Server

Copy files to your web server:

```bash
scp frontend/embed.* your-server:/var/www/html/
```

Ensure accessible:
- ✅ `https://your-domain.com/embed.html`
- ✅ `https://your-domain.com/embed.js`

---

## Step 3: Embed on External Site

To embed the widget on your website:

### Minimal Setup (No Authentication)

```html
<!-- On your website -->
<div id="prime-self-widget"></div>
<script src="https://selfprime.net/embed.js"></script>
<script>
  PrimeSelfWidget.init({
    containerId: 'prime-self-widget',
    mode: 'preview'  // Read-only; no purchasing
  });
</script>
```

Visitor sees:
- Chart generator interface
- Birth data form
- Generated chart display
- No payment options

### With Authentication (Linked to Account)

```html
<div id="prime-self-widget"></div>
<script src="https://selfprime.net/embed.js"></script>
<script>
  PrimeSelfWidget.init({
    containerId: 'prime-self-widget',
    mode: 'authenticated',
    token: '<USER_JWT_TOKEN>',  // From your backend
    onProfile: (profileData) => {
      // Handle generated profile
      console.log('Profile generated:', profileData);
    }
  });
</script>
```

Visitor sees:
- Full chart, transits, profile synthesis
- Pricing tiers
- Upgrade options

---

## Step 4: Configure CORS

CORS allows the widget to communicate with Prime Self API.

### Allowed Origins

The widget works on these domains by default:

```javascript
// In workers/src/middleware/cors.js
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'https://selfprime.net',
  'https://prime-self-ui.pages.dev',
  // Add yours:
  'https://your-domain.com'
]);
```

### Add Your Domain

Edit `workers/src/middleware/cors.js`:

```javascript
ALLOWED_ORIGINS.add('https://your-blog.com');
ALLOWED_ORIGINS.add('https://your-app.com');
```

Then redeploy:

```bash
cd workers
npx wrangler deploy
```

---

## Step 5: Test the Widget

### On Your Site

1. Add embed code (see Step 3)
2. Open site in browser
3. Verify widget loads
4. Try generating a chart
5. Check browser console (F12) for errors

### Troubleshooting Embed

**"Widget doesn't load"**
- Check `src` URL is correct
- Verify CORS is configured
- Check firewall/CSP not blocking

**"API calls fail (403 error)"**
- Your domain is not in `ALLOWED_ORIGINS`
- Edit `workers/src/middleware/cors.js` and redeploy Worker

**"Widget shows white screen"**
- Check JavaScript console (F12)
- Verify `containerId` matches your HTML element
- Try `mode: 'preview'` first (simpler)

---

## Advanced: Styling the Widget

### Custom Colors

Pass theme options:

```javascript
PrimeSelfWidget.init({
  containerId: 'prime-self-widget',
  theme: {
    primary: '#8b5cf6',      // Purple
    secondary: '#ec4899',    // Pink
    background: '#1a1a1a',   // Dark
    text: '#ffffff'          // White
  }
});
```

### Custom CSS

Override widget styles:

```html
<style>
  .prime-self-widget {
    max-width: 800px;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
  }
</style>
```

### White-Label Mode

Hide Prime Self branding:

```javascript
PrimeSelfWidget.init({
  containerId: 'prime-self-widget',
  branding: false,  // Hides "Powered by Prime Self" footer
  customBranding: {
    title: 'Your Company Chart',
    logo: 'https://your-cdn.com/logo.png'
  }
});
```

---

## Pricing & Monetization

### Option 1: Free Preview (Recommended)

Visitors generate charts for free on your site.

```javascript
PrimeSelfWidget.init({
  mode: 'preview',
  pricing: false  // No upgrade options shown
});
```

Revenue: None (but drives traffic to Prime Self).

### Option 2: Affiliate Model

Link to Prime Self with referral code:

```javascript
PrimeSelfWidget.init({
  mode: 'preview',
  affiliateCode: 'your-referral-code',
  // Clicking "Full Access" links to:
  // https://selfprime.net?ref=your-referral-code
});
```

Revenue: Commission on referred subscriptions (contact sales).

### Option 3: Premium Embed (Practitioner Tier)

Embed as a white-label feature on practitioner sites:

```javascript
PrimeSelfWidget.init({
  mode: 'authenticated',
  token: '<PRACTITIONER_JWT>',
  pricing: 'hidden'  // Practitioner handles billing
});
```

Cost: $500/month Practitioner tier (see [../BACKLOG.md](../BACKLOG.md)).

---

## Security Considerations

### API Key Exposure

❌ **Don't do this:**
```javascript
PrimeSelfWidget.init({
  apiKey: 'sk_live_...'  // SECRET! Never expose
});
```

✅ **Do this:**
```javascript
// Generate JWT token on your backend
const token = jwtSign({ userId: user_id }, JWT_SECRET, { expiresIn: '24h' });
// Pass token to frontend
PrimeSelfWidget.init({
  token: token
});
```

### CORS Protection

Only whitelisted domains can call Prime Self API. Add your domain:

```bash
# Edit workers/src/middleware/cors.js
ALLOWED_ORIGINS.add('https://your-domain.com');
# Redeploy
npx wrangler deploy
```

### Rate Limiting

Widget API calls are rate-limited (default: 60 req/min per IP).

For high-traffic partners, contact sales for higher limits.

---

## Widget API Reference

### Options

```javascript
PrimeSelfWidget.init({
  containerId: 'string',        // Required: div ID
  mode: 'preview'|'authenticated',
  token: 'string',              // For authenticated mode
  theme: { primary, secondary, background, text },
  branding: boolean,            // Show/hide branding
  customBranding: { title, logo },
  pricing: boolean,             // Show/hide pricing
  affiliateCode: 'string',      // Referral tracking
  onProfile: (data) => {},      // Callback on generate
  onError: (error) => {}        // Callback on error
});
```

### Events

```javascript
// Listen for events
document.addEventListener('prime-self:profile-generated', (e) => {
  console.log('Profile:', e.detail.profile);
});

document.addEventListener('prime-self:error', (e) => {
  console.log('Error:', e.detail.message);
});
```

---

## Monitoring & Analytics

Track widget usage on your site:

```javascript
PrimeSelfWidget.init({
  containerId: 'prime-self-widget',
  onProfile: (profileData) => {
    // Send analytics
    analytics.track('chart_generated', {
      url: window.location.href,
      userType: 'visitor'
    });
  }
});
```

Prime Self also tracks:
- Widget loads
- Charts generated
- Upgrade clicks
- Refer code conversions

---

## Troubleshooting

### Widget shows "API Error"
- Check `token` is valid JWT
- Verify domain is in ALLOWED_ORIGINS
- Check Worker is deployed

### "Token expired" error appears
- JWT tokens expire after 24 hours
- Refresh token on backend
- Regenerate and pass new token

### Widget blocks other page interactions
- Check z-index in CSS (shouldn't be > 9999)
- Verify modal doesn't capture Click events

### Referrer tracking not working
- Ensure `affiliateCode` is set
- Check URL has `?ref=code` parameter
- Verify code exists in Prime Self

---

## Deployment Checklist

- [ ] Widget files deployed (embed.html, embed.js)
- [ ] Your domain added to ALLOWED_ORIGINS
- [ ] Worker redeployed
- [ ] Embed code tested on your site
- [ ] Chart generation works
- [ ] No console errors
- [ ] Styling looks correct
- [ ] Mobile responsive (test on phone)

---

## Next Steps

- **Advanced styling**: Add custom themes and branding
- **Analytics**: Track widget usage and conversions
- **Affiliate program**: Set up referral tracking
- **Support**: Contact help@primeself.net

---

## See Also

- [../frontend/embed.html](../frontend/embed.html) — Widget page
- [../frontend/embed.js](../frontend/embed.js) — Widget script
- [../EMBED_WIDGET_GUIDE.md](../EMBED_WIDGET_GUIDE.md) — Detailed implementation
- [../DEPLOY.md](../DEPLOY.md) — Deployment
- [SETUP_DEVELOPMENT.md](SETUP_DEVELOPMENT.md) — Development setup


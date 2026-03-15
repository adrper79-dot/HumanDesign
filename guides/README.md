# Implementation Guides

Current setup and integration guides for Prime Self.

Use this directory for practical setup instructions. For current product strategy, pricing, or audit status, start from [DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md) instead of treating these guides as product truth.

## 🚀 Getting Started (Essential First Steps)

Start here to get Prime Self running locally:

1. **[SETUP_DEVELOPMENT.md](SETUP_DEVELOPMENT.md)** (10 min)
   - Install Node.js, dependencies, set up environment variables
   - Configure Neon PostgreSQL, Cloudflare account
   - Run the development server locally

2. **[ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)** (5 min)
   - Complete reference of all required secrets
   - How to set each variable securely
   - Validation checklist before deployment

---

## 🔌 Integration Guides (Most Common)

Set up key features and external services:

### Payment System
- **[STRIPE_INTEGRATION.md](STRIPE_INTEGRATION.md)** (30 min)
  - Create Stripe products and price IDs
  - Set up webhook endpoints
  - Test checkout and upgrade flows

### Visual Design
- **[BACKGROUND_VIDEO.md](BACKGROUND_VIDEO.md)** (20 min)
  - Generate or stitch a cosmic background video
  - Install FFmpeg (Windows, macOS, Linux)
  - Integrate video into frontend

### Progressive Web App
- **[PWA_CONFIGURATION.md](PWA_CONFIGURATION.md)** (15 min)
  - Enable offline support
  - Configure service worker caching
  - Add to home screen on mobile

### Embed Widget
- **[EMBED_WIDGET.md](EMBED_WIDGET.md)** (15 min)
  - Host the Prime Self chart widget on external sites
  - Configure CORS and origin allowlists
  - Pricing and authentication for embedded use

---

## 📚 Published Guides Only

The `guides/advanced/` path is not currently published in this repository. Do not rely on references to advanced/custom theme/white-label guides unless those files are added explicitly.

For current related docs, use:

- [../EMBED_WIDGET_GUIDE.md](../EMBED_WIDGET_GUIDE.md)
- [../docs/API_MARKETPLACE.md](../docs/API_MARKETPLACE.md)
- [../docs/PRACTITIONER_FIRST_90_DAY_ROADMAP.md](../docs/PRACTITIONER_FIRST_90_DAY_ROADMAP.md)

---

## 📖 Reference by Feature

| Feature | Location | Time |
|---------|----------|------|
| **Local development** | [SETUP_DEVELOPMENT.md](SETUP_DEVELOPMENT.md) | 10 min |
| **Secrets & config** | [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) | 5 min |
| **Stripe payments** | [STRIPE_INTEGRATION.md](STRIPE_INTEGRATION.md) | 30 min |
| **Background video** | [BACKGROUND_VIDEO.md](BACKGROUND_VIDEO.md) | 20 min |
| **PWA features** | [PWA_CONFIGURATION.md](PWA_CONFIGURATION.md) | 15 min |
| **Embed widget** | [EMBED_WIDGET.md](EMBED_WIDGET.md) | 15 min |

---

## 🔍 Troubleshooting

See the specific guide for your issue, or consult:
- **Setup issues** → [SETUP_DEVELOPMENT.md](SETUP_DEVELOPMENT.md#troubleshooting)
- **Stripe problems** → [STRIPE_INTEGRATION.md](STRIPE_INTEGRATION.md#troubleshooting)
- **Video issues** → [BACKGROUND_VIDEO.md](BACKGROUND_VIDEO.md#troubleshooting)

---

## 📞 Need Help?

- **General questions** → See [docs/GLOSSARY.md](../docs/GLOSSARY.md)
- **Architecture questions** → See [ARCHITECTURE.md](../ARCHITECTURE.md)
- **Deployment issues** → See [DEPLOY.md](../DEPLOY.md)
- **Operational support** → See [docs/OPERATION.md](../docs/OPERATION.md)


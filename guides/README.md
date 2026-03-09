# Implementation Guides

Step-by-step tutorials for setting up, integrating, and customizing Prime Self.

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

## 📚 Advanced Guides (Customization & Deployment)

Customize the platform and deploy variations:

### Customization
- **[advanced/CUSTOM_THEMES.md](advanced/CUSTOM_THEMES.md)**
  - Create custom color themes
  - Build white-label designs
  - Override design tokens and CSS

### API Integration
- **[advanced/API_INTEGRATION.md](advanced/API_INTEGRATION.md)**
  - Build external applications with the Prime Self API
  - Authentication and rate limiting
  - Example client libraries

### White-Label Deployment
- **[advanced/WHITE_LABEL.md](advanced/WHITE_LABEL.md)**
  - Deploy Prime Self under your brand
  - Custom domain configuration
  - Admin panel customization

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
| **Custom themes** | [advanced/CUSTOM_THEMES.md](advanced/CUSTOM_THEMES.md) | — |
| **API integration** | [advanced/API_INTEGRATION.md](advanced/API_INTEGRATION.md) | — |
| **White-label** | [advanced/WHITE_LABEL.md](advanced/WHITE_LABEL.md) | — |

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


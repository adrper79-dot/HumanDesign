=== Prime Self - Human Design Chart Calculator ===
Contributors: primeself
Tags: human design, bodygraph, astrology, chart calculator, spirituality
Requires at least: 5.0
Tested up to: 6.4
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Embed a Human Design chart calculator on your WordPress site. Powered by Prime Self API.

== Description ==

Transform your WordPress site into a Human Design resource with the Prime Self Chart Calculator plugin. Allow visitors to generate their complete Human Design bodygraph with birth data, displaying their Type, Strategy, Authority, Profile, and more.

### Features

* **Full Chart Calculator** - Calculate Human Design charts from birth date, time, and location
* **Beautiful Widgets** - Multiple style options (Modern, Compact, Minimal)
* **Smart Caching** - Reduce API calls and improve performance with built-in caching
* **Location Autocomplete** - Powered by OpenStreetMap for accurate birth locations
* **Flexible Display Options** - Shortcodes, widgets, and theme integration
* **Customizable Styling** - Choose your primary color and widget appearance
* **Privacy Friendly** - GDPR compliant with configurable data handling
* **Affiliate Integration** - Earn commissions by promoting Prime Self

### What is Human Design?

Human Design is a synthesis of ancient wisdom and modern science, combining astrology, I Ching, Kabbalah, and the chakra system. It provides a unique blueprint of your energetic makeup, helping you understand how you're designed to interact with the world.

### How It Works

1. **Install & Activate** the plugin
2. **Get an API Key** from [primeself.app/api](https://primeself.app/api) (free tier available)
3. **Configure Settings** - Add your API key to the plugin settings
4. **Add to Pages** - Use `[primeself_chart]` shortcode or add the widget to your sidebar

### Shortcodes

**Full Calculator:**
`[primeself_chart]`

**With Options:**
`[primeself_chart style="compact" show_branding="1"]`

**Mini Button:**
`[primeself_mini button_text="Get Your Chart"]`

### Widget Styles

* **Modern** - Full-featured with gradients and visual appeal
* **Compact** - Streamlined for sidebar use
* **Minimal** - Clean, borderless design

### API Pricing

* **Free** - 100 chart calculations per day
* **Basic** - 1,000 charts/day for $9/month
* **Pro** - 10,000 charts/day for $29/month
* **Enterprise** - Custom limits and pricing

The free tier is perfect for personal blogs and small sites. Upgrade as your traffic grows.

### Performance

* **Built-in Caching** - Store chart calculations in your WordPress database
* **Lazy Loading** - Load JavaScript only when needed
* **Optimized Assets** - Minified CSS and JavaScript
* **Cache Hit Rate Tracking** - Monitor performance in Usage Stats page

### Privacy & GDPR

* Anonymous chart caching (no personal identifiers)
* Configurable data retention
* Privacy policy link option
* No tracking cookies
* Optional analytics

### Affiliate Program

Join the Prime Self affiliate program and earn commission when visitors upgrade:

* 30% recurring commission on all plans
* 90-day cookie duration
* Real-time tracking dashboard
* Marketing materials provided

[Apply for Affiliate Program](https://primeself.app/affiliates)

### Support

* [Documentation](https://primeself.app/docs/wordpress)
* [API Docs](https://primeself.app/api)
* [Support Forum](https://primeself.app/support)
* Email: support@primeself.app

== Installation ==

### Automatic Installation

1. Log in to your WordPress dashboard
2. Navigate to Plugins → Add New
3. Search for "Prime Self Human Design"
4. Click "Install Now" and then "Activate"

### Manual Installation

1. Download the plugin ZIP file
2. Log in to your WordPress dashboard
3. Navigate to Plugins → Add New → Upload Plugin
4. Choose the ZIP file and click "Install Now"
5. Activate the plugin

### Configuration

1. Navigate to **Prime Self → Settings**
2. Visit [primeself.app/api](https://primeself.app/api) to get your API key
3. Enter your API key in the settings
4. Click "Test Connection" to verify
5. (Optional) Customize widget appearance and caching settings
6. Save settings

### Adding to Your Site

**In Posts/Pages:**
Add the shortcode `[primeself_chart]` where you want the calculator to appear.

**In Sidebar/Footer:**
1. Go to Appearance → Widgets
2. Drag "Prime Self - Chart Calculator" to your widget area
3. Configure and save

**In Theme Files:**
```php
<?php echo do_shortcode('[primeself_chart]'); ?>
```

== Frequently Asked Questions ==

= Do I need a Prime Self account? =

Yes, you'll need a free account at primeself.app to generate an API key. The free tier includes 100 chart calculations per day.

= How much does it cost? =

The plugin is free. API usage costs:
* Free: 100 charts/day ($0)
* Basic: 1,000 charts/day ($9/month)
* Pro: 10,000 charts/day ($29/month)
* Enterprise: Custom pricing

= Is caching secure? =

Yes! Charts are stored with a SHA-256 hash. No personally identifiable information (names, emails) is stored.

= Can I customize the appearance? =

Absolutely! Change colors, choose widget styles (Modern/Compact/Minimal), and add custom CSS.

= What if I exceed my API limit? =

The calculator will display an error message. Upgrade your API tier or enable longer cache duration to reduce API calls.

= Is this GDPR compliant? =

Yes. The plugin stores only birth data (date, time, location) with no personal identifiers. You can configure cache retention periods and add a privacy policy link.

= Can I earn money with this plugin? =

Yes! Join the affiliate program and earn 30% recurring commission when visitors upgrade to paid Prime Self plans.

= Does it work with page builders? =

Yes! Works with Gutenberg, Elementor, Divi, Beaver Builder, and other page builders using the shortcode block.

= What about mobile devices? =

The widget is fully responsive and works beautifully on phones and tablets.

= Can I translate the plugin? =

Yes, the plugin is translation-ready. Use a plugin like Loco Translate or submit translations via translate.wordpress.org.

== Screenshots ==

1. Full chart calculator in Modern style
2. Admin settings page
3. Usage statistics dashboard
4. Widget configuration
5. Compact calculator in sidebar
6. Chart results display

== Changelog ==

= 1.0.0 - 2024-03-06 =
* Initial release
* Full chart calculator with birth data input
* Location autocomplete using OpenStreetMap
* Chart caching system
* Multiple widget styles (Modern, Compact, Minimal)
* Admin settings panel
* Usage statistics page
* Shortcode support: [primeself_chart] and [primeself_mini]
* WordPress widget support
* Affiliate integration
* Performance optimization with lazy loading
* GDPR compliance features

== Upgrade Notice ==

= 1.0.0 =
Initial release of Prime Self Human Design Chart Calculator

== Privacy Policy ==

This plugin:
* Stores chart calculations in your WordPress database (birth date, time, location only)
* Does not collect names, emails, or other personal identifiers
* Optionally sends anonymous usage analytics to Prime Self (can be disabled)
* Calls the Prime Self API to calculate charts (requires API key)
* Uses OpenStreetMap Nominatim API for location autocomplete
* Does not use tracking cookies
* Respects cache retention settings for data cleanup

For API usage, see the [Prime Self Privacy Policy](https://primeself.app/privacy).

== Third-Party Services ==

This plugin uses the following external services:

**Prime Self API**
* Service URL: https://api.primeself.app
* Purpose: Calculate Human Design charts
* Privacy Policy: https://primeself.app/privacy
* Terms of Service: https://primeself.app/terms

**OpenStreetMap Nominatim**
* Service URL: https://nominatim.openstreetmap.org
* Purpose: Location autocomplete for birth places
* Privacy Policy: https://wiki.osmfoundation.org/wiki/Privacy_Policy
* Usage Policy: https://operations.osmfoundation.org/policies/nominatim/

== Support ==

For support, please:
1. Check the [documentation](https://primeself.app/docs/wordpress)
2. Visit the [support forum](https://primeself.app/support)
3. Email support@primeself.app

== Credits ==

Developed by Prime Self
Website: https://primeself.app

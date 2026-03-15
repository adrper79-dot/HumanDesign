# Embed Widget Guide

Quick-start guide for putting the Prime Self widget on an external website.

For the detailed version, use [../EMBED_WIDGET_GUIDE.md](../EMBED_WIDGET_GUIDE.md).

---

## Current Usage Model

The embed widget is part of the practitioner-first distribution model.

Use it to:

- capture leads on practitioner-owned sites
- offer chart activity without sending users away immediately
- connect visitor interest to practitioner follow-up

White-label behavior should be treated as an Agency capability, not a separate canonical plan name.

---

## Basic Setup

```html
<div data-primeself-widget data-theme="dark" id="ps-widget"></div>
<script src="https://primeself.app/embed.js"></script>
```

---

## If You Need More Control

Use JavaScript initialization:

```html
<div id="primeself-widget"></div>
<script src="https://primeself.app/embed.js"></script>
<script>
  PrimeSelf.init({
    elementId: 'primeself-widget',
    theme: 'dark',
    accentColor: '#c9a84c',
    hideAttribution: false
  });
</script>
```

---

## Entitlement Notes

- Standard branded widget use is available for practitioner-facing distribution.
- `hideAttribution` should be documented and enforced as an Agency / white-label capability.
- If entitlement behavior changes, update this file and [../EMBED_WIDGET_GUIDE.md](../EMBED_WIDGET_GUIDE.md) together.

---

## Related Docs

- [../EMBED_WIDGET_GUIDE.md](../EMBED_WIDGET_GUIDE.md)
- [../docs/API_MARKETPLACE.md](../docs/API_MARKETPLACE.md)
- [../docs/TIER_ENFORCEMENT.md](../docs/TIER_ENFORCEMENT.md)


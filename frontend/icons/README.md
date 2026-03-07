# Prime Self PWA Icons

This directory contains app icons for the Progressive Web App.

## Required Icon Sizes

All icons should use the Prime Self logo/brand colors:
- Background: #0a0a0f (dark)
- Primary: #c9a84c (gold)
- Accent: #d5001c (red)

### Icon Specifications

#### Core Icons (Required)
- **icon-72.png** (72x72) - Small tile
- **icon-96.png** (96x96) - Small tile
- **icon-128.png** (128x128) - Standard icon
- **icon-144.png** (144x144) - MS tile
- **icon-152.png** (152x152) - iOS touch icon
- **icon-192.png** (192x192) - Android home screen (maskable)
- **icon-384.png** (384x384) - High-res version
- **icon-512.png** (512x512) - Splash screen (maskable)

#### Badge Icons (Optional)
- **badge-72.png** (72x72) - Push notification badge (monochrome)

#### Shortcut Icons (Optional)
- **shortcut-chart.png** (96x96) - Bodygraph shortcut
- **shortcut-transits.png** (96x96) - Transit report shortcut

## Maskable Icons

Icons marked as "maskable" should have a safe zone:
- The core logo/design should fit within the central 80% of the image
- Outer 10% on all sides may be cropped by Android adaptive icons
- Use a solid background color (#0a0a0f) extending to edges

## Generation Options

### Option 1: Use Existing Favicon
The current SVG favicon can be rendered at different sizes:
```svg
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='none'>
  <circle cx='16' cy='16' r='14' stroke='%23d5001c' stroke-width='2'/>
  <circle cx='16' cy='16' r='6' fill='%23d5001c'/>
  <line x1='16' y1='2' x2='16' y2='30' stroke='%23d5001c' stroke-width='1'/>
  <line x1='2' y1='16' x2='30' y2='16' stroke='%23d5001c' stroke-width='1'/>
</svg>
```

### Option 2: Create Custom Icons
Use a design tool to create branded icons with:
- Prime Self logo/wordmark
- Human Design bodygraph symbol
- Gene Keys symbol
- Astrological chart element

### Option 3: Use Icon Generator Services
- **PWA Asset Generator**: https://www.pwabuilder.com/imageGenerator
- **RealFaviconGenerator**: https://realfavicongenerator.net/
- **Favicon.io**: https://favicon.io/

## Quick Generation Script

If you have ImageMagick installed:

```bash
# Convert SVG favicon to PNG at various sizes
for size in 72 96 128 144 152 192 384 512; do
  convert -background "#0a0a0f" -size ${size}x${size} favicon.svg icon-${size}.png
done
```

## Current Status

⚠️ **Placeholder icons needed** - The manifest references these icon paths, but actual PNG files need to be generated.

For now, the PWA will work without icons, but users will see:
- Generic browser icon on home screen
- No splash screen on iOS
- Default Android adaptive icon

**Next Step**: Generate icons using one of the methods above and place them in this directory.

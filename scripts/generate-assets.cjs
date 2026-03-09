#!/usr/bin/env node
/**
 * generate-assets.js
 * 
 * Extracts the best logo frame from HumanDesign_LogoMovie.mp4
 * and generates ALL image/video assets needed by the site and PWA.
 *
 * Usage:  node scripts/generate-assets.js
 * Requires: npm install --save-dev ffmpeg-static sharp
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// ── Paths ──────────────────────────────────────────────────────
const ROOT      = path.resolve(__dirname, '..');
const VIDEO     = path.join(ROOT, 'HumanDesign_LogoMovie.mp4');
const FFMPEG    = require('ffmpeg-static');
const ICONS_DIR = path.join(ROOT, 'frontend', 'icons');
const SCREENS   = path.join(ROOT, 'frontend', 'screenshots');
const FRONTEND  = path.join(ROOT, 'frontend');
const TEMP_DIR  = path.join(ROOT, '.tmp-frames');

// ── Brand colors ───────────────────────────────────────────────
const BG_COLOR  = { r: 10, g: 10, b: 15, alpha: 1 };   // #0a0a0f
const GOLD_HEX  = '#c9a84c';

// ── Ensure directories ────────────────────────────────────────
[ICONS_DIR, SCREENS, TEMP_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

// ── Helpers ────────────────────────────────────────────────────
function run(cmd) {
  console.log(`  ▸ ${cmd.substring(0, 120)}...`);
  execSync(cmd, { stdio: 'pipe' });
}

function ffmpeg(args) {
  const cmd = `"${FFMPEG}" ${args}`;
  run(cmd);
}

// ── STEP 1: Extract key frames from the video ─────────────────
console.log('\n═══ STEP 1: Extracting frames from video ═══');

// Extract frame at 5s (logo fully revealed — near the end of a 6s video)
const LOGO_FRAME = path.join(TEMP_DIR, 'logo-frame.png');
ffmpeg(`-y -i "${VIDEO}" -ss 5.0 -frames:v 1 -q:v 1 "${LOGO_FRAME}"`);

// Extract frame at 3s (mid-animation — good for loading screen)
const MID_FRAME = path.join(TEMP_DIR, 'mid-frame.png');
ffmpeg(`-y -i "${VIDEO}" -ss 3.0 -frames:v 1 -q:v 1 "${MID_FRAME}"`);

// Extract frame at 0.5s (early — good for poster/placeholder)
const EARLY_FRAME = path.join(TEMP_DIR, 'early-frame.png');
ffmpeg(`-y -i "${VIDEO}" -ss 0.5 -frames:v 1 -q:v 1 "${EARLY_FRAME}"`);

// Also grab the attached thumbnail (stream 2)
const THUMB_FRAME = path.join(TEMP_DIR, 'thumbnail.png');
try {
  ffmpeg(`-y -i "${VIDEO}" -map 0:2 -frames:v 1 "${THUMB_FRAME}"`);
} catch { console.log('  (no embedded thumbnail, using logo frame)'); }

console.log('  ✓ Frames extracted');

// ── STEP 2: Generate PWA icons at all sizes ────────────────────
async function generateIcons() {
  console.log('\n═══ STEP 2: Generating PWA icons ═══');

  // Load the logo frame (464x688 portrait)
  const frame = sharp(LOGO_FRAME);
  const meta = await frame.metadata();
  console.log(`  Source frame: ${meta.width}×${meta.height}`);

  // Crop to square from center (464x464)
  const squareSize = Math.min(meta.width, meta.height);
  const squareFrame = sharp(LOGO_FRAME)
    .extract({
      left: Math.round((meta.width - squareSize) / 2),
      top: Math.round((meta.height - squareSize) / 2),
      width: squareSize,
      height: squareSize,
    });

  // Save the master square as lossless PNG
  const masterSquare = path.join(TEMP_DIR, 'master-square.png');
  await squareFrame.toFile(masterSquare);

  // ── PWA icon sizes ──
  const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

  for (const size of iconSizes) {
    const outPath = path.join(ICONS_DIR, `icon-${size}.png`);
    await sharp(masterSquare)
      .resize(size, size, { fit: 'contain', background: BG_COLOR })
      .png({ quality: 95 })
      .toFile(outPath);
    console.log(`  ✓ icon-${size}.png (${size}×${size})`);
  }

  // ── Maskable icons (with padding for safe zone) ──
  // Maskable icons need the important content in the inner 80% circle
  for (const size of [192, 512]) {
    const innerSize = Math.round(size * 0.7); // 70% so logo fits in 80% safe zone
    const padding = Math.round((size - innerSize) / 2);

    const outPath = path.join(ICONS_DIR, `icon-${size}-maskable.png`);
    const inner = await sharp(masterSquare)
      .resize(innerSize, innerSize, { fit: 'contain', background: BG_COLOR })
      .toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: BG_COLOR,
      },
    })
      .composite([{ input: inner, left: padding, top: padding }])
      .png()
      .toFile(outPath);
    console.log(`  ✓ icon-${size}-maskable.png (${size}×${size}, safe zone padded)`);
  }

  // ── Badge icon (monochrome-ish — white on transparent) ──
  const badgePath = path.join(ICONS_DIR, 'badge-72.png');
  await sharp(masterSquare)
    .resize(72, 72)
    .greyscale()
    .png()
    .toFile(badgePath);
  console.log('  ✓ badge-72.png (72×72 monochrome)');

  // ── Shortcut icons ──
  for (const name of ['shortcut-chart', 'shortcut-transits']) {
    const outPath = path.join(ICONS_DIR, `${name}.png`);
    await sharp(masterSquare)
      .resize(96, 96)
      .png()
      .toFile(outPath);
    console.log(`  ✓ ${name}.png (96×96)`);
  }

  // ── favicon.ico (multi-size PNG — modern browsers accept PNG favicons) ──
  const favicon16 = path.join(ICONS_DIR, 'favicon-16.png');
  const favicon32 = path.join(ICONS_DIR, 'favicon-32.png');
  const favicon48 = path.join(ICONS_DIR, 'favicon-48.png');
  await sharp(masterSquare).resize(16, 16).png().toFile(favicon16);
  await sharp(masterSquare).resize(32, 32).png().toFile(favicon32);
  await sharp(masterSquare).resize(48, 48).png().toFile(favicon48);
  console.log('  ✓ favicon-16/32/48.png');

  // Copy 32px as the main favicon
  fs.copyFileSync(favicon32, path.join(FRONTEND, 'favicon.png'));
  console.log('  ✓ frontend/favicon.png (32×32)');

  return masterSquare;
}

// ── STEP 3: Generate social/OG images ──────────────────────────
async function generateSocialImages(masterSquare) {
  console.log('\n═══ STEP 3: Generating social media images ═══');

  const frame = sharp(LOGO_FRAME);
  const meta = await frame.metadata();

  // ── Open Graph image (1200×630) ──
  // Place the full logo frame centered on a dark background with brand bg
  const ogWidth = 1200;
  const ogHeight = 630;

  // Scale the logo to fit within the OG image height with padding
  const logoHeight = ogHeight - 60; // 30px padding top/bottom
  const logoScale = logoHeight / meta.height;
  const logoWidth = Math.round(meta.width * logoScale);

  const scaledLogo = await sharp(LOGO_FRAME)
    .resize(logoWidth, logoHeight, { fit: 'inside' })
    .toBuffer();

  const ogPath = path.join(FRONTEND, 'og-image.png');
  await sharp({
    create: {
      width: ogWidth,
      height: ogHeight,
      channels: 4,
      background: BG_COLOR,
    },
  })
    .composite([
      {
        input: scaledLogo,
        left: Math.round((ogWidth - logoWidth) / 2),
        top: Math.round((ogHeight - logoHeight) / 2),
      },
    ])
    .png({ quality: 90 })
    .toFile(ogPath);
  console.log(`  ✓ og-image.png (${ogWidth}×${ogHeight})`);

  // ── Twitter card (same size, copy) ──
  fs.copyFileSync(ogPath, path.join(FRONTEND, 'twitter-card.png'));
  console.log(`  ✓ twitter-card.png (${ogWidth}×${ogHeight})`);

  // ── Pinterest pin image (1000×1500 portrait) ──
  const pinWidth = 1000;
  const pinHeight = 1500;
  const pinLogoH = pinHeight - 200;
  const pinLogoW = Math.round(meta.width * (pinLogoH / meta.height));

  const pinScaled = await sharp(LOGO_FRAME)
    .resize(pinLogoW, pinLogoH, { fit: 'inside' })
    .toBuffer();

  const pinPath = path.join(FRONTEND, 'pinterest-pin.png');
  await sharp({
    create: {
      width: pinWidth,
      height: pinHeight,
      channels: 4,
      background: BG_COLOR,
    },
  })
    .composite([
      {
        input: pinScaled,
        left: Math.round((pinWidth - pinLogoW) / 2),
        top: Math.round((pinHeight - pinLogoH) / 2),
      },
    ])
    .png()
    .toFile(pinPath);
  console.log(`  ✓ pinterest-pin.png (${pinWidth}×${pinHeight})`);
}

// ── STEP 4: Generate Apple splash screens ──────────────────────
async function generateSplashScreens(masterSquare) {
  console.log('\n═══ STEP 4: Generating Apple splash screens ═══');

  // Apple splash screen sizes (portrait only — most common)
  const splashSizes = [
    { name: 'splash-640x1136',   w: 640,  h: 1136  }, // iPhone 5/SE
    { name: 'splash-750x1334',   w: 750,  h: 1334  }, // iPhone 6/7/8
    { name: 'splash-828x1792',   w: 828,  h: 1792  }, // iPhone XR/11
    { name: 'splash-1125x2436',  w: 1125, h: 2436  }, // iPhone X/XS/11 Pro
    { name: 'splash-1170x2532',  w: 1170, h: 2532  }, // iPhone 12/13/14
    { name: 'splash-1179x2556',  w: 1179, h: 2556  }, // iPhone 14/15 Pro
    { name: 'splash-1242x2208',  w: 1242, h: 2208  }, // iPhone 8 Plus
    { name: 'splash-1284x2778',  w: 1284, h: 2778  }, // iPhone 12/13/14 Pro Max
    { name: 'splash-1290x2796',  w: 1290, h: 2796  }, // iPhone 15 Pro Max
    { name: 'splash-1536x2048',  w: 1536, h: 2048  }, // iPad
    { name: 'splash-2048x2732',  w: 2048, h: 2732  }, // iPad Pro 12.9"
  ];

  const logoMeta = await sharp(LOGO_FRAME).metadata();

  for (const { name, w, h } of splashSizes) {
    // Scale logo to 40% of splash height
    const logoH = Math.round(h * 0.4);
    const logoScale = logoH / logoMeta.height;
    const logoW = Math.round(logoMeta.width * logoScale);

    const scaledLogo = await sharp(LOGO_FRAME)
      .resize(Math.min(logoW, w - 40), logoH, { fit: 'inside' })
      .toBuffer();

    const scaledMeta = await sharp(scaledLogo).metadata();

    const outPath = path.join(ICONS_DIR, `${name}.png`);
    await sharp({
      create: {
        width: w,
        height: h,
        channels: 4,
        background: BG_COLOR,
      },
    })
      .composite([
        {
          input: scaledLogo,
          left: Math.round((w - scaledMeta.width) / 2),
          top: Math.round((h - scaledMeta.height) / 2),
        },
      ])
      .png({ quality: 85 })
      .toFile(outPath);
    console.log(`  ✓ ${name}.png (${w}×${h})`);
  }
}

// ── STEP 5: Generate web-optimized video variants ──────────────
function generateVideoVariants() {
  console.log('\n═══ STEP 5: Generating web-optimized video ═══');

  // ── MP4 optimized (smaller, web-ready, fast-start) ──
  const mp4Out = path.join(FRONTEND, 'logo-animation.mp4');
  ffmpeg(
    `-y -i "${VIDEO}" -c:v libx264 -preset slow -crf 28 -vf "scale=464:688" ` +
    `-an -movflags +faststart -pix_fmt yuv420p "${mp4Out}"`
  );
  const mp4Size = (fs.statSync(mp4Out).size / 1024).toFixed(0);
  console.log(`  ✓ logo-animation.mp4 (${mp4Size} KB, no audio, fast-start)`);

  // ── WebM (VP9 — smaller, modern browsers) ──
  const webmOut = path.join(FRONTEND, 'logo-animation.webm');
  ffmpeg(
    `-y -i "${VIDEO}" -c:v libvpx-vp9 -b:v 0 -crf 35 -vf "scale=464:688" ` +
    `-an -row-mt 1 "${webmOut}"`
  );
  const webmSize = (fs.statSync(webmOut).size / 1024).toFixed(0);
  console.log(`  ✓ logo-animation.webm (${webmSize} KB, VP9)`);

  // ── GIF for email/social (lower quality, small size) ──
  const gifOut = path.join(FRONTEND, 'logo-animation.gif');
  // Two-pass for good quality: generate palette first, then use it
  const palette = path.join(TEMP_DIR, 'palette.png');
  ffmpeg(
    `-y -i "${VIDEO}" -vf "fps=12,scale=232:-1:flags=lanczos,palettegen=max_colors=64" "${palette}"`
  );
  ffmpeg(
    `-y -i "${VIDEO}" -i "${palette}" -lavfi "fps=12,scale=232:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer" "${gifOut}"`
  );
  const gifSize = (fs.statSync(gifOut).size / 1024).toFixed(0);
  console.log(`  ✓ logo-animation.gif (${gifSize} KB, 232px wide, 12fps)`);

  // ── Loop clip (last 2 seconds looped 3x — for CSS background-video) ──
  const loopOut = path.join(FRONTEND, 'logo-loop.mp4');
  ffmpeg(
    `-y -ss 4.0 -i "${VIDEO}" -c:v libx264 -preset slow -crf 30 ` +
    `-an -movflags +faststart -pix_fmt yuv420p -t 2 "${loopOut}"`
  );
  const loopSize = (fs.statSync(loopOut).size / 1024).toFixed(0);
  console.log(`  ✓ logo-loop.mp4 (${loopSize} KB, last 2s for looping hero)`);

  // ── Poster image (frame from video as JPEG — fast loading) ──
  const posterOut = path.join(FRONTEND, 'logo-poster.jpg');
  ffmpeg(`-y -i "${VIDEO}" -ss 5.0 -frames:v 1 -q:v 2 "${posterOut}"`);
  console.log('  ✓ logo-poster.jpg (video poster image)');

  // ── Audio extract (for optional sound effect) ──
  const audioOut = path.join(FRONTEND, 'logo-sound.mp3');
  try {
    ffmpeg(`-y -i "${VIDEO}" -vn -acodec libmp3lame -q:a 4 "${audioOut}"`);
    const audioSize = (fs.statSync(audioOut).size / 1024).toFixed(0);
    console.log(`  ✓ logo-sound.mp3 (${audioSize} KB, extracted audio)`);
  } catch {
    console.log('  ⚠ No audio stream or encode failed — skipping');
  }
}

// ── STEP 6: Generate additional marketing assets ───────────────
async function generateMarketingAssets() {
  console.log('\n═══ STEP 6: Generating marketing/misc assets ═══');

  const meta = await sharp(LOGO_FRAME).metadata();

  // ── App Store style preview (1024×1024) ──
  const appIconSize = 1024;
  const innerH = Math.round(appIconSize * 0.75);
  const innerScale = innerH / meta.height;
  const innerW = Math.round(meta.width * innerScale);

  const appScaled = await sharp(LOGO_FRAME)
    .resize(innerW, innerH, { fit: 'inside' })
    .toBuffer();

  const appIconPath = path.join(ICONS_DIR, 'app-store-1024.png');
  await sharp({
    create: {
      width: appIconSize,
      height: appIconSize,
      channels: 4,
      background: BG_COLOR,
    },
  })
    .composite([
      {
        input: appScaled,
        left: Math.round((appIconSize - innerW) / 2),
        top: Math.round((appIconSize - innerH) / 2),
      },
    ])
    .png()
    .toFile(appIconPath);
  console.log(`  ✓ app-store-1024.png (${appIconSize}×${appIconSize})`);

  // ── Email header banner (600×200) ──
  const emailW = 600;
  const emailH = 200;
  const emailLogoH = emailH - 40;
  const emailLogoW = Math.round(meta.width * (emailLogoH / meta.height));

  const emailScaled = await sharp(LOGO_FRAME)
    .resize(emailLogoW, emailLogoH, { fit: 'inside' })
    .toBuffer();
  const emailScaledMeta = await sharp(emailScaled).metadata();

  const emailPath = path.join(FRONTEND, 'email-header.png');
  await sharp({
    create: {
      width: emailW,
      height: emailH,
      channels: 4,
      background: BG_COLOR,
    },
  })
    .composite([
      {
        input: emailScaled,
        left: Math.round((emailW - emailScaledMeta.width) / 2),
        top: Math.round((emailH - emailScaledMeta.height) / 2),
      },
    ])
    .png()
    .toFile(emailPath);
  console.log(`  ✓ email-header.png (${emailW}×${emailH})`);

  // ── Embed widget header (400×100) ──
  const embedW = 400;
  const embedH = 100;
  const embedLogoH = embedH - 20;
  const embedLogoW = Math.round(meta.width * (embedLogoH / meta.height));

  const embedScaled = await sharp(LOGO_FRAME)
    .resize(embedLogoW, embedLogoH, { fit: 'inside' })
    .toBuffer();
  const embedScaledMeta = await sharp(embedScaled).metadata();

  const embedPath = path.join(FRONTEND, 'embed-logo.png');
  await sharp({
    create: {
      width: embedW,
      height: embedH,
      channels: 4,
      background: BG_COLOR,
    },
  })
    .composite([
      {
        input: embedScaled,
        left: Math.round((embedW - embedScaledMeta.width) / 2),
        top: Math.round((embedH - embedScaledMeta.height) / 2),
      },
    ])
    .png()
    .toFile(embedPath);
  console.log(`  ✓ embed-logo.png (${embedW}×${embedH})`);
}

// ── MAIN ───────────────────────────────────────────────────────
(async () => {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   Prime Self — Asset Generation Pipeline     ║');
  console.log('║   Source: HumanDesign_LogoMovie.mp4          ║');
  console.log('╚══════════════════════════════════════════════╝');

  if (!fs.existsSync(VIDEO)) {
    console.error(`\n❌ Video not found: ${VIDEO}`);
    process.exit(1);
  }

  const masterSquare = await generateIcons();
  await generateSocialImages(masterSquare);
  await generateSplashScreens(masterSquare);
  generateVideoVariants();
  await generateMarketingAssets();

  // ── Cleanup temp ──
  console.log('\n═══ Cleanup ═══');
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  console.log('  ✓ Temp directory removed');

  // ── Summary ──
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║            ✅ ALL ASSETS GENERATED            ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('\n📁 Generated files:\n');

  // Count and list generated files
  const iconFiles = fs.readdirSync(ICONS_DIR).filter(f => f.endsWith('.png'));
  console.log(`  frontend/icons/ (${iconFiles.length} files):`);
  iconFiles.forEach(f => {
    const size = (fs.statSync(path.join(ICONS_DIR, f)).size / 1024).toFixed(1);
    console.log(`    ${f} (${size} KB)`);
  });

  const frontendAssets = fs.readdirSync(FRONTEND).filter(f =>
    f.match(/\.(png|jpg|mp4|webm|gif|mp3)$/)
  );
  console.log(`\n  frontend/ (${frontendAssets.length} files):`);
  frontendAssets.forEach(f => {
    const size = (fs.statSync(path.join(FRONTEND, f)).size / 1024).toFixed(1);
    console.log(`    ${f} (${size} KB)`);
  });

  console.log('\n📋 Next steps:');
  console.log('  1. Review generated images for quality');
  console.log('  2. manifest.json has been kept — run the update script');
  console.log('  3. Update index.html favicon/OG references');
  console.log('  4. Add <link rel="apple-touch-startup-image"> tags for splash screens');
  console.log('  5. Use logo-animation.mp4 / .webm as hero background or loading screen');
  console.log('  6. Deploy to Cloudflare Pages\n');
})();

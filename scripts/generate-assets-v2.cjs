#!/usr/bin/env node
/**
 * generate-assets-v2.cjs
 * 
 * Generates all assets from HD_LOGOVID2.mp4 as variant "v2".
 * Same structure as v1 but files suffixed with -v2.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ROOT      = path.resolve(__dirname, '..');
const VIDEO     = path.join(ROOT, 'HD_LOGOVID2.mp4');
const FFMPEG    = require('ffmpeg-static');
const ICONS_DIR = path.join(ROOT, 'frontend', 'icons');
const FRONTEND  = path.join(ROOT, 'frontend');
const TEMP_DIR  = path.join(ROOT, '.tmp-frames-v2');

const BG_COLOR  = { r: 10, g: 10, b: 15, alpha: 1 };

[ICONS_DIR, TEMP_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

function ffmpeg(args) {
  const cmd = `"${FFMPEG}" ${args}`;
  console.log(`  ▸ running ffmpeg...`);
  execSync(cmd, { stdio: 'pipe' });
}

// ── STEP 1: Extract frames ────────────────────────────────────
console.log('\n═══ STEP 1: Extracting frames from HD_LOGOVID2.mp4 ═══');

// Video is 10s — logo likely fully formed near end
const LOGO_FRAME = path.join(TEMP_DIR, 'logo-frame-v2.png');
ffmpeg(`-y -i "${VIDEO}" -ss 8.5 -frames:v 1 -q:v 1 "${LOGO_FRAME}"`);

const MID_FRAME = path.join(TEMP_DIR, 'mid-frame-v2.png');
ffmpeg(`-y -i "${VIDEO}" -ss 5.0 -frames:v 1 -q:v 1 "${MID_FRAME}"`);

const EARLY_FRAME = path.join(TEMP_DIR, 'early-frame-v2.png');
ffmpeg(`-y -i "${VIDEO}" -ss 1.0 -frames:v 1 -q:v 1 "${EARLY_FRAME}"`);

console.log('  ✓ Frames extracted');

// ── STEP 2: PWA icons ─────────────────────────────────────────
async function generateIcons() {
  console.log('\n═══ STEP 2: Generating v2 PWA icons ═══');

  const meta = await sharp(LOGO_FRAME).metadata();
  console.log(`  Source frame: ${meta.width}×${meta.height}`);

  const squareSize = Math.min(meta.width, meta.height);
  const masterSquare = path.join(TEMP_DIR, 'master-square-v2.png');
  await sharp(LOGO_FRAME)
    .extract({
      left: Math.round((meta.width - squareSize) / 2),
      top: Math.round((meta.height - squareSize) / 2),
      width: squareSize,
      height: squareSize,
    })
    .toFile(masterSquare);

  const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];
  for (const size of iconSizes) {
    await sharp(masterSquare)
      .resize(size, size, { fit: 'contain', background: BG_COLOR })
      .png({ quality: 95 })
      .toFile(path.join(ICONS_DIR, `icon-${size}-v2.png`));
    console.log(`  ✓ icon-${size}-v2.png`);
  }

  for (const size of [192, 512]) {
    const innerSize = Math.round(size * 0.7);
    const padding = Math.round((size - innerSize) / 2);
    const inner = await sharp(masterSquare)
      .resize(innerSize, innerSize, { fit: 'contain', background: BG_COLOR })
      .toBuffer();

    await sharp({
      create: { width: size, height: size, channels: 4, background: BG_COLOR },
    })
      .composite([{ input: inner, left: padding, top: padding }])
      .png()
      .toFile(path.join(ICONS_DIR, `icon-${size}-maskable-v2.png`));
    console.log(`  ✓ icon-${size}-maskable-v2.png`);
  }

  // Badge
  await sharp(masterSquare).resize(72, 72).greyscale().png()
    .toFile(path.join(ICONS_DIR, 'badge-72-v2.png'));
  console.log('  ✓ badge-72-v2.png');

  // Favicons
  for (const s of [16, 32, 48]) {
    await sharp(masterSquare).resize(s, s).png()
      .toFile(path.join(ICONS_DIR, `favicon-${s}-v2.png`));
  }
  fs.copyFileSync(
    path.join(ICONS_DIR, 'favicon-32-v2.png'),
    path.join(FRONTEND, 'favicon-v2.png')
  );
  console.log('  ✓ favicon-16/32/48-v2.png');

  // Shortcut icons
  for (const name of ['shortcut-chart-v2', 'shortcut-transits-v2']) {
    await sharp(masterSquare).resize(96, 96).png()
      .toFile(path.join(ICONS_DIR, `${name}.png`));
    console.log(`  ✓ ${name}.png`);
  }

  // App store
  const appSize = 1024;
  const innerH = Math.round(appSize * 0.75);
  const innerW = Math.round(meta.width * (innerH / meta.height));
  const appScaled = await sharp(LOGO_FRAME).resize(innerW, innerH, { fit: 'inside' }).toBuffer();
  await sharp({
    create: { width: appSize, height: appSize, channels: 4, background: BG_COLOR },
  }).composite([{
    input: appScaled,
    left: Math.round((appSize - innerW) / 2),
    top: Math.round((appSize - innerH) / 2),
  }]).png().toFile(path.join(ICONS_DIR, 'app-store-1024-v2.png'));
  console.log('  ✓ app-store-1024-v2.png');

  return masterSquare;
}

// ── STEP 3: Social images ─────────────────────────────────────
async function generateSocialImages() {
  console.log('\n═══ STEP 3: Generating v2 social images ═══');

  const meta = await sharp(LOGO_FRAME).metadata();

  // OG image (1200×630)
  const ogW = 1200, ogH = 630;
  const logoH = ogH - 60;
  const logoW = Math.round(meta.width * (logoH / meta.height));
  const scaled = await sharp(LOGO_FRAME).resize(logoW, logoH, { fit: 'inside' }).toBuffer();

  await sharp({
    create: { width: ogW, height: ogH, channels: 4, background: BG_COLOR },
  }).composite([{
    input: scaled,
    left: Math.round((ogW - logoW) / 2),
    top: Math.round((ogH - logoH) / 2),
  }]).png({ quality: 90 }).toFile(path.join(FRONTEND, 'og-image-v2.png'));
  fs.copyFileSync(path.join(FRONTEND, 'og-image-v2.png'), path.join(FRONTEND, 'twitter-card-v2.png'));
  console.log('  ✓ og-image-v2.png + twitter-card-v2.png');

  // Pinterest (1000×1500)
  const pinW = 1000, pinH = 1500;
  const pinLH = pinH - 200;
  const pinLW = Math.round(meta.width * (pinLH / meta.height));
  const pinScaled = await sharp(LOGO_FRAME).resize(pinLW, pinLH, { fit: 'inside' }).toBuffer();
  await sharp({
    create: { width: pinW, height: pinH, channels: 4, background: BG_COLOR },
  }).composite([{
    input: pinScaled,
    left: Math.round((pinW - pinLW) / 2),
    top: Math.round((pinH - pinLH) / 2),
  }]).png().toFile(path.join(FRONTEND, 'pinterest-pin-v2.png'));
  console.log('  ✓ pinterest-pin-v2.png');

  // Email header (600×200)
  const eW = 600, eH = 200, eLH = eH - 40;
  const eLW = Math.round(meta.width * (eLH / meta.height));
  const eScaled = await sharp(LOGO_FRAME).resize(eLW, eLH, { fit: 'inside' }).toBuffer();
  const eMeta = await sharp(eScaled).metadata();
  await sharp({
    create: { width: eW, height: eH, channels: 4, background: BG_COLOR },
  }).composite([{
    input: eScaled,
    left: Math.round((eW - eMeta.width) / 2),
    top: Math.round((eH - eMeta.height) / 2),
  }]).png().toFile(path.join(FRONTEND, 'email-header-v2.png'));
  console.log('  ✓ email-header-v2.png');

  // Embed logo (400×100)
  const embW = 400, embH = 100, embLH = embH - 20;
  const embLW = Math.round(meta.width * (embLH / meta.height));
  const embScaled = await sharp(LOGO_FRAME).resize(embLW, embLH, { fit: 'inside' }).toBuffer();
  const embMeta = await sharp(embScaled).metadata();
  await sharp({
    create: { width: embW, height: embH, channels: 4, background: BG_COLOR },
  }).composite([{
    input: embScaled,
    left: Math.round((embW - embMeta.width) / 2),
    top: Math.round((embH - embMeta.height) / 2),
  }]).png().toFile(path.join(FRONTEND, 'embed-logo-v2.png'));
  console.log('  ✓ embed-logo-v2.png');
}

// ── STEP 4: Splash screens ───────────────────────────────────
async function generateSplashScreens() {
  console.log('\n═══ STEP 4: Generating v2 splash screens ═══');

  const meta = await sharp(LOGO_FRAME).metadata();
  const splashSizes = [
    { name: 'splash-640x1136-v2',   w: 640,  h: 1136  },
    { name: 'splash-750x1334-v2',   w: 750,  h: 1334  },
    { name: 'splash-828x1792-v2',   w: 828,  h: 1792  },
    { name: 'splash-1125x2436-v2',  w: 1125, h: 2436  },
    { name: 'splash-1170x2532-v2',  w: 1170, h: 2532  },
    { name: 'splash-1179x2556-v2',  w: 1179, h: 2556  },
    { name: 'splash-1242x2208-v2',  w: 1242, h: 2208  },
    { name: 'splash-1284x2778-v2',  w: 1284, h: 2778  },
    { name: 'splash-1290x2796-v2',  w: 1290, h: 2796  },
    { name: 'splash-1536x2048-v2',  w: 1536, h: 2048  },
    { name: 'splash-2048x2732-v2',  w: 2048, h: 2732  },
  ];

  for (const { name, w, h } of splashSizes) {
    const logoH = Math.round(h * 0.4);
    const logoW = Math.round(meta.width * (logoH / meta.height));
    const scaled = await sharp(LOGO_FRAME)
      .resize(Math.min(logoW, w - 40), logoH, { fit: 'inside' })
      .toBuffer();
    const sMeta = await sharp(scaled).metadata();

    await sharp({
      create: { width: w, height: h, channels: 4, background: BG_COLOR },
    }).composite([{
      input: scaled,
      left: Math.round((w - sMeta.width) / 2),
      top: Math.round((h - sMeta.height) / 2),
    }]).png({ quality: 85 }).toFile(path.join(ICONS_DIR, `${name}.png`));
    console.log(`  ✓ ${name}.png`);
  }
}

// ── STEP 5: Video variants ───────────────────────────────────
function generateVideoVariants() {
  console.log('\n═══ STEP 5: Generating v2 video variants ═══');

  // MP4 optimized
  const mp4Out = path.join(FRONTEND, 'logo-animation-v2.mp4');
  ffmpeg(`-y -i "${VIDEO}" -c:v libx264 -preset fast -crf 28 -vf "scale=464:688" -an -movflags +faststart -pix_fmt yuv420p "${mp4Out}"`);
  console.log(`  ✓ logo-animation-v2.mp4 (${(fs.statSync(mp4Out).size / 1024).toFixed(0)} KB)`);

  // WebM VP8
  const webmOut = path.join(FRONTEND, 'logo-animation-v2.webm');
  ffmpeg(`-y -i "${VIDEO}" -c:v libvpx -b:v 800k -crf 20 -vf "scale=464:688" -an "${webmOut}"`);
  console.log(`  ✓ logo-animation-v2.webm (${(fs.statSync(webmOut).size / 1024).toFixed(0)} KB)`);

  // GIF
  const gifOut = path.join(FRONTEND, 'logo-animation-v2.gif');
  const palette = path.join(TEMP_DIR, 'palette-v2.png');
  ffmpeg(`-y -i "${VIDEO}" -vf "fps=12,scale=232:-1:flags=lanczos,palettegen=max_colors=64" "${palette}"`);
  ffmpeg(`-y -i "${VIDEO}" -i "${palette}" -lavfi "fps=12,scale=232:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer" "${gifOut}"`);
  console.log(`  ✓ logo-animation-v2.gif (${(fs.statSync(gifOut).size / 1024).toFixed(0)} KB)`);

  // Loop clip (last 2s of a 10s video = from 8s)
  const loopOut = path.join(FRONTEND, 'logo-loop-v2.mp4');
  ffmpeg(`-y -ss 8.0 -i "${VIDEO}" -c:v libx264 -preset fast -crf 30 -an -movflags +faststart -pix_fmt yuv420p -t 2 "${loopOut}"`);
  console.log(`  ✓ logo-loop-v2.mp4 (${(fs.statSync(loopOut).size / 1024).toFixed(0)} KB)`);

  // Poster
  const posterOut = path.join(FRONTEND, 'logo-poster-v2.jpg');
  ffmpeg(`-y -i "${VIDEO}" -ss 8.5 -frames:v 1 -q:v 2 "${posterOut}"`);
  console.log('  ✓ logo-poster-v2.jpg');

  // Audio
  const audioOut = path.join(FRONTEND, 'logo-sound-v2.mp3');
  try {
    ffmpeg(`-y -i "${VIDEO}" -vn -acodec libmp3lame -q:a 4 "${audioOut}"`);
    console.log(`  ✓ logo-sound-v2.mp3 (${(fs.statSync(audioOut).size / 1024).toFixed(0)} KB)`);
  } catch { console.log('  ⚠ No audio — skipping'); }
}

// ── MAIN ──────────────────────────────────────────────────────
(async () => {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Prime Self — Asset Gen v2 (HD_LOGOVID2)     ║');
  console.log('╚══════════════════════════════════════════════╝');

  if (!fs.existsSync(VIDEO)) {
    console.error(`\n❌ Video not found: ${VIDEO}`);
    process.exit(1);
  }

  await generateIcons();
  await generateSocialImages();
  await generateSplashScreens();
  generateVideoVariants();

  // Cleanup
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });

  // Summary
  console.log('\n═══ COMPLETE ═══\n');
  const iconFiles = fs.readdirSync(ICONS_DIR).filter(f => f.includes('-v2') && f.endsWith('.png'));
  console.log(`frontend/icons/ v2 files: ${iconFiles.length}`);
  iconFiles.forEach(f => {
    const size = (fs.statSync(path.join(ICONS_DIR, f)).size / 1024).toFixed(1);
    console.log(`  ${f} — ${size} KB`);
  });

  const v2Assets = fs.readdirSync(FRONTEND).filter(f => f.includes('-v2') && f.match(/\.(png|jpg|mp4|webm|gif|mp3)$/));
  console.log(`\nfrontend/ v2 media: ${v2Assets.length}`);
  v2Assets.forEach(f => {
    const size = (fs.statSync(path.join(FRONTEND, f)).size / 1024).toFixed(1);
    console.log(`  ${f} — ${size} KB`);
  });

  console.log('\n✅ All v2 assets ready!\n');
})();

#!/usr/bin/env node
/**
 * finish-assets.cjs — Complete the remaining asset generation
 * (VP9 encoding was too slow; using VP8 + faster presets)
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ROOT      = path.resolve(__dirname, '..');
const VIDEO     = path.join(ROOT, 'HumanDesign_LogoMovie.mp4');
const FFMPEG    = require('ffmpeg-static');
const ICONS_DIR = path.join(ROOT, 'frontend', 'icons');
const FRONTEND  = path.join(ROOT, 'frontend');

function ffmpeg(args) {
  const cmd = `"${FFMPEG}" ${args}`;
  console.log(`  ▸ running ffmpeg...`);
  execSync(cmd, { stdio: 'pipe' });
}

(async () => {
  console.log('═══ Finishing remaining assets ═══\n');

  // ── WebM (VP8 — much faster than VP9) ──
  const webmOut = path.join(FRONTEND, 'logo-animation.webm');
  if (!fs.existsSync(webmOut)) {
    console.log('Generating WebM (VP8)...');
    ffmpeg(
      `-y -i "${VIDEO}" -c:v libvpx -b:v 800k -crf 20 -vf "scale=464:688" ` +
      `-an "${webmOut}"`
    );
    const webmSize = (fs.statSync(webmOut).size / 1024).toFixed(0);
    console.log(`  ✓ logo-animation.webm (${webmSize} KB, VP8)`);
  } else {
    console.log('  ✓ logo-animation.webm already exists');
  }

  // ── GIF for email/social ──
  const gifOut = path.join(FRONTEND, 'logo-animation.gif');
  if (!fs.existsSync(gifOut)) {
    console.log('Generating GIF...');
    const TEMP = path.join(ROOT, '.tmp-frames');
    fs.mkdirSync(TEMP, { recursive: true });
    const palette = path.join(TEMP, 'palette.png');
    ffmpeg(
      `-y -i "${VIDEO}" -vf "fps=12,scale=232:-1:flags=lanczos,palettegen=max_colors=64" "${palette}"`
    );
    ffmpeg(
      `-y -i "${VIDEO}" -i "${palette}" -lavfi "fps=12,scale=232:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer" "${gifOut}"`
    );
    const gifSize = (fs.statSync(gifOut).size / 1024).toFixed(0);
    console.log(`  ✓ logo-animation.gif (${gifSize} KB)`);
    fs.rmSync(TEMP, { recursive: true, force: true });
  } else {
    console.log('  ✓ logo-animation.gif already exists');
  }

  // ── Loop clip (last 2 seconds) ──
  const loopOut = path.join(FRONTEND, 'logo-loop.mp4');
  if (!fs.existsSync(loopOut)) {
    console.log('Generating loop clip...');
    ffmpeg(
      `-y -ss 4.0 -i "${VIDEO}" -c:v libx264 -preset fast -crf 30 ` +
      `-an -movflags +faststart -pix_fmt yuv420p -t 2 "${loopOut}"`
    );
    const loopSize = (fs.statSync(loopOut).size / 1024).toFixed(0);
    console.log(`  ✓ logo-loop.mp4 (${loopSize} KB)`);
  } else {
    console.log('  ✓ logo-loop.mp4 already exists');
  }

  // ── Video poster JPEG ──
  const posterOut = path.join(FRONTEND, 'logo-poster.jpg');
  if (!fs.existsSync(posterOut)) {
    console.log('Generating poster...');
    ffmpeg(`-y -i "${VIDEO}" -ss 5.0 -frames:v 1 -q:v 2 "${posterOut}"`);
    console.log('  ✓ logo-poster.jpg');
  } else {
    console.log('  ✓ logo-poster.jpg already exists');
  }

  // ── Audio extract ──
  const audioOut = path.join(FRONTEND, 'logo-sound.mp3');
  if (!fs.existsSync(audioOut)) {
    console.log('Extracting audio...');
    try {
      ffmpeg(`-y -i "${VIDEO}" -vn -acodec libmp3lame -q:a 4 "${audioOut}"`);
      const audioSize = (fs.statSync(audioOut).size / 1024).toFixed(0);
      console.log(`  ✓ logo-sound.mp3 (${audioSize} KB)`);
    } catch {
      console.log('  ⚠ No audio or encode failed — skipping');
    }
  } else {
    console.log('  ✓ logo-sound.mp3 already exists');
  }

  // ── Marketing assets (using sharp) ──
  const LOGO_FRAME = path.join(ROOT, '.tmp-frames', 'logo-frame.png');
  // Re-extract if temp was cleaned up
  let logoFrame = LOGO_FRAME;
  if (!fs.existsSync(logoFrame)) {
    logoFrame = path.join(ROOT, '.tmp-finish-frame.png');
    ffmpeg(`-y -i "${VIDEO}" -ss 5.0 -frames:v 1 -q:v 1 "${logoFrame}"`);
  }

  const meta = await sharp(logoFrame).metadata();

  // ── App Store icon (1024×1024) ──
  const appIconPath = path.join(ICONS_DIR, 'app-store-1024.png');
  if (!fs.existsSync(appIconPath)) {
    console.log('Generating App Store icon...');
    const appIconSize = 1024;
    const innerH = Math.round(appIconSize * 0.75);
    const innerW = Math.round(meta.width * (innerH / meta.height));
    const appScaled = await sharp(logoFrame).resize(innerW, innerH, { fit: 'inside' }).toBuffer();

    await sharp({
      create: { width: appIconSize, height: appIconSize, channels: 4, background: { r: 10, g: 10, b: 15, alpha: 1 } },
    }).composite([{
      input: appScaled,
      left: Math.round((appIconSize - innerW) / 2),
      top: Math.round((appIconSize - innerH) / 2),
    }]).png().toFile(appIconPath);
    console.log(`  ✓ app-store-1024.png`);
  }

  // ── Email header (600×200) ──
  const emailPath = path.join(FRONTEND, 'email-header.png');
  if (!fs.existsSync(emailPath)) {
    console.log('Generating email header...');
    const emailW = 600, emailH = 200;
    const logoH = emailH - 40;
    const logoW = Math.round(meta.width * (logoH / meta.height));
    const scaled = await sharp(logoFrame).resize(logoW, logoH, { fit: 'inside' }).toBuffer();
    const sMeta = await sharp(scaled).metadata();

    await sharp({
      create: { width: emailW, height: emailH, channels: 4, background: { r: 10, g: 10, b: 15, alpha: 1 } },
    }).composite([{
      input: scaled,
      left: Math.round((emailW - sMeta.width) / 2),
      top: Math.round((emailH - sMeta.height) / 2),
    }]).png().toFile(emailPath);
    console.log(`  ✓ email-header.png (600×200)`);
  }

  // ── Embed widget logo (400×100) ──
  const embedPath = path.join(FRONTEND, 'embed-logo.png');
  if (!fs.existsSync(embedPath)) {
    console.log('Generating embed logo...');
    const eW = 400, eH = 100;
    const eLH = eH - 20;
    const eLW = Math.round(meta.width * (eLH / meta.height));
    const eScaled = await sharp(logoFrame).resize(eLW, eLH, { fit: 'inside' }).toBuffer();
    const eMeta = await sharp(eScaled).metadata();

    await sharp({
      create: { width: eW, height: eH, channels: 4, background: { r: 10, g: 10, b: 15, alpha: 1 } },
    }).composite([{
      input: eScaled,
      left: Math.round((eW - eMeta.width) / 2),
      top: Math.round((eH - eMeta.height) / 2),
    }]).png().toFile(embedPath);
    console.log(`  ✓ embed-logo.png (400×100)`);
  }

  // Cleanup temp if we created one
  const tmpFrame = path.join(ROOT, '.tmp-finish-frame.png');
  if (fs.existsSync(tmpFrame)) fs.unlinkSync(tmpFrame);

  // ── Final summary ──
  console.log('\n═══ COMPLETE ═══\n');

  const iconFiles = fs.readdirSync(ICONS_DIR).filter(f => f.endsWith('.png'));
  console.log(`frontend/icons/ (${iconFiles.length} files):`);
  iconFiles.forEach(f => {
    const size = (fs.statSync(path.join(ICONS_DIR, f)).size / 1024).toFixed(1);
    console.log(`  ${f} — ${size} KB`);
  });

  const frontendAssets = fs.readdirSync(FRONTEND).filter(f => f.match(/\.(png|jpg|mp4|webm|gif|mp3)$/));
  console.log(`\nfrontend/ (${frontendAssets.length} media files):`);
  frontendAssets.forEach(f => {
    const size = (fs.statSync(path.join(FRONTEND, f)).size / 1024).toFixed(1);
    console.log(`  ${f} — ${size} KB`);
  });

  console.log('\n✅ All assets ready!\n');
})();

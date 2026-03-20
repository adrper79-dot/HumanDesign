# Background Video Implementation

Complete guide to creating, stitching, and integrating a seamless looping cosmic background video for Prime Self.

**Time to complete**: 10–30 minutes (depending on path)
**Tools needed**: FFmpeg (or use existing video files)
**Complexity**: Medium

---

## Pre-flight Checklist

Before you start, confirm you have:

- [ ] The 6 Grok video files in `/videos/` (or a plan to generate new ones)
- [ ] ~200 MB free disk space (temporary files during stitching)
- [ ] 10–30 minutes available
- [ ] Your chosen path: **A** (stitch existing), **B** (generate new AI clip), or **C** (manual editor)

---

## Implementation Status (Already in Code)

These are already wired into the frontend — you only need to supply the video files:

✅ **HTML** — `<video>` element in `frontend/index.html` (line 128); sources: `.webm` (preferred) + `.mp4` (fallback); poster for fast first paint; fade-in JS on `canplay`

✅ **CSS** — Fullscreen fixed positioning in `frontend/css/artwork.css`; 35% opacity; 1.5s fade-in; respects `prefers-reduced-motion`; hidden on mobile ≤768px (CSS stars/particles used instead)

✅ **Service Worker** — Poster image pre-cached; video cached on first play; auto-evicted on SW version bump

✅ **Performance** — Video pauses when tab hidden; auto-fallback if video unavailable; mobile uses lighter CSS-only animation

---

## Choose Your Path

| Path | Best for | Time |
|------|----------|------|
| **A — Stitch existing clips** | You already have 6 Grok clips in `/videos/` | ~10 min |
| **B — Generate new AI clip** | You want a fresh purpose-built cosmic clip | ~20 min |
| **C — Manual video editor** | You prefer Premiere / DaVinci / CapCut | ~20 min |

---

## Path A: Stitch Existing Video Clips (Easiest)

If you already have 6 Grok-generated video clips in `/videos/`:

### Step 1: Install FFmpeg

See [Install FFmpeg](#install-ffmpeg) section below.

### Step 2: Run the Stitch Script

```bash
cd scripts
bash stitch-background-video.sh
```

This script:
1. Finds all `.mp4` files in `/videos/`
2. Normalizes clips to 1280×720 @ 30fps
3. Builds crossfade transitions between each clip
4. Renders a seamless loop with VP9 WebM fallback
5. Extracts a poster JPEG

**Expected terminal output:**
```
═══════════════════════════════════════════════════════
  Prime Self — Background Video Stitcher
═══════════════════════════════════════════════════════
  Input:   videos/
  Output:  frontend/bg-video.mp4 + .webm
  Target:  1280×720 @ 30fps, ~3-5 MB
── Step 1: Scanning source videos... Found 6 source clips
── Step 2: Normalizing clips...
── Step 3: Ordering clips for visual flow...
── Step 4: Building crossfade transitions...
── Step 5: Rendering stitched MP4...  ✓ Stitched: 4.2M, ~45s
── Step 6: Trimming to ~45s...
── Step 7: Encoding VP9 WebM...  ✓ bg-video.webm → 2.8M
── Step 8: Extracting poster image...  ✓ bg-video-poster.jpg
═══════════════════════════════════════════════════════
  DONE! frontend/bg-video.mp4 (4.2M) | .webm (2.8M) | poster.jpg
═══════════════════════════════════════════════════════
```

### Step 3: Verify Output

```bash
ls -lh frontend/bg-video*
# bg-video.mp4          3-5 MB
# bg-video.webm         2-3 MB  (optional but recommended)
# bg-video-poster.jpg   ~50 KB

python3 scripts/video-helper.py verify frontend/
```

---

## Path B: Generate New Video with xAI Grok

### Step 1: Get the Prompt

Open [../videos/BACKGROUND_VIDEO_PROMPT.md](../videos/BACKGROUND_VIDEO_PROMPT.md) and copy the **Master Prompt** section.

### Step 2: Choose an AI Service

| Service | Speed | Quality | Free Tier |
|---------|-------|---------|-----------|
| **xAI Grok** | Fast | ⭐⭐⭐⭐ | ✅ Free |
| **Runway Gen-3 Alpha** | Fast | ⭐⭐⭐⭐ | ✅ Limited |
| **Pika** | Medium | ⭐⭐⭐ | ✅ Limited |
| **Sora** | Slow | ⭐⭐⭐⭐⭐ | ❌ Waitlist |
| **Kling** | Medium | ⭐⭐⭐ | ✅ Limited |

**Recommended**: xAI Grok — free, fast, highest quality for cosmic aesthetic.

### Step 3: Generate 6 Clips (for variety)

1. Go to https://grok.x.ai
2. Paste prompt, set duration 10–15 seconds, click **Generate**
3. Generate up to 6 clips with slight variations:
   - "cosmic nebula with stars"
   - "purple aurora dancing"
   - "gold particles flowing"
   - "blue quantum waves"
   - "cosmic dust floating"
   - "galaxy spiraling"
4. Download each as MP4, save to `/videos/`

### Step 4: Stitch the Clips

Follow **Path A** above.

---

## Path C: Manual Video Editor

Use Premiere Pro, DaVinci Resolve, CapCut, or Vegas Pro:

1. Import all 6 `grok-video-*.mp4` files from `/videos/`
2. Arrange in sequence (any order for visual variety)
3. Add **1.5 second crossfade** between each clip
4. Duplicate the **first clip** and add it to the very end with a 1.5s crossfade for seamless loop-back
5. Set export options: **1280×720**, H.264, 30fps, ~4 MB, audio OFF
6. Export to `frontend/bg-video.mp4`
7. Extract first frame as `frontend/bg-video-poster.jpg`

---

## Install FFmpeg

### macOS

```bash
brew install ffmpeg
ffmpeg -version  # Verify
```

### Linux (Ubuntu/Debian)

```bash
sudo apt update && sudo apt install ffmpeg
ffmpeg -version  # Verify
```

### Windows — Option 1: Chocolatey (recommended)

```powershell
# Open PowerShell as Administrator
choco install ffmpeg -y
ffmpeg -version  # Verify
```

### Windows — Option 2: Manual Download

1. Go to https://ffmpeg.org/download.html
2. Download Windows build (BtbN or GyanDroid builds recommended)
3. Extract to `C:\tools\ffmpeg`
4. Add to System PATH:
   - Press `Win+R`, type `sysdm.cpl`
   - Click **Advanced** → **Environment Variables**
   - Under System variables, find `Path` → **Edit** → **New**
   - Add: `C:\tools\ffmpeg\bin`
   - Click OK × 3, then restart terminal
5. Verify: `ffmpeg -version`

### Windows — Option 3: WSL (run the script inside WSL)

```bash
wsl
sudo apt update && sudo apt install ffmpeg
ffmpeg -version
cd /mnt/c/Users/Ultimate\ Warrior/My\ project/HumanDesign
bash scripts/stitch-background-video.sh
```

**Troubleshooting on Windows**: If `ffmpeg` works in PowerShell but not WSL, the PATH is only set for Windows. Either re-add it inside WSL with the three-option approach above, or run the script from PowerShell.

---

## Verify and Test

### Verify Files Exist

```bash
ls -lh frontend/bg-video*
python3 scripts/video-helper.py verify frontend/
```

### Local Video Test (No Server)

```bash
# macOS/Linux
open frontend/bg-video.mp4

# Windows
start frontend/bg-video.mp4
```

Play 3–4 times and check:
- ✓ No jitter or jump at the loop point
- ✓ Smooth motion (nebula clouds, particles flowing)
- ✓ Silent (no audio)
- ✓ ~30–45 seconds total duration

### Full Web Test

```bash
python3 -m http.server 8000
# Open: http://localhost:8000/frontend/index.html
```

Check in the browser:
- [ ] Video loads within 1–2 seconds
- [ ] Fades in smoothly (1.5s fade)
- [ ] Sits fully behind all UI elements
- [ ] Loops seamlessly (watch 3 times)
- [ ] Text is clearly readable

---

## Key Specifications

| Aspect | Value |
|--------|-------|
| **Target Resolution** | 1280×720 (16:9 landscape) |
| **Duration** | 30–45 seconds (seamless loop) |
| **Framerate** | 30 fps |
| **Codec (primary)** | H.264 (universal support) |
| **Codec (optional)** | VP9 WebM (smaller for modern browsers) |
| **File size MP4** | 3–5 MB |
| **File size WebM** | 2–3 MB |
| **Opacity** | 35% (text readable) |
| **Fade-in** | 1.5 seconds |
| **Fallback** | CSS stars + particles (mobile/accessibility) |

---

## File Format Reference

| Format | Codec | Browser Support | File Size | Notes |
|--------|-------|-----------------|-----------|-------|
| MP4 | H.264 | All browsers | Medium | Required fallback |
| WebM | VP9 | Chrome, Firefox | Smallest | Optional but recommended |
| Poster | JPEG | All | Tiny (~50 KB) | Shown while video loads |

---

## Visual Theme

**Colors** — designed to complement the Prime Self aesthetic:
- Deep space navy: `#0d0d1a` (base)
- Gold accents: `#c9a84c`
- Purple mystique: `#6a4fc8`
- Teal harmony: `#4fc8a0`

**Motion:**
- Slow, hypnotic (NOT a screensaver)
- Swirling nebula clouds
- Twinkling stars at asynchronous pacing
- Rising particle streams
- Faint sacred geometry (barely visible rotation)
- Premium, meditative atmosphere

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Video doesn't load (404)** | Files must be exactly named `bg-video.mp4`, `bg-video.webm`, `bg-video-poster.jpg` in `frontend/`. Check browser console. |
| **Video loads but no loop** | Confirm `<video>` tag has `loop` attribute — see `frontend/index.html` line ~128. |
| **Seamless loop jerks/cuts** | File may be corrupted. Re-run stitch script. Verify first and last frames are visually similar. |
| **Video plays audio** | Shouldn't happen; all videos are muted in HTML. Strip audio: `ffmpeg -i bad.mp4 -an -c:v copy good.mp4` |
| **Takes too long to load** | File size should be 3–5 MB max. Re-encode at CRF 30 or lower bitrate. Use WebM for modern browsers. |
| **Service Worker not caching** | Hard-refresh: `Ctrl+Shift+Delete` then `Ctrl+F5` (Windows) or `Shift+Cmd+Delete` (Mac). Navigate normally to re-cache. |
| **Text not readable** | Video is too bright. Reduce `opacity` in `frontend/css/artwork.css` `.bg-video` rule (currently 0.35). |
| **Mobile looks different** | By design — video is hidden on ≤768px and CSS stars/particles are used instead. |
| **FFmpeg not found after install** | Restart terminal completely. On Windows, restart the whole shell session. |
| **Poor video quality** | Increase bitrate in stitch script (`BITRATE="3M"`). Generate source clips at higher resolution. |

---

## Advanced: Fine-Tuning the Stitch

Edit `scripts/stitch-background-video.sh` to customize:

```bash
# Adjust fade duration (default: 0.5s)
FADE_DURATION=1.0

# Adjust output resolution (default: 1280x720)
OUTPUT_RES="1920x1080"

# Adjust bitrate (default: 2M; lower = smaller file)
BITRATE="3M"
```

---

## Performance Tips

| Optimization | Impact | How |
|---|---|---|
| **Reduce resolution** | −40% size | Set `OUTPUT_RES="1280x720"` |
| **Lower bitrate** | −50% size | Set `BITRATE="1M"` |
| **H.264 only** | −30% encoding time | Comment out VP9 encoding block |
| **Pre-compress clips** | −20% time | Compress source clips before stitching |

---

## Customization

### Change Colors

Edit [../videos/BACKGROUND_VIDEO_PROMPT.md](../videos/BACKGROUND_VIDEO_PROMPT.md) — change the color palette, opacity, or theme description before generating clips.

### Change Opacity

Edit `frontend/css/artwork.css`, find `.bg-video { opacity: 0.35; }` and adjust. Lower = darker background.

### Change Loop Duration

Edit the stitch script — reduce `CLIP_DURATION` or remove clips from `/videos/` to shorten the loop.

### Add Background Audio (Optional)

```bash
ffmpeg -i frontend/bg-video.mp4 \
       -i music.mp3 \
       -c:v copy -c:a aac \
       -map 0:v:0 -map 1:a:0 \
       -y frontend/bg-video-with-audio.mp4
```

---

## Quick Commands

```bash
# Check FFmpeg installed
ffmpeg -version

# Verify all output files exist + metadata
python3 scripts/video-helper.py verify frontend/
python3 scripts/video-helper.py info frontend/bg-video.mp4

# Re-run stitch from project root
bash scripts/stitch-background-video.sh

# Extract poster from existing video
ffmpeg -i frontend/bg-video.mp4 -ss 2.0 -frames:v 1 -q:v 3 frontend/bg-video-poster.jpg

# Strip audio from a video file
ffmpeg -i input.mp4 -an -c:v copy frontend/bg-video.mp4
```

---

## Integration Checklist

- [ ] FFmpeg installed and `ffmpeg -version` returns output
- [ ] 6 video clips in `/videos/` (or using an existing file)
- [ ] Stitch script ran without errors
- [ ] All 3 files present: `bg-video.mp4`, `bg-video.webm`, `bg-video-poster.jpg`
- [ ] Local web test passes (video loads, fades in, loops)
- [ ] No audio in video
- [ ] Text remains readable over the background

---

## See Also

- [../videos/BACKGROUND_VIDEO_PROMPT.md](../videos/BACKGROUND_VIDEO_PROMPT.md) — AI generation prompt (copy-paste ready)
- [../frontend/css/artwork.css](../frontend/css/artwork.css) — Video CSS styles (opacity, fade-in)
- [../frontend/index.html](../frontend/index.html) — Video HTML element (~line 128)
- [SETUP_DEVELOPMENT.md](SETUP_DEVELOPMENT.md) — General development setup
- [../DEPLOY.md](../DEPLOY.md) — Deployment process

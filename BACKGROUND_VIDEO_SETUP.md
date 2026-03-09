# Prime Self — Background Video Implementation Guide

Complete step-by-step instructions for creating and integrating a seamless looping background video.

---

## Quick Start (3 Options)

### Option 1: Use Existing Grok Clips (Recommended)
If you already have 6 Grok video files in `/videos/`, run the stitch script:

```bash
cd scripts
bash stitch-background-video.sh
```

**Requires:** FFmpeg (see "Install FFmpeg" below)  
**Output:** `frontend/bg-video.mp4`, `frontend/bg-video.webm`, `frontend/bg-video-poster.jpg`  
**Time:** ~5-10 minutes

---

### Option 2: Generate a New Video
Use the AI generation prompt in `/videos/BACKGROUND_VIDEO_PROMPT.md` with:
- **Grok** (free tier available)
- **Runway Gen-3 Alpha** 
- **Pika** 
- **Sora** (if you have access)
- **Kling**

Then save the output as `bg-video.mp4` directly to `/frontend/`.

**Output directly to:** `frontend/bg-video.mp4`  
**Time:** ~5-15 minutes (depends on generation service)  
**Files needed:** Just the MP4

---

### Option 3: Manual Concatenation (No FFmpeg)
Use a video editor (Premiere Pro, DaVinci Resolve, CapCut, Vegas Pro):
1. Import all 6 Grok clips
2. Add 1.5s crossfade transitions between each
3. Add clip#0 again at the end for seamless loop-back
4. Export as 1280×720, H.264 MP4, ~3-5MB
5. Save as `/frontend/bg-video.mp4`

---

## Install FFmpeg

### Windows (PowerShell, as Admin)

#### Using Chocolatey (recommended):
```powershell
choco install ffmpeg
ffmpeg -version  # Verify
```

#### Or download manually:
1. Go to [ffmpeg.org/download.html](https://ffmpeg.org/download.html)
2. Download Windows build (GynaDroid-full recommended)
3. Extract to `C:\tools\ffmpeg`
4. Add to PATH: 
   - `Win+R` → `sysdm.cpl` → Advanced → Environment Variables
   - New `PATH` entry: `C:\tools\ffmpeg\bin`
5. Restart terminal, verify: `ffmpeg -version`

#### Using Windows Subsystem for Linux (WSL):
```bash
wsl
sudo apt update && sudo apt install ffmpeg
ffmpeg -version
```

---

### macOS
```bash
brew install ffmpeg
ffmpeg -version
```

---

### Linux (Ubuntu/Debian)
```bash
sudo apt update && sudo apt install ffmpeg
ffmpeg -version
```

---

## Run the Stitch Script

Once FFmpeg is installed:

```bash
cd /path/to/HumanDesign
bash scripts/stitch-background-video.sh
```

**Expected output:**
```
═══════════════════════════════════════════════════════
  Prime Self — Background Video Stitcher
═══════════════════════════════════════════════════════

  Input:   videos/
  Output:  frontend/bg-video.mp4 + .webm
  Target:  1280×720 @ 30fps, ~3-5 MB

── Step 1: Scanning source videos...
  Found 6 source clips
── Step 2: Normalizing clips...
  [1/6] grok-video...mp4
  [2/6] grok-video...(2).mp4
  ...
  ✓ All clips normalized
── Step 3: Ordering clips for visual flow...
── Step 4: Building crossfade transitions...
  ✓ Filter chain built with 5 crossfade transitions
── Step 5: Rendering stitched MP4...
  ✓ Stitched: 4.2M, ~45s
── Step 6: Trimming to ~45s...
── Step 7: Encoding VP9 WebM...
  ✓ bg-video.webm → 2.8M
── Step 8: Extracting poster image...
  ✓ bg-video-poster.jpg

═══════════════════════════════════════════════════════
  DONE! Output files:
  ├── frontend/bg-video.mp4 (4.2M)
  ├── frontend/bg-video.webm (2.8M)
  └── frontend/bg-video-poster.jpg
═══════════════════════════════════════════════════════
```

---

## Verify Output Files

After running the script, check:

```bash
ls -lh frontend/bg-video*
# Should show:
#   bg-video.mp4          3-5 MB
#   bg-video.webm         2-3 MB
#   bg-video-poster.jpg   ~50 KB
```

---

## Test the Video

### Local test (no server needed):
```bash
# macOS/Linux
open frontend/bg-video.mp4

# Windows
start frontend/bg-video.mp4
```

Play in your favorite player. **Key checks:**
- ✓ Seamless loop (watch 2-3 times, no jitter at the cut)
- ✓ Smooth motion (nebula clouds, particles flowing naturally)
- ✓ Audio is muted (no sound expected)
- ✓ ~30-45 seconds total duration

### Web test:
```bash
# Start a local server
python3 -m http.server 8000

# Open browser
open http://localhost:8000/frontend/index.html
```

Navigate to the app. The background video should:
- Load within 1-2 seconds
- Fade in smoothly over 1.5 seconds
- Sit behind all UI elements
- Loop seamlessly forever
- Be dark enough that text is readable

---

## Integration Status

✅ **HTML**  
- Video element added to `frontend/index.html` (line 128)
- Sources: `.webm` (modern browsers), `.mp4` (fallback)
- Poster image for fast first paint
- Fade-in logic in JS (loads when `canplay` fires)

✅ **CSS**  
- Fullscreen fixed positioning in `frontend/css/artwork.css`
- 35% opacity (text remains readable)
- Smooth 1.5s fade-in transition
- Respects `prefers-reduced-motion` (accessibility)
- Hidden on mobile ≤768px (uses CSS particles instead)

✅ **Service Worker**  
- Poster image pre-cached
- Video files cached on first play (runtime cache)
- Efficient cache eviction

✅ **Performance**  
- Video pauses when tab is hidden (saves battery)
- Fallback to CSS stars/particles if video unavailable
- Responsive: mobile uses lighter CSS animation only

---

## File Checklist

Before deploying, ensure these exist in `frontend/`:

```
frontend/
├── index.html                  (updated with <video> element)
├── bg-video.mp4               (required — H.264, 3-5 MB)
├── bg-video.webm              (recommended — VP9, 2-3 MB)
└── bg-video-poster.jpg        (required — ~50 KB, first frame)

css/
├── artwork.css                (updated with .bg-video styles)
└── ... existing files ...

service-worker.js              (updated cache list)
```

---

## Troubleshooting

### Video doesn't load
- Check browser console (F12 → Console) for 404 errors
- Verify files exist in `frontend/` directory
- Check file names match exactly: `bg-video.mp4`, `bg-video.webm`, `bg-video-poster.jpg`
- Clear browser cache: `Ctrl+Shift+Delete` → Clear All

### Video plays but cuts/stutters
- File may be corrupted. Re-run stitch script
- Check: videos should all be ~10s at 1280×720
- Verify H.264 codec: `ffprobe frontend/bg-video.mp4`

### Too dark / can't read text
- Opacity set to 35% globally
- If needed, adjust `.bg-video { opacity: 0.25; }` in `artwork.css` (lower = darker)
- UI elements have sufficient `z-index` to sit on top

### Service worker not caching
- Clear all service worker data: Settings → Privacy → Clear Browsing Data → Service Workers
- Refresh page with `Ctrl+F5` (hard refresh)
- Subsequent loads will cache the video

### Loop not seamless
- Check first and last frames are visually similar
- May need to tweak crossfade duration (currently 1.5s)
- Test with `ffmpeg -i bg-video.mp4 -vf loop=2 -y test.mp4` to test the loop

---

## Customization

### Change opacity (brightness)
In `frontend/css/artwork.css`, line ~12:
```css
.bg-video {
  opacity: 0.35;  /* Decrease for darker, increase for lighter */
}
```

### Change fade-in speed
In `frontend/css/artwork.css`, line ~26:
```css
transition: opacity 1.5s ease-in;  /* Adjust 1.5s to desired duration */
```

### Change target resolution
In `scripts/stitch-background-video.sh`, line ~27-28:
```bash
WIDTH=1280   # Change to 1920 for Full HD, 960 for smaller
HEIGHT=720   # Maintain 16:9 aspect ratio
```

### Hide on specific page sections
Add CSS:
```css
@media (max-width: 1024px) {
  .bg-video {
    display: none;
  }
}
```

---

## Next Steps

1. **Install FFmpeg** (if using stitch script)
2. **Run stitch script** or generate new video via AI tool
3. **Verify files exist** in `frontend/` directory
4. **Test locally** (check loop, opacity, load time)
5. **Deploy** — video will cache in SW after first load
6. **Monitor** — check console for any errors in production

---

## Advanced: Fine-Tuning the Stitch

To customize crossfade duration, clip order, or quality:

Edit `scripts/stitch-background-video.sh`:

```bash
CROSSFADE_SEC=1.5    # Duration of crossfade (line 26)
CRF_MP4=28           # Quality: lower = better, higher = smaller (line 28)
TARGET_DURATION=45   # Final loop duration in seconds (line 29)
```

Then re-run the script.

---

## Support

**Issue?** Check:
1. FFmpeg installed: `ffmpeg -version`
2. Source clips exist: `ls videos/grok-video*.mp4`
3. Script is executable: `chmod +x scripts/stitch-background-video.sh`
4. Disk space: `df -h` (need ~200MB free for temp files)

**Still stuck?**
- Review `/videos/BACKGROUND_VIDEO_PROMPT.md` for generation alternative
- Check FFmpeg install logs for errors
- Ensure correct path: `cd /path/to/HumanDesign` before running script

---

## Video Behind the Scenes

The implementation uses:
- **Fullscreen fixed positioning** — Always behind all content
- **Fixed aspect ratio** — Maintains 16:9 with `object-fit: cover`
- **Opacity blending** — 35% opacity + dark overlay gradient for readability
- **Progressive enhancement** — Falls back to CSS stars/particles if unavailable
- **Accessibility** — Respects `prefers-reduced-motion` (hidden for users)
- **Performance** — Pauses on tab-hide, cached in Service Worker
- **Mobile optimization** — Hidden on small screens (uses CSS animations instead)

---

## File Sizes & Compression

| Format | Codec   | Quality | Size     | Browser Support |
|--------|---------|---------|----------|-----------------|
| MP4    | H.264   | High    | 3-5 MB   | All modern (IE11+) |
| WebM   | VP9     | High    | 2-3 MB   | Chrome, Firefox, Edge |

**Recommendation:** Ship both (WebM for modern, MP4 for Safari/older browsers)


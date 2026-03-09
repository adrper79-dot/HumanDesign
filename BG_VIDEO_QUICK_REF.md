# Background Video — Quick Reference & Troubleshooting

## What's Been Done

✅ **HTML Setup**  
- Added `<video>` element to `frontend/index.html` (line 128)
- Two sources: `.webm` (preferred) + `.mp4` (fallback)
- Includes fade-in JS logic

✅ **CSS Styling**  
- Fullscreen background video in `frontend/css/artwork.css`
- 35% opacity for text readability
- Smooth 1.5s fade-in animation
- Mobile/accessibility optimizations

✅ **Service Worker Cache**  
- Poster image pre-cached in SW
- Video files cached on first play

✅ **Scripts**  
- `scripts/stitch-background-video.sh` — FFmpeg-based stitcher (for existing clips)
- `scripts/video-helper.py` — Testing & validation utility (no FFmpeg needed)

✅ **Documentation**  
- `BACKGROUND_VIDEO_SETUP.md` — Complete implementation guide
- `videos/BACKGROUND_VIDEO_PROMPT.md` — AI generation prompt
- This file — Quick ref

---

## Next Steps (Pick One)

### Path A: Stitch Existing Videos
```bash
# 1. Install FFmpeg (pick your OS below)
# 2. Run the stitch script
bash scripts/stitch-background-video.sh
# 3. Verify output
python3 scripts/video-helper.py verify frontend/
# 4. Deploy & test
```

**Best for:** You already have 6 Grok clips ready

---

### Path B: Generate New Video
```bash
# 1. Copy the prompt from videos/BACKGROUND_VIDEO_PROMPT.md
# 2. Use Grok, Runway, Pika, or Sora to generate a 10-15s video
# 3. Save output as frontend/bg-video.mp4
# 4. Extract poster with your video editor (or see Path C)
# 5. Verify & test
python3 scripts/video-helper.py verify frontend/
```

**Best for:** You want a fresh, purpose-built clip

---

### Path C: Manual Concatenation
```
1. Open your video editor (Premiere Pro, DaVinci Resolve, CapCut)
2. Import all 6 grok-video-*.mp4 files
3. Add 1.5s crossfade transitions between each
4. Add the first clip again at the very end (for seamless loop-back)
5. Export as:
   - Resolution: 1280×720 (maintain 16:9)
   - Codec: H.264
   - Bitrate: auto (target ~4 MB final)
   - Frame rate: 30fps
6. Save as frontend/bg-video.mp4
7. Extract first frame as frontend/bg-video-poster.jpg
8. Verify:
   python3 scripts/video-helper.py verify frontend/
```

**Best for:** You prefer visual editing or don't want to install FFmpeg

---

## Install FFmpeg (If Choosing Path A)

### Windows
**Option 1: Chocolatey (recommended)**
```powershell
choco install ffmpeg
ffmpeg -version
```

**Option 2: Manual**
1. Download from [ffmpeg.org/download.html](https://ffmpeg.org/download.html)
2. Extract to `C:\tools\ffmpeg`
3. Add `C:\tools\ffmpeg\bin` to System PATH
4. Restart PowerShell
5. Verify: `ffmpeg -version`

**Option 3: WSL (Linux inside Windows)**
```bash
wsl
sudo apt update && sudo apt install ffmpeg
ffmpeg -version
```

### macOS
```bash
brew install ffmpeg
ffmpeg -version
```

### Linux
```bash
sudo apt update && sudo apt install ffmpeg
ffmpeg -version
```

---

## After Creating Videos

### Verify Files Exist
```bash
ls -lh frontend/bg-video*
# Should show:
#   bg-video.mp4          (3-5 MB)
#   bg-video.webm         (optional, 2-3 MB)
#   bg-video-poster.jpg   (~50 KB)
```

### Test Loop Seamlessly
```bash
# macOS/Linux
open frontend/bg-video.mp4

# Windows
start frontend/bg-video.mp4
```
- Play the file 3-4 times
- Watch for jitter/jump at the loop point
- Listen for any audio (should be silent)

### Validate with Helper Script
```bash
python3 scripts/video-helper.py verify frontend/

# Output:
# ═════════════════════════════════════
#   Prime Self — Background Video Verification
# ═════════════════════════════════════
# ✓ REQUIRED FILES:
#   ✓ bg-video.mp4             4.2 MB
#   ✓ bg-video-poster.jpg      0.08 MB
# ⭐ OPTIONAL FILES:
#   ✓ bg-video.webm            2.8 MB
# 📊 VIDEO METADATA:
#   Duration:  45.0s
#   Resolution: 1280x720
#   Codec:     H.264/AVC
#   Size:      4.2 MB
# ═════════════════════════════════════
# ✅ All required files present! Ready to deploy.
```

### Local Web Test
```bash
python3 -m http.server 8000

# Open: http://localhost:8000/frontend/index.html
```
Check:
- Background video loads within 1-2 seconds
- Video fades in smoothly (1.5s fade)
- Sits behind all UI (doesn't obscure buttons/text)
- Loops seamlessly
- Readable text contrast

---

## Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| **Video doesn't load (404 error)** | Files in wrong location. Must be in `frontend/` dir. Filenames must match exactly: `bg-video.mp4`, `bg-video.webm`, `bg-video-poster.jpg` |
| **Video plays but looks wrong color/dim** | Check if correct files. Video should be dark cosmic theme. If too dark, reduce opacity in `artwork.css` line 22: `opacity: 0.20;` (lower = darker) |
| **Seamless loop jerks/cuts** | Video files may be corrupted. Re-run stitch script or regenerate. Check that first and last frames are identical. |
| **Takes too long to load** | Check file size: should be 3-5 MB max. Re-encode with lower quality (CRF 30) if larger. WebM helps (smaller file). |
| **Service worker not caching** | Hard refresh: `Ctrl+Shift+Delete` then `Ctrl+F5`. Or: `Shift+Cmd+Delete` (Mac). Then navigate normally to cache. |
| **Text not readable** | Video too bright. Reduce `.bg-video { opacity: }` in `artwork.css` (currently 0.35). CSS also has dark overlay gradient for help. |
| **Mobile looks weird** | Video hidden on mobile (<768px). Falls back to CSS stars/particles. Works as designed. |
| **Video plays audio (crackling/noise)** | Shouldn't happen. All videos are muted in HTML. If audio plays, check file has audio stream. Extract audio-free copy: `ffmpeg -i bad.mp4 -an -c:v copy good.mp4` |

---

## Key Files

| File | Purpose |
|------|---------|
| `frontend/index.html` | Updated: `<video>` element added (line 128) |
| `frontend/css/artwork.css` | Updated: `.bg-video` styles added (line 8-48) |
| `frontend/service-worker.js` | Updated: cached bg-video-poster.jpg |
| `scripts/stitch-background-video.sh` | **NEW**: FFmpeg stitch script |
| `scripts/video-helper.py` | **NEW**: Validation utility |
| `BACKGROUND_VIDEO_SETUP.md` | **NEW**: Full implementation guide |
| `videos/BACKGROUND_VIDEO_PROMPT.md` | **NEW**: AI generation prompt |
| `frontend/bg-video.mp4` | **TO CREATE**: Stitched/generated video (H.264, 1280×720, ~4 MB) |
| `frontend/bg-video.webm` | **OPTIONAL**: VP9 webm (for modern browsers, ~2-3 MB) |
| `frontend/bg-video-poster.jpg` | **TO CREATE**: First frame as poster (~50 KB) |

---

## Design Specs

**Visual Theme:** Cosmic, mystical, premium  
**Colors:** 
- Base: `#0d0d1a` (deep navy)
- Accent: `#c9a84c` (gold), `#6a4fc8` (purple), `#4fc8a0` (teal)

**Motion:**
- Slow, hypnotic (NOT a screensaver)
- Swirling nebula clouds
- Twinkling stars
- Rising particle streams
- Faint sacred geometry (barely visible)

**Technical:**
- 1280×720 (720p landscape)
- 30 fps smooth playback
- 30-45 seconds loop duration
- H.264 codec (universal support)
- VP9 webm optional (modern browsers)
- ~3-5 MB for MP4, ~2-3 MB for WebM

**Opacity:** 35% (for text readability)  
**Fade-in:** 1.5 seconds  
**Fallback:** CSS stars + particles (if video unavailable)

---

## Quick Commands

```bash
# Check ffmpeg installed
ffmpeg -version

# Verify all output files exist
python3 scripts/video-helper.py verify frontend/

# Get detailed metadata about a video
python3 scripts/video-helper.py info frontend/bg-video.mp4

# Run stitch script
bash scripts/stitch-background-video.sh

# Extract first/last frames to check loop (needs opencv)
python3 scripts/video-helper.py test-frames frontend/bg-video.mp4
```

---

## Deployment Checklist

- [ ] Video files created (mp4 at minimum, webm recommended)
- [ ] Poster image extracted (first frame, ~50 KB JPEG)
- [ ] All 3 files in `frontend/` directory
- [ ] Files verified with `video-helper.py verify`
- [ ] Local web test (loads in browser, loops seamlessly)
- [ ] Text contrast check (UI readable over background)
- [ ] Mobile test (falls back to CSS particles on small screens)
- [ ] Deploy to production
- [ ] Monitor browser console for any errors
- [ ] Verify Service Worker caches video on first play

---

## Support References

- **Full Setup Guide:** `BACKGROUND_VIDEO_SETUP.md`
- **AI Generation Prompt:** `videos/BACKGROUND_VIDEO_PROMPT.md`
- **FFmpeg Docs:** https://ffmpeg.org/documentation.html
- **WebM Encoding:** https://trac.ffmpeg.org/wiki/Encode/VP9
- **CSS `.bg-video` Styles:** `frontend/css/artwork.css` lines 8-48
- **HTML Video Element:** `frontend/index.html` line 128

---

## Next Action

Choose a path above (A, B, or C), follow the steps, and reach out if you hit any snags!


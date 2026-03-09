# ✅ Background Video — Getting Started Checklist

**Last Updated**: March 8, 2026  
**Status**: Ready for implementation

---

## 📋 Pre-Flight Check

Before you start, verify you have:

- [ ] The 6 Grok video files in `/videos/` folder (or plan to generate new)
- [ ] ~200 MB free disk space (temporary files during stitching)
- [ ] 10-30 minutes spare time
- [ ] Your choice of Path (A, B, or C — see below)

---

## 🎯 Choose Your Path

### If you have 6 Grok clips → **PATH A: Stitch**
<details>
<summary><strong>Click to expand Path A instructions</strong></summary>

**Step 1: Install FFmpeg**

Each OS is different. Pick yours:

#### Windows (Professional)
```powershell
# Option 1: Chocolatey (easiest)
choco install ffmpeg

# Option 2: Manual (if no Chocolatey)
# Download from https://ffmpeg.org/download.html
# Extract to C:\tools\ffmpeg
# Add C:\tools\ffmpeg\bin to System PATH
# Restart PowerShell
```

#### Windows (WSL / Linux)
```bash
wsl
sudo apt update && sudo apt install ffmpeg
```

#### macOS
```bash
brew install ffmpeg
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt update && sudo apt install ffmpeg
```

**Step 2: Verify FFmpeg installed**
```bash
ffmpeg -version
```
Should print version info (v5.0+). If error, go back to Step 1.

**Step 3: Run the stitch script**
```bash
cd /path/to/HumanDesign
bash scripts/stitch-background-video.sh
```

**Step 4: Verify output**
```bash
python3 scripts/video-helper.py verify frontend/
```

Should show:
```
✓ bg-video.mp4            4.2 MB
✓ bg-video-poster.jpg     0.08 MB
⭐ bg-video.webm          2.8 MB (optional)
✅ All required files present!
```

**Done!** Your videos are ready. Go to "Test & Deploy" section below.

</details>

---

### If you want fresh AI generation → **PATH B: Generate**
<details>
<summary><strong>Click to expand Path B instructions</strong></summary>

**Step 1: Copy the prompt**  
Open [videos/BACKGROUND_VIDEO_PROMPT.md](videos/BACKGROUND_VIDEO_PROMPT.md)  
Copy the "Master Prompt" section (between the triple backticks)

**Step 2: Choose an AI service**
- **Grok** (xAI) — free tier available, best for cosmic theme
- **Runway Gen-3 Alpha** — fast, high quality
- **Pika** — excellent for smooth motion
- **Sora** (OpenAI) — if you have access
- **Kling** — bilingual, good for mystical themes

**Step 3: Generate**
- Paste the prompt
- Set duration to 10-15 seconds
- Click Generate
- Wait 3-5 minutes

**Step 4: Download & save**
- Download the video (MP4 format preferred)
- Save to: `frontend/bg-video.mp4`

**Step 5: Create poster image**
- Use any video editor or FFmpeg:
  ```bash
  ffmpeg -i frontend/bg-video.mp4 -ss 2.0 -frames:v 1 -q:v 3 frontend/bg-video-poster.jpg
  ```
- Or: Open video in any player, screenshot the 2nd frame, save as JPG

**Done!** Your video is ready. Go to "Test & Deploy" section below.

</details>

---

### If you prefer manual editing → **PATH C: Video Editor**
<details>
<summary><strong>Click to expand Path C instructions</strong></summary>

**Step 1: Open your video editor**
- Premiere Pro, DaVinci Resolve, CapCut, Vegas Pro (any will work)

**Step 2: Import clips**
- Import all 6 `grok-video-*.mp4` files from `/videos/`

**Step 3: Add transitions**
- Place clips in sequence (any order for visual variety)
- Add 1.5 second **crossfade** transition between each clip

**Step 4: Loop-back**
- Duplicate the **first clip**
- Add it to the very end of the timeline
- Add a 1.5 second **crossfade** from last clip to this copy
- This creates the seamless loop-back point

**Step 5: Select output settings**
- Resolution: **1280 × 720** (16:9 landscape)
- Codec: **H.264** (AVC)
- Frame rate: **30 fps**
- Bitrate: Auto (target ~4 MB final)
- Audio: Turn off (no audio needed)

**Step 6: Export**
- Export as MP4
- Save to: `frontend/bg-video.mp4`

**Step 7: Extract poster**
- Scrub to 2 seconds in
- Take a screenshot or export single frame
- Save as JPEG to: `frontend/bg-video-poster.jpg`

**Done!** Your video is ready. Go to "Test & Deploy" section below.

</details>

---

## 🧪 Test & Deploy

Once you have your video files, follow this:

### Step 1: Verify Files Exist
```bash
python3 scripts/video-helper.py verify frontend/
```

Should output:
```
✅ All required files present! Ready to deploy.
```

### Step 2: Test Locally
```bash
python3 -m http.server 8000
# Open: http://localhost:8000/frontend/index.html
```

Check:
- [ ] Background video loads within 2 seconds
- [ ] Video fades in smoothly (1.5 second fade)
- [ ] Sits behind all UI elements
- [ ] Loops seamlessly (watch 3 times, no jitter at cut)
- [ ] Text is clearly readable over the video

### Step 3: Deploy
Just ensure these 3 files are in `frontend/` directory:
- [ ] `bg-video.mp4` (3-5 MB, required)
- [ ] `bg-video.webm` (2-3 MB, optional but recommended)
- [ ] `bg-video-poster.jpg` (~50 KB, required)

That's it! HTML/CSS/JS are already integrated.

The Service Worker will automatically cache the video on first load.

---

## 📊 Quick Status

| Component | Status |
|-----------|--------|
| **HTML** | ✅ Ready (video element added) |
| **CSS** | ✅ Ready (styles in place) |
| **JavaScript** | ✅ Ready (fade-in & caching logic) |
| **Service Worker** | ✅ Ready (cache strategy updated) |
| **Scripts** | ✅ Ready (stitch script + helpers) |
| **Docs** | ✅ Ready (3 comprehensive guides) |
| **Video Files** | 🎬 **NEEDS YOU** (pick Path A, B, or C) |

---

## 📚 Reference Guide

| I need to... | Click here |
|--------------|-----------|
| Full step-by-step setup | [BACKGROUND_VIDEO_SETUP.md](BACKGROUND_VIDEO_SETUP.md) |
| Quick reference & troubleshooting | [BG_VIDEO_QUICK_REF.md](BG_VIDEO_QUICK_REF.md) |
| Delivery summary & big picture | [BACKGROUND_VIDEO_DELIVERY.md](BACKGROUND_VIDEO_DELIVERY.md) |
| AI generation prompt | [videos/BACKGROUND_VIDEO_PROMPT.md](videos/BACKGROUND_VIDEO_PROMPT.md) |
| Understand what changed in code | See "HTML/CSS/JS Integration" below |

---

## 🔧 Quick Commands

```bash
# Verify FFmpeg installed
ffmpeg -version

# Run the stitch script (Path A)
bash scripts/stitch-background-video.sh

# Verify output files
python3 scripts/video-helper.py verify frontend/

# Get detailed video info
python3 scripts/video-helper.py info frontend/bg-video.mp4

# Start local test server
python3 -m http.server 8000
# Then open: http://localhost:8000/frontend/index.html
```

---

## 🎬 What You'll Get

A professional, seamless-looping cosmic background video that:
- ✨ Evokes mysticism & sacred geometry
- 🔄 Loops forever without jitter
- 📱 Gracefully degrades on mobile
- ⚡ Caches efficiently via Service Worker
- 🌙 Stays dark enough for readable UI text
- ♿ Respects accessibility preferences

---

## 💻 HTML/CSS/JS Integration (Already Done)

For reference, here's what changed:

**frontend/index.html** (line 128–137)
```html
<!-- ─── Fullscreen Background Video (seamless loop) ─── -->
<video id="bgVideo" class="bg-video" autoplay muted loop playsinline
       poster="bg-video-poster.jpg"
       aria-hidden="true">
  <source src="bg-video.webm" type="video/webm">
  <source src="bg-video.mp4" type="video/mp4">
</video>
```

**frontend/css/artwork.css** (line 8–48)
```css
.bg-video {
  position: fixed;
  top: 50%;
  left: 50%;
  min-width: 100vw;
  min-height: 100vh;
  width: auto;
  height: auto;
  transform: translate(-50%, -50%);
  z-index: -2;
  object-fit: cover;
  pointer-events: none;
  opacity: 0.35;
  transition: opacity 1.5s ease-in;
}
```

**frontend/service-worker.js**
- Added poster image to pre-cache list
- Video files automatically cached on first play

---

## ⚠️ Common Missteps (Avoid These)

- ❌ Forgetting the poster image (JPG) — will delay first paint
- ❌ Saving video with wrong filename — must be `bg-video.mp4`
- ❌ Using too-bright video — video should be dark, 35% opacity makes it lighter
- ❌ Forgetting loop-back clip — causes visible jitter at loop point
- ❌ Not testing locally first — always verify seamless loop before deploying

---

## 🎯 Next Actions

1. **Pick your path**: A (FFmpeg stitch), B (AI gen), or C (manual edit)
2. **Follow the steps** in the collapsed section above
3. **Run verification**: `python3 scripts/video-helper.py verify frontend/`
4. **Test locally**: `python3 -m http.server 8000`
5. **Deploy**: Ensure 3 files in `frontend/`, that's all!

---

## 📞 Stuck?

1. **FFmpeg won't install?** → Check [BACKGROUND_VIDEO_SETUP.md](BACKGROUND_VIDEO_SETUP.md) install section
2. **Video looks wrong?** → Check colors/theme in [videos/BACKGROUND_VIDEO_PROMPT.md](videos/BACKGROUND_VIDEO_PROMPT.md)
3. **Loop not seamless?** → Re-run Path A script or re-examine manual video edit
4. **Text not readable?** → Opacity is 35%, already optimized. Check video is dark enough.
5. **Something else?** → See [BG_VIDEO_QUICK_REF.md](BG_VIDEO_QUICK_REF.md) Troubleshooting section

---

## ✅ You're All Set!

Everything is ready. Just pick a path and create your video files. It'll take 10-30 minutes, and you'll have a stunning cosmic background for your Prime Self app.

**Ready?** Pick Path A, B, or C above and let's go! 🚀


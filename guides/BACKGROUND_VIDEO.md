# Background Video Implementation

Complete guide to creating and integrating a seamless looping background video.

**Time to complete**: 15–30 minutes  
**Tools needed**: FFmpeg (or use existing video files)  
**Complexity**: Medium

---

## Overview

Prime Self displays a cosmic background video on the landing page. This guide covers:
- ✅ Option 1: Stitch existing Grok clips (10 min, easiest)
- ✅ Option 2: Generate new video with xAI Grok (20 min)
- ✅ Option 3: Use existing video file (2 min)
- ✅ Optimization for web (compression, formats)
- ✅ Integration into frontend

---

## Prerequisites

- FFmpeg installed ([see below](#install-ffmpeg))
- 6 video clips (10–15 seconds each), OR
- Access to xAI Grok or other video generation AI

---

## Option 1: Stitch Existing Video Clips (Easiest)

If you already have 6 Grok-generated video clips in `/videos/`:

### Step 1: Install FFmpeg

See [Install FFmpeg](#install-ffmpeg) section below (5 min).

### Step 2: Run the Stitch Script

```bash
cd scripts
bash stitch-background-video.sh
```

This script:
1. Finds all `.mp4` files in `/videos/`
2. Concatenates them into a seamless loop
3. Generates 3 output files:
   - ✅ `frontend/bg-video.mp4` (H.264, 1920x1080, optimized)
   - ✅ `frontend/bg-video.webm` (VP9, for Chrome/Firefox)
   - ✅ `frontend/bg-video-poster.jpg` (thumbnail)

### Step 3: Verify Output

Check all three files exist:
```bash
ls -lh frontend/bg-video*
```

Expected sizes:
- `.mp4`: 5–15 MB
- `.webm`: 3–10 MB
- `-poster.jpg`: 100–300 KB

### Step 4: Test in Browser

```bash
npm run dev
```

Open http://localhost:5173 and verify:
- Video loads without errors (F12 Console)
- Video loops smoothly every 30 seconds
- No audio glitches
- CSS fade-in working correctly

✅ **Done!** Your cosmic background video is live.

---

## Option 2: Generate New Video with xAI Grok

If you don't have video clips yet:

### Step 1: Get the Prompt

Open [../videos/BACKGROUND_VIDEO_PROMPT.md](../videos/BACKGROUND_VIDEO_PROMPT.md)

Copy the **Master Prompt** section (between triple backticks).

### Step 2: Choose an AI Service

| Service | Speed | Quality | Free Tier |
|---------|-------|---------|-----------|
| **xAI Grok** | Fast | ⭐⭐⭐⭐ | ✅ Free |
| **Runway** | Fast | ⭐⭐⭐⭐ | ✅ Free (limited) |
| **Pika** | Medium | ⭐⭐⭐ | ✅ Free (limited) |
| **Sora** | Slow | ⭐⭐⭐⭐⭐ | ❌ Waitlist |
| **Kling** | Medium | ⭐⭐⭐ | ✅ Free (limited) |

**Recommended**: xAI Grok (free, fast, highest quality cosmic aesthetic)

### Step 3: Generate Videos

#### Via xAI Grok (Free)

1. Go to https://grok.x.ai
2. Paste prompt (see Step 1)
3. Set duration: **10–15 seconds**
4. Click **Generate**
5. Wait 2–5 minutes
6. Download MP4

**Tip**: Generate 6 clips with slight variations:
1. "cosmic nebula with stars"
2. "purple aurora dancing"
3. "gold particles flowing"
4. "blue quantum waves"
5. "cosmic dust floating"
6. "galaxy spiraling"

This creates visual variety when looped.

### Step 4: Stitch the Clips

Move generated videos to `/videos/` and follow **Option 1** above.

---

## Option 3: Use Existing Video File

If you already have a video file:

```bash
cp your-video.mp4 frontend/bg-video.mp4
ffmpeg -i frontend/bg-video.mp4 -c:v libvpx-vp9 -b:v 1M frontend/bg-video.webm
ffmpeg -i frontend/bg-video.mp4 -ss 0 -vframes 1 frontend/bg-video-poster.jpg
```

This creates all three required formats automatically.

---

## Install FFmpeg

### macOS (Homebrew)

```bash
brew install ffmpeg
ffmpeg -version  # Verify
```

### Windows (WSL / Ubuntu)

```bash
sudo apt update
sudo apt install ffmpeg
ffmpeg -version  # Verify
```

### Windows (Native, Without WSL)

1. Download: https://ffmpeg.org/download.html
2. Extract to `C:\ffmpeg\`
3. Add to PATH:
   - Settings → Environment Variables
   - Edit PATH → Add `C:\ffmpeg\bin\`
4. Restart terminal and test: `ffmpeg -version`

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install ffmpeg
ffmpeg -version  # Verify
```

---

## File Format Reference

| Format | Codec | Browser Support | File Size | Quality |
|--------|-------|---|---|---|
| MP4 | H.264 | All | Medium | Good |
| WebM | VP9 | Chrome, Firefox | Smallest | Good |
| Poster | JPEG | All | Tiny (150 KB) | Reference |

**Why three formats?**
- MP4: Fallback for Safari/Edge
- WebM: Smaller file for modern browsers
- Poster: Shown while video loads

---

## Advanced: Fine-Tuning the Stitch

Edit `scripts/stitch-background-video.sh` to customize:

```bash
# Adjust fade duration (default: 0.5s)
FADE_DURATION=1.0

# Adjust output resolution (default: 1920x1080)
OUTPUT_RES="1280x720"

# Adjust bitrate (default: 2M; lower = smaller file)
BITRATE="1500k"
```

Then re-run the script.

---

## Troubleshooting

### FFmpeg command not found
```bash
# Verify installation
which ffmpeg
ffmpeg -version

# If not found, reinstall (see Install FFmpeg section above)
```

### "Video not loading in browser" (403 error)
- Check file exists: `ls -lh frontend/bg-video.mp4`
- Check MIME types in web server
- Try hardcoding video path in HTML if using CDN

### "Video plays but doesn't loop"
- Check HTML `<video>` tag has `loop` attribute
- See [frontend/index.html](../frontend/index.html) line ~128

### "Video quality is poor"
- Increase bitrate in stitch script
- Generate clips at higher resolution (2560x1440 in AI service)
- Use VP9 codec (smaller file, better quality than H.264)

### "Stitching takes forever"
- Reduce clip duration (10 sec instead of 15 sec)
- Reduce resolution (1280x720 instead of 1920x1080)
- Use H.264 codec (faster encoding than VP9)

---

## Performance Tips

| Optimization | Impact | How |
|---|---|---|
| **Reduce res** | -40% size | Change `OUTPUT_RES="1280x720"` |
| **Lower bitrate** | -50% size | Change `BITRATE="1M"` |
| **Use H.264 only** | -30% time | Comment out VP9 encoding |
| **Pre-compress clips** | -20% time | Compress source clips first |

---

## Customization

### Change Video Colors

Edit [../videos/BACKGROUND_VIDEO_PROMPT.md](../videos/BACKGROUND_VIDEO_PROMPT.md):
- Change color palette (purple → blue, gold → silver)
- Adjust opacity ("35% opacity" → "50% opacity")
- Modify theme ("cosmic" → "dreamscape", "aurora", etc.)

### Change Loop Duration

Edit stitch script:
```bash
# Reduce total duration (default: ~180 sec = 6 × 30 sec)
# Edit CLIP_DURATION and regenerate
```

### Add Audio (Optional)

```bash
# Add background music under video
ffmpeg -i frontend/bg-video.mp4 \
        -i music.mp3 \
        -c:v copy \
        -c:a aac \
        -map 0:v:0 -map 1:a:0 \
        -y frontend/bg-video-with-audio.mp4
```

---

## Integration Checklist

- [ ] FFmpeg installed and working
- [ ] 6 video clips in `/videos/` (or use existing file)
- [ ] Stitch script ran successfully
- [ ] 3 files exist: `.mp4`, `.webm`, `-poster.jpg`
- [ ] Frontend dev server running, video loads
- [ ] Video loops smoothly without audio glitches
- [ ] CSS fade-in working correctly
- [ ] All 3 formats pass "lighthouse" performance test

---

## Next Steps

- **Settings**: Edit CSS in [../frontend/css/artwork.css](../frontend/css/artwork.css) lines 8–48
- **Deployment**: See [../DEPLOY.md](../DEPLOY.md)
- **Troubleshooting**: See [../BG_VIDEO_QUICK_REF.md](../BG_VIDEO_QUICK_REF.md#troubleshooting)

---

## See Also

- [../GETTING_STARTED_BACKGROUND_VIDEO.md](../GETTING_STARTED_BACKGROUND_VIDEO.md) — Quick check

list
- [../BACKGROUND_VIDEO_SETUP.md](../BACKGROUND_VIDEO_SETUP.md) — Detailed implementation
- [../videos/BACKGROUND_VIDEO_PROMPT.md](../videos/BACKGROUND_VIDEO_PROMPT.md) — AI generation prompt
- [SETUP_DEVELOPMENT.md](SETUP_DEVELOPMENT.md) — Development setup


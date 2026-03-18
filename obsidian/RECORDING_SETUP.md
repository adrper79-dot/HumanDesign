# Video Recording Setup Guide

> **Stack:** Obsidian (scripts) + OBS Studio (recording) + DaVinci Resolve (editing)
> All three are free and run locally on Windows.

---

## Software to Install

| Tool | Purpose | Download |
|---|---|---|
| **OBS Studio** | Screen recording + audio | obsproject.com |
| **DaVinci Resolve** | Free video editor | blackmagicdesign.com/products/davinciresolve |
| **Obsidian** | Script teleprompter (this app) | obsidian.md |

---

## OBS Setup (One-Time)

1. Download + install OBS Studio
2. Open OBS → Settings → Output:
   - Recording Format: **MP4**
   - Encoder: **x264**
   - Rate Control: **CRF 18** (high quality)
3. Settings → Video:
   - Base Resolution: **1920×1080**
   - Output Resolution: **1920×1080**
   - FPS: **30**
4. Settings → Audio:
   - Sample Rate: **44.1 kHz**
   - Channels: **Stereo**
5. Add Sources in OBS:
   - **Display Capture** → select your main monitor (the browser)
   - **Audio Input Capture** → your microphone

---

## Two-Monitor Recording Layout

```
[Left Monitor]          [Right Monitor — Recorded]
Obsidian script    →    Chrome: selfprime.net
(teleprompter)          OBS capturing this screen
```

- Read from left, act on right
- OBS only captures the RIGHT monitor
- Script stays off-camera

---

## Recording Workflow Per Video

1. Open the script note in Obsidian (left monitor)
2. Open selfprime.net in Chrome (right monitor)
3. Log in with demo account
4. Navigate to the starting screen per script
5. Hit **Start Recording** in OBS
6. Wait 2 seconds (buffer), then begin narration
7. Follow script — pause at [PAUSE] markers naturally
8. Hit **Stop Recording** in OBS
9. Raw file saved to your Videos folder

---

## Editing in DaVinci Resolve

1. Import MP4 from OBS into DaVinci
2. Trim: cut first 2 seconds of buffer + any dead air
3. Add lower-third text overlays at key feature names
4. Export: **YouTube 1080p** preset
5. Upload to YouTube → set as unlisted → embed in help docs

---

## AI Narration Alternative (Synthesia / HeyGen)

If you'd rather not record yourself:
1. Export each script as a .txt file
2. Upload to **Synthesia** (synthesia.io) or **HeyGen** (heygen.com)
3. Pick an AI avatar + voice
4. Paste the script — AI generates the video
5. ~$30–$60 per video on pay-as-you-go plans

Best for: polished product demos you want to look professional without recording yourself.

---

## YouTube Publishing Checklist

Per video:
- [ ] Title: "How to [feature] in Prime Self — [tier] Tutorial"
- [ ] Description: feature overview + selfprime.net link + referral link
- [ ] Tags: human design, energy blueprint, prime self, [feature name]
- [ ] Thumbnail: chart screenshot + video title text overlay
- [ ] Chapter markers added (timestamps in description)
- [ ] Added to "Prime Self Tutorials" playlist
- [ ] Shared on X with referral link
- [ ] Posted in r/humandesign with context (not just a link)

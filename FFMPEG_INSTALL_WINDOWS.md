# FFmpeg Installation for Windows

## Quick Option: Chocolatey (Recommended)

**Prerequisites:** Chocolatey installed (https://chocolatey.org/install)

```powershell
# Open PowerShell as Administrator
# Run:
choco install ffmpeg -y

# Verify:
ffmpeg -version
```

If that works, you can then run the stitch script from WSL.

---

## Alternative: Manual Download & Add to PATH

If Chocolatey doesn't work:

1. **Download FFmpeg:**
   - Go to https://ffmpeg.org/download.html
   - Download Windows build (GynaDroid-full recommended)
   - Extract to `C:\tools\ffmpeg`

2. **Add to System PATH:**
   - Press `Win+R`, type: `sysdm.cpl`
   - Click Advanced → Environment Variables
   - Click New (under System variables)
   - Variable name: `PATH`
   - Variable value: `C:\tools\ffmpeg\bin`
   - Click OK three times
   - Restart PowerShell

3. **Verify:**
   ```powershell
   ffmpeg -version
   ```

---

## Once Installed, Run the Script

From WSL terminal:
```bash
cd /mnt/c/Users/Ultimate\ Warrior/My\ project/HumanDesign
bash scripts/stitch-background-video.sh
```

---

## Troubleshooting

**Command not found after install?**
- Restart your terminal completely (close and reopen)
- Or restart your computer

**Still having issues?**
- Try running from PowerShell instead: `ffmpeg -version`
- If it works in PowerShell but not WSL, you can also run the bash script from PowerShell with WSL prefix

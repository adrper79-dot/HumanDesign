#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# stitch-background-video.sh — Combine Grok video clips into a seamless
#                                looping background video for Prime Self
# ═══════════════════════════════════════════════════════════════════════════════
#
# PREREQUISITES:
#   - ffmpeg ≥ 5.0 with libx264 and libx265 support
#   - Input videos in ../videos/ folder
#
# OUTPUT:
#   - ../frontend/bg-video.mp4    (H.264, ~3-5 MB, 1280×720, seamless loop)
#   - ../frontend/bg-video.webm   (VP9, smaller, for modern browsers)
#   - ../frontend/bg-video-poster.jpg  (first-frame poster image)
#
# USAGE:
#   chmod +x scripts/stitch-background-video.sh
#   ./scripts/stitch-background-video.sh
#
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VIDEOS_DIR="$ROOT/videos"
FRONTEND_DIR="$ROOT/frontend"
TEMP_DIR=$(mktemp -d)

# Cleanup temp files on exit
trap "rm -rf $TEMP_DIR" EXIT

# ── Configuration ──
WIDTH=1280
HEIGHT=720
FPS=30
CRF_MP4=28          # Lower = better quality, higher filesize (23-30 typical)
CRF_WEBM=35         # VP9 CRF (30-40 typical)
CROSSFADE_SEC=1.5    # Duration of crossfade between clips
TARGET_DURATION=45   # Approximate final loop duration in seconds

echo "═══════════════════════════════════════════════════════"
echo "  Prime Self — Background Video Stitcher"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Input:   $VIDEOS_DIR"
echo "  Output:  $FRONTEND_DIR/bg-video.mp4 + .webm"
echo "  Target:  ${WIDTH}×${HEIGHT} @ ${FPS}fps, ~3-5 MB"
echo ""

# ── Step 1: Verify inputs exist ──
echo "── Step 1: Scanning source videos..."
CLIPS=()
for f in "$VIDEOS_DIR"/grok-video-*.mp4; do
    [ -f "$f" ] && CLIPS+=("$f")
done

if [ ${#CLIPS[@]} -eq 0 ]; then
    echo "ERROR: No grok-video-*.mp4 files found in $VIDEOS_DIR"
    exit 1
fi
echo "  Found ${#CLIPS[@]} source clips"

# ── Step 2: Normalize all clips to consistent format ──
echo ""
echo "── Step 2: Normalizing clips to ${WIDTH}×${HEIGHT} @ ${FPS}fps..."
NORMALIZED=()
for i in "${!CLIPS[@]}"; do
    src="${CLIPS[$i]}"
    out="$TEMP_DIR/clip_$(printf '%02d' $i).mp4"
    echo "  [$((i+1))/${#CLIPS[@]}] $(basename "$src")"
    ffmpeg -y -i "$src" \
        -vf "scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=0x0d0d1a,fps=${FPS},format=yuv420p" \
        -c:v libx264 -preset medium -crf 18 \
        -an -movflags +faststart \
        "$out" 2>/dev/null
    NORMALIZED+=("$out")
done
echo "  ✓ All clips normalized"

# ── Step 3: Select and order clips for best flow ──
# Use clips in a curated order for visual variety.
# If you want a specific order, edit the CLIP_ORDER array.
echo ""
echo "── Step 3: Ordering clips for visual flow..."
NUM_CLIPS=${#NORMALIZED[@]}

# Default: use all clips in sequence, then repeat first clip
# to create crossfade back to start for seamless loop
CLIP_ORDER=()
for i in "${!NORMALIZED[@]}"; do
    CLIP_ORDER+=("$i")
done

echo "  Clip sequence: ${CLIP_ORDER[*]}"

# ── Step 4: Build crossfade filter chain ──
echo ""
echo "── Step 4: Building crossfade transitions (${CROSSFADE_SEC}s each)..."

# Build FFmpeg complex filter for sequential crossfades
INPUTS=""
FILTER=""
NUM_ORDER=${#CLIP_ORDER[@]}

for i in "${!CLIP_ORDER[@]}"; do
    idx="${CLIP_ORDER[$i]}"
    INPUTS="$INPUTS -i ${NORMALIZED[$idx]}"
done

# First clip → add the first clip again at the end for seamless loop-back
INPUTS="$INPUTS -i ${NORMALIZED[${CLIP_ORDER[0]}]}"
TOTAL_INPUTS=$((NUM_ORDER + 1))

# Get clip durations (all should be ~10s after normalization)
CLIP_DUR=10

# Build crossfade chain
# [0:v][1:v] xfade → [v01]
# [v01][2:v] xfade → [v012]
# ...
# Final input is clip[0] again, crossfade creates seamless loop point

PREV="[0:v]"
OFFSET=0

for ((i = 1; i < TOTAL_INPUTS; i++)); do
    OFFSET=$(echo "$CLIP_DUR * $i - $CROSSFADE_SEC * $i" | bc -l | xargs printf '%.2f')
    if [ $i -eq $((TOTAL_INPUTS - 1)) ]; then
        LABEL="[vout]"
    else
        LABEL="[v${i}]"
    fi
    FILTER="${FILTER}${PREV}[${i}:v]xfade=transition=fade:duration=${CROSSFADE_SEC}:offset=${OFFSET}${LABEL};"
    PREV="[v${i}]"
done

# Remove trailing semicolon
FILTER="${FILTER%;}"

echo "  ✓ Filter chain built with $((TOTAL_INPUTS - 1)) crossfade transitions"

# ── Step 5: Render stitched video ──
echo ""
echo "── Step 5: Rendering stitched MP4..."
STITCHED="$TEMP_DIR/stitched.mp4"

ffmpeg -y $INPUTS \
    -filter_complex "$FILTER" \
    -map "[vout]" \
    -c:v libx264 -preset slow -crf $CRF_MP4 \
    -pix_fmt yuv420p -an -movflags +faststart \
    "$STITCHED" 2>/dev/null

STITCH_SIZE=$(du -h "$STITCHED" | cut -f1)
STITCH_DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$STITCHED" | cut -d. -f1)
echo "  ✓ Stitched: ${STITCH_SIZE}, ~${STITCH_DUR}s"

# ── Step 6: If too long, trim to target duration ──
FINAL_MP4="$FRONTEND_DIR/bg-video.mp4"
if [ "$STITCH_DUR" -gt "$TARGET_DURATION" ]; then
    echo ""
    echo "── Step 6: Trimming to ~${TARGET_DURATION}s..."
    ffmpeg -y -i "$STITCHED" -t $TARGET_DURATION \
        -c:v libx264 -preset slow -crf $CRF_MP4 \
        -pix_fmt yuv420p -an -movflags +faststart \
        "$FINAL_MP4" 2>/dev/null
else
    cp "$STITCHED" "$FINAL_MP4"
fi

FINAL_SIZE=$(du -h "$FINAL_MP4" | cut -f1)
echo "  ✓ bg-video.mp4 → $FINAL_SIZE"

# ── Step 7: Generate WebM version ──
echo ""
echo "── Step 7: Encoding VP9 WebM (smaller, modern browsers)..."
FINAL_WEBM="$FRONTEND_DIR/bg-video.webm"
ffmpeg -y -i "$FINAL_MP4" \
    -c:v libvpx-vp9 -crf $CRF_WEBM -b:v 0 \
    -an -deadline good -cpu-used 2 \
    "$FINAL_WEBM" 2>/dev/null

WEBM_SIZE=$(du -h "$FINAL_WEBM" | cut -f1)
echo "  ✓ bg-video.webm → $WEBM_SIZE"

# ── Step 8: Extract poster frame ──
echo ""
echo "── Step 8: Extracting poster image..."
POSTER="$FRONTEND_DIR/bg-video-poster.jpg"
ffmpeg -y -i "$FINAL_MP4" -ss 2.0 -frames:v 1 -q:v 3 \
    "$POSTER" 2>/dev/null
echo "  ✓ bg-video-poster.jpg"

# ── Summary ──
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  DONE! Output files:"
echo "  ├── $FINAL_MP4 ($FINAL_SIZE)"
echo "  ├── $FINAL_WEBM ($WEBM_SIZE)"
echo "  └── $POSTER"
echo ""
echo "  Add to index.html:"
echo '  <video id="bgVideo" autoplay muted loop playsinline'
echo '         poster="bg-video-poster.jpg"'
echo '         class="bg-video">'
echo '    <source src="bg-video.webm" type="video/webm">'
echo '    <source src="bg-video.mp4" type="video/mp4">'
echo '  </video>'
echo "═══════════════════════════════════════════════════════"

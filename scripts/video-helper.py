#!/usr/bin/env python3
"""
Prime Self — Background Video Helper
Utility for testing, validating, and troubleshooting background videos.

USAGE:
  python3 video-helper.py info <video_file>      # Get metadata
  python3 video-helper.py verify frontend/        # Check all required files
  python3 video-helper.py test-frames <video>    # Extract first/last frame (requires OpenCV)
"""

import sys
import os
import json
import struct
from pathlib import Path


def parse_mp4_header(filepath):
    """Extract basic MP4 metadata without ffmpeg."""
    try:
        with open(filepath, 'rb') as f:
            data = f.read()
        
        results = {
            'file': os.path.basename(filepath),
            'size_mb': os.path.getsize(filepath) / (1024*1024),
            'path': filepath
        }
        
        # Find mvhd (movie header) for timescale and duration
        idx = data.find(b'mvhd')
        if idx > 0:
            f_data = data[idx+4:]
            version = f_data[0]
            if version == 0:
                timescale = struct.unpack('>I', f_data[12:16])[0]
                duration = struct.unpack('>I', f_data[16:20])[0]
            else:
                timescale = struct.unpack('>I', f_data[20:24])[0]
                duration = struct.unpack('>Q', f_data[24:32])[0]
            if timescale > 0:
                results['duration_sec'] = duration / timescale
        
        # Find video codec and dimensions
        idx = 0
        found_codec = False
        
        # Try H.264
        idx = data.find(b'avc1')
        if idx > 0:
            results['codec'] = 'H.264/AVC'
            try:
                w = struct.unpack('>H', data[idx+24:idx+26])[0]
                h = struct.unpack('>H', data[idx+26:idx+28])[0]
                if 0 < w < 8000 and 0 < h < 8000:
                    results['width'] = w
                    results['height'] = h
                found_codec = True
            except:
                pass
        
        # Try HEVC
        if not found_codec:
            idx = data.find(b'hvc1')
            if idx <= 0:
                idx = data.find(b'hev1')
            if idx > 0:
                results['codec'] = 'HEVC/H.265'
                try:
                    w = struct.unpack('>H', data[idx+24:idx+26])[0]
                    h = struct.unpack('>H', data[idx+26:idx+28])[0]
                    if 0 < w < 8000 and 0 < h < 8000:
                        results['width'] = w
                        results['height'] = h
                    found_codec = True
                except:
                    pass
        
        # Try tkhd for dimensions as fallback
        if 'width' not in results:
            idx = data.find(b'tkhd')
            if idx > 0:
                try:
                    f_data = data[idx+4:]
                    version = f_data[0]
                    if version == 0:
                        w_raw = struct.unpack('>I', f_data[72:76])[0]
                        h_raw = struct.unpack('>I', f_data[76:80])[0]
                    else:
                        w_raw = struct.unpack('>I', f_data[84:88])[0]
                        h_raw = struct.unpack('>I', f_data[88:92])[0]
                    # Fixed point 16.16
                    results['width'] = w_raw >> 16
                    results['height'] = h_raw >> 16
                except:
                    pass
        
        return results
    except Exception as e:
        return {'error': str(e), 'file': filepath}


def verify_files(frontend_dir):
    """Verify all required background video files exist."""
    print("═" * 60)
    print("  Prime Self — Background Video File Verification")
    print("═" * 60)
    
    required = [
        'bg-video.mp4',
        'bg-video-poster.jpg'
    ]
    
    optional = [
        'bg-video.webm'
    ]
    
    frontend_path = Path(frontend_dir)
    
    print("\n✓ REQUIRED FILES:")
    all_ok = True
    for fname in required:
        fpath = frontend_path / fname
        if fpath.exists():
            size_mb = fpath.stat().st_size / (1024*1024)
            print(f"  ✓ {fname:<25} {size_mb:>6.1f} MB")
        else:
            print(f"  ✗ {fname:<25} MISSING")
            all_ok = False
    
    print("\n⭐ OPTIONAL FILES (recommended):")
    for fname in optional:
        fpath = frontend_path / fname
        if fpath.exists():
            size_mb = fpath.stat().st_size / (1024*1024)
            print(f"  ✓ {fname:<25} {size_mb:>6.1f} MB")
        else:
            print(f"  ○ {fname:<25} not found (MP4 fallback OK)")
    
    print("\n📊 VIDEO METADATA:")
    mp4_path = frontend_path / 'bg-video.mp4'
    if mp4_path.exists():
        info = parse_mp4_header(str(mp4_path))
        if 'error' not in info:
            print(f"  Duration:  {info.get('duration_sec', '?'):.1f}s")
            print(f"  Resolution: {info.get('width', '?')}x{info.get('height', '?')}")
            print(f"  Codec:     {info.get('codec', '?')}")
            print(f"  Size:      {info.get('size_mb', 0):.1f} MB")
        else:
            print(f"  Error: {info['error']}")
    
    print("\n" + "═" * 60)
    if all_ok:
        print("✅ All required files present! Ready to deploy.")
    else:
        print("❌ Missing required files. See BACKGROUND_VIDEO_SETUP.md")
    print("═" * 60)
    
    return all_ok


def info_command(filepath):
    """Show detailed info about a video file."""
    if not os.path.exists(filepath):
        print(f"❌ File not found: {filepath}")
        return
    
    info = parse_mp4_header(filepath)
    
    print("\n" + "═" * 60)
    print(f"  {info.get('file', 'Video')}")
    print("═" * 60)
    
    for key, val in info.items():
        if key not in ['file', 'path']:
            if isinstance(val, float):
                print(f"  {key:.<30} {val:.2f}")
            else:
                print(f"  {key:.<30} {val}")
    
    print("═" * 60 + "\n")


def test_frames_command(filepath):
    """Extract first and last frame for loop testing (requires opencv)."""
    try:
        import cv2
    except ImportError:
        print("❌ OpenCV not installed.")
        print("   Install: pip install opencv-python")
        return
    
    if not os.path.exists(filepath):
        print(f"❌ File not found: {filepath}")
        return
    
    cap = cv2.VideoCapture(filepath)
    if not cap.isOpened():
        print(f"❌ Cannot open video: {filepath}")
        return
    
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    
    # Get first frame
    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    ret, first = cap.read()
    
    # Get last frame
    cap.set(cv2.CAP_PROP_POS_FRAMES, total_frames - 1)
    ret, last = cap.read()
    
    cap.release()
    
    outdir = Path('frontend/test-frames')
    outdir.mkdir(exist_ok=True)
    
    first_path = outdir / 'first-frame.jpg'
    last_path = outdir / 'last-frame.jpg'
    
    cv2.imwrite(str(first_path), first)
    cv2.imwrite(str(last_path), last)
    
    print(f"\n✓ Extracted frames to {outdir}/")
    print(f"  - First frame → first-frame.jpg")
    print(f"  - Last frame  → last-frame.jpg")
    print(f"\nFor seamless loop, these should look identical.")
    print(f"Total frames: {total_frames}, FPS: {fps:.1f}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    
    cmd = sys.argv[1]
    
    if cmd == 'info' and len(sys.argv) > 2:
        info_command(sys.argv[2])
    elif cmd == 'verify' and len(sys.argv) > 2:
        verify_files(sys.argv[2])
    elif cmd == 'test-frames' and len(sys.argv) > 2:
        test_frames_command(sys.argv[2])
    else:
        print(__doc__)


if __name__ == '__main__':
    main()

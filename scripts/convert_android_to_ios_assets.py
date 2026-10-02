#!/usr/bin/env python3
"""
convert_android_to_ios_assets.py
---------------------------------
Converts the app_icon.png (Android source) to the full iOS Assets.xcassets
structure required by Xcode:
  - AppIcon.appiconset  — all sizes for iPhone, iPad and App Store
  - Splash.imageset     — 3 universal splash screens (1x, 2x, 3x)

Usage:
  pip install pillow
  python scripts/convert_android_to_ios_assets.py

Run from the project root directory.
"""

import os
import sys
import json
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow is not installed. Run: pip install pillow")
    sys.exit(1)

# Resolve paths relative to the project root (two levels up from this script)
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent

APP_ICON_PATH = ROOT / "app_icon.png"
XCASSETS_DIR = ROOT / "ios" / "App" / "App" / "Assets.xcassets"
APPICON_DIR = XCASSETS_DIR / "AppIcon.appiconset"
SPLASH_DIR = XCASSETS_DIR / "Splash.imageset"

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
if not APP_ICON_PATH.exists():
    print(f"ERROR: Source icon not found at: {APP_ICON_PATH}")
    sys.exit(1)

APPICON_DIR.mkdir(parents=True, exist_ok=True)
SPLASH_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# 1. Generate complete AppIcon set (@1x / @2x / @3x for iPhone, iPad, Store)
# ---------------------------------------------------------------------------
img = Image.open(APP_ICON_PATH).convert("RGBA")

icon_specs = [
    # iPhone — Notification
    {"idiom": "iphone", "size": "20x20",     "scale": "2x", "px": 40,   "name": "AppIcon-20x20@2x.png"},
    {"idiom": "iphone", "size": "20x20",     "scale": "3x", "px": 60,   "name": "AppIcon-20x20@3x.png"},
    # iPhone — Settings
    {"idiom": "iphone", "size": "29x29",     "scale": "1x", "px": 29,   "name": "AppIcon-29x29@1x.png"},
    {"idiom": "iphone", "size": "29x29",     "scale": "2x", "px": 58,   "name": "AppIcon-29x29@2x.png"},
    {"idiom": "iphone", "size": "29x29",     "scale": "3x", "px": 87,   "name": "AppIcon-29x29@3x.png"},
    # iPhone — Spotlight
    {"idiom": "iphone", "size": "40x40",     "scale": "2x", "px": 80,   "name": "AppIcon-40x40@2x.png"},
    {"idiom": "iphone", "size": "40x40",     "scale": "3x", "px": 120,  "name": "AppIcon-40x40@3x.png"},
    # iPhone — App
    {"idiom": "iphone", "size": "60x60",     "scale": "2x", "px": 120,  "name": "AppIcon-60x60@2x.png"},
    {"idiom": "iphone", "size": "60x60",     "scale": "3x", "px": 180,  "name": "AppIcon-60x60@3x.png"},
    # iPad — Notification
    {"idiom": "ipad",   "size": "20x20",     "scale": "1x", "px": 20,   "name": "AppIcon-20x20@1x~ipad.png"},
    {"idiom": "ipad",   "size": "20x20",     "scale": "2x", "px": 40,   "name": "AppIcon-20x20@2x~ipad.png"},
    # iPad — Settings
    {"idiom": "ipad",   "size": "29x29",     "scale": "1x", "px": 29,   "name": "AppIcon-29x29@1x~ipad.png"},
    {"idiom": "ipad",   "size": "29x29",     "scale": "2x", "px": 58,   "name": "AppIcon-29x29@2x~ipad.png"},
    # iPad — Spotlight
    {"idiom": "ipad",   "size": "40x40",     "scale": "1x", "px": 40,   "name": "AppIcon-40x40@1x~ipad.png"},
    {"idiom": "ipad",   "size": "40x40",     "scale": "2x", "px": 80,   "name": "AppIcon-40x40@2x~ipad.png"},
    # iPad — App
    {"idiom": "ipad",   "size": "76x76",     "scale": "1x", "px": 76,   "name": "AppIcon-76x76@1x.png"},
    {"idiom": "ipad",   "size": "76x76",     "scale": "2x", "px": 152,  "name": "AppIcon-76x76@2x.png"},
    # iPad Pro — App
    {"idiom": "ipad",   "size": "83.5x83.5", "scale": "2x", "px": 167,  "name": "AppIcon-83.5x83.5@2x.png"},
    # App Store
    {"idiom": "ios-marketing", "size": "1024x1024", "scale": "1x", "px": 1024, "name": "AppIcon-512@2x.png"},
]

images_json = []
for spec in icon_specs:
    out_path = APPICON_DIR / spec["name"]
    # Flatten RGBA → RGB with dark background for square icons
    flat = Image.new("RGB", img.size, (6, 8, 11))
    flat.paste(img, mask=img.split()[3] if img.mode == "RGBA" else None)
    resized = flat.resize((spec["px"], spec["px"]), Image.Resampling.LANCZOS)
    resized.save(str(out_path), "PNG")
    images_json.append({
        "size": spec["size"],
        "idiom": spec["idiom"],
        "filename": spec["name"],
        "scale": spec["scale"],
    })
    print(f"  ✓ {spec['name']} ({spec['px']}x{spec['px']})")

with open(APPICON_DIR / "Contents.json", "w", encoding="utf-8") as f:
    json.dump({"images": images_json, "info": {"version": 1, "author": "xcode"}}, f, indent=2)

print(f"\nAppIcon.appiconset — {len(icon_specs)} sizes generated.")

# ---------------------------------------------------------------------------
# 2. Generate branded splash screens
# Background: #06080B | Logo: centered, 28% of canvas
# ---------------------------------------------------------------------------
def make_splash(canvas_size: int) -> Image.Image:
    bg = Image.new("RGB", (canvas_size, canvas_size), (6, 8, 11))
    logo_size = int(canvas_size * 0.28)
    logo_flat = Image.new("RGB", img.size, (6, 8, 11))
    logo_flat.paste(img, mask=img.split()[3] if img.mode == "RGBA" else None)
    logo_resized = logo_flat.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    offset = (canvas_size - logo_size) // 2
    bg.paste(logo_resized, (offset, offset))
    return bg

splash_specs = [
    {"name": "splash-2732x2732.png",   "scale": "3x", "px": 2732},
    {"name": "splash-2732x2732-1.png", "scale": "2x", "px": 1821},
    {"name": "splash-2732x2732-2.png", "scale": "1x", "px": 910},
]

splash_images_json = []
for spec in splash_specs:
    splash = make_splash(spec["px"])
    out_path = SPLASH_DIR / spec["name"]
    splash.save(str(out_path), "PNG")
    splash_images_json.append({
        "idiom": "universal",
        "filename": spec["name"],
        "scale": spec["scale"],
    })
    print(f"  ✓ {spec['name']} ({spec['px']}x{spec['px']})")

with open(SPLASH_DIR / "Contents.json", "w", encoding="utf-8") as f:
    json.dump({"images": splash_images_json, "info": {"version": 1, "author": "xcode"}}, f, indent=2)

print(f"\nSplash.imageset — {len(splash_specs)} variants generated.")
print("\n✅ All iOS assets converted successfully!")
print(f"   Output: {XCASSETS_DIR}")

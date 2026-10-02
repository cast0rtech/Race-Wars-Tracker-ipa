import os
from PIL import Image

src_img_path = r"C:\Users\castor\.gemini\antigravity-ide\brain\fd91b9e9-14ba-4d41-b4b9-911a82d06d85\.user_uploaded\media_1790925088937.jpg"
res_dir = r"c:\Users\castor\Documents\GitHub\Race-Wars-Tracker\android\app\src\main\res"

if not os.path.exists(src_img_path):
    print(f"Error: Source image {src_img_path} not found!")
    exit(1)

img = Image.open(src_img_path).convert("RGBA")

# Save high-res PNG in root and assets
img.save(r"c:\Users\castor\Documents\GitHub\Race-Wars-Tracker\app_icon.png")

densities = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

for folder_name, size in densities.items():
    folder_path = os.path.join(res_dir, folder_name)
    os.makedirs(folder_path, exist_ok=True)
    
    resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
    
    # Save ic_launcher.png, ic_launcher_round.png, ic_launcher_foreground.png
    for filename in ["ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"]:
        out_path = os.path.join(folder_path, filename)
        resized_img.save(out_path, "PNG")
        print(f"Saved {out_path} ({size}x{size})")

print("All Android app icon densities generated successfully!")

#!/usr/bin/env python3
import os
import shutil

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
www_dir = os.path.join(root_dir, 'www')
ios_public_dir = os.path.join(root_dir, 'ios', 'App', 'App', 'public')

files_to_copy = [
    'index.html',
    'style.css',
    'app.js',
    'summary.html',
    'summary.css',
    'summary.js',
    'card-offscreen.html',
    'card-offscreen.css',
    'card-offscreen.js',
    'capacitor.config.json'
]

for target_dir in [www_dir, ios_public_dir]:
    if os.path.exists(target_dir):
        shutil.rmtree(target_dir)
    os.makedirs(target_dir, exist_ok=True)

    copied = 0
    for f in files_to_copy:
        src = os.path.join(root_dir, f)
        dst = os.path.join(target_dir, f)
        if os.path.exists(src):
            shutil.copy2(src, dst)
            copied += 1
        else:
            print(f"Warning: {f} not found")

    core_src = os.path.join(root_dir, 'core')
    core_dst = os.path.join(target_dir, 'core')
    os.makedirs(core_dst, exist_ok=True)
    if os.path.exists(core_src):
        for cf in os.listdir(core_src):
            cf_src = os.path.join(core_src, cf)
            if os.path.isfile(cf_src):
                shutil.copy2(cf_src, os.path.join(core_dst, cf))
                copied += 1

    print(f"Copied {copied} assets to {target_dir}")

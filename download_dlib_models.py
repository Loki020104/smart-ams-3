#!/usr/bin/env python3
"""
Download dlib pre-trained models for SmartAMS face recognition.
Run: python download_dlib_models.py
"""

import os
import sys
import urllib.request
import bz2
from pathlib import Path

MODELS = {
    "shape_predictor_68_face_landmarks.dat": {
        "url": "http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2",
        "size_mb": 99.7,
        "description": "Face landmark predictor"
    },
    "mmod_human_face_detector.dat": {
        "url": "http://dlib.net/files/mmod_human_face_detector.dat.bz2",
        "size_mb": 23.3,
        "description": "CNN-based human face detector"
    }
}

def download_file(url, filename, total_size_mb):
    """Download a file with progress bar."""
    print(f"\n📥 Downloading {filename} ({total_size_mb:.1f} MB)...")
    
    try:
        urllib.request.urlretrieve(url, filename, reporthook=progress_hook)
        print(f"✅ Downloaded: {filename}")
        return True
    except Exception as e:
        print(f"❌ Error downloading {filename}: {e}")
        return False

def progress_hook(block_num, block_size, total_size):
    """Show download progress."""
    downloaded = block_num * block_size
    percent = min(downloaded * 100 // total_size, 100) if total_size > 0 else 0
    print(f"\r  Progress: {percent}%", end="", flush=True)

def extract_bz2(bz2_file, output_file):
    """Extract bz2 compressed file."""
    print(f"📦 Extracting {bz2_file}...")
    try:
        with bz2.open(bz2_file, 'rb') as f_in:
            with open(output_file, 'wb') as f_out:
                f_out.write(f_in.read())
        os.remove(bz2_file)
        print(f"✅ Extracted: {output_file}")
        return True
    except Exception as e:
        print(f"❌ Error extracting {bz2_file}: {e}")
        return False

def main():
    print("=" * 60)
    print("dlib Model Downloader for SmartAMS")
    print("=" * 60)
    
    project_root = Path(__file__).parent
    os.chdir(project_root)
    
    print(f"\n📍 Project root: {project_root}")
    
    all_success = True
    for model_name, info in MODELS.items():
        # Check if already exists
        if Path(model_name).exists():
            print(f"\n✅ Already exists: {model_name}")
            continue
        
        print(f"\n🔍 {info['description']}")
        
        # Download bz2 file
        bz2_file = f"{model_name}.bz2"
        if not download_file(info['url'], bz2_file, info['size_mb']):
            all_success = False
            continue
        
        # Extract
        if not extract_bz2(bz2_file, model_name):
            all_success = False
            continue
    
    print("\n" + "=" * 60)
    if all_success:
        print("✅ All models downloaded and extracted successfully!")
        print("\nYou can now run the backend:")
        print("  python backend.py")
    else:
        print("⚠️  Some models failed to download. Check the errors above.")
        print("\nYou can manually download from:")
        for model_name, info in MODELS.items():
            print(f"  - {info['url']}")
    
    print("=" * 60)

if __name__ == "__main__":
    main()

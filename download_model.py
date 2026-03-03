#!/usr/bin/env python3
import urllib.request
import ssl
import bz2
from pathlib import Path

# Skip SSL verification (for this download only)
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

url = "http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2"
project_root = Path("/Users/loki/Downloads/smart-ams 3")
bz2_path = project_root / "shape_predictor_68_face_landmarks.dat.bz2"
dat_path = project_root / "shape_predictor_68_face_landmarks.dat"

print(f"Downloading shape predictor (~99MB)...")
try:
    opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ssl_context))
    urllib.request.install_opener(opener)
    
    def progress(block, size, total):
        if block % 50 == 0:
            mb_done = min(block*size, total) / 1e6
            mb_total = total / 1e6
            print(f"  {mb_done:.1f}MB / {mb_total:.1f}MB", end='\r')
    
    urllib.request.urlretrieve(url, str(bz2_path), reporthook=progress)
    print(f"\n✓ Downloaded {bz2_path.stat().st_size/1e6:.1f}MB  ")
    
    print("Extracting...")
    with bz2.open(bz2_path) as f_in:
        with open(dat_path, 'wb') as f_out:
            f_out.write(f_in.read())
    
    print(f"✓ Extracted {dat_path.stat().st_size/1e6:.1f}MB")
    bz2_path.unlink()
    print("✓ SUCCESS! Model ready for face recognition.")
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()

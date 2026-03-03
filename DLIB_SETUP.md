# dlib Setup for SmartAMS Face Recognition

## Overview
SmartAMS now uses **dlib** for face detection and recognition instead of the face_recognition library. dlib provides:
- **Frontal Face Detector** - detects faces in images
- **Shape Predictor** - identifies face landmarks
- **Face Recognition Model (ResNet)** - generates 128-dimensional face encodings

---

## Installation

### 1. Install dlib
```bash
pip install dlib
# Or if you have issues, try:
pip install dlib==19.24.2
```

**macOS note:** If you get CMake errors, install it first:
```bash
brew install cmake
pip install dlib
```

### 2. Download Pre-trained Models

Download these three dlib model files and place them in the `smart-ams 3/` directory:

#### Option A: Automatic Download (Recommended)
Run this script to download all models:

```bash
python download_dlib_models.py
```

#### Option B: Manual Download

1. **mmod_human_face_detector.dat** (23.3 MB)
   - Download from: http://dlib.net/files/mmod_human_face_detector.dat.bz2
   - Extract and place in project root

2. **shape_predictor_68_face_landmarks.dat** (99.7 MB)
   - Download from: http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2
   - Extract and place in project root

3. **mmod_human_face_detector.dat** (optional, for better detection)
   - Already listed above

**Quick download commands:**
```bash
# Download all models
wget http://dlib.net/files/mmod_human_face_detector.dat.bz2
bunzip2 mmod_human_face_detector.dat.bz2

wget http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2
bunzip2 shape_predictor_68_face_landmarks.dat.bz2
```

---

## Verify Installation

Test if dlib is working:

```bash
python3 -c "
import dlib
detector = dlib.get_frontal_face_detector()
print('✅ dlib frontal face detector loaded')

try:
    sp = dlib.shape_predictor('shape_predictor_68_face_landmarks.dat')
    print('✅ Shape predictor loaded')
except:
    print('⚠️  Shape predictor not found (optional)')

try:
    facerec = dlib.face_recognition_model_v1('mmod_human_face_detector.dat')
    print('✅ Face recognition model loaded')
except:
    print('⚠️  Face recognition model not found (using fallback)')
"
```

---

## Running the Backend

Start the Flask backend with dlib:

```bash
cd "/Users/umamahesh/Downloads/smart-ams 3"
source .venv/bin/activate  # or your venv activation
python backend.py
```

You should see:
```
[FACE] dlib module loaded successfully with face detector
SmartAMS Backend — http://localhost:6001
```

---

## How It Works

### Face Detection (Registration)
1. User uploads photo during registration
2. dlib's **mmod_human_face_detector** detects all faces
3. Ensures exactly **1 face** is present
4. Extracts face region

### Face Encoding
1. dlib **shape_predictor** finds 68 facial landmarks
2. Aligns face based on landmarks
3. **ResNet model** generates 128-dimensional face encoding
4. Encoding is stored (locally in `encodings.pkl` and in Supabase)

### Face Verification (Attendance)
1. Student takes photo during attendance
2. dlib detects face and generates encoding
3. Compares against all registered students using **Euclidean distance**
4. If distance < threshold (0.6), attendance is marked

---

## Tolerance Settings

Edit tolerance in `backend.py` verify function:

```python
tol = float(d.get("tolerance", 0.6))  # 0.6 is default
```

**Recommended values:**
- **0.4-0.5** - Very strict (fewer false positives, more false negatives)
- **0.6** - Balanced (default)
- **0.7-0.8** - Lenient (more false positives, fewer false negatives)

---

## Troubleshooting

### Error: "dlib model files not found"
**Solution:** Download the model files from links above and place in project root.

### Error: "mmod_human_face_detector.dat: No such file"
**Solution:** The full CNN face detector is optional. The system will fallback to HOG-based detection.

### Face detection returns 0 faces
**Solutions:**
- Ensure good lighting
- Face should be clearly visible (front-facing)
- Try higher resolution image
- Increase image upsampling in `encode_image()`: change `detector(img_bgr, 1)` to `detector(img_bgr, 2)`

### Slow face recognition
**Cause:** Using dlib's CNN detector is slower than HOG.
**Solution:** If speed is critical, you can modify to use HOG-only:

```python
# In backend.py, change detector call:
dets = detector(img_bgr, 0)  # 0 = HOG detector (faster)
```

---

## File Structure

After setup, your directory should have:

```
smart-ams 3/
├── app.js
├── index.html
├── backend.py              (uses dlib)
├── requirements.txt        (includes dlib)
├── encodings.pkl           (face encodings database)
├── shape_predictor_68_face_landmarks.dat
├── mmod_human_face_detector.dat
└── DLIB_SETUP.md          (this file)
```

---

## Performance Notes

### Detection Speed
- **HOG detector:** ~50-100ms per image (fast)
- **CNN detector:** ~500-1000ms per image (slow but more accurate)

### Encoding Generation
- **ResNet model:** ~200-300ms per face (one-time during registration)

### Verification Speed
- **Distance calculation:** ~1-5ms (very fast, done at attendance time)

---

## References

- dlib official site: http://dlib.net/
- Face recognition tutorial: http://dlib.net/python_examples.html
- Model files: http://dlib.net/files/

---

**Need help?** Check the backend server logs for `[FACE]` messages indicating which components loaded successfully.

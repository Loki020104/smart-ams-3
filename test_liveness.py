#!/usr/bin/env python3
"""
Test script for Face Recognition with Eye Blinking Liveness Detection
Validates dlib integration and liveness detection functionality
"""

import sys
import os
from pathlib import Path

def test_imports():
    """Test if all required packages are installed."""
    print("[*] Testing imports...")
    
    try:
        import numpy as np
        print("  ✓ numpy")
    except ImportError:
        print("  ✗ numpy - INSTALL: pip install numpy")
        return False
    
    try:
        import cv2
        print("  ✓ opencv-python")
    except ImportError:
        print("  ✗ opencv-python - INSTALL: pip install opencv-python-headless")
        return False
    
    try:
        from PIL import Image
        print("  ✓ pillow")
    except ImportError:
        print("  ✗ pillow - INSTALL: pip install pillow")
        return False
    
    try:
        import face_recognition
        print("  ✓ face_recognition")
    except ImportError:
        print("  ✗ face_recognition - INSTALL: pip install face_recognition")
        return False
    
    try:
        import dlib
        print("  ✓ dlib")
        print(f"    dlib version: {dlib.__version__ if hasattr(dlib, '__version__') else 'unknown'}")
    except ImportError:
        print("  ✗ dlib - INSTALL: pip install dlib")
        return False
    
    return True


def test_dlib_models():
    """Check if dlib models are available."""
    print("\n[*] Testing dlib models...")
    
    try:
        import dlib
        
        # Test frontal face detector
        try:
            detector = dlib.get_frontal_face_detector()
            print("  ✓ Frontal face detector loaded")
        except Exception as e:
            print(f"  ✗ Frontal face detector: {e}")
            return False
        
        # Test shape predictor
        sp_paths = [
            Path("shape_predictor_68_face_landmarks.dat"),
            Path(__file__).parent / "shape_predictor_68_face_landmarks.dat",
            Path.home() / "Downloads" / "shape_predictor_68_face_landmarks.dat",
        ]
        
        sp_found = False
        for sp_path in sp_paths:
            if sp_path.exists():
                try:
                    sp = dlib.shape_predictor(str(sp_path))
                    print(f"  ✓ Shape predictor loaded from {sp_path}")
                    sp_found = True
                    break
                except Exception as e:
                    print(f"  ! Shape predictor error at {sp_path}: {e}")
        
        if not sp_found:
            print("  ⚠ Shape predictor NOT found")
            print("    Download from: https://github.com/davisking/dlib/releases")
            print("    Place in project root: shape_predictor_68_face_landmarks.dat")
            return False
        
        return True
    
    except Exception as e:
        print(f"  ✗ dlib error: {e}")
        return False


def test_eye_aspect_ratio():
    """Test eye aspect ratio calculation."""
    print("\n[*] Testing eye aspect ratio calculation...")
    
    try:
        import numpy as np
        from face_recognition_with_liveness import calculate_eye_aspect_ratio
        
        # Test with mock landmarks
        eye_open = np.array([
            (10, 50),   # p1: left corner
            (20, 20),   # p2: top-middle
            (30, 20),   # p3: top-middle
            (60, 50),   # p4: right corner
            (50, 80),   # p5: bottom-middle
            (40, 80),   # p6: bottom-middle
        ], dtype=np.float32)
        
        ear_open = calculate_eye_aspect_ratio(eye_open)
        print(f"  Eye open EAR: {ear_open:.4f}")
        
        if ear_open > 0.1:
            print("  ✓ EAR calculation correct for open eye")
        else:
            print("  ✗ EAR calculation incorrect")
            return False
        
        # Test with closed eye
        eye_closed = np.array([
            (10, 50),   # p1: left corner
            (20, 48),   # p2: slightly moved
            (30, 48),   # p3: slightly moved
            (60, 50),   # p4: right corner
            (50, 52),   # p5: slightly moved
            (40, 52),   # p6: slightly moved
        ], dtype=np.float32)
        
        ear_closed = calculate_eye_aspect_ratio(eye_closed)
        print(f"  Eye closed EAR: {ear_closed:.4f}")
        
        if ear_closed < 0.1:
            print("  ✓ EAR calculation correct for closed eye")
        else:
            print("  ✗ EAR calculation incorrect for closed state")
            return False
        
        return True
    
    except Exception as e:
        print(f"  ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_liveness_detection():
    """Test liveness detection with a sample image."""
    print("\n[*] Testing liveness detection...")
    
    try:
        from face_recognition_with_liveness import detect_eye_blinking
        import dlib
        from pathlib import Path
        
        # Initialize dlib
        detector = dlib.get_frontal_face_detector()
        
        # Find shape predictor
        sp_path = None
        for path in [
            Path("shape_predictor_68_face_landmarks.dat"),
            Path(__file__).parent / "shape_predictor_68_face_landmarks.dat",
        ]:
            if path.exists():
                sp_path = path
                break
        
        if not sp_path:
            print("  ⚠ Shape predictor not available, skipping detection test")
            return True
        
        sp = dlib.shape_predictor(str(sp_path))
        
        # Test with a non-existent image (should fail gracefully)
        result = detect_eye_blinking("nonexistent.jpg", detector, sp)
        print(f"  Non-existent image result: {result['message']}")
        
        if "not read" in result['message'].lower() or "could not" in result['message'].lower():
            print("  ✓ Error handling works correctly")
            return True
        else:
            print("  ✗ Error handling issue")
            return False
    
    except Exception as e:
        print(f"  ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_backend_integration():
    """Test backend.py integration."""
    print("\n[*] Testing backend.py integration...")
    
    try:
        # Check if backend.py has required functions
        backend_path = Path("backend.py")
        
        if not backend_path.exists():
            print("  ! backend.py not found in current directory")
            return False
        
        with open(backend_path, 'r') as f:
            backend_code = f.read()
        
        required_functions = [
            "calculate_eye_aspect_ratio",
            "detect_liveness",
            "encode_image",
            "load_encodings",
            "verify"
        ]
        
        for func in required_functions:
            if f"def {func}" in backend_code:
                print(f"  ✓ {func} found")
            else:
                print(f"  ✗ {func} NOT found")
                return False
        
        return True
    
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def main():
    """Run all tests."""
    print("=" * 60)
    print("Face Recognition with Liveness Detection - Test Suite")
    print("=" * 60)
    
    tests = [
        ("Imports", test_imports),
        ("dlib Models", test_dlib_models),
        ("Eye Aspect Ratio", test_eye_aspect_ratio),
        ("Liveness Detection", test_liveness_detection),
        ("Backend Integration", test_backend_integration),
    ]
    
    results = {}
    
    for name, test_func in tests:
        try:
            results[name] = test_func()
        except Exception as e:
            print(f"\n[!] Test '{name}' crashed: {e}")
            import traceback
            traceback.print_exc()
            results[name] = False
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    for name, result in results.items():
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status} - {name}")
    
    all_passed = all(results.values())
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✓ All tests PASSED!")
        print("\nYou can now use:")
        print("  from face_recognition_with_liveness import register_person, verify_and_mark")
        print("  register_person('LOKNATH', samples=5)")
        print("  verify_and_mark(tolerance=0.5)")
        return 0
    else:
        print("✗ Some tests FAILED")
        print("\nPlease install missing dependencies:")
        print("  pip install -r requirements_liveness.txt")
        return 1


if __name__ == "__main__":
    sys.exit(main())

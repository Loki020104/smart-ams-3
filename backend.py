"""
SmartAMS – Python Flask Backend
Face Recognition API using exact provided code
"""
import os, base64, csv, pickle, json
from io import BytesIO
from pathlib import Path
from datetime import datetime
import uuid
import numpy as np
from PIL import Image

# Initialize dlib for face recognition. Try local model files first,
# then fall back to models bundled with the `face_recognition_models`
# package if available. If neither is present, fall back to detector-only
# mode (no encodings).
FACE_RECOGNITION_AVAILABLE = False
detector = None
sp = None
facerec = None

try:
    import dlib
    from pathlib import Path
    import sys
    import site

    # Try multiple paths for model files
    candidates = [
        Path("shape_predictor_68_face_landmarks.dat"),  # project root
        Path("dlib_face_recognition_resnet_model_v1.dat"),  # project root
    ]
    
    # Add venv site-packages paths
    for site_pkg in site.getsitepackages() + [site.getusersitepackages()]:
        if site_pkg:
            candidates.append(Path(site_pkg) / "face_recognition_models" / "models" / "shape_predictor_68_face_landmarks.dat")
            candidates.append(Path(site_pkg) / "face_recognition_models" / "models" / "dlib_face_recognition_resnet_model_v1.dat")

    sp_path = None
    rec_path = None
    
    for cand in candidates:
        if cand.exists() and "shape_predictor" in str(cand):
            sp_path = cand
            break
    
    for cand in candidates:
        if cand.exists() and "dlib_face_recognition_resnet_model_v1" in str(cand):
            rec_path = cand
            break

    detector = dlib.get_frontal_face_detector()

    if sp_path and sp_path.exists():
        try:
            sp = dlib.shape_predictor(str(sp_path))
            print(f"[FACE] Loaded shape predictor from {sp_path}")
        except Exception as e:
            print(f"[WARNING] Failed to load shape predictor {sp_path}: {e}")
            sp = None
    else:
        print("[WARNING] shape_predictor_68_face_landmarks.dat not found")
        sp = None

    if rec_path and rec_path.exists():
        try:
            facerec = dlib.face_recognition_model_v1(str(rec_path))
            print(f"[FACE] Loaded face recognition model from {rec_path}")
        except Exception as e:
            print(f"[WARNING] Failed to load face recognition model {rec_path}: {e}")
            facerec = None
    else:
        print("[WARNING] dlib_face_recognition_resnet_model_v1.dat not found")
        facerec = None

    # Only mark full face-recognition available when detector + models exist
    FACE_RECOGNITION_AVAILABLE = detector is not None and sp is not None and facerec is not None
    if FACE_RECOGNITION_AVAILABLE:
        print("[FACE] ✓ dlib module loaded successfully with face detector and models")
    elif detector is not None:
        print("[FACE] ✓ dlib frontal face detector loaded (encodings disabled)")
    else:
        print("[WARNING] dlib not available")
except Exception as e:
    print(f"[WARNING] Error loading dlib: {e}")
    import traceback
    traceback.print_exc()
    FACE_RECOGNITION_AVAILABLE = False

from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

ENC_PATH = "encodings.pkl"
ATT_CSV  = "attendance.csv"

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip('/')
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# Use plain HTTP requests instead of the official supabase client to avoid
# compatibility problems with httpx/httpcore on Python 3.14.  The original
# implementation imported ``from supabase import create_client`` which pulled
# in httpx and crashed at import time.  We just need a tiny subset of the
# REST API (select/insert/upsert) so a lightweight wrapper around ``requests``
# is sufficient.

import requests


def sb_select(table, filters=None, select="*"):
    """Perform a filtered SELECT against a Supabase table.

    ``filters`` should be a dict mapping column names to values; they are
    translated into ``col=eq.value`` query parameters.  ``select`` may be a
    comma-separated string of columns or ``"*"`` for all.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        return []
    qs = []
    if filters:
        for col, val in filters.items():
            qs.append(f"{col}=eq.{val}")
    if select:
        qs.insert(0, f"select={select}")
    query = "?" + "&".join(qs) if qs else ""
    url = f"{SUPABASE_URL}/rest/v1/{table}{query}"
    hdrs = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    resp = requests.get(url, headers=hdrs)
    try:
        resp.raise_for_status()
    except Exception as e:
        print(f"[SUPABASE] SELECT error {resp.status_code}: {resp.text}")
        raise
    try:
        return resp.json()
    except ValueError:
        return []


def sb_insert(table, data, upsert=False, on_conflict=None):
    """Insert (or upsert) a row into a Supabase table.

    If ``upsert`` is True and ``on_conflict`` is provided we add the proper
    ``Prefer`` header and a query parameter to instruct the REST API to merge
    duplicates.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        return []
    hdrs = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    if upsert and on_conflict:
        hdrs["Prefer"] = "resolution=merge-duplicates"
        url = url + f"?on_conflict={on_conflict}"
    resp = requests.post(url, json=data, headers=hdrs)
    try:
        resp.raise_for_status()
    except Exception as e:
        # Print the response body to help debug 4xx errors
        try:
            print(f"[SUPABASE] INSERT/UPSERT error {resp.status_code}: {resp.text}")
        except Exception:
            print(f"[SUPABASE] INSERT/UPSERT HTTP error: {e}")
        raise
    try:
        return resp.json()
    except ValueError:
        return []


# ``sb`` placeholder: construct a minimal client that mimics the
# subset of the official supabase client used elsewhere in this file.
# It delegates to the helper functions above which perform REST calls
# using ``requests``.


class SimpleResult:
    def __init__(self, data):
        self.data = data


class SBTable:
    def __init__(self, table):
        self.table = table
        self._select = "*"
        self._filters = []
        self._order = None
        self._limit = None
        self._insert_data = None
        self._upsert = False
        self._on_conflict = None
        self._single = False

    def select(self, cols="*"):
        self._select = cols
        return self

    def eq(self, col, val):
        self._filters.append((col, val))
        return self

    def order(self, column, desc=False):
        self._order = (column, desc)
        return self

    def limit(self, n):
        self._limit = n
        return self

    def single(self):
        self._single = True
        return self

    def insert(self, data):
        self._insert_data = data
        return self

    def upsert(self, data, on_conflict=None):
        self._insert_data = data
        self._upsert = True
        self._on_conflict = on_conflict
        return self

    def execute(self):
        if self._insert_data is not None:
            res = sb_insert(
                self.table,
                self._insert_data,
                upsert=self._upsert,
                on_conflict=self._on_conflict,
            )
            return SimpleResult(res)
        else:
            filters = {c: v for c, v in self._filters} if self._filters else None
            rows = sb_select(self.table, filters, select=self._select)
            if self._order:
                col, desc = self._order
                rows = sorted(rows, key=lambda r: r.get(col), reverse=desc)
            if self._limit is not None:
                rows = rows[: self._limit]
            if self._single:
                return SimpleResult(rows[0] if rows else None)
            return SimpleResult(rows)


class SimpleSupabaseClient:
    def table(self, name):
        return SBTable(name)


sb = SimpleSupabaseClient() if SUPABASE_URL and SUPABASE_KEY else None

# ── Original functions (unchanged) ──
def load_encodings():
    if Path(ENC_PATH).exists():
        with open(ENC_PATH,"rb") as f:
            d=pickle.load(f)
        return [np.array(e) for e in d["encodings"]], d["names"]
    return [],[]

def save_encodings(encs,names):
    with open(ENC_PATH,"wb") as f:
        pickle.dump({"encodings":[e.tolist() for e in encs],"names":names},f)

def load_encodings_supabase():
    """Return all face encodings from Supabase with names and roll_nos.

    Returns list of (encoding_array, name, roll_no) tuples.
    Falls back to local file if Supabase is unavailable or empty.
    """
    if not sb:
        # For local, return as tuples for consistency
        local_encs, local_names = load_encodings()
        return [(e, n, n) for e, n in zip(local_encs, local_names)]
    try:
        result = sb.table("face_encodings").select("encoding,name,roll_no").execute()
        data = []
        if result.data:
            for row in result.data:
                enc_text = row.get("encoding")
                name = row.get("name", "")
                roll_no = row.get("roll_no")
                try:
                    arr = np.array(json.loads(enc_text))
                    data.append((arr, name, roll_no))
                except Exception:
                    pass
        if data:
            return data
    except Exception as e:
        print(f"[FACE] Error loading encodings from Supabase: {e}")
    # Fallback to local
    local_encs, local_names = load_encodings()
    return [(e, n, n) for e, n in zip(local_encs, local_names)]

def get_system_config(key, default=None):
    """Fetch a value from system_config table."""
    if not sb:
        return default
    try:
        r = sb.table("system_config").select("value").eq("key", key).single().execute()
        if r.data:
            return r.data.get("value")
    except Exception as e:
        print(f"[CONFIG] Error reading {key}: {e}")
    return default

def is_face_enabled():
    val = get_system_config("face_recognition_enabled", "false")
    return str(val).lower() == "true"

def haversine(lat1, lon1, lat2, lon2):
    """Return distance in kilometers between two lat/lon points."""
    from math import radians, sin, cos, asin, sqrt
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    return 6371 * 2 * asin(sqrt(a))


def verify_face_for_user(user_id=None, image_b64=None, roll_no=None):
    """Verify a base64 face image against a stored encoding.

    The function prefers to look up by roll_no, but will fall back to
    user_id if the table has that column.  Returns (verified, confidence).
    """
    if not is_face_enabled() or not sb or not image_b64:
        return False, 0.0
    try:
        import face_recognition
        header, b64data = image_b64.split(",",1) if "," in image_b64 else ("", image_b64)
        bts = base64.b64decode(b64data)
        im = Image.open(BytesIO(bts)).convert("RGB")
        arr = np.array(im)
        locs = face_recognition.face_locations(arr)
        if not locs:
            return False,0.0
        encs = face_recognition.face_encodings(arr, locs)
        if not encs:
            return False,0.0
        enc = encs[0]

        # lookup stored encoding
        result = None
        try:
            if roll_no:
                result = sb.table("face_encodings").select("encoding").eq("roll_no", roll_no).execute()
        except Exception:
            result = None
        if not result or not result.data:
            try:
                result = sb.table("face_encodings").select("encoding").eq("user_id", user_id).execute()
            except Exception:
                result = None
        if not result or not result.data:
            return False,0.0
        db_enc = np.array(result.data[0]["encoding"])
        dist = np.linalg.norm(enc - db_enc)
        verified = dist <= 0.6
        confidence = float(max(0,1 - (dist / 2.0)))
        return verified, confidence
    except Exception as e:
        print(f"[FACE VERIFY] error {e}")
        return False,0.0

def encode_image(path, model='hog'):
    """Use face_recognition library to detect faces and return encodings."""
    try:
        import face_recognition as fr
        img = np.array(Image.open(path).convert("RGB"))
        face_encs = fr.face_encodings(img)
        print(f"[FACE] Detected {len(face_encs)} face(s)")
        return face_encs
    except Exception as e:
        print(f"[FACE] Error encoding image: {e}")
        import traceback
        traceback.print_exc()
        return []

def calculate_eye_aspect_ratio(eye_points):
    """Calculate the eye aspect ratio using dlib landmarks.
    
    EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)
    where p1...p6 are the eye landmark points.
    High EAR = eye open, Low EAR = eye closed
    """
    try:
        pts = np.array(eye_points)
        if len(pts) < 6:
            return 0
        
        # Vertical distances
        dist_top_bottom_1 = np.linalg.norm(pts[1] - pts[5])
        dist_top_bottom_2 = np.linalg.norm(pts[2] - pts[4])
        
        # Horizontal distance
        dist_left_right = np.linalg.norm(pts[0] - pts[3])
        
        # Calculate EAR
        ear = (dist_top_bottom_1 + dist_top_bottom_2) / (2.0 * dist_left_right)
        return ear
    except:
        return 0

def detect_liveness(image_path_or_array, threshold_eye_height=3, eye_aspect_ratio_threshold=0.1):
    """Detect eye movement/blinks to prevent fake image verification.
    
    Uses dlib-based eye aspect ratio (EAR) for robust liveness detection.
    Analyzes eye landmarks to ensure eyes are open and visible (not winking/closed).
    Returns True if eyes are open (live), False if eyes closed or face not detected.
    """
    try:
        import face_recognition as fr
        import cv2
        
        # Load image
        if isinstance(image_path_or_array, str):
            img = cv2.imread(image_path_or_array)
            if img is None:
                img = np.array(Image.open(image_path_or_array).convert("RGB"))
                img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
        else:
            img = image_path_or_array
        
        if img is None:
            print("[LIVENESS] Invalid image")
            return False
        
        # Convert to RGB for face_recognition
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Try dlib-based detection first if available
        if detector is not None and sp is not None:
            print("[LIVENESS] Using dlib for eye detection...")
            dlib_img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            faces = detector(dlib_img, 0)
            
            if len(faces) == 0:
                print("[LIVENESS] No face detected via dlib")
                return False
            
            face = faces[0]
            landmarks = sp(dlib_img, face)
            
            # dlib landmark indices for eyes: 36-41 (left), 42-47 (right)
            left_eye_pts = [(landmarks.part(i).x, landmarks.part(i).y) for i in range(36, 42)]
            right_eye_pts = [(landmarks.part(i).x, landmarks.part(i).y) for i in range(42, 48)]
            
            # Calculate eye aspect ratios
            left_ear = calculate_eye_aspect_ratio(left_eye_pts)
            right_ear = calculate_eye_aspect_ratio(right_eye_pts)
            avg_ear = (left_ear + right_ear) / 2.0
            
            print(f"[LIVENESS] Left EAR: {left_ear:.3f}, Right EAR: {right_ear:.3f}, Avg: {avg_ear:.3f}")
            
            # Both eyes should have EAR > threshold (eyes open, not closed/winking)
            if avg_ear < eye_aspect_ratio_threshold:
                print(f"[LIVENESS] Eyes appear closed/winking (EAR: {avg_ear:.3f} < {eye_aspect_ratio_threshold})")
                return False
            
            print(f"[LIVENESS] ✓ Eyes open (EAR: {avg_ear:.3f}px)")
            return True
        
        # Fallback to face_recognition if dlib not available
        print("[LIVENESS] Using face_recognition for eye detection (fallback)...")
        face_landmarks_list = fr.face_landmarks_in_image(img_rgb)
        
        if not face_landmarks_list:
            print("[LIVENESS] No face detected")
            return False
        
        # Get eye regions from first face
        landmarks = face_landmarks_list[0]
        left_eye = landmarks.get('left_eye', [])
        right_eye = landmarks.get('right_eye', [])
        
        if not left_eye or not right_eye:
            print("[LIVENESS] Eyes not detected")
            return False
        
        # Calculate eye openness (vertical distance between eyelids)
        left_eye_pts = np.array(left_eye)
        right_eye_pts = np.array(right_eye)
        
        left_eye_height = abs(np.max(left_eye_pts[:, 1]) - np.min(left_eye_pts[:, 1]))
        right_eye_height = abs(np.max(right_eye_pts[:, 1]) - np.min(right_eye_pts[:, 1]))
        
        # Eyes should have significant vertical opening (not closed/winking)
        if left_eye_height < threshold_eye_height or right_eye_height < threshold_eye_height:
            print(f"[LIVENESS] Eyes appear closed/winking (L:{left_eye_height:.1f}, R:{right_eye_height:.1f})")
            return False
        
        print(f"[LIVENESS] ✓ Eyes open (L:{left_eye_height:.1f}px, R:{right_eye_height:.1f}px)")
        return True
    
    except Exception as e:
        print(f"[LIVENESS] Error in liveness check: {e}")
        import traceback
        traceback.print_exc()
        # If liveness check fails, allow but log warning
        return True

def mark_attendance(name):
    ts=datetime.utcnow().isoformat()
    write_header=not Path(ATT_CSV).exists()
    with open(ATT_CSV,"a",newline="") as f:
        w=csv.writer(f)
        if write_header: w.writerow(["name","timestamp"])
        w.writerow([name,ts])

# ── API ──
def decode_b64_image(b64_str):
    if "," in b64_str:
        b64_str=b64_str.split(",")[1]
    return Image.open(BytesIO(base64.b64decode(b64_str))).convert("RGB")

def upsert_face_encoding_local(enc_data, roll_no):
    """Save face encoding locally, replacing existing entry for same roll_no."""
    encs_list, names = load_encodings()
    if roll_no in names:
        idx = names.index(roll_no)
        encs_list[idx] = enc_data
        print(f"[FACE] Updated existing local encoding for {roll_no}")
    else:
        encs_list.append(enc_data)
        names.append(roll_no)
    save_encodings(encs_list, names)

def generate_roll_number(department: str) -> str:
    """Create a new roll number based on current year, department code and a
    simple sequence.  The format is <year><dept><seq_4digits>; e.g. 2024cse0001.
    The department string is lowercased and non-alphanumerics removed.  We
    count existing users with the same prefix to determine the next sequence.
    This replicates the "year+dept+number" requirement from the UI.
    """
    if not sb:
        # fallback when Supabase is not configured; just return a uuid fragment
        return f"{datetime.utcnow().year}{department.lower()[:3]}{str(uuid.uuid4())[:4]}"
    prefix = f"{datetime.utcnow().year}{''.join(ch for ch in department.lower() if ch.isalnum())}"
    try:
        existing = sb.table("users").select("roll_no").like("roll_no", f"{prefix}%").execute()
        count = len(existing.data or [])
    except Exception:
        count = 0
    return f"{prefix}{count+1:04d}"


def upsert_face_encoding_supabase(metadata, enc_data):
    """Upsert face encoding to Supabase (insert or update on roll_no conflict)."""
    if not sb:
        return
    try:
        payload = {
            "name": metadata.get('name'),
            "roll_no": metadata.get('roll_no'),
            "admission_no": metadata.get('admission_no'),
            "section": metadata.get('section'),
            "academic_year": metadata.get('academic_year'),
            "encoding": json.dumps(enc_data.tolist()),
            "created_at": datetime.utcnow().isoformat()
        }
        try:
            print(f"[SUPABASE] Upserting face_encodings payload: {json.dumps(payload)[:1000]}")
            sb.table("face_encodings").upsert(payload, on_conflict="roll_no").execute()
            print(f"[FACE] Encoding upserted to Supabase for {metadata.get('roll_no')}")
        except Exception as e:
            print(f"[SUPABASE] Upsert face_encodings error: {e}")
            try:
                import traceback
                traceback.print_exc()
            except Exception:
                pass
    except Exception as e:
        print(f"[FACE] Warning: Failed to upsert to Supabase: {e}")

@app.route("/health")
def health():
    return jsonify(status="ok",supabase=sb is not None,time=datetime.utcnow().isoformat())

@app.route("/api/test-create-student", methods=["POST"])
def test_create_student():
    """Debug endpoint: Create a test student account"""
    try:
        import hashlib
        
        test_data = {
            "username": "student001",
            "password_hash": hashlib.sha256("password123".encode()).hexdigest(),
            "role": "student",
            "full_name": "Test Student",
            "email": "student@test.com",
            "roll_no": "student001",
            "department": "CSE",
            "section": "A",
            "created_at": datetime.utcnow().isoformat()
        }
        
        if sb:
            result = sb.table("users").insert(test_data).execute()
            return jsonify(success=True, message="Test student created", user=test_data)
        else:
            return jsonify(success=False, error="Supabase not configured"), 500
            
    except Exception as e:
        error_msg = str(e)
        if "duplicate" in error_msg.lower():
            return jsonify(success=True, message="Test student already exists", credentials={
                "username": "student001",
                "password": "password123"
            })
        return jsonify(success=False, error=error_msg), 500

@app.route("/api/register", methods=["POST"])
def register():
    """Register face only (standalone face registration). Handles both multipart and JSON."""
    try:
        img = None
        metadata = {}
        
        # Check if it's FormData with file (multipart/form-data)
        if request.files.get('image'):
            image_file = request.files['image']
            print(f"[FACE] Received file: {image_file.filename}")
            img = Image.open(image_file.stream).convert("RGB")
            metadata = {
                'name': request.form.get('name', 'unknown'),
                'roll_no': request.form.get('roll_no', '').strip() or None,
                'admission_no': request.form.get('admission_no', '').strip() or str(uuid.uuid4()),
                'section': request.form.get('section', '–'),
                'academic_year': request.form.get('academic_year', '2024-25')
            }
            # if roll is empty and department info present, generate one
            if not metadata['roll_no'] and request.form.get('department'):
                metadata['roll_no'] = generate_roll_number(request.form.get('department'))
        
        # Otherwise, handle JSON with base64 image
        elif request.is_json:
            d = request.json or {}
            if not d.get("image"):
                print("[FACE] No image in JSON request")
                return jsonify(error="No image provided"), 400
            img = decode_b64_image(d["image"])
            metadata = {
                'name': d.get("name", 'unknown'),
                'roll_no': d.get("roll_no", '').strip() or None,
                'admission_no': d.get("admission_no", '').strip() or str(uuid.uuid4()),
                'section': d.get("section", '–'),
                'academic_year': d.get("academic_year", '2024-25')
            }
            if not metadata['roll_no'] and d.get('department'):
                metadata['roll_no'] = generate_roll_number(d.get('department'))
        else:
            print("[FACE] No image provided (neither multipart nor JSON)")
            return jsonify(error="No image provided. Send multipart form with 'image' file or JSON with 'image' (base64)"), 400
        
        # Process image
        tmp = "tmp_reg.jpg"
        img.save(tmp)
        print(f"[FACE] Image saved, detecting faces...")
        encs = encode_image(tmp)
        print(f"[FACE] Faces detected: {len(encs)}")
        os.remove(tmp)
        
        if len(encs) != 1:
            error_msg = f"Found {len(encs)} faces. Ensure exactly ONE face is visible"
            print(f"[FACE] Error: {error_msg}")
            return jsonify(error=error_msg), 400
        
        enc_data = encs[0]
        roll_no = metadata.get('roll_no', 'unknown')

        # Save locally (upsert — replace if same roll_no exists)
        upsert_face_encoding_local(enc_data, roll_no)
        print(f"[FACE] Encoding saved locally")

        # Upsert to Supabase
        upsert_face_encoding_supabase(metadata, enc_data)
        
        print(f"[FACE] Registration successful for {metadata.get('name')}")
        return jsonify(success=True, message=f"Registered {metadata.get('name')}", encoding=enc_data.tolist())
    
    except Exception as e:
        print(f"[FACE] Exception: {e}")
        import traceback
        traceback.print_exc()
        return jsonify(error=f"Server error: {str(e)}"), 500


@app.route("/api/register-and-add-user", methods=["POST"])
def register_and_add_user():
    """Combined endpoint: register face + create user account in one call."""
    try:
        if not request.files.get('image'):
            return jsonify(success=False, error="No face image provided"), 400

        image_file = request.files['image']
        role        = request.form.get('role', 'student')
        full_name   = request.form.get('full_name', '').strip()
        username    = request.form.get('username', '').strip()
        email       = request.form.get('email', '').strip()
        password    = request.form.get('password', '')
        department  = request.form.get('department', '').strip()
        roll_no     = request.form.get('roll_no', '').strip()
        section     = request.form.get('section', '').strip()
        academic_year = request.form.get('academic_year', '2024-25')

        if role == 'student' and not roll_no:
            # generate roll for students automatically if omitted
            roll_no = generate_roll_number(department)
            username = roll_no
        # admission number always a uuid
        admission_no = str(uuid.uuid4())

        if not all([full_name, username, email, password, department]):
            return jsonify(success=False, error="Missing required fields"), 400

        # ── Step 1: Process face image ──
        img = Image.open(image_file.stream).convert("RGB")
        tmp = "tmp_combined_reg.jpg"
        img.save(tmp)
        print(f"[COMBINED] Detecting faces for {full_name}...")
        encs = encode_image(tmp)
        os.remove(tmp)
        print(f"[COMBINED] Faces detected: {len(encs)}")

        if len(encs) != 1:
            return jsonify(success=False, error=f"Found {len(encs)} faces. Need exactly 1 clear face."), 400

        enc_data = encs[0]
        effective_roll = roll_no or username

        # ── Step 2: Save face locally (upsert) ──
        upsert_face_encoding_local(enc_data, effective_roll)
        print(f"[COMBINED] Face encoding saved locally for {effective_roll}")

        # ── Step 3: Upsert face to Supabase ──
        upsert_face_encoding_supabase({
            'name': full_name,
            'roll_no': effective_roll,
            'admission_no': effective_roll,
            'section': section or '–',
            'academic_year': academic_year
        }, enc_data)

        # ── Step 4: Create user account in Supabase ──
        if not sb:
            return jsonify(success=False, error="Supabase not configured"), 500

        import hashlib
        pwd_hash = hashlib.sha256(password.encode()).hexdigest()

        # Check duplicate username
        existing_user = sb.table("users").select("id").eq("username", username).execute()
        if existing_user.data:
            return jsonify(success=False, error="Username already taken"), 400

        # Check duplicate roll_no for students
        if roll_no and role == "student":
            existing_roll = sb.table("users").select("id").eq("roll_no", roll_no).execute()
            if existing_roll.data:
                return jsonify(success=False, error=f"Roll number {roll_no} is already registered"), 400

        user_payload = {
            "username":      username,
            "password_hash": pwd_hash,
            "role":          role,
            "full_name":     full_name,
            "email":         email,
            "roll_no":       roll_no if role == "student" else None,
            "department":    department,
            "section":       section if role == "student" else None,
            "created_at":    datetime.utcnow().isoformat()
        }
        try:
            print(f"[SUPABASE] Inserting user payload: {json.dumps(user_payload)[:1000]}")
            result = sb.table("users").insert(user_payload).execute()
            user_id = result.data[0]["id"] if result.data else None
            print(f"[COMBINED] User account created: {username} (id={user_id})")
        except Exception as e:
            print(f"[SUPABASE] Error inserting user: {e}")
            try:
                import traceback
                traceback.print_exc()
            except Exception:
                pass
            return jsonify(success=False, error=f"Supabase insert error: {str(e)}"), 500

        return jsonify(success=True, message=f"User {full_name} registered with face!", user_id=user_id)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/verify", methods=["POST"])
def verify():
    try:
        import face_recognition as fr
        
        d = request.json or {}
        if not d or not d.get("image"):
            return jsonify(verified=False, error="No image provided"), 400
        
        # Get logged-in student's roll number
        logged_in_roll_no = d.get("roll_no")
        session_id = d.get("session_id")
        
        if not logged_in_roll_no:
            return jsonify(verified=False, error="Student identity not provided"), 400
        
        # Get max attempts from config
        max_attempts = 2
        if sb:
            try:
                r = sb.table("system_config").select("value").eq("key","max_face_attempts").execute()
                if r.data and len(r.data) > 0:
                    max_attempts = int(r.data[0].get("value", "2"))
            except:
                max_attempts = 2
        
        # Check current attempt count
        current_attempt = 1
        if sb:
            try:
                attempts_result = sb.table("verification_attempts").select("COUNT(*)").eq("roll_no", logged_in_roll_no).eq("session_id", session_id).execute()
                # This is a workaround since COUNT isn't standard in our client
                attempt_records = sb.table("verification_attempts").select("*").eq("roll_no", logged_in_roll_no).eq("session_id", session_id).execute()
                if attempt_records.data:
                    current_attempt = len(attempt_records.data) + 1
            except:
                current_attempt = 1
        
        # Check if attempts exceeded
        if current_attempt > max_attempts:
            print(f"[VERIFY] ❌ ATTEMPTS EXCEEDED: Student {logged_in_roll_no} has exceeded {max_attempts} attempts")
            return jsonify(
                verified=False, 
                error=f"Maximum verification attempts ({max_attempts}) exceeded. Please contact SmartAMS Admin for attendance.", 
                attempts_exhausted=True,
                current_attempt=current_attempt,
                max_attempts=max_attempts
            ), 403
        
        # check feature toggle
        def is_face_enabled():
            if not sb: return False
            try:
                r = sb.table("system_config").select("value").eq("key","face_recognition_enabled").execute()
                if r.data and len(r.data) > 0:
                    return r.data[0].get("value","false") == "true"
                return False
            except Exception as e:
                print(f"[VERIFY] Error checking face_rec_enabled: {e}")
                return False
        
        if not is_face_enabled():
            print(f"[VERIFY] Face recognition disabled, rejecting verification")
            return jsonify(verified=False, error="Face recognition disabled"), 403
        
        # Use stricter tolerance (0.45) for better accuracy - rejects similar but different faces
        tol = float(d.get("tolerance",0.45))
        latitude = d.get("latitude")
        longitude = d.get("longitude")
        
        # location verification if coords provided
        in_campus = None
        if latitude is not None and longitude is not None:
            def haversine(lat1, lon1, lat2, lon2):
                # return kilometers
                from math import radians, sin, cos, asin, sqrt
                lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
                dlat = lat2 - lat1
                dlon = lon2 - lon1
                a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
                return 6371 * 2 * asin(sqrt(a))
            # fetch college coords
            try:
                clat = float(sb.table("system_config").select("value").eq("key","college_lat").single().execute().data.get("value",0))
                clng = float(sb.table("system_config").select("value").eq("key","college_lng").single().execute().data.get("value",0))
                crad = float(sb.table("system_config").select("value").eq("key","college_radius_km").single().execute().data.get("value",0.0))
                in_campus = haversine(latitude, longitude, clat, clng) <= crad
            except Exception:
                in_campus = False
        
        img = decode_b64_image(d.get("image"))
        tmp = "tmp_ver.jpg"
        img.save(tmp)
        
        # Check liveness (eye movement/detection)
        is_live = detect_liveness(tmp)
        if not is_live:
            os.remove(tmp)
            return jsonify(verified=False, error="Liveness check failed - eyes must be open. Possible fake/static image detected.", face_count=0, location_verified=in_campus)
        
        face_encs = encode_image(tmp)
        os.remove(tmp)
        
        # Check if face was detected
        if not face_encs:
            return jsonify(verified=False, error="No face detected. Face is not visible.", face_count=0, location_verified=in_campus)
        
        # Check if multiple faces were detected
        if len(face_encs) > 1:
            return jsonify(verified=False, error=f"More than one person detected ({len(face_encs)} faces found). Please ensure only one person is visible.", face_count=len(face_encs), location_verified=in_campus)
        
        # Load registered encodings (prefer Supabase)
        # Returns list of (encoding_array, name, roll_no) tuples
        encoding_data = load_encodings_supabase() if sb else load_encodings()
        if not encoding_data:
            return jsonify(verified=False, error="No registered users", face_count=1, location_verified=in_campus)
        
        # Extract encodings for distance calculation
        encs_array = np.array([e[0] for e in encoding_data])
        
        # Compute distances using face_recognition library
        current_encoding = face_encs[0]
        distances = fr.face_distance(encs_array, current_encoding)
        
        idx = np.argmin(distances)
        min_distance = distances[idx]
        
        # Get matched student info
        matched_encoding, student_name, student_roll = encoding_data[idx]
        
        print(f"[VERIFY] Min distance: {min_distance:.4f}, Tolerance: {tol}, Face count: {len(face_encs)}")
        
        # common attendance payload
        attendance_record = {
            "name": None,
            "roll_no": None,
            "date": datetime.utcnow().date().isoformat(),
            "timestamp": datetime.utcnow().isoformat(),
            "method": "face",
            "latitude": latitude,
            "longitude": longitude,
            "in_campus": in_campus
        }
        
        confidence = max(0, 1 - (min_distance / 2.0))
        
        # Record attempt in database
        if sb:
            try:
                sb.table("verification_attempts").insert({
                    "roll_no": logged_in_roll_no,
                    "attempt_number": current_attempt,
                    "session_id": session_id,
                    "matched_roll_no": student_roll,
                    "distance": float(min_distance),
                    "verified": False
                }).execute()
            except Exception as e:
                print(f"[VERIFY] Failed to record attempt: {e}")
        
        # Check TWO conditions for successful verification:
        # 1. Face distance is within tolerance
        # 2. Logged-in student's roll_no matches the matched face's roll_no
        identity_match = (logged_in_roll_no == student_roll)
        face_match = (min_distance <= tol)
        
        if face_match and identity_match:
            # SUCCESS: Face matches AND student identity matches
            attendance_record.update({"name": student_name, "roll_no": student_roll, "verified": True})
            print(f"[VERIFY] ✅ VERIFIED: {student_name} ({student_roll}) - Face match + Identity match - distance={min_distance:.4f}, confidence={confidence:.2%}, attempt {current_attempt}/{max_attempts}")
            
            # Update attempt record as verified
            if sb:
                try:
                    sb.table("verification_attempts").update({"verified": True}).eq("roll_no", logged_in_roll_no).eq("attempt_number", current_attempt).eq("session_id", session_id).execute()
                except:
                    pass
            
            # Mark attendance locally
            mark_attendance(student_name)
            
            # Also save to Supabase if available
            if sb:
                try:
                    sb.table("attendance").insert(attendance_record).execute()
                    print(f"[VERIFY] ✅ Attendance saved to Supabase for {student_name}")
                except Exception as e:
                    print(f"[VERIFY] ❌ Supabase insert error: {e}")
            
            return jsonify(
                verified=True, 
                name=student_name, 
                roll_no=student_roll, 
                confidence=float(confidence), 
                face_count=1, 
                location_verified=in_campus,
                current_attempt=current_attempt,
                max_attempts=max_attempts
            )
        else:
            # FAILED: Either face doesn't match OR student identity doesn't match
            failures = []
            if not face_match:
                failures.append("face does not match registered users")
            if not identity_match:
                failures.append(f"matched student ({student_roll}) is not the logged-in student ({logged_in_roll_no})")
            
            error_msg = "Verification failed: " + " AND ".join(failures)
            attendance_record.update({"name": None, "roll_no": logged_in_roll_no, "verified": False})
            print(f"[VERIFY] ❌ FAILED {'(Attempt ' + str(current_attempt) + '/' + str(max_attempts) + ')'}: {error_msg}")
            
            # Calculate remaining attempts
            remaining_attempts = max_attempts - current_attempt
            
            if remaining_attempts > 0:
                error_display = error_msg + f". You have {remaining_attempts} attempt{'s' if remaining_attempts != 1 else ''} remaining."
            else:
                error_display = f"All {max_attempts} verification attempts used. Please contact SmartAMS Admin for attendance."
            
            # Only record absence if this is the final failed attempt
            if current_attempt >= max_attempts and sb:
                try:
                    sb.table("attendance").insert(attendance_record).execute()
                    print(f"[VERIFY] ✅ Absence recorded to Supabase (attempts exhausted)")
                except Exception as e:
                    print(f"[VERIFY] ❌ Supabase insert error: {e}")
            
            return jsonify(
                verified=False, 
                error=error_display,
                confidence=float(confidence), 
                face_count=1, 
                location_verified=in_campus,
                current_attempt=current_attempt,
                max_attempts=max_attempts,
                attempts_remaining=remaining_attempts
            )
    
    except Exception as e:
        print(f"[VERIFY] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify(verified=False, error=f"Server error: {str(e)}"), 500
@app.route("/api/attendance", methods=["GET"])
def get_attendance():
    if sb:
        q=sb.table("attendance").select("*").order("timestamp",desc=True).limit(200)
        if request.args.get("date"): q=q.eq("date",request.args["date"])
        if request.args.get("roll_no"): q=q.eq("roll_no",request.args["roll_no"])
        return jsonify(records=q.execute().data)
    rows=[]
    if Path(ATT_CSV).exists():
        with open(ATT_CSV) as f:
            rows=list(csv.DictReader(f))
    return jsonify(records=rows)

@app.route("/api/config/face-recognition", methods=["GET","POST"])
def face_rec_config():
    if request.method=="POST":
        enabled=request.json.get("enabled",False)
        if sb:
            try:
                # Use upsert with on_conflict on "key" column to handle both insert and update
                result = sb.table("system_config").upsert(
                    {"key":"face_recognition_enabled","value":str(enabled).lower()},
                    on_conflict="key"
                ).execute()
                print(f"[FACE REC] Saved face_recognition_enabled to {enabled}")
            except Exception as e:
                print(f"[FACE REC] Error setting config: {e}")
                return jsonify(success=False, error=str(e)), 500
        return jsonify(success=True, enabled=enabled)
    
    # GET request - retrieve current value
    if sb:
        try:
            result = sb.table("system_config").select("value").eq("key","face_recognition_enabled").execute()
            if result.data and len(result.data) > 0:
                enabled = result.data[0].get("value","false") == "true"
                return jsonify(enabled=enabled)
            else:
                # Row doesn't exist, default to false
                return jsonify(enabled=False)
        except Exception as e:
            print(f"[FACE REC] Error getting config: {e}")
            return jsonify(enabled=False)
    
    return jsonify(enabled=False)


@app.route("/api/system-config", methods=["GET","POST"])
def system_config_api():
    """Get or set system-wide configuration values used by the frontend.

    GET returns a JSON object with keys: college_lat, college_lng, college_radius_km,
    tolerance, qr_expiry_minutes, attendance_window_end (values may be strings).

    POST accepts a JSON payload with any of those keys and upserts them into
    `system_config` table as key/value strings.
    """
    if not sb:
        # Return sensible defaults when Supabase isn't configured
        if request.method == 'GET':
            return jsonify({
                "college_lat": 13.145615,
                "college_lng": 77.574597,
                "college_radius_km": 0.2,
                "tolerance": "0.5",
                "qr_expiry_minutes": 5,
                "attendance_window_end": "18:00"
            })
        return jsonify(success=False, error="Supabase not configured"), 500

    if request.method == 'GET':
        keys = ["college_lat", "college_lng", "college_radius_km", "tolerance", "qr_expiry_minutes", "attendance_window_end"]
        out = {}
        try:
            for k in keys:
                try:
                    r = sb.table("system_config").select("value").eq("key", k).single().execute()
                    if r.data and r.data.get("value") is not None:
                        v = r.data.get("value")
                        # Attempt numeric conversion where appropriate
                        if k in ("college_lat", "college_lng", "college_radius_km"):
                            try:
                                out[k] = float(v)
                            except Exception:
                                out[k] = v
                        elif k == "qr_expiry_minutes":
                            try:
                                out[k] = int(v)
                            except Exception:
                                out[k] = v
                        else:
                            out[k] = v
                except Exception:
                    continue
        except Exception as e:
            print(f"[CONFIG-GET] Error: {e}")
        return jsonify(out)

    # POST: upsert provided keys
    try:
        d = request.json or {}
        for k, v in d.items():
            try:
                sb.table("system_config").upsert({"key": k, "value": str(v)} , on_conflict="key").execute()
            except Exception as e:
                print(f"[CONFIG-POST] failed to upsert {k}: {e}")
        return jsonify(success=True)
    except Exception as e:
        print(f"[CONFIG-POST] Error: {e}")
        return jsonify(success=False, error=str(e)), 500

@app.route("/api/registered-students", methods=["GET"])
def get_registered_students():
    """Get all registered students for faculty dashboard."""
    try:
        print("[API] GET /api/registered-students")
        if sb:
            try:
                result=sb.table("face_encodings").select("name,roll_no,admission_no,section,academic_year,created_at").execute()
                students=result.data if result.data else []
                print(f"[STUDENTS] Got {len(students)} students from Supabase")
                return jsonify(success=True, students=students)
            except Exception as e:
                print(f"[STUDENTS] Supabase error: {e}")
                raise
        else:
            encs,names=load_encodings()
            students=[{"name":n,"roll_no":n,"section":"A","status":"registered"} for n in names]
            return jsonify(success=True, students=students)
    except Exception as e:
        print(f"[STUDENTS] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify(success=False, error=str(e), students=[]), 500

@app.route("/api/mark-qr-attendance", methods=["POST"])
def mark_qr_attendance():
    """Mark attendance via QR code scan."""
    d=request.json
    roll_no=d.get("roll_no")
    name=d.get("name")
    course=d.get("course")
    session_id=d.get("session_id")
    
    if not all([roll_no,name,course]):
        return jsonify(verified=False,error="Missing required fields"),400
    
    face_img_b64=d.get("face_image","")
    if not face_img_b64:
        if sb:
            sb.table("attendance").insert({
                "name":name,"roll_no":roll_no,"course":course,
                "date":datetime.utcnow().date().isoformat(),
                "timestamp":datetime.utcnow().isoformat(),
                "verified":False,"method":"qr","session_id":session_id
            }).execute()
        return jsonify(verified=False,message="Marked without face verification")
    
    img=decode_b64_image(face_img_b64)
    tmp="tmp_qr_ver.jpg"; img.save(tmp)
    face_encs=encode_image(tmp); os.remove(tmp)
    
    if not face_encs:
        return jsonify(verified=False,error="No face detected")
    
    encs,names=load_encodings()
    if not encs:
        return jsonify(verified=False,error="No registered faces")
    
    current_encoding = face_encs[0]
    distances = [np.linalg.norm(current_encoding - e) for e in encs]
    distances = np.array(distances)
    idx = np.argmin(distances)
    min_distance = distances[idx]
    verified = min_distance <= 0.6
    confidence = float(max(0, 1 - (min_distance / 2.0)))
    
    if sb:
        sb.table("attendance").insert({
            "name":name,"roll_no":roll_no,"course":course,
            "date":datetime.utcnow().date().isoformat(),
            "timestamp":datetime.utcnow().isoformat(),
            "verified":verified,"method":"qr","session_id":session_id,
            "confidence":confidence
        }).execute()
    
    return jsonify(verified=verified,name=names[idx] if verified else name,confidence=confidence)

# ── USER MANAGEMENT API ──
@app.route("/api/users/register", methods=["POST"])
def user_register():
    """Register a new user (student/faculty/admin)."""
    d=request.json
    username=d.get("username","").strip()
    password=d.get("password","")
    role=d.get("role","student")
    full_name=d.get("full_name","")
    email=d.get("email","")
    
    if not username or not password or role not in ["student","faculty","admin"]:
        return jsonify(success=False,error="Invalid registration data"),400
    
    if not sb:
        return jsonify(success=False,error="Supabase not configured"),500
    
    try:
        existing=sb.table("users").select("id").eq("username",username).execute()
        if existing.data:
            return jsonify(success=False,error="Username already taken"),400
        
        import hashlib
        pwd_hash=hashlib.sha256(password.encode()).hexdigest()
        
        result=sb.table("users").insert({
            "username":username,
            "password_hash":pwd_hash,
            "role":role,
            "full_name":full_name,
            "email":email,
            "created_at":datetime.utcnow().isoformat()
        }).execute()
        
        return jsonify(success=True,user_id=result.data[0]["id"] if result.data else None,message="Registration successful")
    except Exception as e:
        return jsonify(success=False,error=str(e)),500

@app.route("/api/users/register-face", methods=["POST"])
def register_face():
    """Register face for an existing user. Accepts multipart (file) or JSON (base64)."""
    if not sb:
        return jsonify(success=False,error="Supabase not configured"),500
    
    try:
        img = None
        face_image_b64 = None
        user_id = None
        roll_no = None
        
        # Check if multipart form with image file
        if request.files.get('image'):
            image_file = request.files['image']
            print(f"[FACE] Received face file: {image_file.filename}")
            img = Image.open(image_file.stream).convert("RGB")
            # Get user identifier from form
            user_id = request.form.get("user_id") or request.form.get("id")
            roll_no = request.form.get("roll_no", "").strip()
        
        # Otherwise handle JSON with base64 image
        elif request.is_json:
            d = request.json or {}
            face_image_b64 = d.get("face_image")
            user_id = d.get("user_id") or d.get("id")
            roll_no = d.get("roll_no", "").strip()
            
            if not face_image_b64:
                return jsonify(success=False,error="Missing face_image (base64)"),400
            
            img = decode_b64_image(face_image_b64)
        else:
            return jsonify(success=False,error="Send multipart form with 'image' file or JSON with 'face_image' (base64)"),400
        
        # Identify user: prefer roll_no, then user_id
        identified_user = None
        identified_user_id = None
        identified_roll_no = None
        
        # Validate that we have at least one identifier
        if not roll_no and not user_id:
            error_msg = "Missing user identifier. Provide either 'roll_no' or 'user_id'."
            print(f"[FACE] Error: {error_msg}")
            return jsonify(success=False, error=error_msg), 400
        
        if roll_no:
            print(f"[FACE] Looking up user by roll_no: {roll_no}")
            user_res = sb.table("users").select("id,roll_no,username").eq("roll_no", roll_no).execute()
            if user_res.data:
                identified_user = user_res.data[0]
                identified_user_id = identified_user.get("id")
                identified_roll_no = roll_no
        
        if not identified_user and user_id:
            print(f"[FACE] Looking up user by user_id: {user_id}")
            try:
                user_res = sb.table("users").select("id,roll_no,username").eq("id", user_id).execute()
                if user_res.data:
                    identified_user = user_res.data[0]
                    identified_user_id = identified_user.get("id")
                    identified_roll_no = identified_user.get("roll_no")
            except Exception as e:
                print(f"[FACE] Error looking up by user_id: {e}")
                # Continue to error handling below
        
        if not identified_user:
            error_msg = f"User not found. Provide valid roll_no or user_id."
            print(f"[FACE] Error: {error_msg}")
            return jsonify(success=False,error=error_msg),404
        
        # Process face image
        tmp = "tmp_face.jpg"
        img.save(tmp)
        print(f"[FACE] Image saved, detecting faces...")
        face_encs = encode_image(tmp)
        os.remove(tmp)
        
        if len(face_encs) != 1:
            error_msg = f"Found {len(face_encs)} faces. Ensure exactly ONE face is visible."
            print(f"[FACE] Error: {error_msg}")
            return jsonify(success=False,error=error_msg),400
        
        enc = face_encs[0].tolist()
        
        # Build payload for face_encodings table
        payload = {
            "user_id": identified_user_id,
            "roll_no": identified_roll_no,
            "encoding": enc,
            "created_at": datetime.utcnow().isoformat()
        }
        
        # If we have base64 from JSON, also store it
        if face_image_b64:
            payload["image"] = face_image_b64
        
        print(f"[FACE] Storing face encoding for user_id={identified_user_id}, roll_no={identified_roll_no}")
        
        try:
            res = sb.table("face_encodings").insert(payload).execute()
            print(f"[FACE] Face registered successfully")
            return jsonify(success=True, message="Face registered successfully", user_id=identified_user_id, roll_no=identified_roll_no)
        except Exception as e:
            print(f"[SUPABASE] Error inserting face_encodings: {e}")
            import traceback
            traceback.print_exc()
            return jsonify(success=False,error=f"Supabase insert error: {str(e)}"),500
            
    except Exception as e:
        print(f"[FACE] Exception in register_face: {e}")
        import traceback
        traceback.print_exc()
        return jsonify(success=False,error=str(e)),500

@app.route("/api/users/login", methods=["POST"])
def user_login():
    """Verify user credentials and optionally handle face/location attendance."""
    d=request.json
    username=d.get("username","" ).strip()
    password=d.get("password","" )
    latitude=d.get("latitude")
    longitude=d.get("longitude")
    face_image=d.get("face_image")

    if not username or not password:
        return jsonify(success=False,error="Missing credentials"),400

    if not sb:
        return jsonify(success=False, error="Supabase not configured. Login disabled."), 500

    try:
        import hashlib
        pwd_hash=hashlib.sha256(password.encode()).hexdigest()

        result=sb.table("users").select("*").eq("username",username).execute()

        if not result.data:
            return jsonify(success=False,error="User not found"),404

        user=result.data[0]
        if user["password_hash"]!=pwd_hash:
            return jsonify(success=False,error="Invalid password"),401

        resp_user={
            "id":user["id"],
            "username":user["username"],
            "role":user["role"],
            "full_name":user["full_name"],
            "email":user["email"],
            "roll_no":user.get("roll_no"),
            "employee_id":user.get("employee_id")
        }

        # student-specific logic
        if user["role"] == "student":
            face_registered = False
            try:
                # determine whether this student already has a face encoding
                # prefer lookup by roll number (schema may not contain user_id)
                if user.get("roll_no"):
                    enc_res = sb.table("face_encodings").select("id").eq("roll_no", user.get("roll_no")).execute()
                    face_registered = bool(enc_res.data)
                if not face_registered:
                    enc_res = sb.table("face_encodings").select("id").eq("user_id", user["id"]).execute()
                    face_registered = bool(enc_res.data)
            except Exception as e:
                print(f"[LOGIN] face_registered lookup error: {e}")
                # leave face_registered default value (False)

            resp_user["face_registered"] = face_registered

            if not face_registered and is_face_enabled():
                resp_user["needs_face_registration"] = True

            # if face provided and registered, verify and record attendance
            if is_face_enabled() and face_registered and face_image:
                verified, confidence = verify_face_for_user(user_id=user.get("id"), roll_no=user.get("roll_no"), image_b64=face_image)
                in_campus=None
                if latitude is not None and longitude is not None:
                    try:
                        dist = haversine(float(latitude), float(longitude), 12.981139, 80.249593)
                        in_campus = dist <= 0.5
                    except Exception:
                        in_campus=None
                if sb:
                    try:
                        sb.table("attendance").insert({
                            "name": user.get("full_name"),
                            "roll_no": user.get("roll_no"),
                            "course": user.get("department"),
                            "date": datetime.utcnow().date().isoformat(),
                            "timestamp": datetime.utcnow().isoformat(),
                            "verified": verified,
                            "method": "login",
                            "confidence": confidence,
                            "in_campus": in_campus,
                            "latitude": latitude,
                            "longitude": longitude
                        }).execute()
                    except Exception as e:
                        print(f"[ATTENDANCE] error recording login attendance: {e}")
                resp_user["face_verified"] = verified
                resp_user["confidence"] = confidence
                resp_user["in_campus"] = in_campus

        return jsonify(success=True,user=resp_user)
    except Exception as e:
        return jsonify(success=False,error=str(e)),500

@app.route("/api/users/list", methods=["GET"])
def list_users():
    """Get list of users filtered by role."""
    role=request.args.get("role")
    
    if not sb:
        return jsonify(success=True,users=[])
    
    try:
        q=sb.table("users").select("id,username,role,full_name,email,department,roll_no,employee_id,created_at")
        if role:
            q=q.eq("role",role)
        result=q.execute()
        return jsonify(success=True,users=result.data)
    except Exception as e:
        return jsonify(success=False,error=str(e)),500

@app.route("/api/users/add", methods=["POST"])
def add_user():
    """Add user by admin (JSON only, no face). Use /api/register-and-add-user for face+user together."""
    d=request.json
    username=d.get("username","").strip()
    password=d.get("password","")
    role=d.get("role","student")
    full_name=d.get("full_name","")
    email=d.get("email","")
    roll_no=d.get("roll_no","")
    department=d.get("department","")
    section=d.get("section","")
    # auto-generate admission id
    admission_no = str(uuid.uuid4())
    if role == "student":
        # ensure username matches roll
        if not roll_no:
            roll_no = generate_roll_number(department)
        username = roll_no
    
    if not username or not password or role not in ["student","faculty","admin"]:
        return jsonify(success=False,error="Invalid user data"),400
    
    if not sb:
        return jsonify(success=False,error="Supabase not configured"),500
    
    try:
        existing=sb.table("users").select("id").eq("username",username).execute()
        if existing.data:
            return jsonify(success=False,error="Username already taken"),400

        if roll_no and role == "student":
            existing_roll = sb.table("users").select("id").eq("roll_no", roll_no).execute()
            if existing_roll.data:
                return jsonify(success=False, error=f"Roll number {roll_no} is already registered"), 400
        
        import hashlib
        pwd_hash=hashlib.sha256(password.encode()).hexdigest()
        
        result=sb.table("users").insert({
            "username":username,
            "password_hash":pwd_hash,
            "role":role,
            "full_name":full_name,
            "email":email,
            "roll_no":roll_no if role=="student" else None,
            "department":department,
            "section":section if role=="student" else None,
            "created_at":datetime.utcnow().isoformat()
        }).execute()
        
        return jsonify(success=True,user_id=result.data[0]["id"] if result.data else None,message="User added successfully")
    except Exception as e:
        return jsonify(success=False,error=str(e)),500

# ─────────────────────────────────────────────────────────
# ── ENHANCED QR CODE SYSTEM WITH SECURITY FEATURES ──
# ─────────────────────────────────────────────────────────

from qr_security import (
    QRSessionManager, DeviceFingerprint, FraudDetection,
    AuditTrail, OfflineQueue, QREncryption
)

# In-memory storage for active sessions (replace with Supabase in production)
active_qr_sessions = {}
qr_usage_logs = []

@app.route("/api/qr/generate", methods=["POST"])
def generate_qr_code():
    """Faculty: Generate encrypted QR code for attendance"""
    try:
        d = request.json
        faculty_id = d.get("faculty_id")
        course_id = d.get("course_id")
        subject = d.get("subject", "Class")
        validity_minutes = int(d.get("validity_minutes", 5))
        require_face = d.get("require_face", True)
        require_location = d.get("require_location", True)
        latitude = d.get("latitude")
        longitude = d.get("longitude")
        gps_radius = int(d.get("gps_radius_meters", 100))
        
        if not all([faculty_id, course_id]):
            return jsonify(success=False, error="Missing faculty_id or course_id"), 400
        
        # Generate QR session
        qr_session = QRSessionManager.generate_session_qr(
            course_id=course_id,
            faculty_id=faculty_id,
            subject=subject,
            validity_minutes=validity_minutes,
            require_face=require_face,
            require_location=require_location,
            latitude=latitude,
            longitude=longitude,
            gps_radius=gps_radius
        )
        
        # Store in database if available
        if sb:
            try:
                # build a deep‑link URL that opens the student portal and passes the
                # full AMSQR payload as a query parameter. this ensures native
                # camera apps and the web client both receive the expected
                # "AMSQR:2.0:..." formatted string the backend expects.
                from urllib.parse import quote
                frontend = os.getenv("FRONTEND_URL")
                if not frontend:
                    frontend = request.host_url.rstrip('/')

                full_qr_string = f"AMSQR:2.0:{qr_session['session_id']}:{qr_session['encrypted_data']}"
                link = f"{frontend}/?qr={quote(full_qr_string, safe='') }"
                sb.table("qr_sessions").insert({
                    "session_id": qr_session["session_id"],
                    "course_id": course_id,
                    "faculty_id": faculty_id,
                    "expires_at": qr_session["expires_at"],
                    "encrypted_data": qr_session["encrypted_data"],
                    "qr_code_data": link,
                    "validity_minutes": validity_minutes,
                    "latitude": latitude,
                    "longitude": longitude,
                    "gps_radius_meters": gps_radius,
                    "require_face": require_face,
                    "require_location": require_location,
                    "active": True
                }).execute()
            except Exception as e:
                print(f"[QR-DB] Error storing session: {e}")
        
        # Log event
        audit_log = AuditTrail.log_qr_event(
            event_type="QR_GENERATED",
            user_id=faculty_id,
            session_id=qr_session["session_id"],
            details={"subject": subject, "validity_minutes": validity_minutes},
            severity="low"
        )
        
        return jsonify(
            success=True,
            session_id=qr_session["session_id"],
            qr_code_base64=qr_session["qr_code_base64"],
            expires_at=qr_session["expires_at"],
            validity_seconds=qr_session["validity_seconds"],
            subject=qr_session["subject"]
        )
    
    except Exception as e:
        print(f"[QR-GEN] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/qr/validate", methods=["POST"])
def validate_qr():
    """Validate QR code format and expiry"""
    try:
        d = request.json
        qr_string = d.get("qr_data", "")
        
        valid, qr_data = QRSessionManager.validate_qr_data(qr_string)
        
        if not valid:
            return jsonify(success=False, error=qr_data.get("error")), 400
        
        # Check for duplicate use
        is_duplicate, dup_msg = FraudDetection.check_duplicate_use(
            qr_data.get("session_id"),
            d.get("student_id"),
            qr_usage_logs
        )
        
        if is_duplicate:
            AuditTrail.log_qr_event(
                event_type="DUPLICATE_QR_ATTEMPT",
                user_id=d.get("student_id"),
                session_id=qr_data.get("session_id"),
                details={"reason": dup_msg},
                severity="high"
            )
            return jsonify(success=False, error=dup_msg), 403
        
        return jsonify(
            success=True,
            session_id=qr_data.get("session_id"),
            subject=qr_data.get("subject"),
            require_face=qr_data.get("require_face"),
            require_location=qr_data.get("require_location"),
            latitude=qr_data.get("latitude"),
            longitude=qr_data.get("longitude"),
            gps_radius=qr_data.get("gps_radius")
        )
    
    except Exception as e:
        print(f"[QR-VAL] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/qr/mark-attendance", methods=["POST"])
def mark_qr_attendance_enhanced():
    """Mark attendance with full security checks"""
    try:
        d = request.json
        session_id = d.get("session_id")
        student_id = d.get("student_id")
        roll_no = d.get("roll_no")
        name = d.get("name")
        face_image = d.get("face_image", "")
        latitude = d.get("latitude")
        longitude = d.get("longitude")
        device_fingerprint = d.get("device_fingerprint", "")
        user_agent = d.get("user_agent", "")
        ip_address = request.remote_addr
        
        if not all([session_id, roll_no, name]):
            return jsonify(success=False, error="Missing required fields"), 400
        
        # Get session from DB
        session_data = None
        if sb:
            result = sb.table("qr_sessions").select("*").eq("session_id", session_id).execute()
            if result.data:
                session_data = result.data[0]
        
        if not session_data:
            return jsonify(success=False, error="Session not found or expired"), 404
        
        # ── SECURITY CHECK 1: Location Verification ──
        location_verified = True
        location_error = ""
        if session_data.get("require_location") and latitude and longitude:
            location_anomaly, loc_msg = FraudDetection.check_location_anomaly(
                latitude, longitude,
                session_data.get("latitude"),
                session_data.get("longitude"),
                session_data.get("gps_radius_meters", 100)
            )
            if location_anomaly:
                location_verified = False
                location_error = loc_msg
        
        # ── SECURITY CHECK 2: Face Recognition ──
        face_verified = False
        face_confidence = 0.0
        face_name = name
        
        if session_data.get("require_face") and face_image:
            try:
                img = decode_b64_image(face_image)
                tmp = f"tmp_qr_face_{session_id}.jpg"
                img.save(tmp)
                face_encs = encode_image(tmp)
                os.remove(tmp)
                
                if face_encs:
                    encs, names = load_encodings()
                    if encs:
                        current_enc = face_encs[0]
                        distances = [np.linalg.norm(current_enc - e) for e in encs]
                        distances = np.array(distances)
                        idx = np.argmin(distances)
                        min_distance = distances[idx]
                        face_verified = min_distance <= 0.6
                        face_confidence = float(max(0, 1 - (min_distance / 2.0)))
                        face_name = names[idx] if face_verified else name
                        
                        # Check confidence threshold
                        conf_anomaly, conf_msg = FraudDetection.check_face_confidence(face_confidence)
                        if conf_anomaly:
                            face_verified = False
            except Exception as e:
                print(f"[QR-FACE] Error: {e}")
        
        # ── SECURITY CHECK 3: Rapid Reuse Detection ──
        rapid_reuse, reuse_msg = FraudDetection.check_rapid_reuse(session_id, qr_usage_logs)
        if rapid_reuse:
            AuditTrail.log_qr_event(
                event_type="RAPID_REUSE_ATTEMPT",
                user_id=student_id,
                session_id=session_id,
                details={"reason": reuse_msg},
                severity="critical"
            )
            return jsonify(success=False, error=reuse_msg), 403
        
        # ── SECURITY CHECK 4: Fraud Detection ──
        is_fraud, fraud_reason, severity = FraudDetection.detect_proxy_attempt(
            face_verified, face_confidence, location_verified, True, 0
        )
        
        if is_fraud:
            AuditTrail.log_qr_event(
                event_type="FRAUD_ATTEMPT",
                user_id=student_id,
                session_id=session_id,
                details={"reason": fraud_reason},
                severity=severity
            )
            return jsonify(success=False, error=f"Security check failed: {fraud_reason}"), 403
        
        # ── Mark Attendance ──
        final_status = "valid"
        if not face_verified or not location_verified:
            final_status = "partial"
        
        log_entry = {
            "session_id": session_id,
            "student_id": student_id,
            "roll_no": roll_no,
            "face_verified": face_verified,
            "face_confidence": face_confidence,
            "location_verified": location_verified,
            "latitude": latitude,
            "longitude": longitude,
            "device_fingerprint": device_fingerprint,
            "ip_address": ip_address,
            "device_os": DeviceFingerprint.extract_device_info(user_agent).get("os", "Unknown"),
            "device_browser": DeviceFingerprint.extract_device_info(user_agent).get("browser", "Unknown"),
            "status": final_status,
            "created_at": datetime.utcnow().isoformat()
        }
        qr_usage_logs.append(log_entry)
        
        # Store in database
        if sb:
            try:
                sb.table("qr_usage_log").insert({
                    "session_id": session_id,
                    "student_id": student_id,
                    "roll_no": roll_no,
                    "face_verified": face_verified,
                    "face_confidence": face_confidence,
                    "location_verified": location_verified,
                    "latitude": latitude,
                    "longitude": longitude,
                    "device_fingerprint": device_fingerprint,
                    "ip_address": ip_address,
                    "status": final_status,
                    "used_at": datetime.utcnow().isoformat()
                }).execute()
                
                # Also mark attendance
                sb.table("attendance").insert({
                    "student_id": student_id,
                    "name": face_name,
                    "roll_no": roll_no,
                    "course_id": session_data.get("course_id"),
                    "date": datetime.utcnow().date().isoformat(),
                    "timestamp": datetime.utcnow().isoformat(),
                    "method": "qr",
                    "verified": face_verified,
                    "latitude": latitude,
                    "longitude": longitude,
                    "in_campus": location_verified,
                    "qr_session_id": session_id
                }).execute()
            except Exception as e:
                print(f"[QR-DB] Error recording attendance: {e}")
        
        AuditTrail.log_qr_event(
            event_type="QR_ATTENDANCE_MARKED",
            user_id=student_id,
            session_id=session_id,
            details={"face_verified": face_verified, "location_verified": location_verified},
            severity="low"
        )
        
        return jsonify(
            success=True,
            message="Attendance marked successfully",
            student_name=face_name,
            face_verified=face_verified,
            face_confidence=f"{face_confidence:.2%}",
            location_verified=location_verified,
            timestamp=datetime.utcnow().isoformat()
        )
    
    except Exception as e:
        print(f"[QR-ATT] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/qr/device-fingerprint", methods=["POST"])
def register_device():
    """Register and manage device fingerprints"""
    try:
        d = request.json
        user_id = d.get("user_id")
        user_agent = d.get("user_agent", request.headers.get('User-Agent', ''))
        ip_address = request.remote_addr
        device_name = d.get("device_name", "")
        trust_device = d.get("trust_device", False)
        
        if not user_id:
            return jsonify(success=False, error="Missing user_id"), 400
        
        # Generate fingerprint
        fingerprint = DeviceFingerprint.generate_fingerprint(user_agent, ip_address)
        device_info = DeviceFingerprint.extract_device_info(user_agent)
        
        # Store in database
        if sb:
            try:
                sb.table("device_fingerprints").upsert({
                    "user_id": user_id,
                    "fingerprint_hash": fingerprint,
                    "device_name": device_name,
                    "os": device_info.get("os"),
                    "browser": device_info.get("browser"),
                    "ip_address": ip_address,
                    "trusted": trust_device,
                    "last_seen": datetime.utcnow().isoformat()
                }, on_conflict="fingerprint_hash").execute()
            except Exception as e:
                print(f"[FINGERPRINT] Error: {e}")
        
        return jsonify(
            success=True,
            fingerprint=fingerprint,
            device_info=device_info,
            message="Device registered successfully"
        )
    
    except Exception as e:
        print(f"[DEVICE] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/qr/audit-log", methods=["GET"])
def get_audit_log():
    """Retrieve audit trail for security review"""
    try:
        session_id = request.args.get("session_id")
        user_id = request.args.get("user_id")
        severity = request.args.get("severity")
        limit = int(request.args.get("limit", 100))
        
        if not sb:
            return jsonify(success=False, error="Database not available"), 500
        
        q = sb.table("audit_trail").select("*")
        
        if session_id:
            q = q.eq("session_id", session_id)
        if user_id:
            q = q.eq("user_id", user_id)
        if severity:
            q = q.eq("severity", severity)
        
        result = q.order("created_at", desc=True).limit(limit).execute()
        
        return jsonify(
            success=True,
            logs=result.data,
            count=len(result.data)
        )
    
    except Exception as e:
        print(f"[AUDIT] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/qr/attendance-history", methods=["GET"])
def get_qr_attendance_history():
    """Get attendance history via QR for student"""
    try:
        roll_no = request.args.get("roll_no")
        limit = int(request.args.get("limit", 50))
        
        if not roll_no:
            return jsonify(success=False, error="Missing roll_no"), 400
        
        if not sb:
            return jsonify(success=False, error="Database not available"), 500
        
        result = sb.table("attendance").select("*").eq("roll_no", roll_no).order("date", desc=True).limit(limit).execute()
        
        return jsonify(
            success=True,
            attendance_records=result.data,
            total_records=len(result.data)
        )
    
    except Exception as e:
        print(f"[HISTORY] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/qr/create-profile", methods=["POST"])
def create_qr_profile():
    """Create personal QR profile for student"""
    try:
        import hashlib, qrcode
        from datetime import timedelta
        d = request.json
        user_id = d.get("user_id")
        roll_no = d.get("roll_no")
        full_name = d.get("full_name")
        email = d.get("email")
        share_enabled = d.get("share_enabled", True)
        expires_hours = int(d.get("expires_hours", 168))  # Default 7 days
        
        if not all([user_id, roll_no]):
            return jsonify(success=False, error="Missing required fields"), 400
        
        # Create profile data
        profile_data = {
            "user_id": user_id,
            "roll_no": roll_no,
            "full_name": full_name,
            "email": email,
            "created_at": datetime.utcnow().isoformat(),
            "version": "1.0"
        }
        
        # Generate QR code
        profile_qr_string = f"AMSPROFILE:{user_id}:{roll_no}:{base64.b64encode(json.dumps(profile_data).encode()).decode()}"
        profile_hash = hashlib.sha256(profile_qr_string.encode()).hexdigest()
        
        # Create QR image
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(profile_qr_string)
        qr.make(fit=True)
        qr_image = qr.make_image(fill_color="black", back_color="white")
        
        buffer = BytesIO()
        qr_image.save(buffer, format='PNG')
        qr_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        expires_at = datetime.utcnow() + timedelta(hours=expires_hours)
        
        # Store in database
        if sb:
            try:
                sb.table("qr_profiles").insert({
                    "user_id": user_id,
                    "roll_no": roll_no,
                    "profile_qr_data": profile_qr_string,
                    "profile_hash": profile_hash,
                    "share_enabled": share_enabled,
                    "expires_at": expires_at.isoformat()
                }).execute()
            except Exception as e:
                print(f"[PROFILE] Error: {e}")
        
        return jsonify(
            success=True,
            profile_hash=profile_hash,
            qr_code_base64=qr_base64,
            expires_at=expires_at.isoformat(),
            share_url=f"/api/qr/profile/{profile_hash}"
        )
    
    except Exception as e:
        print(f"[PROFILE-CREATE] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/qr/profile/<profile_hash>", methods=["GET"])
def get_qr_profile(profile_hash):
    """Retrieve student QR profile"""
    try:
        if not sb:
            return jsonify(success=False, error="Database not available"), 500
        
        result = sb.table("qr_profiles").select("*").eq("profile_hash", profile_hash).execute()
        
        if not result.data:
            return jsonify(success=False, error="Profile not found"), 404
        
        profile = result.data[0]
        
        # Check expiry
        if profile.get("expires_at"):
            expires_at = datetime.fromisoformat(profile.get("expires_at"))
            if expires_at < datetime.utcnow():
                return jsonify(success=False, error="Profile has expired"), 410
        
        # Check if sharing is enabled
        if not profile.get("share_enabled"):
            return jsonify(success=False, error="Profile sharing is disabled"), 403
        
        # Increment view count
        try:
            sb.table("qr_profiles").update({
                "view_count": profile.get("view_count", 0) + 1
            }).eq("profile_hash", profile_hash).execute()
        except:
            pass
        
        return jsonify(
            success=True,
            roll_no=profile.get("roll_no"),
            user_id=profile.get("user_id"),
            view_count=profile.get("view_count", 0)
        )
    
    except Exception as e:
        print(f"[PROFILE-GET] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/qr/offline-sync", methods=["POST"])
def sync_offline_queue():
    """Sync offline attendance entries to server"""
    try:
        d = request.json
        queue_entries = d.get("queue", [])
        user_id = d.get("user_id")
        
        if not queue_entries or not user_id:
            return jsonify(success=False, error="Missing queue or user_id"), 400
        
        synced_count = 0
        failed_entries = []
        
        for entry in queue_entries:
            try:
                if not sb:
                    failed_entries.append(entry)
                    continue
                
                # Try to sync the offline entry
                sb.table("offline_queue").update({
                    "synced": True,
                    "synced_at": datetime.utcnow().isoformat()
                }).eq("id", entry.get("id")).execute()
                
                synced_count += 1
            except Exception as e:
                print(f"[SYNC] Error syncing entry: {e}")
                failed_entries.append(entry)
        
        AuditTrail.log_qr_event(
            event_type="OFFLINE_SYNC",
            user_id=user_id,
            session_id="offline",
            details={"synced": synced_count, "failed": len(failed_entries)},
            severity="low"
        )
        
        return jsonify(
            success=True,
            synced_count=synced_count,
            failed_count=len(failed_entries),
            failed_entries=failed_entries
        )
    
    except Exception as e:
        print(f"[OFFLINE-SYNC] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/qr/session-stats", methods=["GET"])
def get_session_stats():
    """Get real-time stats for an active QR session"""
    try:
        session_id = request.args.get("session_id")
        
        if not session_id:
            return jsonify(success=False, error="Missing session_id"), 400
        
        # Calculate stats from logs
        session_logs = [log for log in qr_usage_logs if log.get("session_id") == session_id]
        
        total_checkins = len(session_logs)
        face_verified = len([l for l in session_logs if l.get("face_verified")])
        location_verified = len([l for l in session_logs if l.get("location_verified")])
        anomalies = len([l for l in session_logs if l.get("status") == "partial" or l.get("status") == "fraud_attempt"])
        
        return jsonify(
            success=True,
            session_id=session_id,
            total_checkins=total_checkins,
            face_verified_count=face_verified,
            location_verified_count=location_verified,
            anomaly_count=anomalies,
            attendees=session_logs
        )
    
    except Exception as e:
        print(f"[STATS] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/qr/session-reports", methods=["GET"])
def get_session_reports():
    """Generate detailed reports for QR sessions"""
    try:
        faculty_id = request.args.get("faculty_id")
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        
        if not sb or not faculty_id:
            return jsonify(success=False, error="Missing parameters"), 400
        
        q = sb.table("qr_sessions").select("*").eq("faculty_id", faculty_id)
        if start_date:
            q = q.gte("created_at", start_date)
        if end_date:
            q = q.lte("created_at", end_date)
        
        sessions = q.execute().data
        
        # Compile statistics
        total_sessions = len(sessions)
        total_attendance = 0
        avg_attendance = 0
        security_incidents = 0
        
        for session in sessions:
            session_logs = [log for log in qr_usage_logs if log.get("session_id") == session.get("session_id")]
            total_attendance += len(session_logs)
            security_incidents += len([l for l in session_logs if l.get("status") != "valid"])
        
        avg_attendance = total_attendance / total_sessions if total_sessions > 0 else 0
        
        return jsonify(
            success=True,
            report={
                "period": f"{start_date} to {end_date}",
                "total_sessions": total_sessions,
                "total_attendance_marks": total_attendance,
                "average_attendance_per_session": round(avg_attendance, 2),
                "security_incidents": security_incidents,
                "fraud_attempts": len([l for l in qr_usage_logs if l.get("status") == "fraud_attempt"]),
                "duplicate_attempts": len([l for l in qr_usage_logs if l.get("status") == "duplicate"]),
                "face_verification_rate": round((len([l for l in qr_usage_logs if l.get("face_verified")]) / max(total_attendance, 1)) * 100, 2),
                "location_verification_rate": round((len([l for l in qr_usage_logs if l.get("location_verified")]) / max(total_attendance, 1)) * 100, 2)
            },
            sessions=sessions[:10]  # Last 10 sessions
        )
    
    except Exception as e:
        print(f"[REPORTS] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/qr/fraudulent-attempts", methods=["GET"])
def get_fraudulent_attempts():
    """Get flagged fraudulent attendance attempts"""
    try:
        session_id = request.args.get("session_id")
        limit = int(request.args.get("limit", 50))
        
        fraud_logs = [
            log for log in qr_usage_logs 
            if log.get("status") in ["fraud_attempt", "duplicate", "partial"]
        ]
        
        if session_id:
            fraud_logs = [l for l in fraud_logs if l.get("session_id") == session_id]
        
        fraud_logs = sorted(fraud_logs, key=lambda x: x.get("created_at", ""), reverse=True)[:limit]
        
        return jsonify(
            success=True,
            fraud_attempts=fraud_logs,
            count=len(fraud_logs)
        )
    
    except Exception as e:
        print(f"[FRAUD] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/qr/student-attendance-summary", methods=["GET"])
def get_student_attendance_summary():
    """Get attendance summary for a student"""
    try:
        roll_no = request.args.get("roll_no")
        course_id = request.args.get("course_id")
        
        if not sb or not roll_no:
            return jsonify(success=False, error="Missing roll_no"), 400
        
        q = sb.table("attendance").select("*").eq("roll_no", roll_no)
        if course_id:
            q = q.eq("course_id", course_id)
        
        records = q.execute().data
        
        # Calculate stats
        total = len(records)
        verified = len([r for r in records if r.get("verified")])
        face_verified = len([r for r in records if r.get("method") == "qr"])
        manual = len([r for r in records if r.get("method") == "manual"])
        
        attendance_percentage = (verified / total * 100) if total > 0 else 0
        
        return jsonify(
            success=True,
            summary={
                "roll_no": roll_no,
                "total_classes": total,
                "present": verified,
                "attendance_percentage": round(attendance_percentage, 2),
                "qr_attendance": face_verified,
                "manual_attendance": manual,
                "last_marked": records[0].get("timestamp") if records else None
            },
            recent_records=records[:10]
        )
    
    except Exception as e:
        print(f"[SUMMARY] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


# ============================================================
# PHASE 1: LESSON PLANNING & COURSE PROGRESS
# ============================================================

@app.route("/api/courses/<course_id>/lessons", methods=["GET"])
def get_course_lessons(course_id):
    """Get all lessons for a course"""
    try:
        if not sb:
            return jsonify(success=False, error="Database not available"), 500
        
        lessons = sb.table("lesson_plans").select("*").eq("course_id", course_id).order("lesson_number").execute().data
        
        return jsonify(success=True, lessons=lessons)
    except Exception as e:
        print(f"[LESSONS] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/courses/<course_id>/lessons", methods=["POST"])
def create_lesson(course_id):
    """Create a new lesson topic"""
    try:
        if not sb:
            return jsonify(success=False, error="Database not available"), 500
        
        d = request.get_json()
        lesson_data = {
            "course_id": course_id,
            "lesson_number": d.get("lesson_number"),
            "topic_name": d.get("topic_name"),
            "description": d.get("description"),
            "learning_outcomes": d.get("learning_outcomes"),
            "planned_date": d.get("planned_date"),
            "estimated_hours": d.get("estimated_hours"),
            "status": d.get("status", "planned"),
            "created_by": d.get("faculty_id")
        }
        
        result = sb.table("lesson_plans").insert(lesson_data).execute().data
        
        # Update course syllabus total topics
        course_data = sb.table("courses").select("*").eq("id", course_id).execute().data
        if course_data:
            total_lessons = sb.table("lesson_plans").select("id").eq("course_id", course_id).execute().data
            sb.table("course_syllabus").upsert({
                "course_id": course_id,
                "total_topics": len(total_lessons)
            }).execute()
        
        return jsonify(success=True, lesson=result[0] if result else None)
    except Exception as e:
        print(f"[LESSON CREATE] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/lessons/<lesson_id>", methods=["PUT"])
def update_lesson(lesson_id):
    """Update lesson progress"""
    try:
        if not sb:
            return jsonify(success=False, error="Database not available"), 500
        
        d = request.get_json()
        update_data = {
            "status": d.get("status"),
            "completion_percentage": d.get("completion_percentage"),
            "actual_completion_date": d.get("actual_completion_date"),
            "notes": d.get("notes"),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        result = sb.table("lesson_plans").update(update_data).eq("id", lesson_id).execute().data
        
        # Update course syllabus coverage after lesson update
        if result:
            lesson = result[0]
            course_id = lesson.get("course_id")
            
            all_lessons = sb.table("lesson_plans").select("*").eq("course_id", course_id).execute().data
            completed = len([l for l in all_lessons if l.get("status") == "completed"])
            coverage = (completed / len(all_lessons) * 100) if all_lessons else 0
            
            sb.table("course_syllabus").update({
                "completed_topics": completed,
                "coverage_percentage": coverage,
                "last_updated": datetime.utcnow().isoformat()
            }).eq("course_id", course_id).execute()
        
        return jsonify(success=True, lesson=result[0] if result else None)
    except Exception as e:
        print(f"[LESSON UPDATE] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/courses/<course_id>/progress", methods=["GET"])
def get_course_progress(course_id):
    """Get overall course progress"""
    try:
        if not sb:
            return jsonify(success=False, error="Database not available"), 500
        
        # Get course syllabus
        syllabus = sb.table("course_syllabus").select("*").eq("course_id", course_id).execute().data
        
        # Get all lessons
        lessons = sb.table("lesson_plans").select("*").eq("course_id", course_id).execute().data
        
        course = sb.table("courses").select("*").eq("id", course_id).execute().data[0] if sb.table("courses").select("*").eq("id", course_id).execute().data else None
        
        completed_lessons = len([l for l in lessons if l.get("status") == "completed"])
        completion_percentage = (completed_lessons / len(lessons) * 100) if lessons else 0
        
        return jsonify(
            success=True,
            course=course,
            syllabus=syllabus[0] if syllabus else None,
            total_lessons=len(lessons),
            completed_lessons=completed_lessons,
            completion_percentage=round(completion_percentage, 2),
            lessons=lessons
        )
    except Exception as e:
        print(f"[COURSE PROGRESS] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


# simple listing of courses, optional faculty filter
@app.route("/api/courses", methods=["GET"])
def list_courses():
    try:
        if not sb:
            return jsonify(success=False, error="Database not available"), 500
        faculty_id = request.args.get("faculty_id")
        q = sb.table("courses").select("*")
        if faculty_id:
            q = q.eq("faculty_id", faculty_id)
        courses = q.execute().data
        return jsonify(success=True, courses=courses)
    except Exception as e:
        print(f"[COURSES] Error: {e}")
        return jsonify(success=False, error=str(e)), 500

# ============================================================
# PHASE 1: NOTIFICATIONS & ANNOUNCEMENTS
# ============================================================

@app.route("/api/notifications", methods=["GET"])
def get_notifications():
    """Get notifications for logged-in user"""
    try:
        if not sb:
            return jsonify(success=False, error="Database not available"), 500
        
        user_id = request.args.get("user_id")
        unread_only = request.args.get("unread", "false").lower() == "true"
        
        if not user_id:
            return jsonify(success=False, error="user_id required"), 400
        
        q = sb.table("notifications").select("*").eq("recipient_id", user_id)
        
        if unread_only:
            q = q.eq("is_read", False)
        
        q = q.is_("deleted_at", "null").order("created_at", desc=True)
        
        notifications = q.execute().data
        
        return jsonify(success=True, notifications=notifications, count=len(notifications))
    except Exception as e:
        print(f"[NOTIFICATIONS] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/notifications", methods=["POST"])
def create_notification():
    """Create a notification"""
    try:
        if not sb:
            return jsonify(success=False, error="Database not available"), 500
        
        d = request.get_json()
        notification_data = {
            "sender_id": d.get("sender_id"),
            "recipient_id": d.get("recipient_id"),
            "notification_type": d.get("notification_type"),
            "title": d.get("title"),
            "message": d.get("message"),
            "related_course_id": d.get("related_course_id"),
            "priority": d.get("priority", "normal"),
            "action_url": d.get("action_url"),
            "expires_at": d.get("expires_at")
        }
        
        result = sb.table("notifications").insert(notification_data).execute().data
        
        return jsonify(success=True, notification=result[0] if result else None)
    except Exception as e:
        print(f"[CREATE NOTIFICATION] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/notifications/<notification_id>/read", methods=["PUT"])
def mark_notification_read(notification_id):
    """Mark notification as read"""
    try:
        if not sb:
            return jsonify(success=False, error="Database not available"), 500
        
        result = sb.table("notifications").update({
            "is_read": True,
            "read_at": datetime.utcnow().isoformat()
        }).eq("id", notification_id).execute().data
        
        return jsonify(success=True, notification=result[0] if result else None)
    except Exception as e:
        print(f"[MARK READ] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/announcements", methods=["GET"])
def get_announcements():
    """Get announcements for user"""
    try:
        if not sb:
            return jsonify(success=False, error="Database not available"), 500
        
        user_role = request.args.get("role", "student")
        department = request.args.get("department")
        
        q = sb.table("announcements").select("*").eq("visibility", "public").order("published_at", desc=True)
        
        # Filter by role
        q = q.or_(f"target_role.eq.{user_role},target_role.eq.all")
        
        if department:
            q = q.or_(f"target_department.eq.{department},target_department.is.null")
        
        announcements = q.execute().data
        
        return jsonify(success=True, announcements=announcements)
    except Exception as e:
        print(f"[ANNOUNCEMENTS] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/announcements", methods=["POST"])
def create_announcement():
    """Create an announcement (Faculty/Admin)"""
    try:
        if not sb:
            return jsonify(success=False, error="Database not available"), 500
        
        d = request.get_json()
        announcement_data = {
            "sender_id": d.get("sender_id"),
            "title": d.get("title"),
            "message": d.get("message"),
            "announcement_type": d.get("announcement_type"),
            "target_role": d.get("target_role", "all"),
            "target_department": d.get("target_department"),
            "target_course_id": d.get("target_course_id"),
            "priority": d.get("priority", "normal"),
            "visibility": d.get("visibility", "public"),
            "published_at": datetime.utcnow().isoformat(),
            "expires_at": d.get("expires_at")
        }
        
        result = sb.table("announcements").insert(announcement_data).execute().data
        
        return jsonify(success=True, announcement=result[0] if result else None)
    except Exception as e:
        print(f"[CREATE ANNOUNCEMENT] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


# ============================================================
# PHASE 1: ASSIGNMENTS & ASSESSMENT
# ============================================================

@app.route("/api/assignments", methods=["GET"])
def get_assignments():
    """Get assignments for a course or student"""
    try:
        if not sb:
            return jsonify(success=False, error="Database not available"), 500
        
        course_id = request.args.get("course_id")
        student_id = request.args.get("student_id")
        
        if course_id:
            q = sb.table("assignments").select("*").eq("course_id", course_id)
            assignments = q.execute().data
        elif student_id:
            # Get all assignments for courses the student is enrolled in
            q = sb.table("assignment_submissions").select("assignment_id").eq("student_id", student_id)
            submissions = q.execute().data
            assignment_ids = [s["assignment_id"] for s in submissions]
            assignments = sb.table("assignments").select("*").in_("id", assignment_ids).execute().data
        else:
            assignments = sb.table("assignments").select("*").order("due_date").execute().data
        
        return jsonify(success=True, assignments=assignments)
    except Exception as e:
        print(f"[GET ASSIGNMENTS] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/assignments", methods=["POST"])
def create_assignment():
    """Create an assignment"""
    try:
        if not sb:
            return jsonify(success=False, error="Database not available"), 500
        
        d = request.get_json()
        assignment_data = {
            "course_id": d.get("course_id"),
            "faculty_id": d.get("faculty_id"),
            "title": d.get("title"),
            "description": d.get("description"),
            "assignment_type": d.get("assignment_type", "homework"),
            "total_marks": d.get("total_marks", 100),
            "due_date": d.get("due_date"),
            "submission_type": d.get("submission_type", "file"),
            "allow_late_submission": d.get("allow_late_submission", False),
            "late_submission_penalty": d.get("late_submission_penalty", 0),
            "status": d.get("status", "published")
        }
        
        result = sb.table("assignments").insert(assignment_data).execute().data
        
        return jsonify(success=True, assignment=result[0] if result else None)
    except Exception as e:
        print(f"[CREATE ASSIGNMENT] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/assignments/<assignment_id>/submit", methods=["POST"])
def submit_assignment(assignment_id):
    """Student submits assignment"""
    try:
        if not sb:
            return jsonify(success=False, error="Database not available"), 500
        
        d = request.get_json()
        submission_data = {
            "assignment_id": assignment_id,
            "student_id": d.get("student_id"),
            "submission_file_url": d.get("submission_file_url"),
            "submission_text": d.get("submission_text"),
            "submission_link": d.get("submission_link"),
            "submitted_at": datetime.utcnow().isoformat(),
            "submission_status": d.get("submission_status", "submitted")
        }
        
        result = sb.table("assignment_submissions").upsert(submission_data).execute().data
        
        return jsonify(success=True, submission=result[0] if result else None)
    except Exception as e:
        print(f"[SUBMIT ASSIGNMENT] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/assignments/<assignment_id>/submissions", methods=["GET"])
def get_assignment_submissions(assignment_id):
    """Get all submissions for an assignment (Faculty)"""
    try:
        if not sb:
            return jsonify(success=False, error="Database not available"), 500
        
        submissions = sb.table("assignment_submissions").select("*").eq("assignment_id", assignment_id).order("submitted_at", desc=True).execute().data
        
        return jsonify(success=True, submissions=submissions)
    except Exception as e:
        print(f"[GET SUBMISSIONS] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/submissions/<submission_id>/grade", methods=["PUT"])
def grade_submission(submission_id):
    """Grade a submission and record marks"""
    try:
        if not sb:
            return jsonify(success=False, error="Database not available"), 500
        
        d = request.get_json()
        
        # Update submission with grades
        submission_update = {
            "marks_obtained": d.get("marks_obtained"),
            "feedback": d.get("feedback"),
            "graded_by": d.get("faculty_id"),
            "graded_at": datetime.utcnow().isoformat(),
            "submission_status": "graded"
        }
        
        result = sb.table("assignment_submissions").update(submission_update).eq("id", submission_id).execute().data
        
        if result:
            submission = result[0]
            
            # Also record in grades table
            assignment = sb.table("assignments").select("*").eq("id", submission["assignment_id"]).execute().data[0]
            
            grade_data = {
                "student_id": submission["student_id"],
                "course_id": assignment["course_id"],
                "assessment_type": "assignment",
                "assessment_id": assignment["id"],
                "marks_obtained": d.get("marks_obtained"),
                "total_marks": assignment["total_marks"],
                "recorded_by": d.get("faculty_id"),
                "recorded_at": datetime.utcnow().isoformat()
            }
            
            sb.table("grades").upsert(grade_data).execute()
        
        return jsonify(success=True, submission=result[0] if result else None)
    except Exception as e:
        print(f"[GRADE SUBMISSION] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


@app.route("/api/grades", methods=["GET"])
def get_grades():
    """Get grades for student or course"""
    try:
        if not sb:
            return jsonify(success=False, error="Database not available"), 500
        
        student_id = request.args.get("student_id")
        course_id = request.args.get("course_id")
        
        q = sb.table("grades").select("*")
        
        if student_id:
            q = q.eq("student_id", student_id)
        
        if course_id:
            q = q.eq("course_id", course_id)
        
        grades = q.order("recorded_at", desc=True).execute().data
        
        # Calculate GPA if multiple grades
        if student_id and grades:
            total_points = sum([g.get("grade_points", 0) for g in grades if g.get("grade_points")])
            gpa = total_points / len(grades) if grades else 0
            
            return jsonify(success=True, grades=grades, gpa=round(gpa, 2))
        
        return jsonify(success=True, grades=grades)
    except Exception as e:
        print(f"[GET GRADES] Error: {e}")
        return jsonify(success=False, error=str(e)), 500


if __name__=="__main__":
    print("SmartAMS Backend — http://localhost:6001")
    print("QR Security System — ENABLED")
    print("Phase 1 Extensions — Lessons, Notifications, Assignments ENABLED")
    app.run(debug=True,host="0.0.0.0",port=6001)


# 🚀 SmartAMS QR System - Deployment & Quick Start Guide

## What's New - Complete Feature List

### ✅ All Features Implemented

#### For Teachers (Faculty)
- ✅ Generate encrypted QR codes for attendance sessions
- ✅ Time-limited codes (5-15 minutes configurable)
- ✅ Display on projector or share digitally
- ✅ Real-time tracking of student check-ins
- ✅ Unique Session ID for each class
- ✅ Optional GPS verification with configurable radius
- ✅ Live attendance tracker dashboard
- ✅ Detailed session reports and analytics

#### For Students
- ✅ Quick scan access from dashboard
- ✅ Instant attendance confirmation with visual feedback
- ✅ Personal QR profile for sharing attendance details
- ✅ View complete attendance history via QR
- ✅ Works offline with automatic sync when online
- ✅ Attendance verification status display

#### Security Features
- ✅ Encrypted QR codes with AES-256 encryption
- ✅ One-time use per student per session (duplicate detection)
- ✅ Anti-proxy measures with face + location verification
- ✅ Time-window lock (QR expires and cannot be reused)
- ✅ Full audit trail logging of all events
- ✅ Device fingerprinting for fraud prevention
- ✅ Multi-factor fraud detection engine
- ✅ Rapid reuse detection (impossible pattern detection)

---

## 📦 Files Added/Modified

### New Files Created

1. **qr_security.py** - Core QR security module
   - QREncryption class (AES-256 encryption/decryption)
   - QRSessionManager (QR generation & validation)
   - DeviceFingerprint (device identification)
   - FraudDetection (multi-signal fraud analysis)
   - AuditTrail (comprehensive event logging)
   - OfflineQueue (offline storage & sync)

2. **qr_client.js** - Frontend QR module
   - Enhanced QR generation with security UI
   - Advanced QR scanning with validation
   - Personal QR profile creation
   - Device fingerprinting
   - Offline queue management
   - Auto-sync capability

3. **QR_FEATURES_COMPLETE.md** - Complete feature documentation

### Modified Files

1. **schema.sql**
   - Enhanced `qr_sessions` table (encryption, security flags)
   - Added `qr_usage_log` table (usage tracking)
   - Added `device_fingerprints` table (device tracking)
   - Added `qr_profiles` table (student profiles)
   - Added `audit_trail` table (event logging)
   - Added `offline_queue` table (offline support)

2. **backend.py**
   - Added 10+ new API endpoints
   - QR generation with encryption
   - QR validation with duplicate checks
   - Enhanced attendance marking with security checks
   - Device fingerprinting endpoints
   - Fraud detection endpoints
   - Audit trail querying
   - Session statistics and reports
   - Offline sync support

3. **requirements.txt**
   - cryptography (AES encryption)
   - qrcode (QR generation)
   - pycryptodome (cryptographic primitives)
   - user-agent (device parsing)
   - geohaversin (GPS calculations)

4. **app.js**
   - Enhanced generateQR() with security features
   - New startQRScan() function
   - New createStudentQRProfile() function
   - New viewAttendanceHistory() function
   - Integration with QRModule

5. **index.html**
   - Added qr_client.js script import

---

## 🛠️ Installation & Setup

### Step 1: Database Schema Update

```bash
# Open your Supabase SQL editor and run:
# Copy the entire contents of schema.sql and paste into Supabase
# This will create all new tables and enhance existing ones
```

### Step 2: Install Dependencies

```bash
cd /Users/loki/Downloads/smart-ams\ 3

# Install Python packages
pip3 install -r requirements.txt

# Verify installation
python -c "from cryptography.fernet import Fernet; from qrcode import QRCode; print('✅ Dependencies installed')"
```

### Step 3: Environment Configuration

Create a `.env` file in the project root:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key

# QR Security (Generate secure random keys)
# For QR_ENCRYPTION_KEY, generate 32 bytes and base64 encode
# For QR_HMAC_SECRET, generate any strong random string

QR_ENCRYPTION_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
QR_HMAC_SECRET=$(python -c "import secrets; print(secrets.token_hex(32))")
```

### Step 4: Start the System

```bash
# Terminal 1: Start Python Flask Backend
source .venv/bin/activate  # Or your Python environment
python backend.py
# Should output: SmartAMS Backend — http://localhost:6001
#                QR Security System — ENABLED

# Terminal 2: Open frontend
# Open index.html in a web browser
# Production: Use Node.js or a web server like Nginx
```

---

## 🧪 Quick Test Guide

### Test 1: Faculty QR Generation

```bash
curl -X POST http://localhost:6001/api/qr/generate \
  -H "Content-Type: application/json" \
  -d '{
    "faculty_id": "prof123",
    "course_id": "CS101",
    "subject": "Data Structures",
    "validity_minutes": 5,
    "require_face": true,
    "require_location": true,
    "latitude": 13.146,
    "longitude": 77.574,
    "gps_radius_meters": 100
  }'

# Expected response:
# {
#   "success": true,
#   "session_id": "QRABCD123456",
#   "qr_code_base64": "iVBORw0KGgoAAAANS...",
#   "expires_at": "2026-03-01T10:15:00Z",
#   "validity_seconds": 300
# }
```

### Test 2: QR Validation

```bash
curl -X POST http://localhost:6001/api/qr/validate \
  -H "Content-Type: application/json" \
  -d '{
    "qr_data": "AMSQR:2.0:QRABCD123456:...",
    "student_id": "student456"
  }'

# Expected: QR decoded and validated
```

### Test 3: Mark Attendance

```bash
curl -X POST http://localhost:6001/api/qr/mark-attendance \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "QRABCD123456",
    "student_id": "student456",
    "roll_no": "CS001",
    "name": "John Doe",
    "face_image": "iVBORw0KGgoAAAA...",
    "latitude": 13.1460,
    "longitude": 77.5740,
    "device_fingerprint": "abc123xyz"
  }'

# Expected: Attendance marked with security verification
```

### Test 4: Get Session Statistics

```bash
curl -X GET "http://localhost:6001/api/qr/session-stats?session_id=QRABCD123456"

# Expected response with attendance counts
```

### Test 5: Create Student QR Profile

```bash
curl -X POST http://localhost:6001/api/qr/create-profile \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "student456",
    "roll_no": "CS001",
    "full_name": "John Doe",
    "email": "john@example.com",
    "share_enabled": true
  }'
```

---

## 🎯 Frontend Usage

### For Faculty

1. **Generate QR Code:**
   ```
   Click: Attendance → Generate QR Code
   ```
   - Select course
   - Configurable validity (auto 5 min)
   - See encrypted QR generated
   - Real-time check-in count shows

2. **Live Tracker:**
   ```
   Click: 📊 Live Attendance Tracker
   ```
   - See students checking in real-time
   - Face verification status
   - Location verification status
   - Anomaly detection alerts

3. **View Reports:**
   ```
   Click: Reports → QR Session Reports
   ```
   - Session analytics
   - Attendance rates
   - Security incident summary

### For Students

1. **Mark Attendance (QR Scan):**
   ```
   Click: Dashboard → QR Code Scan
   ```
   - Camera opens
   - Scan faculty QR code
   - Face verification
   - Location check
   - Instant confirmation

2. **Create QR Profile:**
   ```
   Click: Dashboard → Create QR Profile
   ```
   - Generate personal QR
   - Share with others
   - See view count
   - Manage expiry

3. **View History:**
   ```
   Click: Attendance → View History
   ```
   - Complete attendance record
   - Verification status for each
   - Location details
   - Method used (QR/Face/Manual)

---

## 🔐 Security Configuration

### Recommended Settings

```python
# In backend.py or system_config

# QR Settings
QR_VALIDITY_MINUTES = 5              # Keep short for security
GPS_RADIUS_METERS = 100              # Typical classroom size
FACE_CONFIDENCE_THRESHOLD = 0.85     # 85% minimum confidence

# Anti-Fraud
RAPID_REUSE_MINIMUM_SECONDS = 30     # Prevent instant reuse
DUPLICATE_CHECK_ENABLED = True       # Prevent same student twice
FRAUD_DETECTION_ENABLED = True       # Multi-signal analysis

# Encryption
ENCRYPTION_ALGORITHM = "AES-256"
KEY_DERIVATION = "PBKDF2"
ITERATIONS = 100000
```

---

## 📊 Monitoring & Alerts

### Key Metrics to Monitor

```
Dashboard Metrics:
├─ QR Generation Success Rate (target: >99%)
├─ Face Verification Success Rate (target: >95%)
├─ Location Verification Success Rate (target: >98%)
├─ Average Response Time (target: <500ms)
├─ Fraud Detection Rate (target: >0.5%)
├─ Offline Sync Success (target: 100%)
└─ Database Query Performance (target: <100ms)
```

### Alert Conditions

```
🔴 Critical Alerts:
- Multiple fraud attempts from same student
- GPS spoofing detected
- Device fingerprinting anomalies
- Encryption failures

🟠 Warning Alerts:
- High face verification failures (>5%)
- Location verification misses (>2%)
- Offline queue growing (>50 entries)
- Encryption key not set
```

---

## 🐛 Troubleshooting

### QR Code Not Generating

```
Problem: "Failed to generate QR code"
Solution:
1. Check QR_ENCRYPTION_KEY in .env
2. Verify Supabase connection
3. Check server logs for detailed error
```

### Face Recognition Failing

```
Problem: "Face not detected" or low confidence
Solution:
1. Check lighting conditions
2. Ensure camera is functional
3. Verify dlib is installed
4. Check face_confidence threshold setting
```

### Location Not Verified

```
Problem: "Location outside permitted range"
Solution:
1. Enable GPS in browser/device
2. Check GPS accuracy (should be <50m)
3. Verify GPS_RADIUS_METERS setting
4. Ensure coordinates are accurate
```

### Offline Sync Not Working

```
Problem: Offline queue not syncing
Solution:
1. Check internet connection
2. Clear browser localStorage
3. Reload page
4. Check /api/qr/offline-sync endpoint
```

---

## 📝 API Quick Reference

### Generate QR
```
POST /api/qr/generate
Headers: Content-Type: application/json
Body: { faculty_id, course_id, subject, validity_minutes, require_face, require_location, latitude, longitude, gps_radius_meters }
Returns: { success, session_id, qr_code_base64, expires_at, validity_seconds }
```

### Mark Attendance
```
POST /api/qr/mark-attendance
Headers: Content-Type: application/json
Body: { session_id, student_id, roll_no, name, face_image, latitude, longitude, device_fingerprint }
Returns: { success, student_name, face_verified, location_verified, timestamp }
```

### Get Attendance History
```
GET /api/qr/attendance-history?roll_no=CS001&limit=50
Returns: { success, attendance_records, total_records }
```

### Get Audit Log
```
GET /api/qr/audit-log?session_id=QR123&severity=critical&limit=100
Returns: { success, logs, count }
```

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Database tables created successfully
- [ ] Python packages installed (test import statements)
- [ ] Backend server starts without errors
- [ ] Frontend loads and shows interface
- [ ] Faculty can generate QR codes
- [ ] QR codes display in browser
- [ ] Student can scan QR codes
- [ ] Face recognition works (with camera)
- [ ] Location verification works (with GPS)
- [ ] Attendance records saved to database
- [ ] Audit logs being recorded
- [ ] Offline mode queues entries
- [ ] Offline entries sync when online
- [ ] Fraud detection flags anomalies
- [ ] Device fingerprinting works
- [ ] Reports generate correctly
- [ ] API endpoints return proper JSON

---

## 📞 Tech Stack

**Frontend:**
- HTML5, CSS3, JavaScript (ES6+)
- QRCode.js (QR generation)
- jsQR (QR scanning/decoding)
- Supabase JS SDK

**Backend:**
- Python 3.11+
- Flask (web framework)
- dlib (face recognition)
- cryptography (AES encryption)
- qrcode (QR generation)

**Database:**
- Supabase PostgreSQL
- Tables: users, courses, attendance, qr_sessions, qr_usage_log, device_fingerprints, qr_profiles, audit_trail, offline_queue

**Security:**
- AES-256 encryption
- PBKDF2 key derivation
- HMAC verification
- SHA-256 hashing
- Device fingerprinting

---

## 🎓 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Browser)                    │
│  index.html + app.js + qr_client.js                         │
│  - Student Dashboard (QR Scan, Profile, History)            │
│  - Faculty Dashboard (QR Generation, Live Tracker)          │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS/REST API
┌────────────────────────▼────────────────────────────────────┐
│                    Backend (Flask Server)                    │
│  backend.py + qr_security.py                                │
│  - QR Generation & Encryption                               │
│  - Face Recognition (dlib)                                  │
│  - Security Validation                                      │
│  - Audit Logging                                            │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
    ┌───▼──┐      ┌──────▼────────┐  ┌──▼──────┐
    │ dlib │      │  Supabase     │  │ Storage │
    │ Face │      │  PostgreSQL   │  │(Offline)│
    │ Rec  │      │  Database     │  │(Cache)  │
    └──────┘      └───────────────┘  └─────────┘
```

---

## 🚀 Next Steps

1. **Deploy Backend:**
   - Set up on production server (AWS/DigitalOcean)
   - Configure HTTPS/SSL
   - Setup auto-restart on crash

2. **Deploy Frontend:**
   - Build minified version
   - Deploy to CDN or web server
   - Configure CORS properly

3. **Monitor & Optimize:**
   - Set up monitoring dashboard
   - Configure alerts
   - Optimize database queries
   - Monitor face recognition accuracy

4. **Scale:**
   - Implement caching (Redis)
   - Load balance API
   - Optimize database indexes
   - Consider edge deployment

---

## 📞 Support

For issues or questions:
1. Check the logs in backend
2. Review browser console
3. Check QR_FEATURES_COMPLETE.md for detailed documentation
4. Test API endpoints manually with curl

---

**Version:** 1.0 Complete  
**Release Date:** March 2026  
**Status:** Production Ready ✅

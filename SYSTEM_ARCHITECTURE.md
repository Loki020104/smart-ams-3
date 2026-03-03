# Smart Attendance Management System (SAMS) - Architecture

## Overview

This document describes the final architecture for the Smart Attendance Management System, implementing a clean separation between **user account management** and **biometric face registration**.

---

## Architecture Principles

### 1. **Separation of Concerns**
- **User Management**: Creates and manages student accounts (credentials-based)
- **Face Registration**: Stores face encodings linked to existing user accounts
- These two processes are completely independent and can be done at different times

### 2. **No Duplicate Users**
- Both `username` and `roll_no` must be unique in the `users` table
- Admin cannot create duplicate student accounts
- Duplicate face registrations are prevented by checking user existence first

### 3. **Optional Face Biometrics**
- Face registration is **optional** when adding users
- Students can add face later via "Register Face" feature without re-entering credentials
- Attendance can use QR, geolocation, or face verification independently

---

## System Flow Diagrams

### **Step 1: Admin Creates User Account** (No Face)

```
Admin Portal
    ↓
Fill form (name, email, password, dept, roll_no)
    ↓
[✓] Add User button
    ↓
POST /api/users/add (JSON, no image)
    ↓
Supabase: users table insert
    ↓
Response: user_id
    ↓
✅ User created (no face registered yet)
```

**Request Example:**
```json
POST /api/users/add
{
  "role": "student",
  "full_name": "John Doe",
  "username": "johndoe",
  "email": "john@college.edu",
  "password": "secure_pass",
  "department": "Computer Science",
  "roll_no": "20241cse0001",
  "section": "A"
}
```

**Response:**
```json
{
  "success": true,
  "user_id": "uuid-123",
  "message": "User added successfully"
}
```

---

### **Step 2: Student Registers Face** (Separate, Later)

Can happen **immediately after creating user** OR **anytime later** via Student Settings.

```
Student Portal / Settings
    ↓
Click "Register Face"
    ↓
Allow camera → Capture face image
    ↓
[✓] Register Face button
    ↓
POST /api/users/register-face (multipart form with image)
    ↓
Check: User exists? (by roll_no or username)
    ↓
No → Error "User not found"
    ↓
Yes → Extract face encoding from image
    ↓
Check: Exactly 1 face? Store in face_encodings table
    ↓
✅ Face registered for this user
```

**Request Example (Multipart):**
```
POST /api/users/register-face
Content-Type: multipart/form-data

image: [binary face image file]
roll_no: 20241cse0001
user_id: uuid-123 (optional, roll_no is preferred)
```

**Response:**
```json
{
  "success": true,
  "message": "Face registered successfully",
  "user_id": "uuid-123",
  "roll_no": "20241cse0001"
}
```

---

### **Step 3: Student Logs In** (Credentials Only)

```
Login Portal
    ↓
Enter username + password
    ↓
POST /api/users/login (JSON)
    ↓
Check: credentials valid?
    ↓
No → ❌ "Invalid credentials"
    ↓
Yes → Check: face registered for this user?
    ↓
Return: { logged_in: true, face_registered: true/false }
```

---

### **Step 4: Student Marks Attendance** (Face Mode)

```
Attendance Portal → Face Recognition Mode
    ↓
Check: Location within college?
    ↓
No → ❌ "Not in campus"
    ↓
Yes → Show video feed (allow camera)
    ↓
Student positions face in frame
    ↓
[✓] Capture & Verify button
    ↓
POST /api/verify (JSON with base64 face image)
    ↓
Extract encoding from captured image
    ↓
Query face_encodings table for logged-in user (by roll_no)
    ↓
Compare: captured encoding vs stored encoding
    ↓
Match distance < threshold?
    ↓
No (distance too high) → ❌ "Face does not match"
    ↓
Yes → ✅ "Attendance Marked - PRESENT"
```

**Request Example:**
```json
POST /api/verify
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABA..."
}
```

**Response (Match):**
```json
{
  "verified": true,
  "message": "Face matched. Attendance marked.",
  "name": "John Doe",
  "roll_no": "20241cse0001"
}
```

**Response (No Match):**
```json
{
  "verified": false,
  "error": "Face does not match registered face"
}
```

---

## Database Schema

### **users table**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  role VARCHAR (student|faculty|admin),
  full_name VARCHAR,
  email VARCHAR UNIQUE,
  roll_no VARCHAR UNIQUE,          -- Only for students
  department VARCHAR,
  section VARCHAR,                 -- Only for students
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### **face_encodings table**
```sql
CREATE TABLE face_encodings (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  roll_no VARCHAR,                 -- Denormalized for fast lookup
  encoding VECTOR(128),            -- Face embedding (128-dimensional)
  image TEXT,                      -- Optional: base64 face image
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### **attendance table**
```sql
CREATE TABLE attendance (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  roll_no VARCHAR,
  method VARCHAR (qr|face|geolocation),
  marked_at TIMESTAMP,
  latitude FLOAT,
  longitude FLOAT,
  device_fingerprint VARCHAR,
  session_id VARCHAR
);
```

---

## API Endpoints

### **User Management**

#### `POST /api/users/add`
**Purpose:** Admin adds new user (credentials only, no face)
- **Method:** POST
- **Content-Type:** application/json
- **Body:** `{ role, full_name, username, email, password, department, roll_no, section }`
- **Response:** `{ success, user_id, message }`
- **Notes:** 
  - Checks for duplicate username and roll_no
  - For students, username defaults to roll_no if not provided

---

#### `POST /api/users/login`
**Purpose:** Student/faculty login
- **Method:** POST
- **Content-Type:** application/json
- **Body:** `{ username, password, face_image? }`
- **Response:** `{ logged_in, face_registered, user_id, roll_no, message }`
- **Notes:**
  - Optional `face_image` for login verification (if enabled by faculty)
  - Returns `face_registered` flag to indicate if face is on file

---

#### `POST /api/users/register-face`
**Purpose:** Register or update face for existing user
- **Method:** POST
- **Content-Type:** multipart/form-data
- **Fields:**
  - `image`: Binary face image file
  - `user_id` or `roll_no`: Identify the user
- **Response:** `{ success, message, user_id, roll_no }`
- **Validation:**
  - Checks user exists (by roll_no or user_id)
  - Detects exactly 1 face in image
  - Extracts 128-dim encoding

---

#### `POST /api/verify`
**Purpose:** Verify attendance with face recognition
- **Method:** POST
- **Content-Type:** application/json
- **Body:** `{ image: "data:image/jpeg;base64,..." }`
- **Response:** `{ verified, message, name, roll_no }` (if verified) OR `{ verified: false, error }`
- **Logic:**
  - Expects logged-in user context (session/JWT)
  - Extracts encoding from submitted image
  - Compares vs stored encoding in face_encodings table
  - Marks attendance if match (distance < threshold)

---

#### `POST /api/register` (Legacy)
**Purpose:** Standalone face registration (without user creation)
- **Method:** POST
- **Content-Type:** multipart/form-data OR application/json
- **Notes:** Deprecated in favor of `/api/users/register-face`

---

### **Attendance**

#### `GET /api/attendance`
**Purpose:** Get logged-in student's attendance records
- **Method:** GET
- **Response:** `{ attendance: [ { marked_at, method, session_id }, ... ] }`

---

## Frontend User Stories

### **Admin: Add a New Student**
1. Click "Add User" in Admin Panel
2. Fill form: Name, Email, Password, Department, Roll Number, Section
3. **Optional:** Check "Capture face immediately"
4. If face capture selected:
   - Click "Capture Face"
   - Allow camera, position face in circle
   - Click "Capture" → Preview → "Register Face"
5. Click "Add User" → User created in database
6. **Result:** User account ready, optionally with face registered

**Endpoints Used:**
- `POST /api/users/add` (required)
- `POST /api/users/register-face` (optional)

---

### **Student: Register Face (After Login)**
1. Log in with credentials
2. Go to Settings → "Register Face"
3. Click "Register Face"
4. Allow camera, position face in circle
5. Click "Capture" → Review → "Register"
6. **Result:** Face encoding stored, linked to their account

**Endpoints Used:**
- `POST /api/users/register-face`

---

### **Student: Mark Attendance with Face**
1. Log in
2. Go to Attendance
3. Select "Face Recognition" mode
4. Allow camera, position face in frame
5. Click "Capture & Verify"
6. If match → ✅ "Attendance Marked"
7. If no match → ❌ "Face does not match"

**Endpoints Used:**
- `GET /api/system-config` (college coords)
- `POST /api/verify` (face verification)
- `POST /api/attendance` (mark attendance)

---

## Key Implementation Details

### **Face Encoding Extraction**
- Uses `face_recognition` library (ResNet-based, 128-dimensional encoding)
- Detects face, creates encoding, compares with cosine distance
- Threshold: distance < 0.6 for match (tunable in `/api/verify`)

### **Liveness Detection**
- Uses `dlib` for eye-blink detection (dlib_livenesses)
- Runs on captured image to ensure real face (not photo/video)
- Threshold: eye aspect ratio > 0.1 indicates open eyes

### **Password Security**
- Passwords hashed with SHA256 before storing
- Comparison via hash during login

### **Camera Handling**
- `startCamera()`: Waits up to 3 seconds for video metadata
- `captureFrame()`: Draws canvas frame at 50% JPEG quality
- `verifyFace()`: Accepts base64 data URL format

### **Error Handling**
- Multipart request without "image" file → 400 error
- JSON request without "image" key → 400 error
- User not found → 404 error
- Multiple faces detected → 400 error
- Supabase connection errors → 500 error with details

---

## Security Considerations

1. **No face data in username/password fields** — Face is separate
2. **User existence check** — Prevents registering face for non-existent users
3. **Unique constraints** — Prevents duplicate student accounts
4. **Encoding comparison** — Uses cosine distance, not simple pixel comparison
5. **Liveness detection** — Detects eye blinks to prevent spoofing
6. **Session/JWT** — Enforced for `/api/verify` to bind attendance to logged-in user

---

## Migration Path (From Old System)

If upgrading from a system using `/api/register-and-add-user`:

1. **Update admin form** to use `/api/users/add` instead
2. **Add checkbox** for optional face capture
3. **Update submission** to call `/api/users/register-face` if face captured
4. **Test thoroughly** — Ensure no duplicate user creation
5. **Migrate old data** — If needed, link existing faces to users by roll_no

---

## Testing Checklist

- [ ] Admin can create user without face
- [ ] Admin can optionally create user + register face
- [ ] Cannot create user with duplicate username or roll_no
- [ ] Student can register face after login
- [ ] Student face verification rejects non-matching faces
- [ ] Student face verification accepts matching faces
- [ ] Liveness detection rejects still photos
- [ ] Attendance record created on successful face match
- [ ] Camera fails gracefully if not available

---

## Future Enhancements

1. **Batch face registration** — Admin uploads CSV with face images
2. **Face update** — Allow student to re-register face if encoding becomes obsolete
3. **Multi-face support** — Some students might look different (beard, glasses); store multiple encodings
4. **Attendance export** — Export attendance reports filtered by method (face/QR/geolocation)
5. **Analytics** — Track which attendance method is most reliable for institution
6. **Mobile app** — Extend logic to mobile clients (face.js library)
7. **Biometric anti-spoofing** — Use depth sensors or advanced liveness (3D face detection)

---

**Last Updated:** March 2, 2026  
**Version:** 1.0 - Production Ready

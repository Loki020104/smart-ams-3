# Quick Reference: Admin & Student Workflows

## 👨‍💼 Admin Workflow: Add New Student

### Step-by-Step

1. **Open Admin Panel** → Click "Add User" button
2. **Select Role** → "Student"
3. **Fill Form:**
   - Full Name: John Doe
   - Username: johndoe
   - Email: john@college.edu
   - Password: (secure password)
   - Department: Computer Science
   - Roll Number: 20241cse0001 (or auto-generated)
   - Section: A

4. **Optional: Add Face**
   - Check "📷 Capture face immediately"
   - Allow camera permission
   - Position student's face in circle
   - Click "Capture"
   - Review preview
   - Click "Register Face"

5. **Submit**
   - Click "Add User"
   - Result: User created (with or without face)
   - Confirmation: "✅ User created!"

---

## 👨‍🎓 Student Workflow: First Login & Face Registration

### Scenario: Student just created, needs to register face

1. **Log In**
   - Username: johndoe
   - Password: (password set by admin)
   - Click "Login"
   - Result: "✅ Logged in as John Doe"

2. **Register Face** (if not done during creation)
   - Go to "Settings" → "Register Face"
   - OR: Go to "Attendance" → "Face Registration" → "Register New Face"
   - Allow camera permission
   - Position face in circle
   - Click "Capture"
   - Review preview
   - Click "Register Face"
   - Result: "✅ Face registered successfully"

3. **Mark Attendance** (Face Mode)
   - Go to "Attendance"
   - Select "Face Recognition"
   - System checks: Location in campus? ✅
   - Allow camera permission
   - Position face in frame
   - Click "Capture & Verify"
   - **Match** → "✅ Attendance Marked PRESENT" (Location: CSE Block)
   - **No Match** → "❌ Face does not match registered face"

---

## API Reference for Developers

### Create User (Admin)
```bash
POST /api/users/add
Content-Type: application/json

{
  "role": "student",
  "full_name": "John Doe",
  "username": "johndoe",
  "email": "john@college.edu",
  "password": "secure_pass_123",
  "department": "Computer Science",
  "roll_no": "20241cse0001",
  "section": "A"
}

# Response:
{
  "success": true,
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "User added successfully"
}
```

### Register Face (Student)
```bash
POST /api/users/register-face
Content-Type: multipart/form-data

image: <binary JPG file>
roll_no: 20241cse0001
user_id: 550e8400-e29b-41d4-a716-446655440000

# Response:
{
  "success": true,
  "message": "Face registered successfully",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "roll_no": "20241cse0001"
}
```

### Login (Student)
```bash
POST /api/users/login
Content-Type: application/json

{
  "username": "johndoe",
  "password": "secure_pass_123"
}

# Response:
{
  "logged_in": true,
  "face_registered": true,
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "roll_no": "20241cse0001",
  "name": "John Doe"
}
```

### Verify Attendance (Face)
```bash
POST /api/verify
Content-Type: application/json

{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABA..."
}

# Response (Match):
{
  "verified": true,
  "message": "Attendance marked successfully",
  "name": "John Doe",
  "roll_no": "20241cse0001"
}

# Response (No Match):
{
  "verified": false,
  "error": "Face does not match registered face"
}
```

---

## System States & Validation

### User Creation Flow
```
Input: Credentials (username, password, role, dept, email)
  ↓
Check: Username unique?
  ├─ No → Error: "Username already taken"
  └─ Yes → Continue
  ↓
Check: Roll_no unique? (if student)
  ├─ No → Error: "Roll number already registered"
  └─ Yes → Continue
  ↓
Hash password, store in users table
  ↓
Return: user_id
```

### Face Registration Flow
```
Input: Face image + user identifier (roll_no or user_id)
  ↓
Lookup: Does user exist?
  ├─ No → Error: "User not found" [404]
  └─ Yes → Continue
  ↓
Detect: How many faces in image?
  ├─ 0 → Error: "No face detected"
  ├─ 1 → Continue
  └─ >1 → Error: "Found N faces. Ensure exactly ONE"
  ↓
Extract: Face encoding (128-dimensional vector)
  ↓
Store: Encoding in face_encodings table, linked to user_id
  ↓
Return: Success (user_id, roll_no)
```

### Attendance Verification Flow
```
Input: Captured face image (student must be logged in)
  ↓
Check: Face image quality
  ├─ Image too small → Error: "Face too small"
  ├─ Image blurry → Error: "Image not clear"
  └─ OK → Continue
  ↓
Extract: Captured face encoding
  ↓
Lookup: Stored encoding for logged-in user
  ├─ Not found → Error: "No face registered"
  └─ Found → Continue
  ↓
Compare: Distance between captured & stored encoding
  ├─ distance < 0.6 → Match ✓
  └─ distance ≥ 0.6 → No Match ✗
  ↓
If Match: Mark attendance in attendance table
  ↓
Return: Verified (name, roll_no, timestamp)
```

---

## Error Reference

### HTTP Status Codes

| Code | Error | Cause | Action |
|------|-------|-------|--------|
| 400 | Missing fields | Required field not provided | Fill all required fields |
| 400 | Invalid role | Role not in [student, faculty, admin] | Select valid role |
| 400 | No image provided | Image not sent in form or JSON | Upload face image |
| 400 | No face detected | 0 faces in image | Ensure face is visible |
| 400 | Found N faces | Multiple people in image | Only one person allowed |
| 400 | Username already taken | Username duplicated | Choose different username |
| 400 | Roll number already taken | Roll_no duplicated | Correct roll number |
| 404 | User not found | User doesn't exist in database | Create user first |
| 500 | Server error | Backend error | Check logs, contact support |

### Frontend Toast Messages

| Message | Meaning | Next Step |
|---------|---------|-----------|
| ✅ Face captured! | Photo taken successfully | Click "Register Face" |
| ❌ Capture Failed | Camera not ready | Check permissions, try again |
| ✅ User created! | Account registered | User can now log in |
| ❌ Face does not match | Verification failed | Try again, or re-register face |
| ✅ Attendance Marked PRESENT | Success | Attendance recorded |

---

## Common Scenarios

### Scenario 1: Student registering face immediately after account creation

**Admin does:**
1. Fill user form (name, email, password, dept, roll_no)
2. Check "Capture face immediately"
3. Capture student's photo
4. Click "Add User"

**Behind the scenes:**
1. POST /api/users/add → user created, user_id returned
2. POST /api/users/register-face → face encoding stored with user_id

**Result:** Student can log in and mark attendance with face

---

### Scenario 2: Student registering face one week after account creation

**Admin creates user:**
1. Fill form, uncheck face capture
2. Click "Add User"

**One week later, student:**
1. Logs in with credentials
2. Goes to Settings → Register Face
3. Captures and registers face

**Behind the scenes:**
1. User already exists in database from step 1
2. POST /api/users/register-face → face encoding linked to existing user_id

**Result:** Same as Scenario 1, but happens later

---

### Scenario 3: Invalid roll number when registering face

**Student tries:**
1. POST /api/users/register-face
2. Provides face image + roll_no "99999invalid"

**Response:**
```json
{
  "success": false,
  "error": "User not found. Provide valid roll_no or user_id."
}

HTTP Status: 404
```

**Admin action:**
1. Check that student account was created with correct roll_no
2. Use correct roll_no when registering face

---

## Performance Tips

1. **Face image size:** Keep JPEGs under 500KB for fast upload
2. **Network:** Use on campus WiFi for faster face verification
3. **Lighting:** Ensure face is well-lit during capture
4. **Distance:** Face should be 6-12 inches from camera
5. **Angle:** Look straight at camera (avoid tilting head >15°)
6. **Retry threshold:** If "Face does not match", try 2-3 times (may be lighting/angle issue)

---

## Troubleshooting

### "Camera not initialized" error
- [ ] Check camera permissions in browser
- [ ] Try allowing camera access
- [ ] Ensure browser has microphone/camera permission
- [ ] Try different browser (Chrome recommended)
- [ ] Restart browser

### "Face not detected" error
- [ ] Ensure face is visible in frame
- [ ] Increase lighting (face should be well-lit)
- [ ] Move closer to camera (6 inches minimum)
- [ ] Remove sunglasses/hat

### "Face does not match" during attendance
- [ ] Check registered face was captured clearly
- [ ] Try re-registering face
- [ ] Ensure lighting is similar to registration
- [ ] Remove accessories (glasses, hat, scarf)

### "User not found" when registering face
- [ ] Verify user was created with correct roll_no
- [ ] Check roll_no spelling and format
- [ ] Ask admin to confirm account exists

---

## Documentation References

- **Full System Architecture:** See `SYSTEM_ARCHITECTURE.md`
- **Implementation Details:** See `IMPLEMENTATION_NOTES.md`
- **Setup Guide:** See `START_HERE.md` or `QUICK_START.md`
- **API Documentation:** See this file (Quick Reference)

---

**Last Updated:** March 2, 2026  
**Version:** 1.0 - Admin & Student Guide

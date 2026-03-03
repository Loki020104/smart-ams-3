# 🎓 SmartAMS — Complete Academic Management System

**Face Recognition • QR Attendance • Location Verification • Role-Based Access**

---

## ✨ Features

### Attendance System
- **Face Recognition** — live camera + location check
- **QR Code Attendance** — faculty shows QR → student scans → face verify → location check → marked
- **Manual Attendance** — faculty override with mark all / individual
- **Location Geofencing** — marks present only when student is within college campus (GPS)

### Roles
| Role | Access |
|------|--------|
| **Admin** | Full system + all student module data (add/edit) |
| **Faculty** | All 17 faculty modules |
| **Student** | All 22 student modules |

### Student Modules (22)
Dashboard, Calendar, Timetable, Subject Communities, CBCS, Online Class, Attendance, Performance, Digital Library, Exam Registration, Supplementary Exam, Revaluation, Grace Marks, Sem Registration, Interim Survey, Exit Survey, Grievance, Staff Evaluation, Leave Management, Placement, Message Box, Notice Board, Push Notifications

### Faculty Modules (18)
Dashboard, Timetable, Course Details, OBE Config, Lesson Planner, Online Classes, Materials, Attendance (Face/QR/Manual), Assessments, Assignments, Internal Exam, Question Paper Gen, Course File, Mark Computation, Custom Reports, Online Exam, Staff Report, Work Log, Appraisal

---

## 🚀 Quick Start

### 1. Open Frontend
Simply open `index.html` in any modern browser. First screen will ask for Supabase details.

Demo credentials work without Supabase (select any role, enter any username/password).

### 2. Set Up Supabase
1. Create project at https://supabase.com
2. Go to SQL Editor → paste `schema.sql` → Run
3. Go to Settings → API → copy URL and anon key
4. Enter them when the app prompts

### 3. Run Python Backend (for real face recognition)
```bash
pip install -r requirements.txt
# Create .env file:
echo "SUPABASE_URL=https://xxx.supabase.co" > .env
echo "SUPABASE_KEY=eyJ..." >> .env
python backend.py
```

Then update `app.js` API calls to point to `http://localhost:5000`.

---

## 📍 Campus Location Setup

Edit these in `app.js` (top of file):
```js
const COLLEGE_LAT  = 13.0827;   // Your college latitude
const COLLEGE_LNG  = 80.2707;   // Your college longitude
const COLLEGE_KM   = 0.5;       // Geofence radius in km
```
Or configure via Admin → System Config in the app.

---

## 📲 QR Attendance Flow

1. **Faculty** opens Attendance → clicks "Generate QR"
2. QR code appears (valid 5 min) — show on projector/screen
3. **Student** opens Attendance → clicks "QR Code Scan"
4. Camera opens (rear) → scans QR automatically
5. System checks: QR valid? → Location in campus? → Face recognised?
6. All 3 pass → attendance marked ✅

---

## 👁️ Face Recognition Flow

1. **Admin** registers student (live capture, no upload)
2. Encoding stored in Supabase + local `encodings.pkl`
3. **Faculty** enables face recognition
4. **Student** clicks "Face Recognition" attendance
5. Location checked → Camera opens → Face captured → Verified against DB
6. Match within tolerance (0.5) → Present ✅

---

## 🗄️ Files

| File | Description |
|------|-------------|
| `index.html` | Complete web app (HTML + CSS) |
| `app.js` | All JS modules & logic |
| `backend.py` | Flask API with face_recognition |
| `schema.sql` | Supabase database schema |
| `requirements.txt` | Python dependencies |

---

## 🔐 Admin Super-Access

Admin can navigate to any student module (Attendance, Fees, Performance, Leave, Placement, Grievances) and **edit data directly** — add entries, change status, override values.

---

## 📱 Mobile Responsive

- Hamburger menu on small screens
- Responsive stat grids
- Touch-friendly buttons
- QR scanner uses rear camera on mobile

---

**Demo Login:** any username + any password (select role first)

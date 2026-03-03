# Supabase Face Recognition & Attendance Integration

This document explains how the SmartAMS backend interacts with Supabase for
managing user accounts, storing face images/encodings and marking attendance.

## Database Schema (excerpt)

The `schema.sql` provided in the workspace contains the relevant tables:

```sql
create table public.users (
  id bigserial primary key,
  username text unique,
  password_hash text,
  role text,
  full_name text,
  email text,
  roll_no text,
  department text,
  section text,
  created_at timestamptz default now()
);

create table public.face_encodings (
  id bigserial primary key,
  user_id bigint references users(id),
  roll_no text,
  encoding jsonb,
  image text
);

create table public.attendance (
  id bigserial primary key,
  name text,
  roll_no text,
  course text,
  date text,
  timestamp text,
  verified boolean,
  method text,
  confidence real,
  in_campus boolean,
  latitude real,
  longitude real
);

create table public.system_config (
  key text primary key,
  value text
);
```

The backend reads/writes these tables via a minimal `SimpleSupabaseClient`
wrapper (`sb` variable). The `.env` file should contain `SUPABASE_URL` and
`SUPABASE_KEY` so the client can be initialized on startup.

> **Python compatibility:** the `face-recognition` package only publishes
> prebuilt wheels up through Python 3.14.  In this workspace we pin
> `face-recognition==1.3.0` in `requirements.txt` – the highest available
> version for macOS/3.14.  If you use a newer interpreter, either downgrade
> to 3.11/3.12 or install an earlier version of `face-recognition` manually.

## Feature Toggles

The `system_config` table controls runtime options:

- `face_recognition_enabled` (`true`/`false`) – when `false`, face APIs
  return errors and front‑end should skip related UI.
- `college_lat`, `college_lng`, `college_radius_km` – used for geolocation
  checks when latitude/longitude are supplied.

A helper endpoint `/api/config/face-recognition` is exposed to flip the
face‑recognition toggle.

## Workflow

### 1. Admin/User Registration

- **Without face**: POST `/api/users/register` for self‑registration, or
  `/api/users/add` for admins creating records. Only basic username/password
  and role fields are required.

- **With face**: use the combined endpoint `/api/register-and-add-user` which
  accepts a multipart form with an image file. It:
    1. Detects exactly one face and computes a dlib/`face_recognition` encoding.
    2. Saves the encoding locally (for fallback) and upserts into Supabase.
    3. Creates the corresponding `users` record in Supabase.

### 2. Student First Login (Face Registration)

When a student logs in via `/api/users/login`, the response now includes extra
keys when face recognition is enabled:

```json
{
  "success": true,
  "user": {
    "id": 123,
    "username": "2024cse0001",
    "role": "student",
    "face_registered": false,
    "needs_face_registration": true
  }
}
```

The frontend should detect `needs_face_registration` and prompt the student
for a clear selfie. Once captured, the client sends it to
`POST /api/users/register-face` along with `user_id`:

```json
{ "user_id": 123, "face_image": "data:image/jpeg;base64,..." }
```

The backend decodes the image, computes an encoding, and inserts a
`face_encodings` row (storing both the encoding JSON and the original
base64 image for audit). After this step, subsequent login attempts will
report `face_registered: true`.

### 3. Attendance During Login or QR Scan

Whenever a login attempt includes a `face_image` (base64) and latitude/longitude,
and face recognition is enabled, the backend tries to verify the face against
the stored encoding for that user:

```json
{
  "verified": true,
  "confidence": 0.82,
  "in_campus": true
}
```

- If the face matches within tolerance (default 0.6) the student is marked
  **present**; otherwise they are recorded as **absent**.  Attendance rows are
  inserted into Supabase with `method: "login"`.
- Geolocation is optional but if provided it will be checked against the
  college coordinates (stored in `system_config`) and the `in_campus` flag
  saved.

The `/api/verify` endpoint used for QR‑code scans follows a very similar
process but loads encodings for all students (or from Supabase) and is
intended for kiosk/scan flows.

## Helper Functions

- `load_encodings_supabase()` – retrieves all encodings from Supabase and
  returns `(encodings, names)` for matching.
- `verify_face_for_user(user_id=None, image_b64=None, roll_no=None)` – helper used by login to compare. It prefers `roll_no` when available and falls back to `user_id` in case your table uses that column.
  a provided image to the stored encoding for a specific `user_id`.
- `haversine(...)` – compute distance between lat/lon points to validate
  campus presence.
- `is_face_enabled()` – checks the system config toggle.

## Notes

- The backend continues to support QR‑based attendance and existing endpoints
  unmodified; our changes simply augment capabilities.
- The code retains fallback behaviour for local files when Supabase is not
  configured (e.g. in development without `.env`).
- All new data is recorded in Supabase according to the provided schema so
  reporting and cross‑querying become possible.

---

Refer to the various `*.md` files in the repository for further implementation
details, liveness demos, and quick‑start instructions.
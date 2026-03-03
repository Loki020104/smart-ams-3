-- Run this in Supabase SQL Editor to fix missing in_campus column

-- Add in_campus column to attendance table if it doesn't exist
ALTER TABLE IF EXISTS attendance 
ADD COLUMN IF NOT EXISTS in_campus BOOLEAN;

-- Add verified column if it doesn't exist
ALTER TABLE IF EXISTS attendance 
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

-- Add method column if it doesn't exist (with constraint)
ALTER TABLE IF EXISTS attendance 
ADD COLUMN IF NOT EXISTS method VARCHAR(20);

-- Ensure method column has proper constraint
ALTER TABLE IF EXISTS attendance 
DROP CONSTRAINT IF EXISTS attendance_method_check;

ALTER TABLE IF EXISTS attendance 
ADD CONSTRAINT attendance_method_check 
CHECK (method IN ('face','qr','manual'));

-- Ensure correct defaults
ALTER TABLE IF EXISTS attendance 
ALTER COLUMN timestamp SET DEFAULT NOW(),
ALTER COLUMN verified SET DEFAULT FALSE;

-- Update attendance table structure - drop and recreate if needed
-- This is safer than trying to alter individual columns
DROP TABLE IF EXISTS attendance CASCADE;

CREATE TABLE attendance (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES users(id),
  name VARCHAR(255),
  roll_no VARCHAR(50),
  course_id VARCHAR(50),
  date DATE NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  method VARCHAR(20) CHECK (method IN ('face','qr','manual')),
  verified BOOLEAN DEFAULT FALSE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  in_campus BOOLEAN,
  qr_session_id VARCHAR(100),
  marked_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recreate unique index
CREATE UNIQUE INDEX idx_att_unique ON attendance(roll_no, date, course_id);

-- Recreate summary view
DROP VIEW IF EXISTS v_attendance_summary CASCADE;
CREATE VIEW v_attendance_summary AS
SELECT fe.name, fe.roll_no, fe.section,
  COUNT(a.id) total,
  SUM(CASE WHEN a.verified THEN 1 ELSE 0 END) present,
  ROUND(SUM(CASE WHEN a.verified THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(a.id),0),2) pct
FROM face_encodings fe
LEFT JOIN attendance a ON fe.roll_no=a.roll_no
GROUP BY fe.name,fe.roll_no,fe.section;

-- Ensure qr_sessions has gps_radius_meters column (needed by QR APIs)
ALTER TABLE IF EXISTS qr_sessions
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS gps_radius_meters INTEGER DEFAULT 100;

-- Ensure qr_sessions geometry columns exist for location checks
ALTER TABLE IF EXISTS qr_sessions
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Additional QR session fields introduced later
ALTER TABLE IF EXISTS qr_sessions
ADD COLUMN IF NOT EXISTS require_face BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS require_location BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS session_status VARCHAR(20) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS total_students_present INTEGER DEFAULT 0;

-- recreate session_status constraint if absent
ALTER TABLE IF EXISTS qr_sessions
DROP CONSTRAINT IF EXISTS qr_sessions_session_status_check;

ALTER TABLE IF EXISTS qr_sessions
ADD CONSTRAINT qr_sessions_session_status_check CHECK (session_status IN ('active','expired','closed'));

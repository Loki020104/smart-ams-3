-- SmartAMS – Complete Supabase Schema
-- Run this in your Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  role VARCHAR(20) CHECK (role IN ('admin','faculty','student')),
  full_name VARCHAR(255),
  email VARCHAR(255),
  roll_no VARCHAR(50),
  employee_id VARCHAR(50),
  department VARCHAR(100),
  section VARCHAR(20),
  academic_year VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS face_encodings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  roll_no VARCHAR(50) UNIQUE NOT NULL,
  admission_no VARCHAR(50) UNIQUE NOT NULL,
  section VARCHAR(20),
  academic_year VARCHAR(20),
  encoding TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_att_unique ON attendance(roll_no, date, course_id);

CREATE TABLE IF NOT EXISTS system_config (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO system_config(key,value) VALUES
  ('face_recognition_enabled','false'),
  ('tolerance','0.5'),
  ('college_lat','13.0827'),
  ('college_lng','80.2707'),
  ('college_radius_km','0.5'),
  ('qr_expiry_minutes','5')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS courses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  credits INTEGER,
  department VARCHAR(100),
  semester INTEGER,
  academic_year VARCHAR(20),
  faculty_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qr_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id VARCHAR(100) UNIQUE NOT NULL,
  course_id UUID REFERENCES courses(id),
  faculty_id UUID REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  encrypted_data TEXT,
  qr_code_data TEXT,
  validity_minutes INTEGER DEFAULT 5,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  gps_radius_meters INTEGER DEFAULT 100,
  require_face BOOLEAN DEFAULT TRUE,
  require_location BOOLEAN DEFAULT TRUE,
  session_status VARCHAR(20) DEFAULT 'active' CHECK (session_status IN ('active','expired','closed')),
  total_students_present INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qr_usage_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES qr_sessions(id),
  student_id UUID REFERENCES users(id),
  roll_no VARCHAR(50),
  used_at TIMESTAMPTZ DEFAULT NOW(),
  face_verified BOOLEAN DEFAULT FALSE,
  location_verified BOOLEAN DEFAULT FALSE,
  face_confidence DECIMAL(5,2),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  device_fingerprint VARCHAR(255),
  device_os VARCHAR(100),
  device_browser VARCHAR(100),
  ip_address VARCHAR(50),
  status VARCHAR(20) DEFAULT 'valid' CHECK (status IN ('valid','duplicate','fraud_attempt','expired','failed')),
  fraud_flag BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_fingerprints (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  fingerprint_hash VARCHAR(255) UNIQUE,
  device_name VARCHAR(255),
  os VARCHAR(100),
  browser VARCHAR(100),
  ip_address VARCHAR(50),
  trusted BOOLEAN DEFAULT FALSE,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  login_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qr_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  roll_no VARCHAR(50),
  profile_qr_data TEXT,
  profile_hash VARCHAR(255),
  share_enabled BOOLEAN DEFAULT FALSE,
  shared_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_trail (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_type VARCHAR(100),
  user_id UUID REFERENCES users(id),
  session_id VARCHAR(100),
  details JSONB,
  severity VARCHAR(20) CHECK (severity IN ('low','medium','high','critical')),
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS offline_queue (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action_type VARCHAR(100),
  action_data JSONB,
  synced BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS assessments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID REFERENCES courses(id),
  title VARCHAR(255),
  type VARCHAR(50),
  date DATE,
  max_marks INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fees (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES users(id),
  fee_type VARCHAR(100),
  amount DECIMAL(10,2),
  due_date DATE,
  paid BOOLEAN DEFAULT FALSE,
  payment_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leave_applications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES users(id),
  type VARCHAR(50),
  from_date DATE,
  to_date DATE,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grievances (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES users(id),
  category VARCHAR(50),
  subject VARCHAR(255),
  description TEXT,
  anonymous BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'open',
  response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id UUID REFERENCES users(id),
  recipient_id UUID REFERENCES users(id),
  subject VARCHAR(255),
  body TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action VARCHAR(255),
  module VARCHAR(100),
  details JSONB,
  ip VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sample data (insert only if not exists)
INSERT INTO users(username,password_hash,role,full_name,email,roll_no) VALUES
  ('admin','admin123','admin','System Administrator','admin@smartams.edu',NULL),
  ('faculty1','faculty123','faculty','Dr. Smith','smith@smartams.edu',NULL),
  ('student1','student123','student','Alice Johnson','alice@smartams.edu','CS001')
ON CONFLICT DO NOTHING;

-- Attendance summary view
DROP VIEW IF EXISTS v_attendance_summary CASCADE;
CREATE VIEW v_attendance_summary AS
SELECT fe.name, fe.roll_no, fe.section,
  COUNT(a.id) total,
  SUM(CASE WHEN a.verified THEN 1 ELSE 0 END) present,
  ROUND(SUM(CASE WHEN a.verified THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(a.id),0),2) pct
FROM face_encodings fe
LEFT JOIN attendance a ON fe.roll_no=a.roll_no
GROUP BY fe.name,fe.roll_no,fe.section;

-- Phase1 extensions appended
-- SmartAMS Phase 1: Database Schema Extensions
-- Run this in Supabase SQL Editor to implement:
-- 1. Lesson Planning & Course Progress
-- 2. Notifications System  
-- 3. Assignment & Assessment Workflow

-- ============================================================
-- 1. LESSON PLANNING & COURSE PROGRESS TABLES
-- ============================================================

-- Lesson topics/syllabus management
CREATE TABLE IF NOT EXISTS lesson_plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  lesson_number INTEGER NOT NULL,
  topic_name VARCHAR(255) NOT NULL,
  description TEXT,
  learning_outcomes TEXT,
  planned_date DATE,
  estimated_hours DECIMAL(5,2),
  status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'in-progress', 'completed', 'delayed')),
  completion_percentage DECIMAL(5,2) DEFAULT 0,
  actual_completion_date DATE,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, lesson_number)
);

CREATE INDEX idx_lesson_plans_course ON lesson_plans(course_id);
CREATE INDEX idx_lesson_plans_status ON lesson_plans(status);

-- Syllabus coverage tracking
CREATE TABLE IF NOT EXISTS course_syllabus (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  total_topics INTEGER,
  completed_topics INTEGER DEFAULT 0,
  coverage_percentage DECIMAL(5,2) DEFAULT 0,
  planned_completion_date DATE,
  actual_completion_date DATE,
  syllabus_document_url VARCHAR(500),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX idx_course_syllabus_course ON course_syllabus(course_id);

-- ============================================================
-- 2. NOTIFICATION SYSTEM TABLES
-- ============================================================

-- User notifications (one-to-one messages)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id UUID REFERENCES users(id),
  recipient_id UUID REFERENCES users(id),
  notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN (
    'announcement', 'alert', 'message', 'timetable', 'assignment', 'grade', 'attendance', 'event'
  )),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  related_course_id UUID REFERENCES courses(id),
  related_assignment_id UUID,
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  action_url VARCHAR(500),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);
CREATE INDEX idx_notifications_type ON notifications(notification_type);

-- Broadcast announcements (one-to-many)
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id UUID REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  announcement_type VARCHAR(50) NOT NULL CHECK (announcement_type IN (
    'timetable', 'assignment', 'alert', 'news', 'maintenance', 'event'
  )),
  target_role VARCHAR(20) CHECK (target_role IN ('student', 'faculty', 'admin', 'all')),
  target_department VARCHAR(100),
  target_semester INTEGER,
  target_course_id UUID REFERENCES courses(id),
  attachment_url VARCHAR(500),
  visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'drafts', 'archived')),
  priority VARCHAR(20) DEFAULT 'normal',
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Announcement views tracking
CREATE TABLE IF NOT EXISTS announcement_views (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_announcement_views ON announcement_views(announcement_id, user_id);

-- ============================================================
-- 3. ASSIGNMENT & ASSESSMENT WORKFLOW TABLES
-- ============================================================

-- Assignment creation and management
CREATE TABLE IF NOT EXISTS assignments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  faculty_id UUID REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  assignment_type VARCHAR(50) CHECK (assignment_type IN ('homework', 'project', 'quiz', 'practical', 'presentation')),
  total_marks INTEGER DEFAULT 100,
  due_date TIMESTAMPTZ NOT NULL,
  submission_type VARCHAR(50) DEFAULT 'file' CHECK (submission_type IN ('file', 'text', 'link', 'mixed')),
  allow_late_submission BOOLEAN DEFAULT FALSE,
  late_submission_penalty DECIMAL(5,2) DEFAULT 0,
  rubric_url VARCHAR(500),
  attachment_url VARCHAR(500),
  status VARCHAR(20) DEFAULT 'published' CHECK (status IN ('draft', 'published', 'closed', 'graded')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assignments_course ON assignments(course_id);
CREATE INDEX idx_assignments_faculty ON assignments(faculty_id);
CREATE INDEX idx_assignments_due ON assignments(due_date);

-- Student assignment submissions
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id),
  submission_file_url VARCHAR(500),
  submission_text TEXT,
  submission_link VARCHAR(500),
  submitted_at TIMESTAMPTZ,
  submission_status VARCHAR(20) DEFAULT 'pending' CHECK (submission_status IN ('pending', 'submitted', 'late', 'missing')),
  marks_obtained DECIMAL(5,2),
  feedback TEXT,
  graded_by UUID REFERENCES users(id),
  graded_at TIMESTAMPTZ,
  grade_remarks VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX idx_submissions_student ON assignment_submissions(student_id);
CREATE INDEX idx_submissions_status ON assignment_submissions(submission_status);
CREATE UNIQUE INDEX idx_submissions_unique ON assignment_submissions(assignment_id, student_id);

-- Overall grades/marks
CREATE TABLE IF NOT EXISTS grades (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES users(id),
  course_id UUID REFERENCES courses(id),
  assessment_type VARCHAR(50) CHECK (assessment_type IN ('assignment', 'quiz', 'midterm', 'final', 'project', 'internal')),
  assessment_id UUID, -- Links to assignments or exams
  marks_obtained DECIMAL(5,2) NOT NULL,
  total_marks DECIMAL(5,2) NOT NULL DEFAULT 100,
  grade_percentage DECIMAL(5,2) GENERATED ALWAYS AS (marks_obtained * 100 / total_marks) STORED,
  grade_letter VARCHAR(2),
  grade_points DECIMAL(3,2),
  recorded_by UUID REFERENCES users(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_grades_student ON grades(student_id);
CREATE INDEX idx_grades_course ON grades(course_id);
CREATE INDEX idx_grades_type ON grades(assessment_type);

-- Grade scale configuration (for institutions)
CREATE TABLE IF NOT EXISTS grade_scales (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  institution_name VARCHAR(255),
  grade_letter VARCHAR(2) NOT NULL,
  min_marks DECIMAL(5,2),
  max_marks DECIMAL(5,2),
  grade_points DECIMAL(3,2),
  description VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_name, grade_letter)
);

-- Sample grade scale (can be customized)
INSERT INTO grade_scales (institution_name, grade_letter, min_marks, max_marks, grade_points, description)
VALUES 
  ('Default', 'A+', 90, 100, 4.0, 'Excellent'),
  ('Default', 'A', 80, 89.99, 3.8, 'Very Good'),
  ('Default', 'B+', 70, 79.99, 3.5, 'Good'),
  ('Default', 'B', 60, 69.99, 3.0, 'Satisfactory'),
  ('Default', 'C', 50, 59.99, 2.5, 'Average'),
  ('Default', 'D', 40, 49.99, 2.0, 'Below Average'),
  ('Default', 'F', 0, 39.99, 0.0, 'Fail')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. CONVENIENCE VIEWS FOR DASHBOARDS
-- ============================================================

-- Course progress view for faculty/admin
CREATE OR REPLACE VIEW v_course_progress AS
SELECT 
  c.id as course_id,
  c.code,
  c.name,
  c.faculty_id,
  u.full_name as faculty_name,
  cs.total_topics,
  cs.completed_topics,
  cs.coverage_percentage,
  COUNT(DISTINCT CASE WHEN lp.status = 'completed' THEN lp.id END) as lessons_completed,
  COUNT(DISTINCT lp.id) as total_lessons,
  ROUND(COUNT(DISTINCT CASE WHEN lp.status = 'completed' THEN lp.id END)::numeric / 
        NULLIF(COUNT(DISTINCT lp.id), 0) * 100, 2) as lesson_completion_rate,
  cs.planned_completion_date,
  cs.actual_completion_date
FROM courses c
LEFT JOIN course_syllabus cs ON c.id = cs.course_id
LEFT JOIN lesson_plans lp ON c.id = lp.course_id
LEFT JOIN users u ON c.faculty_id = u.id
GROUP BY c.id, c.code, c.name, c.faculty_id, u.full_name, cs.total_topics, cs.completed_topics, cs.coverage_percentage, cs.planned_completion_date, cs.actual_completion_date;

-- Student assignment summary view
CREATE OR REPLACE VIEW v_student_assignments AS
SELECT 
  asub.student_id,
  u.full_name as student_name,
  a.course_id,
  c.name as course_name,
  COUNT(DISTINCT a.id) as total_assignments,
  COUNT(DISTINCT CASE WHEN asub.submission_status = 'submitted' THEN asub.id END) as submitted_count,
  COUNT(DISTINCT CASE WHEN asub.submission_status = 'pending' THEN asub.id END) as pending_count,
  COUNT(DISTINCT CASE WHEN asub.submission_status = 'missing' THEN asub.id END) as missing_count,
  ROUND(AVG(asub.marks_obtained), 2) as average_marks,
  MAX(a.due_date) as next_due_date
FROM assignment_submissions asub
LEFT JOIN assignments a ON a.id = asub.assignment_id
LEFT JOIN courses c ON a.course_id = c.id
LEFT JOIN users u ON asub.student_id = u.id
GROUP BY asub.student_id, u.full_name, a.course_id, c.name;

-- Notification summary for dashboard
CREATE OR REPLACE VIEW v_user_notification_summary AS
SELECT 
  recipient_id,
  COUNT(*) as total_notifications,
  COUNT(CASE WHEN is_read = FALSE THEN 1 END) as unread_count,
  MAX(created_at) as last_notification_at
FROM notifications
WHERE deleted_at IS NULL
GROUP BY recipient_id;

-- ============================================================
-- 5. PERMISSIONS/ROW LEVEL SECURITY SETUP (Optional)
-- ============================================================
-- Note: RLS policies require proper auth setup. 
-- If you get errors, skip this section and enable RLS from Supabase Dashboard instead.

-- Uncomment below if your auth.uid() is properly configured:
/*
ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

-- RLS Policies (examples - customize based on your needs)
CREATE POLICY "Students see own notifications"
  ON notifications FOR SELECT
  USING (recipient_id = auth.uid());

CREATE POLICY "Students see own submissions"
  ON assignment_submissions FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Students see own grades"
  ON grades FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Faculty see own assignments"
  ON assignments FOR SELECT
  USING (faculty_id = auth.uid());
*/

-- ============================================================
-- 6. SAMPLE DATA FOR TESTING (Optional)
-- ============================================================

-- Insert sample lesson plans for testing
-- (Uncomment after verifying table creation)
/*
INSERT INTO lesson_plans (course_id, lesson_number, topic_name, description, status, created_by)
SELECT 
  id, 
  1, 
  'Introduction to ' || name,
  'Basic concepts and overview',
  'completed',
  faculty_id
FROM courses
LIMIT 3;
*/

-- ============================================================
-- Summary of Tables Created/Modified:
-- ============================================================
-- NEW:
--   lesson_plans - Store course lesson topics and progress
--   course_syllabus - Overall course coverage tracking
--   notifications - One-to-one user notifications
--   announcements - Broadcast announcements/alerts
--   announcement_views - Track who viewed announcements
--   assignments - Assignment definitions
--   assignment_submissions - Student submissions
--   grades - Individual assessment grades
--   grade_scales - Grade letter mappings
--
-- VIEWS:
--   v_course_progress - Faculty/admin course overview
--   v_student_assignments - Student assignment summary
--   v_user_notification_summary - Notification dashboard
--
-- ============================================================

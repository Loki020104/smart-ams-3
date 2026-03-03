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

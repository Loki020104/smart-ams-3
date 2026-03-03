-- SmartAMS CSV Import Setup
-- Run this ONCE to create all base data before importing CSVs
-- After this runs, you can import CSV files for each table

-- ================================================================
-- STEP 1: Create Faculty Users
-- ================================================================
INSERT INTO users (username, password_hash, role, full_name, email, employee_id, department, academic_year)
VALUES 
  ('faculty_khan', 'hash123', 'faculty', 'Dr. Mohammad Khan', 'khan@college.edu', 'FAC001', 'CSE', '2025-26'),
  ('faculty_sharma', 'hash123', 'faculty', 'Prof. Sharma', 'sharma@college.edu', 'FAC002', 'ECE', '2025-26'),
  ('faculty_gupta', 'hash123', 'faculty', 'Ms. Priya Gupta', 'gupta@college.edu', 'FAC003', 'CSE', '2025-26'),
  ('faculty_patel', 'hash123', 'faculty', 'Dr. Rajesh Patel', 'patel@college.edu', 'FAC004', 'ECE', '2025-26'),
  ('faculty_verma', 'hash123', 'faculty', 'Prof. Deepak Verma', 'verma@college.edu', 'FAC005', 'CSE', '2025-26'),
  ('faculty_nair', 'hash123', 'faculty', 'Dr. Arun Nair', 'nair@college.edu', 'FAC006', 'ECE', '2025-26'),
  ('faculty_roy', 'hash123', 'faculty', 'Prof. Suresh Roy', 'roy@college.edu', 'FAC007', 'ME', '2025-26'),
  ('faculty_desai', 'hash123', 'faculty', 'Ms. Meera Desai', 'desai@college.edu', 'FAC008', 'CE', '2025-26'),
  ('admin_user', 'hash123', 'admin', 'Admin User', 'admin@college.edu', 'ADM001', 'Admin', '2025-26')
ON CONFLICT (username) DO NOTHING;

-- ================================================================
-- STEP 2: Create Courses (linked to faculty)
-- ================================================================
INSERT INTO courses (code, name, credits, department, semester, academic_year, faculty_id)
VALUES 
  ('CS101', 'Data Structures and Algorithms', 4, 'CSE', 3, '2025-26', (SELECT id FROM users WHERE username='faculty_khan' LIMIT 1)),
  ('CS102', 'Database Management Systems', 4, 'CSE', 3, '2025-26', (SELECT id FROM users WHERE username='faculty_sharma' LIMIT 1)),
  ('CS103', 'Design and Analysis of Algorithms', 3, 'CSE', 4, '2025-26', (SELECT id FROM users WHERE username='faculty_gupta' LIMIT 1)),
  ('CS201', 'Operating Systems', 4, 'CSE', 5, '2025-26', (SELECT id FROM users WHERE username='faculty_patel' LIMIT 1)),
  ('CS202', 'Computer Networks', 4, 'CSE', 5, '2025-26', (SELECT id FROM users WHERE username='faculty_verma' LIMIT 1)),
  ('EC101', 'Digital Electronics', 4, 'ECE', 3, '2025-26', (SELECT id FROM users WHERE username='faculty_nair' LIMIT 1)),
  ('EC102', 'Signals and Systems', 4, 'ECE', 4, '2025-26', (SELECT id FROM users WHERE username='faculty_roy' LIMIT 1)),
  ('EC201', 'Microprocessors', 3, 'ECE', 5, '2025-26', (SELECT id FROM users WHERE username='faculty_desai' LIMIT 1))
ON CONFLICT (code) DO NOTHING;

-- ================================================================
-- STEP 3: Create Student Users (for CSV student import reference)
-- ================================================================
INSERT INTO users (username, password_hash, role, full_name, email, roll_no, department, section, academic_year)
VALUES 
  ('student_001', 'hash123', 'student', 'Raj Kumar', 'raj001@college.edu', '20261CSE001', 'CSE', 'A', '2025-26'),
  ('student_002', 'hash123', 'student', 'Priya Singh', 'priya002@college.edu', '20261CSE002', 'CSE', 'A', '2025-26'),
  ('student_003', 'hash123', 'student', 'Arjun Patel', 'arjun003@college.edu', '20261CSE003', 'CSE', 'B', '2025-26'),
  ('student_004', 'hash123', 'student', 'Neha Verma', 'neha004@college.edu', '20261ECE001', 'ECE', 'A', '2025-26'),
  ('student_005', 'hash123', 'student', 'Aditya Singh', 'aditya005@college.edu', '20261ECE002', 'ECE', 'B', '2025-26')
ON CONFLICT (username) DO NOTHING;

-- ================================================================
-- Verification Queries
-- ================================================================
SELECT '--- Faculty Created ---' as status;
SELECT COUNT(*) as faculty_count FROM users WHERE role='faculty';

SELECT '--- Courses Created ---' as status;
SELECT COUNT(*) as courses_count FROM courses;

SELECT '--- Students Created ---' as status;
SELECT COUNT(*) as student_count FROM users WHERE role='student';

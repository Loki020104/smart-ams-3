-- Step 1: Insert Faculty Members first
-- These will be referenced by the courses table

-- Get faculty IDs from here to use in courses.csv

INSERT INTO users (username, password_hash, role, full_name, email, employee_id, department, academic_year)
VALUES 
  ('faculty_khan', '$2b$10$examplehash1', 'faculty', 'Dr. Mohammad Khan', 'khan@college.edu', 'FAC001', 'CSE', '2025-26'),
  ('faculty_sharma', '$2b$10$examplehash2', 'faculty', 'Prof. Sharma', 'sharma@college.edu', 'FAC002', 'ECE', '2025-26'),
  ('faculty_gupta', '$2b$10$examplehash3', 'faculty', 'Ms. Priya Gupta', 'gupta@college.edu', 'FAC003', 'CSE', '2025-26'),
  ('faculty_patel', '$2b$10$examplehash4', 'faculty', 'Dr. Rajesh Patel', 'patel@college.edu', 'FAC004', 'ECE', '2025-26'),
  ('faculty_verma', '$2b$10$examplehash5', 'faculty', 'Prof. Deepak Verma', 'verma@college.edu', 'FAC005', 'CSE', '2025-26'),
  ('faculty_nair', '$2b$10$examplehash6', 'faculty', 'Dr. Arun Nair', 'nair@college.edu', 'FAC006', 'EC', '2025-26'),
  ('faculty_roy', '$2b$10$examplehash7', 'faculty', 'Prof. Suresh Roy', 'roy@college.edu', 'FAC007', 'ME', '2025-26'),
  ('faculty_desai', '$2b$10$examplehash8', 'faculty', 'Ms. Meera Desai', 'desai@college.edu', 'FAC008', 'CE', '2025-26')
ON CONFLICT (username) DO NOTHING;

-- Step 2: Get the generated UUIDs and insert Courses
-- NOTE: Replace the UUID values below with actual IDs from your users table
-- Run this query first to get the IDs:
-- SELECT id, full_name FROM users WHERE role='faculty' AND username LIKE 'faculty_%';

-- Then update the faculty_id UUIDs below with the actual values from your database

INSERT INTO courses (code, name, credits, department, semester, academic_year, faculty_id)
VALUES 
  ('CS101', 'Data Structures and Algorithms', 4, 'CSE', 3, '2025-26', (SELECT id FROM users WHERE username='faculty_khan' LIMIT 1)),
  ('CS102', 'Database Management Systems', 4, 'CSE', 3, '2025-26', (SELECT id FROM users WHERE username='faculty_sharma' LIMIT 1)),
  ('CS103', 'Design and Analysis of Algorithms', 3, 'CSE', 4, '2025-26', (SELECT id FROM users WHERE username='faculty_gupta' LIMIT 1)),
  ('CS201', 'Operating Systems', 4, 'CSE', 5, '2025-26', (SELECT id FROM users WHERE username='faculty_patel' LIMIT 1)),
  ('CS202', 'Computer Networks', 4, 'CSE', 5, '2025-26', (SELECT id FROM users WHERE username='faculty_verma' LIMIT 1)),
  ('EC101', 'Digital Electronics', 4, 'ECE', 3, '2025-26', (SELECT id FROM users WHERE username='faculty_nair' LIMIT 1)),
  ('EC102', 'Signals and Systems', 4, 'ECE', 4, '2025-26', (SELECT id FROM users WHERE username='faculty_roy' LIMIT 1)),
  ('EC201', 'Microprocessors', 3, 'ECE', 5, '2025-26', (SELECT id FROM users WHERE username='faculty_desai' LIMIT 1)),
  ('CS104', 'Web Technologies', 3, 'CSE', 4, '2025-26', (SELECT id FROM users WHERE username='faculty_khan' LIMIT 1)),
  ('CS203', 'Machine Learning', 4, 'CSE', 6, '2025-26', (SELECT id FROM users WHERE username='faculty_gupta' LIMIT 1))
ON CONFLICT (code) DO NOTHING;

-- Verify insertion
SELECT 'Faculty created:' AS status, COUNT(*) FROM users WHERE role='faculty';
SELECT 'Courses created:' AS status, COUNT(*) FROM courses;

-- ============================================================================
-- FACE RECOGNITION VERIFICATION SYSTEM - COMPLETE SETUP
-- Run ALL sections in your Supabase SQL Editor
-- ============================================================================

-- Section 1: Add max_face_attempts configuration
-- ============================================================================
INSERT INTO system_config(key,value) VALUES
  ('max_face_attempts','2')
ON CONFLICT(key) DO UPDATE SET value='2';

-- Section 2: Create verification_attempts table to track per-session verification attempts
-- ============================================================================
DROP TABLE IF EXISTS verification_attempts CASCADE;

CREATE TABLE verification_attempts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  roll_no VARCHAR(50) NOT NULL,
  attempt_number INTEGER DEFAULT 1,
  session_id VARCHAR(255),
  verified BOOLEAN DEFAULT FALSE,
  matched_roll_no VARCHAR(50),
  distance DECIMAL(5,4),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookup
CREATE INDEX idx_verification_attempts_roll_no_session 
ON verification_attempts(roll_no, session_id);

-- View to check current attempt count for a student in session
DROP VIEW IF EXISTS v_current_attempts CASCADE;
CREATE VIEW v_current_attempts AS
SELECT 
  roll_no,
  session_id,
  COUNT(*) as attempt_count,
  MAX(timestamp) as last_attempt,
  BOOL_OR(verified) as any_verified
FROM verification_attempts
WHERE timestamp >= NOW() - INTERVAL '1 day'
  AND session_id IS NOT NULL
GROUP BY roll_no, session_id;

-- Section 3: Disable Row-Level Security (RLS) on critical tables
-- ============================================================================
-- This allows the backend to INSERT/UPDATE records for face attendance
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE face_encodings DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE verification_attempts DISABLE ROW LEVEL SECURITY;
ALTER TABLE qr_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE qr_usage_log DISABLE ROW LEVEL SECURITY;

-- Verify RLS status - should show 'f' (false = disabled) for all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('attendance', 'face_encodings', 'system_config', 'verification_attempts', 'qr_sessions', 'qr_usage_log')
ORDER BY tablename;

-- ============================================================================
-- EXPLANATION OF THE NEW VERIFICATION SYSTEM
-- ============================================================================
-- 
-- FLOW:
-- 1. Student logs in with username & password
--    - Student's roll_no is stored in sessionStorage
--
-- 2. Student initiates face recognition attendance
--    - A session_id is generated (unique per attendance attempt)
--
-- 3. Student captures their face
--    
-- 4. Backend verifies:
--    a) Liveness check (eyes open, real person)
--    b) Face detection (exactly 1 face)
--    c) Face matching (distance ≤ 0.45)
--    d) Identity verification (matched_roll_no == logged_in_roll_no)
--
-- 5. Attempt tracking:
--    - If verification fails, record attempt in verification_attempts table
--    - Check current attempt count
--    - Allow max_face_attempts (default 2) before rejection
--
-- 6. Results:
--    - SUCCESS: If both face match AND identity match → Mark PRESENT
--    - FAIL: If conditions not met → Show error + remaining attempts
--    - EXHAUSTED: After max attempts → "Contact SmartAMS Admin"
--
-- ============================================================================
-- ADMIN CONTROL: Adjust max verification attempts
-- ============================================================================
-- To change from 2 to 3 attempts:
UPDATE system_config SET value='3' WHERE key='max_face_attempts';

-- To change from 2 to 1 attempt:
UPDATE system_config SET value='1' WHERE key='max_face_attempts';

-- View current setting:
SELECT value FROM system_config WHERE key='max_face_attempts';

-- ============================================================================
-- MONITORING: View verification attempts
-- ============================================================================
-- See all failed attempts:
SELECT roll_no, attempt_number, session_id, matched_roll_no, distance, verified, timestamp
FROM verification_attempts
WHERE verified = FALSE
ORDER BY timestamp DESC
LIMIT 20;

-- See successful verifications:
SELECT roll_no, session_id, distance, timestamp
FROM verification_attempts
WHERE verified = TRUE
ORDER BY timestamp DESC
LIMIT 20;

-- See current attempt count for a specific student:
SELECT * FROM v_current_attempts
WHERE roll_no = '2026lcse0001'
ORDER BY last_attempt DESC;

-- Add max_face_attempts to system_config
INSERT INTO system_config(key,value) VALUES
  ('max_face_attempts','2')
ON CONFLICT(key) DO UPDATE SET value='2';

-- Create or update verification_attempts table to track per-session attempts
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

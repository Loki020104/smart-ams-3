-- Run this in Supabase SQL Editor to fix RLS issues

-- Disable RLS on attendance table so backend can insert records
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;

-- Disable RLS on other tables that might need backend writes
ALTER TABLE face_encodings DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE qr_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE qr_usage_log DISABLE ROW LEVEL SECURITY;

-- Verify RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('attendance', 'face_encodings', 'system_config', 'qr_sessions', 'qr_usage_log')
ORDER BY tablename;

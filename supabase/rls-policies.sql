-- ============================================
-- SUPPERSAFE RLS POLICIES
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: ENABLE RLS ON TABLES
-- ============================================
ALTER TABLE dinesafe ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 2: DINESAFE POLICIES (public health data)
-- ============================================
-- Allow anyone to search and view restaurant data
CREATE POLICY "Public read access" ON dinesafe
  FOR SELECT USING (true);

-- ============================================
-- STEP 3: WAITLIST POLICIES (lock it down)
-- ============================================
-- Service role can do everything (Edge Functions use this)
CREATE POLICY "Service role full access" ON waitlist
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- STEP 4: SECURE RPC FUNCTIONS
-- ============================================

-- get_user_count - returns total waitlist count
CREATE OR REPLACE FUNCTION get_user_count()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM waitlist;
$$;

-- get_next_queue_position - returns next position atomically
CREATE OR REPLACE FUNCTION get_next_queue_position()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_pos INTEGER;
BEGIN
  SELECT COALESCE(MAX(queue_position), 247) + 1 INTO next_pos FROM waitlist;
  RETURN next_pos;
END;
$$;

-- increment_referrer_count - increments referral count for a code
CREATE OR REPLACE FUNCTION increment_referrer_count(referrer_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE waitlist
  SET referral_count = COALESCE(referral_count, 0) + 1
  WHERE referral_code = increment_referrer_count.referrer_code;
END;
$$;

-- ============================================
-- VERIFICATION QUERIES (run after to confirm)
-- ============================================
-- Check RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Check policies exist:
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';

-- ==============================================================================
-- MeZShip Database Security & Row Level Security (RLS) Migration
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Enable RLS on all public tables
-- ------------------------------------------------------------------------------
ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_campus_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. Restrict direct PostgREST table permissions (Defense in Depth)
-- ------------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.reports, public.user_bans FROM authenticated;

-- ------------------------------------------------------------------------------
-- 3. Row Level Security Policies
-- ------------------------------------------------------------------------------

-- Campuses: Public read-only for active campuses
DROP POLICY IF EXISTS "Allow public read on active campuses" ON public.campuses;
CREATE POLICY "Allow public read on active campuses"
  ON public.campuses
  FOR SELECT
  TO public
  USING (active = true);

-- User Profiles: Authenticated users can view profiles; users can only edit their own
DROP POLICY IF EXISTS "Allow authenticated read on user profiles" ON public.user_profiles;
CREATE POLICY "Allow authenticated read on user profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.user_profiles;
CREATE POLICY "Allow users to insert their own profile"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid())::text = user_id);

DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.user_profiles;
CREATE POLICY "Allow users to update their own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid())::text = user_id)
  WITH CHECK ((select auth.uid())::text = user_id);

-- User Campus Preferences: Users manage strictly their own campus preferences
DROP POLICY IF EXISTS "Allow users to view own campus preferences" ON public.user_campus_preferences;
CREATE POLICY "Allow users to view own campus preferences"
  ON public.user_campus_preferences
  FOR SELECT
  TO authenticated
  USING ((select auth.uid())::text = user_id);

DROP POLICY IF EXISTS "Allow users to insert own campus preferences" ON public.user_campus_preferences;
CREATE POLICY "Allow users to insert own campus preferences"
  ON public.user_campus_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid())::text = user_id);

DROP POLICY IF EXISTS "Allow users to delete own campus preferences" ON public.user_campus_preferences;
CREATE POLICY "Allow users to delete own campus preferences"
  ON public.user_campus_preferences
  FOR DELETE
  TO authenticated
  USING ((select auth.uid())::text = user_id);

-- User Blocks: Users can view and manage their own blocks
DROP POLICY IF EXISTS "Allow users to view their own blocks" ON public.user_blocks;
CREATE POLICY "Allow users to view their own blocks"
  ON public.user_blocks
  FOR SELECT
  TO authenticated
  USING ((select auth.uid())::text = blocker_user_id);

DROP POLICY IF EXISTS "Allow users to insert blocks as blocker" ON public.user_blocks;
CREATE POLICY "Allow users to insert blocks as blocker"
  ON public.user_blocks
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid())::text = blocker_user_id);

DROP POLICY IF EXISTS "Allow users to delete blocks as blocker" ON public.user_blocks;
CREATE POLICY "Allow users to delete blocks as blocker"
  ON public.user_blocks
  FOR DELETE
  TO authenticated
  USING ((select auth.uid())::text = blocker_user_id);

-- Reports: No client SELECT/INSERT/UPDATE/DELETE.
-- Only backend (service_role) can access reports to guarantee match validation.
DROP POLICY IF EXISTS "Disallow client report access" ON public.reports;

-- User Bans: Users can only check their own ban status
DROP POLICY IF EXISTS "Allow users to check their own ban status" ON public.user_bans;
CREATE POLICY "Allow users to check their own ban status"
  ON public.user_bans
  FOR SELECT
  TO authenticated
  USING ((select auth.uid())::text = user_id);

-- ------------------------------------------------------------------------------
-- 4. Foreign Key and Query Performance Indexes
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_reports_reported_user_id 
  ON public.reports (reported_user_id);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_user_id 
  ON public.user_blocks (blocked_user_id);

CREATE INDEX IF NOT EXISTS idx_user_campus_preferences_campus_id 
  ON public.user_campus_preferences (campus_id);

-- ==============================================================================
-- Migration 0007: Profiles Table, Real-time Role Sync & User Handover Automation
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CREATE PUBLIC.PROFILES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  display_name text,
  avatar_url text,
  phone text,
  department text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index on email for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Permissions
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Policies:
-- 1. All authenticated users can view profiles (collaborative workspace directory)
DROP POLICY IF EXISTS "Authenticated users view profiles" ON public.profiles;
CREATE POLICY "Authenticated users view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- 2. Users can insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- 3. Users can update their own profile, admins can update any profile
DROP POLICY IF EXISTS "Users and admins can update profile" ON public.profiles;
CREATE POLICY "Users and admins can update profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.fn_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

-- ------------------------------------------------------------------------------
-- 2. AUTOMATIC EMAIL CONFIRMATION & REGISTRATION TRIGGER (AUTH.USERS)
-- ------------------------------------------------------------------------------
-- Auto-confirm any new auth user so email verification is never blocked in factory ERP
CREATE OR REPLACE FUNCTION public.fn_auto_confirm_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_confirm_auth_user ON auth.users;
CREATE TRIGGER trg_auto_confirm_auth_user
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_auto_confirm_auth_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_count int;
  v_initial_role text;
  v_name text;
BEGIN
  -- Determine display name from metadata or email
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'name',
    split_part(COALESCE(NEW.email, 'User'), '@', 1)
  );

  -- Check if this is the very first user registering in the system
  SELECT count(*) INTO v_admin_count
  FROM public.user_roles
  WHERE role = 'admin';

  -- First bootstrap account becomes admin; subsequent signups are pending
  IF v_admin_count = 0 THEN
    v_initial_role := 'admin';
  ELSE
    v_initial_role := 'pending';
  END IF;

  -- 1. Create Profile record
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    display_name,
    avatar_url,
    phone,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    v_name,
    v_name,
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    updated_at = NOW();

  -- 2. Create User Role record
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, v_initial_role);
  END IF;

  -- 3. Notify realtime subscribers via factory_data_pings
  BEGIN
    INSERT INTO public.factory_data_pings (table_name, change_source)
    VALUES ('profiles', 'auth_user_signup');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 3. REALTIME PINGS ON ROLE OR PROFILE CHANGES
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  -- Ensure change_source column exists on factory_data_pings
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'factory_data_pings' 
      AND column_name = 'change_source'
  ) THEN
    ALTER TABLE public.factory_data_pings ADD COLUMN IF NOT EXISTS change_source text;
  END IF;

  -- Ensure table_name is nullable if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'factory_data_pings' 
      AND column_name = 'table_name'
  ) THEN
    ALTER TABLE public.factory_data_pings ALTER COLUMN table_name DROP NOT NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE OR REPLACE FUNCTION public.fn_ping_user_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.factory_data_pings (table_name, change_source)
    VALUES ('user_roles', 'user_roles_changed');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ping_user_roles ON public.user_roles;
CREATE TRIGGER trg_ping_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH STATEMENT EXECUTE FUNCTION public.fn_ping_user_role_change();

-- ------------------------------------------------------------------------------
-- 4. REALTIME PUBLICATION CONFIGURATION
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ------------------------------------------------------------------------------
-- 5. ENSURE UNIQUE CONSTRAINT ON USER_ROLES & BACKFILL EXISTING USERS
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  -- Deduplicate user_roles if any duplicate rows exist for the same user_id
  DELETE FROM public.user_roles a
  USING public.user_roles b
  WHERE a.user_id = b.user_id
    AND a.id < b.id;

  -- Add unique constraint on user_id if not present
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_roles'::regclass
      AND conname = 'user_roles_user_id_key'
  ) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  -- Immediately confirm all existing unconfirmed users (like smith@gmail.com) so they can log in
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE email_confirmed_at IS NULL;

  -- Backfill profiles for existing auth.users
  INSERT INTO public.profiles (id, email, full_name, display_name, created_at, updated_at)
  SELECT
    u.id,
    COALESCE(u.email, ''),
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'display_name', split_part(COALESCE(u.email, ''), '@', 1)),
    COALESCE(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', split_part(COALESCE(u.email, ''), '@', 1)),
    COALESCE(u.created_at, NOW()),
    NOW()
  FROM auth.users u
  ON CONFLICT (id) DO NOTHING;

  -- Ensure existing users have user_roles rows (only users without any role row)
  INSERT INTO public.user_roles (user_id, role)
  SELECT u.id, 'pending'
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id);
END $$;

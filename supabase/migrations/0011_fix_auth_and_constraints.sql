-- ==============================================================================
-- Migration 0011: Fix Auth & Constraint Issues (Login/Sign-Up)
-- ==============================================================================
-- This migration fixes the root causes of login and sign-up failures:
--   1. Deduplicates user_roles and ensures UNIQUE(user_id) single-column constraint
--   2. Ensures email_confirmed_at is set for all existing users
--   3. Re-attaches and corrects handle_new_user trigger
--   4. Ensures allowed_pages has correct defaults for all existing users
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: Deduplicate user_roles — keep the highest-privilege role per user
-- ------------------------------------------------------------------------------
-- Priority order: admin > manager > supervisor > accountant > dispatch_clerk > user > viewer > pending
DO $$
BEGIN
  -- Delete lower-priority duplicate rows (keep only 1 row per user_id)
  DELETE FROM public.user_roles a
  USING public.user_roles b
  WHERE a.user_id = b.user_id
    AND a.id <> b.id
    AND (
      -- Keep the row with the higher-privilege role
      CASE b.role
        WHEN 'admin'         THEN 8
        WHEN 'manager'       THEN 7
        WHEN 'supervisor'    THEN 6
        WHEN 'accountant'    THEN 5
        WHEN 'dispatch_clerk'THEN 4
        WHEN 'user'          THEN 3
        WHEN 'viewer'        THEN 2
        WHEN 'pending'       THEN 1
        ELSE 0
      END
      >
      CASE a.role
        WHEN 'admin'         THEN 8
        WHEN 'manager'       THEN 7
        WHEN 'supervisor'    THEN 6
        WHEN 'accountant'    THEN 5
        WHEN 'dispatch_clerk'THEN 4
        WHEN 'user'          THEN 3
        WHEN 'viewer'        THEN 2
        WHEN 'pending'       THEN 1
        ELSE 0
      END
    );

  -- If any exact-same-role duplicates remain, keep the earliest (smallest id)
  DELETE FROM public.user_roles a
  USING public.user_roles b
  WHERE a.user_id = b.user_id
    AND a.id > b.id;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Dedup step encountered an error: %', SQLERRM;
END $$;

-- ------------------------------------------------------------------------------
-- STEP 2: Drop composite unique constraint, add single-column UNIQUE(user_id)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  -- Drop the old composite unique (user_id, role) if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_roles'::regclass
      AND contype = 'u'
      AND conname != 'user_roles_user_id_key'
      AND array_length(conkey, 1) > 1
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.user_roles DROP CONSTRAINT ' || quote_ident(conname)
      FROM pg_constraint
      WHERE conrelid = 'public.user_roles'::regclass
        AND contype = 'u'
        AND conname != 'user_roles_user_id_key'
        AND array_length(conkey, 1) > 1
      LIMIT 1
    );
  END IF;

  -- Add single-column unique on user_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_roles'::regclass
      AND conname = 'user_roles_user_id_key'
  ) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Constraint step error: %', SQLERRM;
END $$;

-- ------------------------------------------------------------------------------
-- STEP 3: Confirm all existing unconfirmed users (no email verification)
-- ------------------------------------------------------------------------------
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email_confirmed_at IS NULL;

-- ------------------------------------------------------------------------------
-- STEP 4: Backfill profiles for any users without one
-- ------------------------------------------------------------------------------
INSERT INTO public.profiles (id, email, full_name, display_name, created_at, updated_at)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'display_name',
    split_part(COALESCE(u.email, 'user@unknown'), '@', 1)
  ),
  COALESCE(
    u.raw_user_meta_data->>'display_name',
    u.raw_user_meta_data->>'full_name',
    split_part(COALESCE(u.email, 'user@unknown'), '@', 1)
  ),
  COALESCE(u.created_at, NOW()),
  NOW()
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- STEP 5: Backfill user_roles for any auth.users without a role row
-- ------------------------------------------------------------------------------
INSERT INTO public.user_roles (user_id, role, allowed_pages)
SELECT
  u.id,
  'pending',
  ARRAY[]::text[]
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id
);

-- ------------------------------------------------------------------------------
-- STEP 6: Ensure allowed_pages is populated for all existing users
-- ------------------------------------------------------------------------------
-- Admin gets all pages; non-pending gets standard pages; pending gets none
UPDATE public.user_roles
SET allowed_pages = CASE
  WHEN role = 'admin' THEN ARRAY[
    'dashboard', 'orders', 'production', 'dispatch',
    'parties', 'catalog', 'workers', 'expenses', 'reports', 'settings', 'profile'
  ]
  WHEN role = 'pending' THEN ARRAY[]::text[]
  ELSE ARRAY[
    'dashboard', 'orders', 'production', 'dispatch',
    'parties', 'catalog', 'workers', 'settings', 'profile'
  ]
END
WHERE allowed_pages IS NULL OR array_length(allowed_pages, 1) IS NULL;

-- ------------------------------------------------------------------------------
-- STEP 7: Replace handle_new_user (clean version, avoids all prior bugs)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_count int;
  v_initial_role text;
  v_initial_pages text[];
  v_name text;
BEGIN
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'name',
    split_part(COALESCE(NEW.email, 'User'), '@', 1)
  );

  -- First user registered becomes Admin; subsequent users are pending
  SELECT count(*) INTO v_admin_count
  FROM public.user_roles
  WHERE role = 'admin';

  IF v_admin_count = 0 THEN
    v_initial_role := 'admin';
    v_initial_pages := ARRAY[
      'dashboard', 'orders', 'production', 'dispatch',
      'parties', 'catalog', 'workers', 'expenses', 'reports', 'settings', 'profile'
    ];
  ELSE
    v_initial_role := 'pending';
    v_initial_pages := ARRAY[]::text[];
  END IF;

  -- Upsert profile
  INSERT INTO public.profiles (
    id, email, full_name, display_name, avatar_url, phone, created_at, updated_at
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
    email        = EXCLUDED.email,
    full_name    = COALESCE(EXCLUDED.full_name, profiles.full_name),
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    updated_at   = NOW();

  -- Upsert user role (safe with single-column UNIQUE(user_id))
  INSERT INTO public.user_roles (user_id, role, allowed_pages)
  VALUES (NEW.id, v_initial_role, v_initial_pages)
  ON CONFLICT (user_id) DO NOTHING;

  -- Realtime ping (best-effort)
  BEGIN
    INSERT INTO public.factory_data_pings (table_name, change_source)
    VALUES ('profiles', 'auth_user_signup');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NEW;
END;
$$;

-- Re-attach the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- STEP 8: Ensure fn_auto_confirm_auth_user BEFORE INSERT trigger is present
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_auto_confirm_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_confirm_auth_user ON auth.users;
CREATE TRIGGER trg_auto_confirm_auth_user
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_auto_confirm_auth_user();

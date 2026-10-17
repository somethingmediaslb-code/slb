-- ==============================================================================
-- Migration 0009: Strict Pending Signups & Role Governance
-- ==============================================================================

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

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
    INSERT INTO public.user_roles (user_id, role, allowed_pages)
    VALUES (NEW.id, v_initial_role, v_initial_pages);
  END IF;

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

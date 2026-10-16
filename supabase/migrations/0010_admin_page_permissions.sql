-- ==============================================================================
-- Migration 0010: Admin Page Permissions Governance & Realtime Sync
-- ==============================================================================

-- 1. Ensure allowed_pages column exists on user_roles table
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS allowed_pages text[] DEFAULT ARRAY[
    'dashboard', 'orders', 'production', 'dispatch',
    'parties', 'catalog', 'workers', 'expenses', 'reports', 'settings', 'profile'
  ];

-- 2. Function: admin_set_user_page_access (Strictly Admin-Only)
CREATE OR REPLACE FUNCTION public.admin_set_user_page_access(
  p_target_user_id uuid,
  p_allowed_pages text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  -- Verify caller is an administrator
  SELECT role INTO v_caller_role
  FROM public.user_roles
  WHERE user_id = auth.uid();

  IF v_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can govern user page access'
      USING ERRCODE = '42501';
  END IF;

  -- Update target user's permitted pages
  UPDATE public.user_roles
  SET allowed_pages = p_allowed_pages
  WHERE user_id = p_target_user_id;

  -- Emit realtime ping so client sessions update immediately
  BEGIN
    INSERT INTO public.factory_data_pings (table_name, change_source)
    VALUES ('user_roles', 'page_access_changed:' || p_target_user_id::text);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'allowed_pages', p_allowed_pages
  );
END;
$$;

-- Revoke public execution and grant strictly to authenticated users
REVOKE ALL ON FUNCTION public.admin_set_user_page_access(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_page_access(uuid, text[]) TO authenticated;

-- 3. Ensure realtime publication tracks user_roles changes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_roles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

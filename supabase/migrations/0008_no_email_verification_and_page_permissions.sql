-- ==============================================================================
-- Migration 0008: Remove Email Verification, Add "User" Role & Per-User Page Permissions
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. AUTO-CONFIRM ALL AUTH USERS (NO EMAIL VERIFICATION NEEDED)
-- ------------------------------------------------------------------------------
-- Note: In Supabase auth.users, "confirmed_at" is a generated column computed from "email_confirmed_at".
-- Only "email_confirmed_at" needs to be set.
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email_confirmed_at IS NULL;

-- Automatically confirm any newly created auth user before insert
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

-- ------------------------------------------------------------------------------
-- 2. EXTEND USER_ROLES WITH ALLOWED_PAGES FOR TENANT PAGE ISOLATION
-- ------------------------------------------------------------------------------
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS allowed_pages text[] DEFAULT ARRAY[
    'dashboard', 'orders', 'production', 'dispatch',
    'parties', 'catalog', 'workers', 'settings', 'profile'
  ];

-- ------------------------------------------------------------------------------
-- 3. SEED ROLE PERMISSIONS FOR THE 'USER' (STANDARD WORKSPACE USER) ROLE
-- ------------------------------------------------------------------------------
INSERT INTO public.role_permissions (role, capability, allowed)
VALUES
  ('user', 'view_money', false),
  ('user', 'create_order', true),
  ('user', 'edit_order', true),
  ('user', 'assign_labour', true),
  ('user', 'set_rates', false),
  ('user', 'create_challan', true),
  ('user', 'confirm_dispatch', false),
  ('user', 'cancel_challan', false),
  ('user', 'close_order_short', false),
  ('user', 'run_payroll', false),
  ('user', 'record_payment', false),
  ('user', 'manage_expenses', false),
  ('user', 'manage_borrowings', false),
  ('user', 'manage_masters', true),
  ('user', 'manage_users', false),
  ('user', 'view_audit', false)
ON CONFLICT (role, capability) DO UPDATE
SET allowed = EXCLUDED.allowed;

-- ------------------------------------------------------------------------------
-- 4. UPDATE ADMIN_SET_USER_ROLE TO SUPPORT 'USER' ROLE
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  target_user_id uuid,
  new_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_role text;
BEGIN
  PERFORM public.fn_require_capability('manage_users');

  IF new_role NOT IN ('admin', 'manager', 'supervisor', 'accountant', 'dispatch_clerk', 'viewer', 'user', 'pending') THEN
    RAISE EXCEPTION 'Invalid role: %', new_role;
  END IF;

  SELECT role INTO v_old_role
  FROM public.user_roles
  WHERE user_id = target_user_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, new_role)
  ON CONFLICT (user_id) DO UPDATE
  SET role = new_role;

  -- Log action in audit trail
  BEGIN
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_fields, user_id)
    VALUES (
      'user_roles',
      target_user_id,
      'UPDATE',
      jsonb_build_object('role', v_old_role),
      jsonb_build_object('role', new_role),
      jsonb_build_object('role', jsonb_build_object('old', v_old_role, 'new', new_role)),
      auth.uid()
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Realtime notification ping
  BEGIN
    INSERT INTO public.factory_data_pings (table_name, change_source)
    VALUES ('user_roles', 'role_changed:' || new_role);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'user_id', target_user_id, 'old_role', v_old_role, 'new_role', new_role);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. FUNCTION: ADMIN SET USER PAGE ACCESS (TENANT ISOLATED PERMISSIONS)
-- ------------------------------------------------------------------------------
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
  -- Verify caller is admin
  SELECT role INTO v_caller_role
  FROM public.user_roles
  WHERE user_id = auth.uid();

  IF v_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can govern user page access'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.user_roles
  SET allowed_pages = p_allowed_pages
  WHERE user_id = p_target_user_id;

  -- Realtime notification ping
  BEGIN
    INSERT INTO public.factory_data_pings (table_name, change_source)
    VALUES ('user_roles', 'page_access_changed:' || p_target_user_id::text);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'user_id', p_target_user_id, 'allowed_pages', p_allowed_pages);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_page_access(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_page_access(uuid, text[]) TO authenticated;

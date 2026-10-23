-- ==============================================================================
-- Migration 0013: Restore Capability Guard Functions for factory_action
-- ==============================================================================
-- Provides fn_has_capability and fn_require_capability expected by factory_action.
-- Aligns with AGENTS.md rule:
-- "All operational records belong to one shared factory workspace accessible
--  to authenticated accounts, matching the PRD; separate protected user_roles
--  stores administrative permissions."
-- ==============================================================================

-- 1. Capability check function
CREATE OR REPLACE FUNCTION public.fn_has_capability(p_capability text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_allowed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO v_role
  FROM public.user_roles
  WHERE user_id = auth.uid();

  -- Authenticated workspace users default to full operational capabilities per PRD / AGENTS.md
  IF v_role IS NULL OR v_role = 'user' OR v_role = 'admin' THEN
    RETURN true;
  END IF;

  SELECT allowed INTO v_allowed
  FROM public.role_permissions
  WHERE role = v_role AND capability = p_capability;

  RETURN COALESCE(v_allowed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_has_capability(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_has_capability(text) TO authenticated;

-- 2. Capability guard function (Throws 42501 if unauthorized)
CREATE OR REPLACE FUNCTION public.fn_require_capability(p_capability text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.fn_has_capability(p_capability) THEN
    RAISE EXCEPTION 'Access denied: missing required capability "%"', p_capability
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_require_capability(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_require_capability(text) TO authenticated;

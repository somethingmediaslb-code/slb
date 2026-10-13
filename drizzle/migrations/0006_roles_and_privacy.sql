-- ==============================================================================
-- Migration 0006: Roles & Permissions, Column Privacy Views, Realtime Pings
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTEND ITEM MASTER & PRODUCTION ALLOCATIONS FOR PIECE RATE WORKFLOW
-- ------------------------------------------------------------------------------
ALTER TABLE public.item_master
  ADD COLUMN IF NOT EXISTS default_labour_rate numeric CHECK (default_labour_rate IS NULL OR default_labour_rate >= 0);

-- Allow allocations to have NULL rate when rate is pending
ALTER TABLE public.production_allocations
  ALTER COLUMN labour_rate DROP NOT NULL;

DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'production_allocations'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%labour_rate%'
  ) LOOP
    EXECUTE 'ALTER TABLE public.production_allocations DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE public.production_allocations
  ADD CONSTRAINT chk_production_allocations_labour_rate_valid
  CHECK (labour_rate IS NULL OR labour_rate >= 0);

-- ------------------------------------------------------------------------------
-- 2. DATA-DRIVEN ROLE PERMISSIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role text NOT NULL,
  capability text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role, capability)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

DROP POLICY IF EXISTS "Authenticated users view role permissions" ON public.role_permissions;
CREATE POLICY "Authenticated users view role permissions"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (true);

-- Seed Capability Matrix across all 7 roles
INSERT INTO public.role_permissions (role, capability, allowed)
VALUES
  -- ADMIN (Owner: Full Access)
  ('admin', 'view_money', true),
  ('admin', 'create_order', true),
  ('admin', 'edit_order', true),
  ('admin', 'assign_labour', true),
  ('admin', 'set_rates', true),
  ('admin', 'create_challan', true),
  ('admin', 'confirm_dispatch', true),
  ('admin', 'cancel_challan', true),
  ('admin', 'close_order_short', true),
  ('admin', 'run_payroll', true),
  ('admin', 'record_payment', true),
  ('admin', 'manage_expenses', true),
  ('admin', 'manage_borrowings', true),
  ('admin', 'manage_masters', true),
  ('admin', 'manage_users', true),
  ('admin', 'view_audit', true),

  -- MANAGER (Operations Lead)
  ('manager', 'view_money', true),
  ('manager', 'create_order', true),
  ('manager', 'edit_order', true),
  ('manager', 'assign_labour', true),
  ('manager', 'set_rates', true),
  ('manager', 'create_challan', true),
  ('manager', 'confirm_dispatch', true),
  ('manager', 'cancel_challan', true),
  ('manager', 'close_order_short', false),
  ('manager', 'run_payroll', true),
  ('manager', 'record_payment', false),
  ('manager', 'manage_expenses', true),
  ('manager', 'manage_borrowings', true),
  ('manager', 'manage_masters', true),
  ('manager', 'manage_users', false),
  ('manager', 'view_audit', false),

  -- SUPERVISOR (Floor Lead: Physical Qty Only, Party Name Only)
  ('supervisor', 'view_money', false),
  ('supervisor', 'create_order', false),
  ('supervisor', 'edit_order', false),
  ('supervisor', 'assign_labour', true),
  ('supervisor', 'set_rates', false),
  ('supervisor', 'create_challan', false),
  ('supervisor', 'confirm_dispatch', false),
  ('supervisor', 'cancel_challan', false),
  ('supervisor', 'close_order_short', false),
  ('supervisor', 'run_payroll', false),
  ('supervisor', 'record_payment', false),
  ('supervisor', 'manage_expenses', false),
  ('supervisor', 'manage_borrowings', false),
  ('supervisor', 'manage_masters', false),
  ('supervisor', 'manage_users', false),
  ('supervisor', 'view_audit', false),

  -- ACCOUNTANT (Accounts & Billing: Full Money & Payments, No Orders)
  ('accountant', 'view_money', true),
  ('accountant', 'create_order', false),
  ('accountant', 'edit_order', false),
  ('accountant', 'assign_labour', false),
  ('accountant', 'set_rates', false),
  ('accountant', 'create_challan', false),
  ('accountant', 'confirm_dispatch', false),
  ('accountant', 'cancel_challan', false),
  ('accountant', 'close_order_short', false),
  ('accountant', 'run_payroll', true),
  ('accountant', 'record_payment', true),
  ('accountant', 'manage_expenses', true),
  ('accountant', 'manage_borrowings', true),
  ('accountant', 'manage_masters', false),
  ('accountant', 'manage_users', false),
  ('accountant', 'view_audit', false),

  -- DISPATCH CLERK (Gate Logistics: Challans & Freight Only, No Prices/Payroll)
  ('dispatch_clerk', 'view_money', false),
  ('dispatch_clerk', 'create_order', false),
  ('dispatch_clerk', 'edit_order', false),
  ('dispatch_clerk', 'assign_labour', false),
  ('dispatch_clerk', 'set_rates', false),
  ('dispatch_clerk', 'create_challan', true),
  ('dispatch_clerk', 'confirm_dispatch', true),
  ('dispatch_clerk', 'cancel_challan', false),
  ('dispatch_clerk', 'close_order_short', false),
  ('dispatch_clerk', 'run_payroll', false),
  ('dispatch_clerk', 'record_payment', false),
  ('dispatch_clerk', 'manage_expenses', false),
  ('dispatch_clerk', 'manage_borrowings', false),
  ('dispatch_clerk', 'manage_masters', false),
  ('dispatch_clerk', 'manage_users', false),
  ('dispatch_clerk', 'view_audit', false),

  -- VIEWER (Auditor / Silent Stakeholder: Read-Only, No Money)
  ('viewer', 'view_money', false),
  ('viewer', 'create_order', false),
  ('viewer', 'edit_order', false),
  ('viewer', 'assign_labour', false),
  ('viewer', 'set_rates', false),
  ('viewer', 'create_challan', false),
  ('viewer', 'confirm_dispatch', false),
  ('viewer', 'cancel_challan', false),
  ('viewer', 'close_order_short', false),
  ('viewer', 'run_payroll', false),
  ('viewer', 'record_payment', false),
  ('viewer', 'manage_expenses', false),
  ('viewer', 'manage_borrowings', false),
  ('viewer', 'manage_masters', false),
  ('viewer', 'manage_users', false),
  ('viewer', 'view_audit', false),

  -- PENDING (New Register: Zero Access)
  ('pending', 'view_money', false),
  ('pending', 'create_order', false),
  ('pending', 'edit_order', false),
  ('pending', 'assign_labour', false),
  ('pending', 'set_rates', false),
  ('pending', 'create_challan', false),
  ('pending', 'confirm_dispatch', false),
  ('pending', 'cancel_challan', false),
  ('pending', 'close_order_short', false),
  ('pending', 'run_payroll', false),
  ('pending', 'record_payment', false),
  ('pending', 'manage_expenses', false),
  ('pending', 'manage_borrowings', false),
  ('pending', 'manage_masters', false),
  ('pending', 'manage_users', false),
  ('pending', 'view_audit', false)
ON CONFLICT (role, capability) DO UPDATE
SET allowed = EXCLUDED.allowed;

-- Function: Check Capability (Security Definer, Stable, Search Path Set)
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

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  -- Admin role has all capabilities by definition
  IF v_role = 'admin' THEN
    RETURN true;
  END IF;

  SELECT allowed INTO v_allowed
  FROM public.role_permissions
  WHERE role = v_role AND capability = p_capability;

  RETURN COALESCE(v_allowed, false);
END;
$$;

-- Function: Require Capability Guard (Throws 42501 if missing)
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

-- RPC: Admin-only role capability modifier
CREATE OR REPLACE FUNCTION public.admin_set_role_permission(
  p_role text,
  p_capability text,
  p_allowed boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.fn_require_capability('manage_users');

  INSERT INTO public.role_permissions (role, capability, allowed)
  VALUES (p_role, p_capability, p_allowed)
  ON CONFLICT (role, capability) DO UPDATE
  SET allowed = p_allowed;

  INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_fields, user_id)
  VALUES (
    'role_permissions',
    gen_random_uuid(),
    'UPDATE',
    NULL,
    jsonb_build_object('role', p_role, 'capability', p_capability, 'allowed', p_allowed),
    jsonb_build_object('allowed', p_allowed),
    auth.uid()
  );

  RETURN jsonb_build_object('success', true, 'role', p_role, 'capability', p_capability, 'allowed', p_allowed);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_role_permission(text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_role_permission(text, text, boolean) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. USER ROLES SECURITY & ROLE MIGRATION
-- ------------------------------------------------------------------------------
-- Protect user_roles from direct client manipulation
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM PUBLIC, authenticated, anon;
GRANT SELECT ON public.user_roles TO authenticated;

-- Prevent demoting or deleting the last admin
CREATE OR REPLACE FUNCTION public.fn_prevent_last_admin_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_admin_count int;
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.role = 'admin') OR
     (TG_OP = 'UPDATE' AND OLD.role = 'admin' AND NEW.role <> 'admin') THEN
    SELECT count(*) INTO v_admin_count
    FROM public.user_roles
    WHERE role = 'admin' AND user_id <> OLD.user_id;

    IF v_admin_count = 0 THEN
      RAISE EXCEPTION 'Cannot demote or delete the last remaining administrator.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_last_admin ON public.user_roles;
CREATE TRIGGER trg_protect_last_admin
  BEFORE UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_last_admin_removal();

-- Migrate existing 'user' accounts to 'viewer' (least privilege)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN (SELECT user_id FROM public.user_roles WHERE role = 'user') LOOP
    RAISE NOTICE 'Migrated user % from user to viewer', r.user_id;
  END LOOP;

  UPDATE public.user_roles
  SET role = 'viewer'
  WHERE role = 'user';
END $$;

-- RPC: Admin-only user role assignment
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

  IF new_role NOT IN ('admin', 'manager', 'supervisor', 'accountant', 'dispatch_clerk', 'viewer', 'pending') THEN
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

  RETURN jsonb_build_object('success', true, 'user_id', target_user_id, 'old_role', v_old_role, 'new_role', new_role);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. COLUMN PRIVACY: SANITIZED VIEWS (NOT SECURITY INVOKER)
-- ------------------------------------------------------------------------------

-- VIEW: v_orders
CREATE OR REPLACE VIEW public.v_orders AS
SELECT
  id,
  order_no,
  party_id,
  is_self_stock,
  order_date,
  expected_date,
  medium,
  remarks,
  status,
  created_at,
  closed_short,
  close_short_reason,
  closed_short_at,
  closed_short_by,
  deleted_at,
  deleted_by,
  updated_at,
  updated_by
FROM public.orders
WHERE deleted_at IS NULL;

-- VIEW: v_order_items (Masks unit_rate for non-money roles)
CREATE OR REPLACE VIEW public.v_order_items AS
SELECT
  id,
  order_id,
  sr_no,
  box_type,
  code_remarks,
  size_dimensions,
  specification,
  ordered_qty,
  allocated_qty,
  completed_qty,
  reserved_qty,
  dispatched_qty,
  CASE WHEN public.fn_has_capability('view_money') THEN unit_rate ELSE NULL END AS unit_rate,
  priority_signal,
  deleted_at,
  deleted_by,
  updated_at,
  updated_by
FROM public.order_items
WHERE deleted_at IS NULL;

-- VIEW: v_production_allocations (Masks labour_rate and paid_earnings)
CREATE OR REPLACE VIEW public.v_production_allocations AS
SELECT
  id,
  order_item_id,
  labour_id,
  allocated_qty,
  CASE WHEN public.fn_has_capability('view_money') THEN labour_rate ELSE NULL END AS labour_rate,
  start_time,
  duration_hours,
  tentative_completion,
  completed_qty,
  CASE WHEN public.fn_has_capability('view_money') THEN paid_earnings ELSE NULL END AS paid_earnings,
  status,
  created_at,
  deleted_at,
  deleted_by,
  updated_at,
  updated_by
FROM public.production_allocations
WHERE deleted_at IS NULL;

-- VIEW: v_delivery_challans
CREATE OR REPLACE VIEW public.v_delivery_challans AS
SELECT
  id,
  challan_number,
  order_id,
  status,
  transport_carrier,
  vehicle_number,
  lr_number,
  CASE WHEN public.fn_has_capability('view_money') OR public.fn_has_capability('create_challan') THEN freight_charges ELSE NULL END AS freight_charges,
  dispatch_date,
  created_at,
  deleted_at,
  deleted_by,
  updated_at,
  updated_by
FROM public.delivery_challans
WHERE deleted_at IS NULL;

-- VIEW: v_challan_items (Masks direct_labour_cost)
CREATE OR REPLACE VIEW public.v_challan_items AS
SELECT
  id,
  challan_id,
  order_item_id,
  dispatched_qty,
  CASE WHEN public.fn_has_capability('view_money') THEN direct_labour_cost ELSE NULL END AS direct_labour_cost,
  deleted_at,
  deleted_by,
  updated_at,
  updated_by
FROM public.challan_items
WHERE deleted_at IS NULL;

-- VIEW: v_expenses (Returns rows with amounts only to money roles)
CREATE OR REPLACE VIEW public.v_expenses AS
SELECT
  id,
  expense_date,
  category,
  CASE WHEN public.fn_has_capability('view_money') THEN amount ELSE NULL END AS amount,
  reference_dc_id,
  remarks,
  created_at,
  deleted_at,
  deleted_by,
  updated_at,
  updated_by
FROM public.expenses
WHERE deleted_at IS NULL
  AND (public.fn_has_capability('view_money') OR public.fn_has_capability('manage_expenses'));

-- VIEW: v_labour_borrowings (Masks amounts for non-money roles)
CREATE OR REPLACE VIEW public.v_labour_borrowings AS
SELECT
  id,
  labour_id,
  borrow_date,
  CASE WHEN public.fn_has_capability('view_money') THEN amount ELSE NULL END AS amount,
  CASE WHEN public.fn_has_capability('view_money') THEN deducted_amount ELSE NULL END AS deducted_amount,
  remarks,
  created_at,
  deleted_at,
  deleted_by,
  updated_at,
  updated_by
FROM public.labour_borrowings
WHERE deleted_at IS NULL
  AND (public.fn_has_capability('view_money') OR public.fn_has_capability('manage_borrowings'));

-- VIEW: v_labour_payroll (Masks financial figures for non-money roles)
CREATE OR REPLACE VIEW public.v_labour_payroll AS
SELECT
  id,
  labour_id,
  CASE WHEN public.fn_has_capability('view_money') THEN gross ELSE NULL END AS gross,
  CASE WHEN public.fn_has_capability('view_money') THEN deductions ELSE NULL END AS deductions,
  CASE WHEN public.fn_has_capability('view_money') THEN net_paid ELSE NULL END AS net_paid,
  CASE WHEN public.fn_has_capability('view_money') THEN amount_paid ELSE NULL END AS amount_paid,
  status,
  payout_date,
  created_at,
  deleted_at,
  deleted_by,
  updated_at,
  updated_by
FROM public.labour_payroll
WHERE deleted_at IS NULL
  AND (public.fn_has_capability('view_money') OR public.fn_has_capability('run_payroll'));

-- VIEW: v_labour_payroll_disbursements
CREATE OR REPLACE VIEW public.v_labour_payroll_disbursements AS
SELECT
  id,
  payroll_id,
  CASE WHEN public.fn_has_capability('view_money') THEN amount ELSE NULL END AS amount,
  payment_mode,
  reference_notes,
  disbursed_at,
  disbursed_by,
  deleted_at,
  deleted_by,
  updated_at,
  updated_by
FROM public.labour_payroll_disbursements
WHERE deleted_at IS NULL
  AND (public.fn_has_capability('view_money') OR public.fn_has_capability('record_payment'));

-- VIEW: v_party_master (Masks contact info for supervisors/dispatch; shows company_name only)
CREATE OR REPLACE VIEW public.v_party_master AS
SELECT
  id,
  company_name,
  CASE WHEN public.fn_has_capability('view_money') OR public.fn_has_capability('manage_masters') THEN phone_number ELSE NULL END AS phone_number,
  CASE WHEN public.fn_has_capability('view_money') OR public.fn_has_capability('manage_masters') THEN contact_person ELSE NULL END AS contact_person,
  CASE WHEN public.fn_has_capability('view_money') OR public.fn_has_capability('manage_masters') THEN email ELSE NULL END AS email,
  CASE WHEN public.fn_has_capability('view_money') OR public.fn_has_capability('manage_masters') THEN address ELSE NULL END AS address,
  CASE WHEN public.fn_has_capability('view_money') OR public.fn_has_capability('manage_masters') THEN gstin ELSE NULL END AS gstin,
  deleted_at,
  deleted_by,
  updated_at,
  updated_by
FROM public.party_master
WHERE deleted_at IS NULL;

-- VIEW: v_item_master (Masks default piece rate for non-money roles)
CREATE OR REPLACE VIEW public.v_item_master AS
SELECT
  id,
  box_type,
  length_mm,
  width_mm,
  height_mm,
  wood_type,
  safe_stock_limit,
  specification,
  CASE WHEN public.fn_has_capability('view_money') OR public.fn_has_capability('set_rates') THEN default_labour_rate ELSE NULL END AS default_labour_rate,
  deleted_at,
  deleted_by,
  updated_at,
  updated_by
FROM public.item_master
WHERE deleted_at IS NULL;

-- Grant access on sanitized views to authenticated
REVOKE ALL ON public.v_orders FROM PUBLIC, anon;
REVOKE ALL ON public.v_order_items FROM PUBLIC, anon;
REVOKE ALL ON public.v_production_allocations FROM PUBLIC, anon;
REVOKE ALL ON public.v_delivery_challans FROM PUBLIC, anon;
REVOKE ALL ON public.v_challan_items FROM PUBLIC, anon;
REVOKE ALL ON public.v_expenses FROM PUBLIC, anon;
REVOKE ALL ON public.v_labour_borrowings FROM PUBLIC, anon;
REVOKE ALL ON public.v_labour_payroll FROM PUBLIC, anon;
REVOKE ALL ON public.v_labour_payroll_disbursements FROM PUBLIC, anon;
REVOKE ALL ON public.v_party_master FROM PUBLIC, anon;
REVOKE ALL ON public.v_item_master FROM PUBLIC, anon;

GRANT SELECT ON public.v_orders TO authenticated;
GRANT SELECT ON public.v_order_items TO authenticated;
GRANT SELECT ON public.v_production_allocations TO authenticated;
GRANT SELECT ON public.v_delivery_challans TO authenticated;
GRANT SELECT ON public.v_challan_items TO authenticated;
GRANT SELECT ON public.v_expenses TO authenticated;
GRANT SELECT ON public.v_labour_borrowings TO authenticated;
GRANT SELECT ON public.v_labour_payroll TO authenticated;
GRANT SELECT ON public.v_labour_payroll_disbursements TO authenticated;
GRANT SELECT ON public.v_party_master TO authenticated;
GRANT SELECT ON public.v_item_master TO authenticated;

-- Restrict Direct Base Table SELECT via RLS to roles with view_money
DROP POLICY IF EXISTS factory_access ON public.order_items;
CREATE POLICY "Money roles base select on order_items"
  ON public.order_items FOR SELECT TO authenticated
  USING (public.fn_has_capability('view_money'));

DROP POLICY IF EXISTS factory_access ON public.production_allocations;
CREATE POLICY "Money roles base select on production_allocations"
  ON public.production_allocations FOR SELECT TO authenticated
  USING (public.fn_has_capability('view_money'));

DROP POLICY IF EXISTS factory_access ON public.challan_items;
CREATE POLICY "Money roles base select on challan_items"
  ON public.challan_items FOR SELECT TO authenticated
  USING (public.fn_has_capability('view_money'));

DROP POLICY IF EXISTS factory_access ON public.expenses;
CREATE POLICY "Money roles base select on expenses"
  ON public.expenses FOR SELECT TO authenticated
  USING (public.fn_has_capability('view_money'));

DROP POLICY IF EXISTS factory_access ON public.labour_borrowings;
CREATE POLICY "Money roles base select on labour_borrowings"
  ON public.labour_borrowings FOR SELECT TO authenticated
  USING (public.fn_has_capability('view_money'));

DROP POLICY IF EXISTS factory_access ON public.labour_payroll;
CREATE POLICY "Money roles base select on labour_payroll"
  ON public.labour_payroll FOR SELECT TO authenticated
  USING (public.fn_has_capability('view_money'));

DROP POLICY IF EXISTS factory_access ON public.labour_payroll_disbursements;
CREATE POLICY "Money roles base select on labour_payroll_disbursements"
  ON public.labour_payroll_disbursements FOR SELECT TO authenticated
  USING (public.fn_has_capability('view_money'));

-- ------------------------------------------------------------------------------
-- 5. REALTIME: DATA-LESS CHANGE PING SYSTEM
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.factory_data_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.factory_data_pings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.factory_data_pings TO authenticated;
GRANT ALL ON public.factory_data_pings TO service_role;

DROP POLICY IF EXISTS "Authenticated read data pings" ON public.factory_data_pings;
CREATE POLICY "Authenticated read data pings"
  ON public.factory_data_pings FOR SELECT TO authenticated
  USING (true);

-- Trigger function to emit zero-data table change ping
CREATE OR REPLACE FUNCTION public.fn_emit_factory_ping()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.factory_data_pings (table_name, changed_at)
  VALUES (TG_TABLE_NAME, now());
  RETURN NULL;
END;
$$;

-- Attach ping trigger to all core operational tables
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'orders', 'order_items', 'production_allocations',
    'delivery_challans', 'challan_items', 'expenses',
    'labour_borrowings', 'labour_payroll', 'labour_payroll_disbursements',
    'party_master', 'item_master', 'labour_master'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS trg_ping_' || quote_ident(tbl) || ' ON public.' || quote_ident(tbl) || ';';
    EXECUTE 'CREATE TRIGGER trg_ping_' || quote_ident(tbl) || '
      AFTER INSERT OR UPDATE OR DELETE ON public.' || quote_ident(tbl) || '
      FOR EACH STATEMENT EXECUTE FUNCTION public.fn_emit_factory_ping();';
  END LOOP;
END $$;

-- Configure Supabase Realtime Publication
DO $$
BEGIN
  -- Add ping table to realtime publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.factory_data_pings;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  -- Remove money-bearing tables from realtime publication to prevent raw socket leaks
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.order_items;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.production_allocations;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.challan_items;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.expenses;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.labour_borrowings;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.labour_payroll;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.labour_payroll_disbursements;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
END $$;

-- ------------------------------------------------------------------------------
-- 6. RPC: SECURED factory_action WITH GRANULAR CAPABILITY CHECKS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.factory_action(action text, payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item public.order_items;
  allocation public.production_allocations;
  challan public.delivery_challans;
  ord public.orders;
  obj jsonb;
  rid uuid;
  oid uuid;
  qty int;
  rate numeric;
  earnings numeric;
  debt numeric;
  deduction numeric;
  remaining numeric;
  borrowing record;
  open_dc record;
  v_doc_no text;
  v_def_rate numeric;
  v_pending_rates_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to continue' USING ERRCODE = '42501';
  END IF;

  -- ============================================================================
  -- ACTION: ORDER (create) -> requires create_order
  -- ============================================================================
  IF action = 'order' THEN
    PERFORM public.fn_require_capability('create_order');

    v_doc_no := public.fn_next_doc_number('PO', COALESCE((payload->>'order_date')::timestamptz, now()));

    INSERT INTO orders(order_no, party_id, is_self_stock, order_date, expected_date, medium, remarks)
    VALUES(
      v_doc_no,
      CASE WHEN (payload->>'is_self_stock')::boolean THEN NULL ELSE (payload->>'party_id')::uuid END,
      COALESCE((payload->>'is_self_stock')::boolean, false),
      (payload->>'order_date')::date,
      (payload->>'expected_date')::date,
      COALESCE(payload->>'medium', 'Other'),
      payload->>'remarks'
    ) RETURNING id INTO oid;

    IF jsonb_array_length(payload->'items') = 0 THEN
      RAISE EXCEPTION 'Add at least one order item';
    END IF;

    FOR obj IN SELECT value FROM jsonb_array_elements(payload->'items') LOOP
      INSERT INTO order_items(order_id, sr_no, box_type, code_remarks, size_dimensions, specification, ordered_qty, unit_rate, priority_signal)
      VALUES(
        oid,
        (obj->>'sr_no')::int,
        obj->>'box_type',
        obj->>'code_remarks',
        obj->>'size_dimensions',
        obj->>'specification',
        (obj->>'ordered_qty')::int,
        COALESCE((obj->>'unit_rate')::numeric, 0),
        obj->>'priority_signal'
      );

      IF obj->>'priority_signal' = 'Red' THEN
        INSERT INTO factory_notifications(title, body, path)
        VALUES('High-priority order', 'A high-priority order ' || v_doc_no || ' needs production allocation.', '/production');
      END IF;
    END LOOP;
    rid := oid;

  -- ============================================================================
  -- ACTION: ALLOCATE (assign labour) -> requires assign_labour
  -- Piece Rate: Admin/Manager can set rate; Supervisor automatically inherits default_labour_rate
  -- ============================================================================
  ELSIF action = 'allocate' THEN
    PERFORM public.fn_require_capability('assign_labour');

    SELECT * INTO STRICT item FROM order_items WHERE id = (payload->>'order_item_id')::uuid FOR UPDATE;
    qty := (payload->>'allocated_qty')::int;
    IF qty <= 0 OR qty > item.ordered_qty - item.allocated_qty THEN
      RAISE EXCEPTION 'Quantity exceeds remaining production';
    END IF;

    -- Determine labour piece rate
    IF public.fn_has_capability('set_rates') AND (payload->>'labour_rate') IS NOT NULL THEN
      rate := (payload->>'labour_rate')::numeric;
    ELSE
      -- Lookup default piece rate from item_master
      SELECT default_labour_rate INTO v_def_rate
      FROM public.item_master
      WHERE box_type = item.box_type AND deleted_at IS NULL;

      rate := v_def_rate; -- NULL if not set
    END IF;

    INSERT INTO production_allocations(
      order_item_id, labour_id, allocated_qty, labour_rate,
      start_time, duration_hours, tentative_completion, status
    )
    VALUES(
      item.id,
      (payload->>'labour_id')::uuid,
      qty,
      rate,
      (payload->>'start_time')::timestamptz,
      (payload->>'duration_hours')::int,
      (payload->>'start_time')::timestamptz + make_interval(hours => (payload->>'duration_hours')::int),
      CASE WHEN rate IS NULL THEN 'Rate Pending' ELSE 'In Progress' END
    ) RETURNING id INTO rid;

    UPDATE order_items SET allocated_qty = allocated_qty + qty WHERE id = item.id;
    UPDATE orders SET status = 'In Production' WHERE id = item.order_id;

  -- ============================================================================
  -- ACTION: COMPLETE (log completed) -> requires assign_labour
  -- ============================================================================
  ELSIF action = 'complete' THEN
    PERFORM public.fn_require_capability('assign_labour');

    SELECT order_item_id INTO oid FROM production_allocations WHERE id = (payload->>'id')::uuid;
    PERFORM id FROM order_items WHERE id = oid FOR UPDATE;
    SELECT * INTO STRICT allocation FROM production_allocations WHERE id = (payload->>'id')::uuid FOR UPDATE;
    qty := (payload->>'completed_qty')::int;
    IF qty < allocation.completed_qty OR qty > allocation.allocated_qty THEN
      RAISE EXCEPTION 'Completed quantity must be between previous completion and allocated quantity';
    END IF;

    UPDATE order_items SET completed_qty = completed_qty + qty - allocation.completed_qty WHERE id = allocation.order_item_id;
    UPDATE production_allocations
      SET completed_qty = qty,
          status = CASE
            WHEN qty = allocated_qty AND labour_rate IS NULL THEN 'Rate Pending'
            WHEN qty = allocated_qty THEN 'Completed'
            ELSE 'Partial'
          END
      WHERE id = allocation.id;
    rid := allocation.id;

    IF qty = allocation.allocated_qty AND qty > allocation.completed_qty THEN
      INSERT INTO factory_notifications(title, body, path)
      VALUES('Production completed', 'An allocation is ready for dispatch inspection.', '/dispatch');
    END IF;

  -- ============================================================================
  -- ACTION: CHALLAN (create) -> requires create_challan
  -- ============================================================================
  ELSIF action = 'challan' THEN
    PERFORM public.fn_require_capability('create_challan');

    SELECT * INTO STRICT item FROM order_items WHERE id = (payload->>'order_item_id')::uuid FOR UPDATE;
    qty := (payload->>'dispatched_qty')::int;
    IF qty <= 0 OR qty > item.completed_qty - item.dispatched_qty - item.reserved_qty THEN
      RAISE EXCEPTION 'Quantity exceeds available completed production';
    END IF;

    v_doc_no := public.fn_next_doc_number('DC', COALESCE((payload->>'dispatch_date')::timestamptz, now()));

    INSERT INTO delivery_challans(challan_number, order_id, transport_carrier, vehicle_number, lr_number, freight_charges, dispatch_date)
    VALUES(
      v_doc_no,
      item.order_id,
      payload->>'transport_carrier',
      payload->>'vehicle_number',
      payload->>'lr_number',
      COALESCE((payload->>'freight_charges')::numeric, 0),
      (payload->>'dispatch_date')::timestamptz
    ) RETURNING id INTO rid;

    SELECT COALESCE(sum(completed_qty * COALESCE(labour_rate, 0)) / NULLIF(sum(completed_qty), 0), 0)
      INTO rate FROM production_allocations WHERE order_item_id = item.id;

    INSERT INTO challan_items(challan_id, order_item_id, dispatched_qty, direct_labour_cost)
      VALUES(rid, item.id, qty, qty * rate);

    UPDATE order_items SET reserved_qty = reserved_qty + qty WHERE id = item.id;

  -- ============================================================================
  -- ACTION: DISPATCH (confirm) -> requires confirm_dispatch
  -- ============================================================================
  ELSIF action = 'dispatch' THEN
    PERFORM public.fn_require_capability('confirm_dispatch');

    SELECT * INTO STRICT challan FROM delivery_challans WHERE id = (payload->>'id')::uuid FOR UPDATE;
    IF challan.status <> 'Delivery Challan Made' THEN
      RAISE EXCEPTION 'Challan has already been dispatched or cancelled';
    END IF;

    FOR obj IN SELECT to_jsonb(c) FROM challan_items c WHERE challan_id = challan.id ORDER BY order_item_id LOOP
      UPDATE order_items
      SET reserved_qty = reserved_qty - (obj->>'dispatched_qty')::int,
          dispatched_qty = dispatched_qty + (obj->>'dispatched_qty')::int
      WHERE id = (obj->>'order_item_id')::uuid;
    END LOOP;

    UPDATE delivery_challans SET status = 'Dispatched' WHERE id = challan.id;

    UPDATE orders
    SET status = CASE
      WHEN NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = challan.order_id AND dispatched_qty < ordered_qty) THEN 'Completed'
      ELSE 'Partially Dispatched'
    END
    WHERE id = challan.order_id;

    INSERT INTO factory_notifications(title, body, path)
      VALUES('Delivery dispatched', challan.challan_number || ' has been confirmed dispatched.', '/dispatch');
    rid := challan.id;

  -- ============================================================================
  -- ACTION: CANCEL_CHALLAN -> requires cancel_challan (Admin, Manager)
  -- ============================================================================
  ELSIF action = 'cancel_challan' THEN
    PERFORM public.fn_require_capability('cancel_challan');

    SELECT * INTO STRICT challan FROM delivery_challans WHERE id = (payload->>'id')::uuid FOR UPDATE;
    IF challan.status <> 'Delivery Challan Made' THEN
      RAISE EXCEPTION 'Only non-dispatched challans in "Delivery Challan Made" status can be cancelled. Dispatched challans are final.';
    END IF;

    FOR obj IN SELECT to_jsonb(c) FROM challan_items c WHERE challan_id = challan.id LOOP
      UPDATE order_items
      SET reserved_qty = GREATEST(0, reserved_qty - (obj->>'dispatched_qty')::int)
      WHERE id = (obj->>'order_item_id')::uuid;
    END LOOP;

    UPDATE delivery_challans SET status = 'Cancelled' WHERE id = challan.id;
    rid := challan.id;

  -- ============================================================================
  -- ACTION: CLOSE_ORDER_SHORT -> requires close_order_short (Admin Only)
  -- ============================================================================
  ELSIF action = 'close_order_short' THEN
    PERFORM public.fn_require_capability('close_order_short');

    IF payload->>'reason' IS NULL OR char_length(trim(payload->>'reason')) < 5 THEN
      RAISE EXCEPTION 'A valid reason of at least 5 characters is required to close an order short';
    END IF;

    SELECT * INTO STRICT ord FROM orders WHERE id = (payload->>'order_id')::uuid FOR UPDATE;

    IF ord.status IN ('Completed', 'Cancelled') THEN
      RAISE EXCEPTION 'Order % is already %', ord.order_no, ord.status;
    END IF;

    SELECT challan_number INTO open_dc
    FROM delivery_challans
    WHERE order_id = ord.id AND status = 'Delivery Challan Made'
    LIMIT 1;

    IF open_dc.challan_number IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot close order short: Delivery Challan % is pending. Dispatch or cancel it first.', open_dc.challan_number;
    END IF;

    UPDATE orders
    SET status = 'Completed',
        closed_short = true,
        close_short_reason = trim(payload->>'reason'),
        closed_short_at = now(),
        closed_short_by = auth.uid()
    WHERE id = ord.id;
    rid := ord.id;

  -- ============================================================================
  -- ACTION: BORROW (advance) -> requires manage_borrowings
  -- ============================================================================
  ELSIF action = 'borrow' THEN
    PERFORM public.fn_require_capability('manage_borrowings');

    PERFORM id FROM labour_master WHERE id = (payload->>'labour_id')::uuid FOR UPDATE;
    INSERT INTO labour_borrowings(labour_id, borrow_date, amount, remarks)
    VALUES(
      (payload->>'labour_id')::uuid,
      (payload->>'borrow_date')::date,
      (payload->>'amount')::numeric,
      payload->>'remarks'
    ) RETURNING id INTO rid;

  -- ============================================================================
  -- ACTION: PAYROLL (compute batch) -> requires run_payroll
  -- Skips and reports allocations where labour_rate IS NULL
  -- ============================================================================
  ELSIF action = 'payroll' THEN
    PERFORM public.fn_require_capability('run_payroll');

    PERFORM id FROM labour_master WHERE id = (payload->>'labour_id')::uuid FOR UPDATE;
    PERFORM id FROM production_allocations WHERE labour_id = (payload->>'labour_id')::uuid FOR UPDATE;

    -- Calculate earnings only for allocations that have a set piece rate
    SELECT COALESCE(sum(completed_qty * labour_rate - paid_earnings), 0)
      INTO earnings
    FROM public.production_allocations
    WHERE labour_id = (payload->>'labour_id')::uuid
      AND labour_rate IS NOT NULL
      AND deleted_at IS NULL;

    -- Check if unrated allocations exist
    SELECT count(*) INTO v_pending_rates_count
    FROM public.production_allocations
    WHERE labour_id = (payload->>'labour_id')::uuid
      AND labour_rate IS NULL
      AND completed_qty > 0
      AND deleted_at IS NULL;

    IF earnings <= 0 THEN
      IF v_pending_rates_count > 0 THEN
        RAISE EXCEPTION 'No payable earnings. % allocation(s) skipped with pending piece rates. Set rates first.', v_pending_rates_count;
      ELSE
        RAISE EXCEPTION 'No unpaid production earnings';
      END IF;
    END IF;

    SELECT COALESCE(sum(amount - deducted_amount), 0)
      INTO debt
    FROM labour_borrowings
    WHERE labour_id = (payload->>'labour_id')::uuid AND deleted_at IS NULL;

    deduction := LEAST(earnings, debt);
    remaining := deduction;

    FOR borrowing IN SELECT * FROM labour_borrowings
      WHERE labour_id = (payload->>'labour_id')::uuid AND deducted_amount < amount AND deleted_at IS NULL
      ORDER BY borrow_date, id FOR UPDATE LOOP
      rate := LEAST(remaining, borrowing.amount - borrowing.deducted_amount);
      UPDATE labour_borrowings SET deducted_amount = deducted_amount + rate WHERE id = borrowing.id;
      remaining := remaining - rate;
    END LOOP;

    UPDATE production_allocations
    SET paid_earnings = completed_qty * labour_rate
    WHERE labour_id = (payload->>'labour_id')::uuid
      AND labour_rate IS NOT NULL
      AND deleted_at IS NULL;

    INSERT INTO labour_payroll(labour_id, gross, deductions, net_paid, amount_paid, status)
    VALUES(
      (payload->>'labour_id')::uuid,
      earnings,
      deduction,
      earnings - deduction,
      0,
      CASE WHEN (earnings - deduction) <= 0 THEN 'Paid' ELSE 'Pending' END
    ) RETURNING id INTO rid;

  -- ============================================================================
  -- ACTION: DISBURSE (record payment) -> requires record_payment (Admin, Accountant)
  -- ============================================================================
  ELSIF action = 'disburse' THEN
    PERFORM public.fn_require_capability('record_payment');

    INSERT INTO labour_payroll_disbursements(payroll_id, amount, payment_mode, reference_notes, disbursed_at, disbursed_by)
    VALUES(
      (payload->>'payroll_id')::uuid,
      (payload->>'amount')::numeric,
      COALESCE(payload->>'payment_mode', 'Cash'),
      payload->>'reference_notes',
      COALESCE((payload->>'disbursed_at')::timestamptz, now()),
      auth.uid()
    ) RETURNING id INTO rid;

  ELSE
    RAISE EXCEPTION 'Unknown factory action: %', action;
  END IF;

  RETURN jsonb_build_object('id', rid);
END;
$$;

REVOKE ALL ON FUNCTION public.factory_action(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.factory_action(text, jsonb) TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. RPC: SECURED soft_delete_record WITH CAPABILITY CHECKS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_record(
  target_table text,
  target_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_rec record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  -- Capability validation per table
  IF target_table IN ('party_master', 'item_master', 'labour_master') THEN
    PERFORM public.fn_require_capability('manage_masters');
  ELSIF target_table = 'orders' THEN
    PERFORM public.fn_require_capability('edit_order');
  ELSIF target_table = 'delivery_challans' THEN
    PERFORM public.fn_require_capability('cancel_challan');
  ELSIF target_table = 'expenses' THEN
    PERFORM public.fn_require_capability('manage_expenses');
  ELSIF target_table = 'labour_borrowings' THEN
    PERFORM public.fn_require_capability('manage_borrowings');
  ELSE
    PERFORM public.fn_require_capability('manage_users');
  END IF;

  -- Dependency checks
  IF target_table = 'party_master' THEN
    SELECT count(*) INTO v_count FROM public.orders WHERE party_id = target_id AND deleted_at IS NULL;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'Cannot delete party: % active order(s) exist for this company.', v_count;
    END IF;

  ELSIF target_table = 'item_master' THEN
    SELECT * INTO v_rec FROM public.item_master WHERE id = target_id;
    SELECT count(*) INTO v_count FROM public.order_items WHERE box_type = v_rec.box_type AND deleted_at IS NULL;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'Cannot delete catalog item: used in % active order item(s).', v_count;
    END IF;

  ELSIF target_table = 'labour_master' THEN
    SELECT count(*) INTO v_count FROM public.production_allocations WHERE labour_id = target_id AND deleted_at IS NULL;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'Cannot delete worker: % active production allocation(s) exist.', v_count;
    END IF;
    SELECT count(*) INTO v_count FROM public.labour_borrowings WHERE labour_id = target_id AND (amount - deducted_amount) > 0 AND deleted_at IS NULL;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'Cannot delete worker: outstanding advance borrowing balance exists.';
    END IF;

  ELSIF target_table = 'orders' THEN
    UPDATE public.order_items
    SET deleted_at = now(), deleted_by = auth.uid()
    WHERE order_id = target_id AND deleted_at IS NULL;

  ELSIF target_table = 'delivery_challans' THEN
    SELECT * INTO v_rec FROM public.delivery_challans WHERE id = target_id;
    IF v_rec.status = 'Dispatched' THEN
      RAISE EXCEPTION 'Cannot delete a confirmed dispatched challan. Only draft/cancelled challans can be removed.';
    END IF;
  END IF;

  EXECUTE 'UPDATE public.' || quote_ident(target_table) || '
    SET deleted_at = now(), deleted_by = $1
    WHERE id = $2 AND deleted_at IS NULL;'
  USING auth.uid(), target_id;

  RETURN jsonb_build_object('success', true, 'table', target_table, 'id', target_id);
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_record(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_record(text, uuid) TO authenticated;

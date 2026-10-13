-- ==============================================================================
-- Migration 0004: Database Integrity, Number Series, Soft Delete & Audit Logging
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. NUMBER SERIES (Concurrency-Safe FY Numbering for Orders, Challans, Invoices)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_number_series (
  series text NOT NULL,
  fy_label text NOT NULL,
  last_no int NOT NULL DEFAULT 0 CHECK (last_no >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (series, fy_label)
);

ALTER TABLE public.document_number_series ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.document_number_series TO authenticated;
GRANT ALL ON public.document_number_series TO service_role;

-- Function: Compute Indian Financial Year (April-March in Asia/Kolkata)
CREATE OR REPLACE FUNCTION public.fn_get_indian_fy(p_timestamp timestamptz DEFAULT now())
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_ist timestamp;
  v_year int;
  v_month int;
  v_y1 int;
  v_y2 int;
BEGIN
  v_ist := timezone('Asia/Kolkata', COALESCE(p_timestamp, now()));
  v_year := EXTRACT(YEAR FROM v_ist)::int;
  v_month := EXTRACT(MONTH FROM v_ist)::int;

  IF v_month >= 4 THEN
    v_y1 := v_year % 100;
    v_y2 := (v_year + 1) % 100;
  ELSE
    v_y1 := (v_year - 1) % 100;
    v_y2 := v_year % 100;
  END IF;

  RETURN to_char(v_y1, 'FM00') || '-' || to_char(v_y2, 'FM00');
END;
$$;

-- Function: Atomic, Concurrency-Safe Document Number Generator
CREATE OR REPLACE FUNCTION public.fn_next_doc_number(
  p_series text,
  p_timestamp timestamptz DEFAULT now()
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fy text;
  v_next_no int;
  v_doc_no text;
BEGIN
  v_fy := public.fn_get_indian_fy(p_timestamp);

  INSERT INTO public.document_number_series (series, fy_label, last_no, updated_at)
  VALUES (p_series, v_fy, 1, now())
  ON CONFLICT (series, fy_label)
  DO UPDATE SET last_no = document_number_series.last_no + 1, updated_at = now()
  RETURNING last_no INTO v_next_no;

  -- Formats: 26-27/PO-0001 (14 char), 26-27/DC-0001 (14 char), 26-27/INV-0001 (15 char <= 16 GST limit)
  v_doc_no := v_fy || '/' || p_series || '-' || to_char(v_next_no, 'FM0000');
  RETURN v_doc_no;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. SOFT DELETE & AUDIT TIMESTAMPS COLUMNS
-- ------------------------------------------------------------------------------
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
    EXECUTE 'ALTER TABLE public.' || quote_ident(tbl) || '
      ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
      ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id),
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);';
  END LOOP;
END $$;

-- Trigger Function: Automatic updated_at / updated_by tracking
CREATE OR REPLACE FUNCTION public.fn_set_updated_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

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
    EXECUTE 'DROP TRIGGER IF EXISTS trg_set_updated_' || quote_ident(tbl) || ' ON public.' || quote_ident(tbl) || ';';
    EXECUTE 'CREATE TRIGGER trg_set_updated_' || quote_ident(tbl) || '
      BEFORE UPDATE ON public.' || quote_ident(tbl) || '
      FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_timestamp();';
  END LOOP;
END $$;

-- Revoke hard DELETE permissions on business tables from authenticated
REVOKE DELETE ON public.orders FROM authenticated;
REVOKE DELETE ON public.order_items FROM authenticated;
REVOKE DELETE ON public.production_allocations FROM authenticated;
REVOKE DELETE ON public.delivery_challans FROM authenticated;
REVOKE DELETE ON public.challan_items FROM authenticated;
REVOKE DELETE ON public.expenses FROM authenticated;
REVOKE DELETE ON public.labour_borrowings FROM authenticated;
REVOKE DELETE ON public.labour_payroll FROM authenticated;
REVOKE DELETE ON public.labour_payroll_disbursements FROM authenticated;
REVOKE DELETE ON public.party_master FROM authenticated;
REVOKE DELETE ON public.item_master FROM authenticated;
REVOKE DELETE ON public.labour_master FROM authenticated;

-- Convert UNIQUE constraints to Partial Unique Indexes (ignoring soft-deleted rows)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_no_key;
CREATE UNIQUE INDEX IF NOT EXISTS uidx_orders_order_no_active
  ON public.orders (order_no) WHERE deleted_at IS NULL;

ALTER TABLE public.delivery_challans DROP CONSTRAINT IF EXISTS delivery_challans_challan_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS uidx_delivery_challans_no_active
  ON public.delivery_challans (challan_number) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------------------------
-- 3. APPEND-ONLY AUDIT LOGGING SYSTEM
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_fields jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Deny all update and delete on audit logs
REVOKE UPDATE, DELETE ON public.audit_logs FROM PUBLIC, authenticated, anon;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read audit logs" ON public.audit_logs;
CREATE POLICY "Admins read audit logs" ON public.audit_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Trigger Function: Capture full before/after audit records
CREATE OR REPLACE FUNCTION public.fn_audit_log_capture()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec_id uuid;
  v_user_id uuid;
  v_changed jsonb := '{}'::jsonb;
  v_key text;
  v_action text;
BEGIN
  -- Skip no-op updates
  IF TG_OP = 'UPDATE' AND to_jsonb(OLD) = to_jsonb(NEW) THEN
    RETURN NEW;
  END IF;

  v_user_id := auth.uid();

  IF TG_OP = 'INSERT' THEN
    v_rec_id := NEW.id;
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_fields, user_id)
    VALUES (TG_TABLE_NAME, v_rec_id, 'INSERT', NULL, to_jsonb(NEW), NULL, v_user_id);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_rec_id := NEW.id;

    -- Detect soft delete action
    IF (to_jsonb(OLD)->>'deleted_at') IS NULL AND (to_jsonb(NEW)->>'deleted_at') IS NOT NULL THEN
      v_action := 'SOFT_DELETE';
    ELSE
      v_action := 'UPDATE';
    END IF;

    -- Compute field-level delta
    FOR v_key IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
      IF (to_jsonb(OLD)->v_key) IS DISTINCT FROM (to_jsonb(NEW)->v_key) THEN
        v_changed := v_changed || jsonb_build_object(v_key, jsonb_build_object('old', to_jsonb(OLD)->v_key, 'new', to_jsonb(NEW)->v_key));
      END IF;
    END LOOP;

    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_fields, user_id)
    VALUES (TG_TABLE_NAME, v_rec_id, v_action, to_jsonb(OLD), to_jsonb(NEW), v_changed, v_user_id);
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_rec_id := OLD.id;
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_fields, user_id)
    VALUES (TG_TABLE_NAME, v_rec_id, 'DELETE', to_jsonb(OLD), NULL, NULL, v_user_id);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

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
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_' || quote_ident(tbl) || ' ON public.' || quote_ident(tbl) || ';';
    EXECUTE 'CREATE TRIGGER trg_audit_' || quote_ident(tbl) || '
      AFTER INSERT OR UPDATE OR DELETE ON public.' || quote_ident(tbl) || '
      FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_capture();';
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 4. SOFT DELETE RPC (Dependency Protection for Parties, Items & Workers)
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
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 1. Dependency checks
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
    -- Cascade soft-delete to order items
    UPDATE public.order_items
    SET deleted_at = now(), deleted_by = auth.uid()
    WHERE order_id = target_id AND deleted_at IS NULL;

  ELSIF target_table = 'delivery_challans' THEN
    SELECT * INTO v_rec FROM public.delivery_challans WHERE id = target_id;
    IF v_rec.status = 'Dispatched' THEN
      RAISE EXCEPTION 'Cannot delete a confirmed dispatched challan. Only draft/cancelled challans can be removed.';
    END IF;
  END IF;

  -- 2. Execute soft delete
  EXECUTE 'UPDATE public.' || quote_ident(target_table) || '
    SET deleted_at = now(), deleted_by = $1
    WHERE id = $2 AND deleted_at IS NULL;'
  USING auth.uid(), target_id;

  RETURN jsonb_build_object('success', true, 'table', target_table, 'id', target_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_record(text, uuid) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. ROW-LEVEL CHECK CONSTRAINTS (Added as NOT VALID for Safe Migration)
-- ------------------------------------------------------------------------------
-- Drop any legacy quantity checks on order_items
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'order_items'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%dispatched_qty%'
  ) LOOP
    EXECUTE 'ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE public.order_items
  ADD CONSTRAINT chk_order_items_quantities_valid
  CHECK (
    ordered_qty >= 0 AND
    allocated_qty >= 0 AND
    completed_qty >= 0 AND
    reserved_qty >= 0 AND
    dispatched_qty >= 0 AND
    allocated_qty <= ordered_qty AND
    completed_qty <= allocated_qty AND
    (dispatched_qty + reserved_qty) <= completed_qty
  ) NOT VALID;

-- Production allocations invariants
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
      AND pg_get_constraintdef(con.oid) ILIKE '%completed_qty%'
  ) LOOP
    EXECUTE 'ALTER TABLE public.production_allocations DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE public.production_allocations
  ADD CONSTRAINT chk_production_allocations_qty_valid
  CHECK (
    allocated_qty > 0 AND
    completed_qty >= 0 AND
    completed_qty <= allocated_qty
  ) NOT VALID;

-- Challan items invariants
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'challan_items'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%dispatched_qty%'
  ) LOOP
    EXECUTE 'ALTER TABLE public.challan_items DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE public.challan_items
  ADD CONSTRAINT chk_challan_items_qty_positive
  CHECK (dispatched_qty > 0) NOT VALID;

-- ------------------------------------------------------------------------------
-- 6. PERFORMANCE & FOREIGN KEY INDEXES
-- ------------------------------------------------------------------------------
-- Foreign key join indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_prod_alloc_order_item_id ON public.production_allocations (order_item_id);
CREATE INDEX IF NOT EXISTS idx_prod_alloc_labour_id ON public.production_allocations (labour_id);
CREATE INDEX IF NOT EXISTS idx_delivery_challans_order_id ON public.delivery_challans (order_id);
CREATE INDEX IF NOT EXISTS idx_challan_items_challan_id ON public.challan_items (challan_id);
CREATE INDEX IF NOT EXISTS idx_challan_items_order_item_id ON public.challan_items (order_item_id);
CREATE INDEX IF NOT EXISTS idx_labour_borrowings_labour_id ON public.labour_borrowings (labour_id);
CREATE INDEX IF NOT EXISTS idx_labour_payroll_labour_id ON public.labour_payroll (labour_id);
CREATE INDEX IF NOT EXISTS idx_expenses_reference_dc_id ON public.expenses (reference_dc_id);
CREATE INDEX IF NOT EXISTS idx_orders_party_id ON public.orders (party_id);

-- Operational filter indexes (Partial indexes excluding soft-deleted rows)
CREATE INDEX IF NOT EXISTS idx_orders_status_active ON public.orders (status, order_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_challans_status_active ON public.delivery_challans (status, dispatch_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_prod_alloc_status_active ON public.production_allocations (status, tentative_completion) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_labour_payroll_status_active ON public.labour_payroll (status, payout_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs (table_name, record_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 7. UPDATE factory_action RPC: WIRED NUMBER SERIES
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.factory_action(action text, payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to continue';
  END IF;

  -- ACTION: ORDER
  IF action = 'order' THEN
    -- Generate sequential Indian FY Order Number (e.g., 26-27/PO-0001)
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
        VALUES('High-priority order', 'A high-priority order needs production allocation.', '/production');
      END IF;
    END LOOP;
    rid := oid;

  -- ACTION: ALLOCATE
  ELSIF action = 'allocate' THEN
    SELECT * INTO STRICT item FROM order_items WHERE id = (payload->>'order_item_id')::uuid FOR UPDATE;
    qty := (payload->>'allocated_qty')::int;
    IF qty <= 0 OR qty > item.ordered_qty - item.allocated_qty THEN
      RAISE EXCEPTION 'Quantity exceeds remaining production';
    END IF;
    INSERT INTO production_allocations(order_item_id, labour_id, allocated_qty, labour_rate, start_time, duration_hours, tentative_completion)
    VALUES(
      item.id,
      (payload->>'labour_id')::uuid,
      qty,
      (payload->>'labour_rate')::numeric,
      (payload->>'start_time')::timestamptz,
      (payload->>'duration_hours')::int,
      (payload->>'start_time')::timestamptz + make_interval(hours => (payload->>'duration_hours')::int)
    ) RETURNING id INTO rid;
    UPDATE order_items SET allocated_qty = allocated_qty + qty WHERE id = item.id;
    UPDATE orders SET status = 'In Production' WHERE id = item.order_id;

  -- ACTION: COMPLETE
  ELSIF action = 'complete' THEN
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
          status = CASE WHEN qty = allocated_qty THEN 'Completed' ELSE 'Partial' END
      WHERE id = allocation.id;
    rid := allocation.id;
    IF qty = allocation.allocated_qty AND qty > allocation.completed_qty THEN
      INSERT INTO factory_notifications(title, body, path)
      VALUES('Production completed', 'An allocation is ready for dispatch.', '/dispatch');
    END IF;

  -- ACTION: CHALLAN (CREATE)
  ELSIF action = 'challan' THEN
    SELECT * INTO STRICT item FROM order_items WHERE id = (payload->>'order_item_id')::uuid FOR UPDATE;
    qty := (payload->>'dispatched_qty')::int;
    IF qty <= 0 OR qty > item.completed_qty - item.dispatched_qty - item.reserved_qty THEN
      RAISE EXCEPTION 'Quantity exceeds available completed production';
    END IF;

    -- Generate sequential Indian FY Challan Number (e.g., 26-27/DC-0001)
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
    SELECT COALESCE(sum(completed_qty * labour_rate) / NULLIF(sum(completed_qty), 0), 0)
      INTO rate FROM production_allocations WHERE order_item_id = item.id;
    INSERT INTO challan_items(challan_id, order_item_id, dispatched_qty, direct_labour_cost)
      VALUES(rid, item.id, qty, qty * rate);
    UPDATE order_items SET reserved_qty = reserved_qty + qty WHERE id = item.id;

  -- ACTION: DISPATCH (CONFIRM)
  ELSIF action = 'dispatch' THEN
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

    -- Update order status: Completed only if all items are fully dispatched, otherwise Partially Dispatched
    UPDATE orders
    SET status = CASE
      WHEN NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = challan.order_id AND dispatched_qty < ordered_qty) THEN 'Completed'
      ELSE 'Partially Dispatched'
    END
    WHERE id = challan.order_id;

    INSERT INTO factory_notifications(title, body, path)
      VALUES('Delivery dispatched', challan.challan_number || ' has been dispatched.', '/dispatch');
    rid := challan.id;

  -- ACTION: CANCEL_CHALLAN
  ELSIF action = 'cancel_challan' THEN
    SELECT * INTO STRICT challan FROM delivery_challans WHERE id = (payload->>'id')::uuid FOR UPDATE;
    IF challan.status <> 'Delivery Challan Made' THEN
      RAISE EXCEPTION 'Only non-dispatched challans in "Delivery Challan Made" status can be cancelled';
    END IF;
    FOR obj IN SELECT to_jsonb(c) FROM challan_items c WHERE challan_id = challan.id LOOP
      UPDATE order_items
      SET reserved_qty = GREATEST(0, reserved_qty - (obj->>'dispatched_qty')::int)
      WHERE id = (obj->>'order_item_id')::uuid;
    END LOOP;
    UPDATE delivery_challans SET status = 'Cancelled' WHERE id = challan.id;
    rid := challan.id;

  -- ACTION: CLOSE_ORDER_SHORT
  ELSIF action = 'close_order_short' THEN
    IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Only administrators can close an order short';
    END IF;

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

  -- ACTION: BORROW
  ELSIF action = 'borrow' THEN
    PERFORM id FROM labour_master WHERE id = (payload->>'labour_id')::uuid FOR UPDATE;
    INSERT INTO labour_borrowings(labour_id, borrow_date, amount, remarks)
    VALUES(
      (payload->>'labour_id')::uuid,
      (payload->>'borrow_date')::date,
      (payload->>'amount')::numeric,
      payload->>'remarks'
    ) RETURNING id INTO rid;

  -- ACTION: PAYROLL
  ELSIF action = 'payroll' THEN
    PERFORM id FROM labour_master WHERE id = (payload->>'labour_id')::uuid FOR UPDATE;
    PERFORM id FROM production_allocations WHERE labour_id = (payload->>'labour_id')::uuid FOR UPDATE;
    SELECT COALESCE(sum(completed_qty * labour_rate - paid_earnings), 0)
      INTO earnings FROM production_allocations WHERE labour_id = (payload->>'labour_id')::uuid;
    IF earnings <= 0 THEN
      RAISE EXCEPTION 'No unpaid production earnings';
    END IF;

    SELECT COALESCE(sum(amount - deducted_amount), 0)
      INTO debt FROM labour_borrowings WHERE labour_id = (payload->>'labour_id')::uuid;
    
    deduction := LEAST(earnings, debt);
    remaining := deduction;

    FOR borrowing IN SELECT * FROM labour_borrowings
      WHERE labour_id = (payload->>'labour_id')::uuid AND deducted_amount < amount
      ORDER BY borrow_date, id FOR UPDATE LOOP
      rate := LEAST(remaining, borrowing.amount - borrowing.deducted_amount);
      UPDATE labour_borrowings SET deducted_amount = deducted_amount + rate WHERE id = borrowing.id;
      remaining := remaining - rate;
    END LOOP;

    UPDATE production_allocations SET paid_earnings = completed_qty * labour_rate WHERE labour_id = (payload->>'labour_id')::uuid;

    INSERT INTO labour_payroll(labour_id, gross, deductions, net_paid, amount_paid, status)
    VALUES(
      (payload->>'labour_id')::uuid,
      earnings,
      deduction,
      earnings - deduction,
      0,
      CASE WHEN (earnings - deduction) <= 0 THEN 'Paid' ELSE 'Pending' END
    ) RETURNING id INTO rid;

  -- ACTION: DISBURSE
  ELSIF action = 'disburse' THEN
    IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Only administrators can record payroll payments';
    END IF;

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

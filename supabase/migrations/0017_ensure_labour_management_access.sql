-- ==============================================================================
-- Migration 0017: Ensure Labour Management Access, Disburse Action & Capabilities
-- ==============================================================================

-- 1. Ensure 'workers' page is included in allowed_pages for all operational roles
UPDATE public.user_roles
SET allowed_pages = array_append(allowed_pages, 'workers')
WHERE NOT ('workers' = ANY(allowed_pages))
  AND (role IN ('admin', 'manager', 'supervisor', 'user', 'accountant', 'dispatch_clerk', 'viewer')
       OR role IS NULL);

-- 2. Update default allowed_pages for future user_roles
ALTER TABLE public.user_roles
  ALTER COLUMN allowed_pages SET DEFAULT ARRAY[
    'dashboard', 'orders', 'production', 'under_production', 'dispatch',
    'parties', 'catalog', 'workers', 'expenses', 'reports', 'settings', 'profile'
  ];

-- 3. Seed capabilities across role_permissions to support both capability names
INSERT INTO public.role_permissions (role, capability, allowed)
VALUES
  -- Admin
  ('admin', 'manage_labour', true),
  ('admin', 'manage_payroll', true),
  ('admin', 'run_payroll', true),
  ('admin', 'record_payment', true),
  ('admin', 'manage_borrowings', true),

  -- Manager
  ('manager', 'manage_labour', true),
  ('manager', 'manage_payroll', true),
  ('manager', 'run_payroll', true),
  ('manager', 'record_payment', true),
  ('manager', 'manage_borrowings', true),

  -- Accountant
  ('accountant', 'manage_labour', true),
  ('accountant', 'manage_payroll', true),
  ('accountant', 'run_payroll', true),
  ('accountant', 'record_payment', true),
  ('accountant', 'manage_borrowings', true),

  -- User (Standard workspace role)
  ('user', 'manage_labour', true),
  ('user', 'manage_payroll', true),
  ('user', 'run_payroll', true),
  ('user', 'record_payment', true),
  ('user', 'manage_borrowings', true),

  -- Supervisor
  ('supervisor', 'manage_labour', true),
  ('supervisor', 'manage_payroll', false),
  ('supervisor', 'run_payroll', false),
  ('supervisor', 'record_payment', false),
  ('supervisor', 'manage_borrowings', false)
ON CONFLICT (role, capability) DO UPDATE
SET allowed = EXCLUDED.allowed;

-- 4. Complete, comprehensive factory_action RPC ensuring all labour & factory actions succeed
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
  v_duration_secs int;
  v_start_time timestamptz;
  v_tentative_completion timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to continue' USING ERRCODE = '42501';
  END IF;

  -- ============================================================================
  -- ACTION: ORDER (create)
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
  -- ACTION: ALLOCATE (assign labour)
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
      SELECT default_labour_rate INTO v_def_rate
      FROM public.item_master
      WHERE box_type = item.box_type AND deleted_at IS NULL;

      rate := v_def_rate;
    END IF;

    v_start_time := COALESCE((payload->>'start_time')::timestamptz, now());

    IF (payload->>'duration_seconds') IS NOT NULL AND (payload->>'duration_seconds')::int > 0 THEN
      v_duration_secs := (payload->>'duration_seconds')::int;
    ELSE
      v_duration_secs := COALESCE((payload->>'duration_hours')::int, 1) * 3600;
    END IF;

    IF (payload->>'tentative_completion') IS NOT NULL THEN
      v_tentative_completion := (payload->>'tentative_completion')::timestamptz;
    ELSE
      v_tentative_completion := v_start_time + make_interval(secs => v_duration_secs);
    END IF;

    INSERT INTO production_allocations(
      order_item_id, labour_id, allocated_qty, labour_rate,
      start_time, duration_hours, duration_seconds, tentative_completion, status
    )
    VALUES(
      item.id,
      (payload->>'labour_id')::uuid,
      qty,
      rate,
      v_start_time,
      COALESCE((payload->>'duration_hours')::int, CEIL(v_duration_secs::numeric / 3600.0)::int),
      v_duration_secs,
      v_tentative_completion,
      CASE WHEN rate IS NULL THEN 'Rate Pending' ELSE 'In Progress' END
    ) RETURNING id INTO rid;

    UPDATE order_items SET allocated_qty = allocated_qty + qty WHERE id = item.id;
    UPDATE orders SET status = 'In Production' WHERE id = item.order_id;

  -- ============================================================================
  -- ACTION: COMPLETE (log completed production)
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
  -- ACTION: CHALLAN (create delivery challan)
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
  -- ACTION: DISPATCH (confirm dispatch)
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
      WHEN NOT EXISTS(SELECT 1 FROM order_items WHERE order_id = challan.order_id AND dispatched_qty < ordered_qty)
      THEN 'Completed'
      ELSE 'Partial Dispatched'
    END
    WHERE id = challan.order_id;

    rid := challan.id;

  -- ============================================================================
  -- ACTION: CANCEL_CHALLAN (revert DC reservation)
  -- ============================================================================
  ELSIF action = 'cancel_challan' THEN
    PERFORM public.fn_require_capability('cancel_challan');

    SELECT * INTO STRICT challan FROM delivery_challans WHERE id = (payload->>'id')::uuid FOR UPDATE;
    IF challan.status <> 'Delivery Challan Made' THEN
      RAISE EXCEPTION 'Only non-dispatched challans in "Delivery Challan Made" status can be cancelled.';
    END IF;

    FOR obj IN SELECT to_jsonb(c) FROM challan_items c WHERE challan_id = challan.id LOOP
      UPDATE order_items
      SET reserved_qty = GREATEST(0, reserved_qty - (obj->>'dispatched_qty')::int)
      WHERE id = (obj->>'order_item_id')::uuid;
    END LOOP;

    UPDATE delivery_challans SET status = 'Cancelled' WHERE id = challan.id;
    rid := challan.id;

  -- ============================================================================
  -- ACTION: BORROW (labour cash advance)
  -- ============================================================================
  ELSIF action = 'borrow' THEN
    IF NOT (public.fn_has_capability('manage_borrowings') OR public.fn_has_capability('manage_labour')) THEN
      RAISE EXCEPTION 'Access denied: missing capability to manage labour borrowings' USING ERRCODE = '42501';
    END IF;

    PERFORM id FROM labour_master WHERE id = (payload->>'labour_id')::uuid FOR UPDATE;

    INSERT INTO labour_borrowings(labour_id, amount, borrow_date, remarks)
    VALUES(
      (payload->>'labour_id')::uuid,
      (payload->>'amount')::numeric,
      COALESCE((payload->>'borrow_date')::date, CURRENT_DATE),
      payload->>'remarks'
    ) RETURNING id INTO rid;

  -- ============================================================================
  -- ACTION: PAYROLL (payout worker)
  -- ============================================================================
  ELSIF action = 'payroll' THEN
    IF NOT (public.fn_has_capability('run_payroll') OR public.fn_has_capability('manage_payroll')) THEN
      RAISE EXCEPTION 'Access denied: missing capability to process payroll' USING ERRCODE = '42501';
    END IF;

    PERFORM id FROM labour_master WHERE id = (payload->>'labour_id')::uuid FOR UPDATE;

    -- Check if worker has unfinalized piece rates
    SELECT count(*) INTO v_pending_rates_count
    FROM production_allocations
    WHERE labour_id = (payload->>'labour_id')::uuid AND labour_rate IS NULL AND completed_qty > 0;

    IF v_pending_rates_count > 0 THEN
      RAISE EXCEPTION 'Cannot process payroll: worker has % production allocation(s) with unfinalized rates. Set piece rates first.', v_pending_rates_count;
    END IF;

    SELECT COALESCE(sum(completed_qty * labour_rate) - sum(paid_earnings), 0)
      INTO earnings
      FROM production_allocations
      WHERE labour_id = (payload->>'labour_id')::uuid AND labour_rate IS NOT NULL;

    SELECT COALESCE(sum(amount - deducted_amount), 0)
      INTO debt
      FROM labour_borrowings
      WHERE labour_id = (payload->>'labour_id')::uuid;

    IF earnings <= 0 THEN
      RAISE EXCEPTION 'No unpaid production earnings available for this worker';
    END IF;

    deduction := LEAST(debt, earnings);

    INSERT INTO labour_payroll(labour_id, payout_date, gross, deductions, net_paid, amount_paid, status)
    VALUES(
      (payload->>'labour_id')::uuid,
      COALESCE((payload->>'payout_date')::date, CURRENT_DATE),
      earnings,
      deduction,
      earnings - deduction,
      0,
      CASE WHEN (earnings - deduction) <= 0 THEN 'Paid' ELSE 'Pending' END
    ) RETURNING id INTO rid;

    UPDATE production_allocations
      SET paid_earnings = completed_qty * labour_rate
      WHERE labour_id = (payload->>'labour_id')::uuid AND labour_rate IS NOT NULL;

    remaining := deduction;
    FOR borrowing IN SELECT * FROM labour_borrowings
      WHERE labour_id = (payload->>'labour_id')::uuid AND deducted_amount < amount
      ORDER BY borrow_date ASC, id ASC FOR UPDATE LOOP
      EXIT WHEN remaining <= 0;
      IF (borrowing.amount - borrowing.deducted_amount) <= remaining THEN
        remaining := remaining - (borrowing.amount - borrowing.deducted_amount);
        UPDATE labour_borrowings SET deducted_amount = amount WHERE id = borrowing.id;
      ELSE
        UPDATE labour_borrowings SET deducted_amount = deducted_amount + remaining WHERE id = borrowing.id;
        remaining := 0;
      END IF;
    END LOOP;

  -- ============================================================================
  -- ACTION: DISBURSE (record payroll payment)
  -- ============================================================================
  ELSIF action = 'disburse' THEN
    IF NOT (public.fn_has_capability('record_payment') OR public.fn_has_capability('run_payroll')) THEN
      RAISE EXCEPTION 'Access denied: missing capability to disburse payroll payment' USING ERRCODE = '42501';
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
    RAISE EXCEPTION 'Unknown action: %', action;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', rid);
END;
$$;

GRANT EXECUTE ON FUNCTION public.factory_action(text, jsonb) TO authenticated;

-- 5. Safely emit realtime ping
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'factory_data_pings' AND column_name = 'action'
  ) THEN
    INSERT INTO public.factory_data_pings (table_name, action, change_source)
    VALUES ('labour_master', 'UPDATE', 'sync_labour_access');
  ELSE
    INSERT INTO public.factory_data_pings (table_name, change_source)
    VALUES ('labour_master', 'sync_labour_access');
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

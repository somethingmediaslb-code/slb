-- ==============================================================================
-- Migration 0014: Custom Duration in Seconds for Production Allocations
-- ==============================================================================
-- Allows production timer customization with seconds, minutes, and hours.
-- Maintains consistency in factory_action RPC while allowing quick testing.
-- ==============================================================================

-- 1. Relax duration_hours constraint to allow 0 or positive values
ALTER TABLE public.production_allocations 
  DROP CONSTRAINT IF EXISTS production_allocations_duration_hours_check;

ALTER TABLE public.production_allocations 
  ADD CONSTRAINT production_allocations_duration_hours_check 
  CHECK (duration_hours >= 0);

-- 2. Add duration_seconds column if it does not already exist
ALTER TABLE public.production_allocations
  ADD COLUMN IF NOT EXISTS duration_seconds int;

-- 3. Update factory_action RPC to handle duration_seconds & flexible tentative_completion
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
  -- Supports granular duration in seconds, minutes, and hours
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

    v_start_time := COALESCE((payload->>'start_time')::timestamptz, now());

    -- Determine duration in seconds (defaults to duration_hours * 3600 or 3600)
    IF (payload->>'duration_seconds') IS NOT NULL AND (payload->>'duration_seconds')::int > 0 THEN
      v_duration_secs := (payload->>'duration_seconds')::int;
    ELSE
      v_duration_secs := COALESCE((payload->>'duration_hours')::int, 1) * 3600;
    END IF;

    -- Tentative completion calculation
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
      WHEN NOT EXISTS(SELECT 1 FROM order_items WHERE order_id = challan.order_id AND dispatched_qty < ordered_qty)
      THEN 'Completed'
      ELSE 'Partial Dispatched'
    END
    WHERE id = challan.order_id;

    rid := challan.id;

  -- ============================================================================
  -- ACTION: BORROW (labour cash advance) -> requires manage_labour
  -- ============================================================================
  ELSIF action = 'borrow' THEN
    PERFORM public.fn_require_capability('manage_labour');

    INSERT INTO labour_borrowings(labour_id, amount, borrow_date, remarks)
    VALUES(
      (payload->>'labour_id')::uuid,
      (payload->>'amount')::numeric,
      COALESCE((payload->>'borrow_date')::date, CURRENT_DATE),
      payload->>'remarks'
    ) RETURNING id INTO rid;

  -- ============================================================================
  -- ACTION: PAYROLL (payout worker) -> requires manage_payroll
  -- ============================================================================
  ELSIF action = 'payroll' THEN
    PERFORM public.fn_require_capability('manage_payroll');

    -- Guard: check if worker has unfinalized piece rates
    SELECT count(*) INTO v_pending_rates_count
    FROM production_allocations
    WHERE labour_id = (payload->>'labour_id')::uuid AND labour_rate IS NULL;

    IF v_pending_rates_count > 0 THEN
      RAISE EXCEPTION 'Cannot process payroll: worker has % production allocation(s) with unfinalized rates. Set piece rates first.', v_pending_rates_count;
    END IF;

    SELECT COALESCE(sum(completed_qty * labour_rate) - sum(paid_earnings), 0)
      INTO earnings
      FROM production_allocations
      WHERE labour_id = (payload->>'labour_id')::uuid;

    SELECT COALESCE(sum(amount - deducted_amount), 0)
      INTO debt
      FROM labour_borrowings
      WHERE labour_id = (payload->>'labour_id')::uuid;

    deduction := LEAST(debt, earnings);

    INSERT INTO labour_payroll(labour_id, payout_date, gross, deductions, net_paid, status)
    VALUES(
      (payload->>'labour_id')::uuid,
      COALESCE((payload->>'payout_date')::date, CURRENT_DATE),
      earnings,
      deduction,
      earnings - deduction,
      'Paid'
    ) RETURNING id INTO rid;

    UPDATE production_allocations
      SET paid_earnings = completed_qty * labour_rate
      WHERE labour_id = (payload->>'labour_id')::uuid;

    remaining := deduction;
    FOR borrowing IN SELECT * FROM labour_borrowings
      WHERE labour_id = (payload->>'labour_id')::uuid AND deducted_amount < amount
      ORDER BY borrow_date ASC FOR UPDATE LOOP
      EXIT WHEN remaining <= 0;
      IF (borrowing.amount - borrowing.deducted_amount) <= remaining THEN
        remaining := remaining - (borrowing.amount - borrowing.deducted_amount);
        UPDATE labour_borrowings SET deducted_amount = amount WHERE id = borrowing.id;
      ELSE
        UPDATE labour_borrowings SET deducted_amount = deducted_amount + remaining WHERE id = borrowing.id;
        remaining := 0;
      END IF;
    END LOOP;

  ELSE
    RAISE EXCEPTION 'Unknown action: %', action;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', rid);
END;
$$;

GRANT EXECUTE ON FUNCTION public.factory_action(text, jsonb) TO authenticated;

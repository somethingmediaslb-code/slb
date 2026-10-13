-- Migration 0003: Comprehensive factory_action v2, Orders & Challan Constraints, and Payroll Backfill

-- 1. Orders: Drop any existing status check constraints dynamically and re-add with 'Partially Dispatched'
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'orders'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  ) LOOP
    EXECUTE 'ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('Pending','In Production','Partially Dispatched','Dispatched','Completed','Cancelled'));

-- Add closed_short audit columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS closed_short boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS close_short_reason text,
  ADD COLUMN IF NOT EXISTS closed_short_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_short_by uuid REFERENCES auth.users(id);

-- 2. Delivery Challans: Ensure status accepts 'Cancelled'
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'delivery_challans'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  ) LOOP
    EXECUTE 'ALTER TABLE public.delivery_challans DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE public.delivery_challans ADD CONSTRAINT delivery_challans_status_check
  CHECK (status IN ('Delivery Challan Made', 'Dispatched', 'Cancelled'));

-- 3. Labour Payroll: Ensure status accepts 'Pending', 'Partially Paid', 'Paid'
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'labour_payroll'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  ) LOOP
    EXECUTE 'ALTER TABLE public.labour_payroll DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE public.labour_payroll ADD CONSTRAINT labour_payroll_status_check
  CHECK (status IN ('Pending', 'Partially Paid', 'Paid'));

-- 4. Backfill existing Paid payroll records
UPDATE public.labour_payroll
SET amount_paid = net_paid
WHERE status = 'Paid' AND (amount_paid = 0 OR amount_paid IS NULL);

-- 5. Complete factory_action v2 RPC
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to continue';
  END IF;

  -- ACTION: ORDER
  IF action = 'order' THEN
    INSERT INTO orders(party_id, is_self_stock, order_date, expected_date, medium, remarks)
    VALUES(
      CASE WHEN (payload->>'is_self_stock')::boolean THEN NULL ELSE (payload->>'party_id')::uuid END,
      COALESCE((payload->>'is_self_stock')::boolean, false),
      (payload->>'order_date')::date,
      (payload->>'expected_date')::date,
      payload->>'medium',
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
    INSERT INTO delivery_challans(order_id, transport_carrier, vehicle_number, lr_number, freight_charges, dispatch_date)
    VALUES(
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
    -- Rule 1: Admin only
    IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Only administrators can close an order short';
    END IF;

    -- Rule 2: Reason of at least 5 characters
    IF payload->>'reason' IS NULL OR char_length(trim(payload->>'reason')) < 5 THEN
      RAISE EXCEPTION 'A valid reason of at least 5 characters is required to close an order short';
    END IF;

    SELECT * INTO STRICT ord FROM orders WHERE id = (payload->>'order_id')::uuid FOR UPDATE;

    -- Rule 3: Reject orders already Completed or Cancelled
    IF ord.status IN ('Completed', 'Cancelled') THEN
      RAISE EXCEPTION 'Order % is already %', ord.order_no, ord.status;
    END IF;

    -- Rule 4: Reject if any challan is currently in "Delivery Challan Made"
    SELECT challan_number INTO open_dc
    FROM delivery_challans
    WHERE order_id = ord.id AND status = 'Delivery Challan Made'
    LIMIT 1;

    IF open_dc.challan_number IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot close order short: Delivery Challan % is pending. Dispatch or cancel it first.', open_dc.challan_number;
    END IF;

    -- Set status to Completed, record who and when
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
    
    -- Cap deduction at LEAST(earnings, debt) so net is never negative
    deduction := LEAST(earnings, debt);
    remaining := deduction;

    -- Deduct oldest borrowings first
    FOR borrowing IN SELECT * FROM labour_borrowings
      WHERE labour_id = (payload->>'labour_id')::uuid AND deducted_amount < amount
      ORDER BY borrow_date, id FOR UPDATE LOOP
      rate := LEAST(remaining, borrowing.amount - borrowing.deducted_amount);
      UPDATE labour_borrowings SET deducted_amount = deducted_amount + rate WHERE id = borrowing.id;
      remaining := remaining - rate;
    END LOOP;

    -- Update paid_earnings to prevent paying the same allocations twice
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

  -- ACTION: DISBURSE (RECORD PAYMENT)
  ELSIF action = 'disburse' THEN
    -- Admin only check
    IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Only administrators can record payroll payments';
    END IF;

    -- Insert into disbursements table, which triggers fn_apply_payroll_disbursement()
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

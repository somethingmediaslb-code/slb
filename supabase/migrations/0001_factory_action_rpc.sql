-- ==============================================================================
-- Migration 0001: Factory Action RPC (Supabase-safe)
-- The core business logic function — was missing from supabase/migrations/
-- ==============================================================================

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
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to continue'; END IF;

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
    IF jsonb_array_length(payload->'items') = 0 THEN RAISE EXCEPTION 'Add at least one order item'; END IF;
    FOR obj IN SELECT value FROM jsonb_array_elements(payload->'items') LOOP
      INSERT INTO order_items(order_id, sr_no, box_type, code_remarks, size_dimensions, specification, ordered_qty, unit_rate, priority_signal)
      VALUES(oid, (obj->>'sr_no')::int, obj->>'box_type', obj->>'code_remarks', obj->>'size_dimensions', obj->>'specification',
        (obj->>'ordered_qty')::int, COALESCE((obj->>'unit_rate')::numeric, 0), obj->>'priority_signal');
      IF obj->>'priority_signal' = 'Red' THEN
        INSERT INTO factory_notifications(title, body, path) VALUES('High-priority order', 'A high-priority order needs production allocation.', '/production');
      END IF;
    END LOOP;
    rid := oid;

  ELSIF action = 'allocate' THEN
    SELECT * INTO STRICT item FROM order_items WHERE id = (payload->>'order_item_id')::uuid FOR UPDATE;
    qty := (payload->>'allocated_qty')::int;
    IF qty <= 0 OR qty > item.ordered_qty - item.allocated_qty THEN RAISE EXCEPTION 'Quantity exceeds remaining production'; END IF;
    INSERT INTO production_allocations(order_item_id, labour_id, allocated_qty, labour_rate, start_time, duration_hours, tentative_completion)
    VALUES(item.id, (payload->>'labour_id')::uuid, qty, (payload->>'labour_rate')::numeric, (payload->>'start_time')::timestamptz,
      (payload->>'duration_hours')::int, (payload->>'start_time')::timestamptz + make_interval(hours => (payload->>'duration_hours')::int))
    RETURNING id INTO rid;
    UPDATE order_items SET allocated_qty = allocated_qty + qty WHERE id = item.id;
    UPDATE orders SET status = 'In Production' WHERE id = item.order_id;

  ELSIF action = 'complete' THEN
    SELECT order_item_id INTO oid FROM production_allocations WHERE id = (payload->>'id')::uuid;
    PERFORM id FROM order_items WHERE id = oid FOR UPDATE;
    SELECT * INTO STRICT allocation FROM production_allocations WHERE id = (payload->>'id')::uuid FOR UPDATE;
    qty := (payload->>'completed_qty')::int;
    IF qty < allocation.completed_qty OR qty > allocation.allocated_qty THEN
      RAISE EXCEPTION 'Completed quantity must be between previous completion and allocated quantity';
    END IF;
    UPDATE order_items SET completed_qty = completed_qty + qty - allocation.completed_qty WHERE id = allocation.order_item_id;
    UPDATE production_allocations SET completed_qty = qty, status = CASE WHEN qty = allocated_qty THEN 'Completed' ELSE 'Partial' END WHERE id = allocation.id;
    rid := allocation.id;
    IF qty = allocation.allocated_qty AND qty > allocation.completed_qty THEN
      INSERT INTO factory_notifications(title, body, path) VALUES('Production completed', 'An allocation is ready for dispatch.', '/dispatch');
    END IF;

  ELSIF action = 'challan' THEN
    SELECT * INTO STRICT item FROM order_items WHERE id = (payload->>'order_item_id')::uuid FOR UPDATE;
    qty := (payload->>'dispatched_qty')::int;
    IF qty <= 0 OR qty > item.completed_qty - item.dispatched_qty - item.reserved_qty THEN
      RAISE EXCEPTION 'Quantity exceeds available completed production';
    END IF;
    INSERT INTO delivery_challans(order_id, transport_carrier, vehicle_number, lr_number, freight_charges, dispatch_date)
    VALUES(item.order_id, payload->>'transport_carrier', payload->>'vehicle_number', payload->>'lr_number',
      COALESCE((payload->>'freight_charges')::numeric, 0), (payload->>'dispatch_date')::timestamptz) RETURNING id INTO rid;
    SELECT COALESCE(sum(completed_qty * labour_rate) / NULLIF(sum(completed_qty), 0), 0) INTO rate
    FROM production_allocations WHERE order_item_id = item.id;
    INSERT INTO challan_items(challan_id, order_item_id, dispatched_qty, direct_labour_cost) VALUES(rid, item.id, qty, qty * rate);
    UPDATE order_items SET reserved_qty = reserved_qty + qty WHERE id = item.id;

  ELSIF action = 'dispatch' THEN
    SELECT * INTO STRICT challan FROM delivery_challans WHERE id = (payload->>'id')::uuid FOR UPDATE;
    IF challan.status <> 'Delivery Challan Made' THEN RAISE EXCEPTION 'Challan has already been dispatched'; END IF;
    FOR obj IN SELECT to_jsonb(c) FROM challan_items c WHERE challan_id = challan.id ORDER BY order_item_id LOOP
      UPDATE order_items SET
        reserved_qty = reserved_qty - (obj->>'dispatched_qty')::int,
        dispatched_qty = dispatched_qty + (obj->>'dispatched_qty')::int
      WHERE id = (obj->>'order_item_id')::uuid;
    END LOOP;
    UPDATE delivery_challans SET status = 'Dispatched' WHERE id = challan.id;
    UPDATE orders SET status = CASE WHEN NOT EXISTS(SELECT 1 FROM order_items WHERE order_id = challan.order_id AND dispatched_qty < ordered_qty) THEN 'Completed' ELSE 'Dispatched' END WHERE id = challan.order_id;
    INSERT INTO factory_notifications(title, body, path) VALUES('Delivery dispatched', challan.challan_number || ' has been dispatched.', '/dispatch');
    rid := challan.id;

  ELSIF action = 'borrow' THEN
    PERFORM id FROM labour_master WHERE id = (payload->>'labour_id')::uuid FOR UPDATE;
    INSERT INTO labour_borrowings(labour_id, borrow_date, amount, remarks)
    VALUES((payload->>'labour_id')::uuid, (payload->>'borrow_date')::date, (payload->>'amount')::numeric, payload->>'remarks')
    RETURNING id INTO rid;

  ELSIF action = 'payroll' THEN
    PERFORM id FROM labour_master WHERE id = (payload->>'labour_id')::uuid FOR UPDATE;
    PERFORM id FROM production_allocations WHERE labour_id = (payload->>'labour_id')::uuid FOR UPDATE;
    SELECT COALESCE(sum(completed_qty * labour_rate - paid_earnings), 0) INTO earnings FROM production_allocations WHERE labour_id = (payload->>'labour_id')::uuid;
    IF earnings <= 0 THEN RAISE EXCEPTION 'No unpaid production earnings'; END IF;
    SELECT COALESCE(sum(amount - deducted_amount), 0) INTO debt FROM labour_borrowings WHERE labour_id = (payload->>'labour_id')::uuid;
    deduction := LEAST(earnings, debt); remaining := deduction;
    FOR borrowing IN SELECT * FROM labour_borrowings WHERE labour_id = (payload->>'labour_id')::uuid AND deducted_amount < amount ORDER BY borrow_date, id FOR UPDATE LOOP
      rate := LEAST(remaining, borrowing.amount - borrowing.deducted_amount);
      UPDATE labour_borrowings SET deducted_amount = deducted_amount + rate WHERE id = borrowing.id;
      remaining := remaining - rate;
    END LOOP;
    UPDATE production_allocations SET paid_earnings = completed_qty * labour_rate WHERE labour_id = (payload->>'labour_id')::uuid;
    INSERT INTO labour_payroll(labour_id, gross, deductions, net_paid, status)
    VALUES((payload->>'labour_id')::uuid, earnings, deduction, earnings - deduction, CASE WHEN (earnings - deduction) <= 0 THEN 'Paid' ELSE 'Pending' END)
    RETURNING id INTO rid;

  ELSIF action = 'cancel_challan' THEN
    SELECT * INTO STRICT challan FROM delivery_challans WHERE id = (payload->>'id')::uuid FOR UPDATE;
    IF challan.status <> 'Delivery Challan Made' THEN
      RAISE EXCEPTION 'Only non-dispatched challans in "Delivery Challan Made" status can be cancelled';
    END IF;
    FOR obj IN SELECT to_jsonb(c) FROM challan_items c WHERE challan_id = challan.id LOOP
      UPDATE order_items SET reserved_qty = GREATEST(0, reserved_qty - (obj->>'dispatched_qty')::int) WHERE id = (obj->>'order_item_id')::uuid;
    END LOOP;
    UPDATE delivery_challans SET status = 'Cancelled' WHERE id = challan.id;
    rid := challan.id;

  ELSE
    RAISE EXCEPTION 'Unknown factory action';
  END IF;

  RETURN jsonb_build_object('id', rid);
END;
$$;

REVOKE ALL ON FUNCTION public.factory_action(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.factory_action(text, jsonb) TO authenticated;

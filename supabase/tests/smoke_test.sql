-- ==============================================================================
-- CrateERP Supabase Architecture Smoke Test
-- Runs in a self-contained transaction with ROLLBACK at the end.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_user_id  uuid := '22222222-2222-2222-2222-222222222222';
  v_party_id uuid;
  v_labour_id uuid;
  v_labour_2_id uuid;
  v_order_res jsonb;
  v_order_id uuid;
  v_item_id uuid;
  v_alloc_res jsonb;
  v_alloc_id uuid;
  v_challan_res jsonb;
  v_challan_id uuid;
  v_challan_2_id uuid;
  v_order_status text;
  v_reserved int;
  v_payroll_res jsonb;
  v_payroll_id uuid;
  v_gross numeric;
  v_deductions numeric;
  v_net numeric;
  v_status text;
  v_amount_paid numeric;
  v_failed boolean;
  v_err_msg text;
BEGIN
  RAISE NOTICE 'Starting CrateERP Architecture Smoke Tests...';

  -- Set up mock authenticated admin user
  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id, 'role', 'authenticated')::text, true);

  -- Ensure test users exist in auth.users so foreign keys are satisfied
  BEGIN
    INSERT INTO auth.users (id, aud, role, email)
    VALUES
      (v_admin_id, 'authenticated', 'authenticated', 'smoke_admin@test.local'),
      (v_user_id, 'authenticated', 'authenticated', 'smoke_user@test.local')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Setup test roles without relying on single-column ON CONFLICT
  DELETE FROM public.user_roles WHERE user_id IN (v_admin_id, v_user_id);
  INSERT INTO public.user_roles(user_id, role) VALUES (v_admin_id, 'admin');
  INSERT INTO public.user_roles(user_id, role) VALUES (v_user_id, 'user');

  -- Fixture Party & Labour
  INSERT INTO public.party_master(company_name, phone_number)
  VALUES ('Test Smoke Party', '9999999999')
  RETURNING id INTO v_party_id;

  INSERT INTO public.labour_master(labour_name, daily_rate)
  VALUES ('Smoke Worker 1', 400)
  RETURNING id INTO v_labour_id;

  INSERT INTO public.labour_master(labour_name, daily_rate)
  VALUES ('Smoke Worker 2', 400)
  RETURNING id INTO v_labour_2_id;

  -- --------------------------------------------------------------------------
  -- TEST A: Order 100, Dispatch 40, Confirm -> Order is Partially Dispatched
  -- --------------------------------------------------------------------------
  v_order_res := public.factory_action('order', jsonb_build_object(
    'party_id', v_party_id,
    'is_self_stock', false,
    'order_date', CURRENT_DATE::text,
    'expected_date', CURRENT_DATE::text,
    'medium', 'Other',
    'remarks', 'Smoke test order',
    'items', jsonb_build_array(
      jsonb_build_object(
        'sr_no', 1,
        'box_type', 'Pine Box Standard',
        'code_remarks', 'Smoke A',
        'size_dimensions', '20x10x10',
        'specification', 'Pine 12mm',
        'ordered_qty', 100,
        'unit_rate', 150,
        'priority_signal', 'Yellow'
      )
    )
  ));
  v_order_id := (v_order_res->>'id')::uuid;

  SELECT id INTO v_item_id FROM public.order_items WHERE order_id = v_order_id;

  -- Allocate 100 boxes
  v_alloc_res := public.factory_action('allocate', jsonb_build_object(
    'order_item_id', v_item_id,
    'labour_id', v_labour_id,
    'allocated_qty', 100,
    'labour_rate', 10,
    'start_time', now()::text,
    'duration_hours', 8
  ));
  v_alloc_id := (v_alloc_res->>'id')::uuid;

  -- Complete 100 boxes
  PERFORM public.factory_action('complete', jsonb_build_object(
    'id', v_alloc_id,
    'completed_qty', 100
  ));

  -- Create delivery challan for 40 boxes
  v_challan_res := public.factory_action('challan', jsonb_build_object(
    'order_item_id', v_item_id,
    'dispatched_qty', 40,
    'transport_carrier', 'Express Logistics',
    'vehicle_number', 'GJ-01-AB-1234',
    'lr_number', 'LR-9988',
    'freight_charges', 500,
    'dispatch_date', now()::text
  ));
  v_challan_id := (v_challan_res->>'id')::uuid;

  -- Confirm dispatch
  PERFORM public.factory_action('dispatch', jsonb_build_object('id', v_challan_id));

  SELECT status INTO v_order_status FROM public.orders WHERE id = v_order_id;
  IF v_order_status <> 'Partially Dispatched' THEN
    RAISE EXCEPTION 'TEST A FAILED: Expected order status "Partially Dispatched", got "%"', v_order_status;
  END IF;
  RAISE NOTICE 'PASS: Test A (Order status is Partially Dispatched)';

  -- --------------------------------------------------------------------------
  -- TEST B: Second challan exceeding completed quantity is blocked
  -- --------------------------------------------------------------------------
  -- Total completed = 100, dispatched = 40. Available = 60. Attempting 70 must fail.
  v_failed := false;
  BEGIN
    PERFORM public.factory_action('challan', jsonb_build_object(
      'order_item_id', v_item_id,
      'dispatched_qty', 70,
      'transport_carrier', 'Express',
      'vehicle_number', 'GJ-01-AB-1234',
      'lr_number', 'LR-9989',
      'freight_charges', 0,
      'dispatch_date', now()::text
    ));
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST B FAILED: Overselling completed inventory was NOT blocked!';
  END IF;
  RAISE NOTICE 'PASS: Test B (Overselling completed inventory blocked)';

  -- --------------------------------------------------------------------------
  -- TEST C: Cancelling a challan releases the reservation
  -- --------------------------------------------------------------------------
  -- Create challan for 30 boxes (available drops from 60 to 30; reserved = 30)
  v_challan_res := public.factory_action('challan', jsonb_build_object(
    'order_item_id', v_item_id,
    'dispatched_qty', 30,
    'transport_carrier', 'Express',
    'vehicle_number', 'GJ-01-AB-1234',
    'lr_number', 'LR-9990',
    'freight_charges', 0,
    'dispatch_date', now()::text
  ));
  v_challan_2_id := (v_challan_res->>'id')::uuid;

  SELECT reserved_qty INTO v_reserved FROM public.order_items WHERE id = v_item_id;
  IF v_reserved <> 30 THEN
    RAISE EXCEPTION 'TEST C FAILED: Expected reserved_qty = 30, got %', v_reserved;
  END IF;

  -- Cancel challan
  PERFORM public.factory_action('cancel_challan', jsonb_build_object('id', v_challan_2_id));

  SELECT reserved_qty INTO v_reserved FROM public.order_items WHERE id = v_item_id;
  IF v_reserved <> 0 THEN
    RAISE EXCEPTION 'TEST C FAILED: Reserved quantity was not reset to 0 after cancellation, got %', v_reserved;
  END IF;

  SELECT status INTO v_status FROM public.delivery_challans WHERE id = v_challan_2_id;
  IF v_status <> 'Cancelled' THEN
    RAISE EXCEPTION 'TEST C FAILED: Expected challan status "Cancelled", got "%"', v_status;
  END IF;
  RAISE NOTICE 'PASS: Test C (Cancelling challan releases reservation and sets status to Cancelled)';

  -- --------------------------------------------------------------------------
  -- TEST D: Payroll with advances higher than earnings -> net is 0, never negative;
  --         Running payroll twice raises an error.
  -- --------------------------------------------------------------------------
  -- Labour 1 earnings: 100 boxes * ₹10 = ₹1,000.
  -- Add borrowings of ₹1,500 (> ₹1,000).
  PERFORM public.factory_action('borrow', jsonb_build_object(
    'labour_id', v_labour_id,
    'borrow_date', CURRENT_DATE::text,
    'amount', 1500,
    'remarks', 'Large advance'
  ));

  v_payroll_res := public.factory_action('payroll', jsonb_build_object(
    'labour_id', v_labour_id
  ));
  v_payroll_id := (v_payroll_res->>'id')::uuid;

  SELECT gross, deductions, net_paid INTO v_gross, v_deductions, v_net
  FROM public.labour_payroll WHERE id = v_payroll_id;

  IF v_gross <> 1000 OR v_deductions <> 1000 OR v_net <> 0 THEN
    RAISE EXCEPTION 'TEST D FAILED: Expected gross=1000, deductions=1000, net=0; got gross=%, ded=%, net=%',
      v_gross, v_deductions, v_net;
  END IF;

  -- Try running payroll a second time immediately
  v_failed := false;
  BEGIN
    PERFORM public.factory_action('payroll', jsonb_build_object('labour_id', v_labour_id));
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST D FAILED: Running payroll twice did not raise an error!';
  END IF;
  RAISE NOTICE 'PASS: Test D (Net payable is 0 and double-payroll prevented)';

  -- --------------------------------------------------------------------------
  -- TEST E: Disbursement above net payable is rejected;
  --         Part payment -> Partially Paid; Full payment -> Paid
  -- --------------------------------------------------------------------------
  -- Allocate & complete for Labour 2: 50 boxes * ₹20 = ₹1,000 net payable (0 borrowings)
  v_order_res := public.factory_action('order', jsonb_build_object(
    'party_id', v_party_id,
    'is_self_stock', false,
    'order_date', CURRENT_DATE::text,
    'expected_date', CURRENT_DATE::text,
    'medium', 'Other',
    'remarks', 'Smoke payroll order',
    'items', jsonb_build_array(
      jsonb_build_object(
        'sr_no', 1,
        'box_type', 'Pine Box Small',
        'code_remarks', 'Smoke E',
        'size_dimensions', '10x10x10',
        'specification', 'Pine 10mm',
        'ordered_qty', 50,
        'unit_rate', 100,
        'priority_signal', 'Green'
      )
    )
  ));
  SELECT id INTO v_item_id FROM public.order_items WHERE order_id = (v_order_res->>'id')::uuid;

  v_alloc_res := public.factory_action('allocate', jsonb_build_object(
    'order_item_id', v_item_id,
    'labour_id', v_labour_2_id,
    'allocated_qty', 50,
    'labour_rate', 20,
    'start_time', now()::text,
    'duration_hours', 4
  ));
  PERFORM public.factory_action('complete', jsonb_build_object('id', (v_alloc_res->>'id')::uuid, 'completed_qty', 50));

  v_payroll_res := public.factory_action('payroll', jsonb_build_object('labour_id', v_labour_2_id));
  v_payroll_id := (v_payroll_res->>'id')::uuid;

  -- Attempt disbursement of ₹1,200 (> ₹1,000 net payable) -> must fail
  v_failed := false;
  BEGIN
    PERFORM public.factory_action('disburse', jsonb_build_object(
      'payroll_id', v_payroll_id,
      'amount', 1200,
      'payment_mode', 'UPI'
    ));
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST E FAILED: Overpayment above net payable was NOT rejected!';
  END IF;

  -- Part payment of ₹400 -> Partially Paid
  PERFORM public.factory_action('disburse', jsonb_build_object(
    'payroll_id', v_payroll_id,
    'amount', 400,
    'payment_mode', 'UPI',
    'reference_notes', 'Partial instalment'
  ));

  SELECT status, amount_paid INTO v_status, v_amount_paid FROM public.labour_payroll WHERE id = v_payroll_id;
  IF v_status <> 'Partially Paid' OR v_amount_paid <> 400 THEN
    RAISE EXCEPTION 'TEST E FAILED: Expected status="Partially Paid" and amount_paid=400, got status="%" amount=%',
      v_status, v_amount_paid;
  END IF;

  -- Full payment of remaining ₹600 -> Paid
  PERFORM public.factory_action('disburse', jsonb_build_object(
    'payroll_id', v_payroll_id,
    'amount', 600,
    'payment_mode', 'Bank Transfer',
    'reference_notes', 'Final clearance'
  ));

  SELECT status, amount_paid INTO v_status, v_amount_paid FROM public.labour_payroll WHERE id = v_payroll_id;
  IF v_status <> 'Paid' OR v_amount_paid <> 1000 THEN
    RAISE EXCEPTION 'TEST E FAILED: Expected status="Paid" and amount_paid=1000, got status="%" amount=%',
      v_status, v_amount_paid;
  END IF;
  RAISE NOTICE 'PASS: Test E (Disbursement validation, Partially Paid & Paid transitions)';

  -- --------------------------------------------------------------------------
  -- TEST F: close_order_short fails for non-admins, without reason, and with open challan
  -- --------------------------------------------------------------------------
  -- 1. Try as non-admin
  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_id, 'role', 'authenticated')::text, true);

  v_failed := false;
  BEGIN
    PERFORM public.factory_action('close_order_short', jsonb_build_object(
      'order_id', v_order_id,
      'reason', 'Valid reason string'
    ));
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST F FAILED: Non-admin was permitted to close order short!';
  END IF;

  -- Restore admin user
  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id, 'role', 'authenticated')::text, true);

  -- 2. Try with reason < 5 chars
  v_failed := false;
  BEGIN
    PERFORM public.factory_action('close_order_short', jsonb_build_object(
      'order_id', v_order_id,
      'reason', 'Bad'
    ));
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST F FAILED: Closing order short without >= 5 char reason was permitted!';
  END IF;

  -- 3. Try with an open challan in 'Delivery Challan Made'
  -- Re-query the order_item_id belonging to v_order_id (since v_item_id was reassigned in Test E)
  SELECT id INTO v_item_id FROM public.order_items WHERE order_id = v_order_id;

  -- Create open challan on v_order_id
  v_challan_res := public.factory_action('challan', jsonb_build_object(
    'order_item_id', v_item_id,
    'dispatched_qty', 10,
    'transport_carrier', 'Express',
    'vehicle_number', 'GJ-01-AB-1234',
    'lr_number', 'LR-OPEN',
    'freight_charges', 0,
    'dispatch_date', now()::text
  ));

  v_failed := false;
  BEGIN
    PERFORM public.factory_action('close_order_short', jsonb_build_object(
      'order_id', v_order_id,
      'reason', 'Customer requested balance cancellation'
    ));
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST F FAILED: Closing order short with open challan was permitted!';
  END IF;

  -- Cancel the open challan
  PERFORM public.factory_action('cancel_challan', jsonb_build_object('id', (v_challan_res->>'id')::uuid));

  -- Now close order short succeeds as admin
  PERFORM public.factory_action('close_order_short', jsonb_build_object(
    'order_id', v_order_id,
    'reason', 'Customer requested balance cancellation'
  ));

  SELECT status, closed_short, close_short_reason, closed_short_by
  INTO v_order_status, v_failed, v_err_msg, v_admin_id
  FROM public.orders WHERE id = v_order_id;

  IF v_order_status <> 'Completed' OR v_failed <> true OR v_err_msg <> 'Customer requested balance cancellation' THEN
    RAISE EXCEPTION 'TEST F FAILED: Order was not closed short properly!';
  END IF;
  RAISE NOTICE 'PASS: Test F (close_order_short security, validation and execution)';

  -- ============================================================================
  -- TEST G: Phase 1A Check Constraints (Negative, Out-of-bounds Qty Rejection)
  -- ============================================================================
  RAISE NOTICE 'Starting Test G: Phase 1A Check Constraints...';

  -- 1. order_items: ordered_qty < 0 must fail
  v_failed := false;
  BEGIN
    INSERT INTO public.order_items (order_id, description, ordered_qty, unit_rate)
    VALUES (v_order_id, 'Illegal negative item', -10, 100);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST G FAILED: Negative ordered_qty was permitted on order_items!';
  END IF;

  -- 2. order_items: allocated_qty > ordered_qty must fail
  v_failed := false;
  BEGIN
    INSERT INTO public.order_items (order_id, description, ordered_qty, allocated_qty, unit_rate)
    VALUES (v_order_id, 'Overallocated item', 50, 100, 100);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST G FAILED: allocated_qty > ordered_qty was permitted on order_items!';
  END IF;

  -- 3. production_allocations: allocated_qty <= 0 must fail
  v_failed := false;
  BEGIN
    INSERT INTO public.production_allocations (order_item_id, labour_id, allocated_qty)
    VALUES (v_item_id, v_labour_id, 0);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST G FAILED: allocated_qty <= 0 was permitted on production_allocations!';
  END IF;

  -- 4. production_allocations: completed_qty > allocated_qty must fail
  v_failed := false;
  BEGIN
    INSERT INTO public.production_allocations (order_item_id, labour_id, allocated_qty, completed_qty)
    VALUES (v_item_id, v_labour_id, 20, 25);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST G FAILED: completed_qty > allocated_qty was permitted on production_allocations!';
  END IF;

  -- 5. challan_items: dispatched_qty <= 0 must fail
  v_failed := false;
  BEGIN
    INSERT INTO public.challan_items (challan_id, order_item_id, dispatched_qty)
    VALUES (v_challan_id, v_item_id, 0);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST G FAILED: dispatched_qty <= 0 was permitted on challan_items!';
  END IF;

  RAISE NOTICE 'PASS: Test G (Database integrity check constraints enforced)';

  -- ============================================================================
  -- TEST H: Concurrency-Safe Indian Financial Year Number Series
  -- ============================================================================
  RAISE NOTICE 'Starting Test H: Indian FY Number Series Boundary Tests...';

  -- 31 March 2026 23:59:00 IST is '2026-03-31 18:29:00+00' UTC -> must be '25-26'
  IF public.fn_get_indian_fy('2026-03-31 18:29:00+00'::timestamptz) <> '25-26' THEN
    RAISE EXCEPTION 'TEST H FAILED: 31 March 23:59 IST did not map to 25-26! Got %',
      public.fn_get_indian_fy('2026-03-31 18:29:00+00'::timestamptz);
  END IF;

  -- 1 April 2026 00:01:00 IST is '2026-03-31 18:31:00+00' UTC -> must be '26-27'
  IF public.fn_get_indian_fy('2026-03-31 18:31:00+00'::timestamptz) <> '26-27' THEN
    RAISE EXCEPTION 'TEST H FAILED: 1 April 00:01 IST did not map to 26-27! Got %',
      public.fn_get_indian_fy('2026-03-31 18:31:00+00'::timestamptz);
  END IF;

  -- Sequential increment test
  DECLARE
    v_doc_1 text;
    v_doc_2 text;
    v_doc_inv text;
  BEGIN
    v_doc_1 := public.fn_next_doc_number('TEST', '2026-03-31 18:29:00+00'::timestamptz);
    v_doc_2 := public.fn_next_doc_number('TEST', '2026-03-31 18:29:00+00'::timestamptz);
    v_doc_inv := public.fn_next_doc_number('INV', '2026-04-05 10:00:00+00'::timestamptz);

    IF v_doc_1 <> '25-26/TEST-0001' OR v_doc_2 <> '25-26/TEST-0002' THEN
      RAISE EXCEPTION 'TEST H FAILED: Consecutive number generation failed! Got % and %', v_doc_1, v_doc_2;
    END IF;

    -- GST rule: Invoice number must be <= 16 characters
    IF length(v_doc_inv) > 16 THEN
      RAISE EXCEPTION 'TEST H FAILED: Invoice number exceeded GST 16-character limit! Got % (length %)',
        v_doc_inv, length(v_doc_inv);
    END IF;
  END;

  RAISE NOTICE 'PASS: Test H (Indian FY boundary and document sequence tests passed)';

  -- ============================================================================
  -- TEST I: Soft Delete Dependency Blocking
  -- ============================================================================
  RAISE NOTICE 'Starting Test I: Soft Delete Dependency Blocking...';

  -- 1. Try to soft delete a party with existing orders
  v_failed := false;
  BEGIN
    PERFORM public.soft_delete_record('party_master', v_party_id);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST I FAILED: Soft delete of party with order history was allowed!';
  END IF;

  -- 2. Try to soft delete a labourer with production allocation history
  v_failed := false;
  BEGIN
    PERFORM public.soft_delete_record('labour_master', v_labour_id);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST I FAILED: Soft delete of labourer with allocation history was allowed!';
  END IF;

  -- 3. Soft delete an unlinked record succeeds
  DECLARE
    v_orphan_party uuid;
    v_del_res jsonb;
    v_is_deleted boolean;
  BEGIN
    INSERT INTO public.party_master (company_name, phone_number)
    VALUES ('Orphan Party For Deletion', '1111222233')
    RETURNING id INTO v_orphan_party;

    v_del_res := public.soft_delete_record('party_master', v_orphan_party);
    SELECT (deleted_at IS NOT NULL) INTO v_is_deleted FROM public.party_master WHERE id = v_orphan_party;

    IF NOT v_is_deleted THEN
      RAISE EXCEPTION 'TEST I FAILED: Orphan party soft delete did not mark deleted_at!';
    END IF;
  END;

  RAISE NOTICE 'PASS: Test I (Soft delete dependency protection verified)';

  -- ============================================================================
  -- TEST J: Audit Logging Capture
  -- ============================================================================
  RAISE NOTICE 'Starting Test J: Audit Logging Capture...';

  DECLARE
    v_audit_count int;
  BEGIN
    SELECT count(*) INTO v_audit_count
    FROM public.audit_logs
    WHERE table_name = 'orders' AND record_id = v_order_id;

    IF v_audit_count = 0 THEN
      RAISE EXCEPTION 'TEST J FAILED: No audit log was recorded for test order mutation!';
    END IF;

    -- Assert audit log recorded correct fields
    PERFORM 1 FROM public.audit_logs
    WHERE table_name = 'orders'
      AND record_id = v_order_id
      AND action IN ('INSERT', 'UPDATE')
      AND user_id = v_admin_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'TEST J FAILED: Audit log record missing correct action or user_id!';
    END IF;
  END;

  RAISE NOTICE 'PASS: Test J (Append-only audit logs captured successfully)';

  RAISE NOTICE 'ALL SMOKE TESTS (A through J) COMPLETED SUCCESSFULLY.';
END $$;

ROLLBACK;


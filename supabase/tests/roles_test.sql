-- ==============================================================================
-- CrateERP Phase 1B: Roles, Capabilities & Privacy Test Suite
-- Runs in a self-contained transaction with ROLLBACK at the end.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
  v_admin_id      uuid := '11111111-1111-1111-1111-111111111111';
  v_manager_id    uuid := '22222222-2222-2222-2222-222222222222';
  v_supervisor_id uuid := '33333333-3333-3333-3333-333333333333';
  v_accountant_id uuid := '44444444-4444-4444-4444-444444444444';
  v_dispatch_id   uuid := '55555555-5555-5555-5555-555555555555';
  v_viewer_id     uuid := '66666666-6666-6666-6666-666666666666';

  v_party_id uuid;
  v_labour_id uuid;
  v_labour_unrated_id uuid;
  v_order_res jsonb;
  v_order_id uuid;
  v_item_id uuid;
  v_item_unrated_id uuid;
  v_alloc_res jsonb;
  v_alloc_id uuid;
  v_challan_res jsonb;
  v_challan_id uuid;
  v_payroll_res jsonb;
  v_payroll_id uuid;

  v_count int;
  v_rate numeric;
  v_unit_rate numeric;
  v_phone text;
  v_company text;
  v_status text;
  v_failed boolean;
  v_err_msg text;
BEGIN
  RAISE NOTICE 'Starting CrateERP Phase 1B Roles & Privacy Tests...';

  -- ----------------------------------------------------------------------------
  -- 0. TEST FIXTURES SETUP (Run as superuser/postgres)
  -- ----------------------------------------------------------------------------
  -- Setup test users in auth.users
  BEGIN
    INSERT INTO auth.users (id, aud, role, email)
    VALUES
      (v_admin_id, 'authenticated', 'authenticated', 'admin@test.local'),
      (v_manager_id, 'authenticated', 'authenticated', 'manager@test.local'),
      (v_supervisor_id, 'authenticated', 'authenticated', 'supervisor@test.local'),
      (v_accountant_id, 'authenticated', 'authenticated', 'accountant@test.local'),
      (v_dispatch_id, 'authenticated', 'authenticated', 'dispatch@test.local'),
      (v_viewer_id, 'authenticated', 'authenticated', 'viewer@test.local')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Setup role assignments
  DELETE FROM public.user_roles WHERE user_id IN (
    v_admin_id, v_manager_id, v_supervisor_id, v_accountant_id, v_dispatch_id, v_viewer_id
  );
  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_admin_id, 'admin'),
    (v_manager_id, 'manager'),
    (v_supervisor_id, 'supervisor'),
    (v_accountant_id, 'accountant'),
    (v_dispatch_id, 'dispatch_clerk'),
    (v_viewer_id, 'viewer');

  -- Create master data
  INSERT INTO public.party_master (company_name, phone_number, contact_person, email, address, gstin)
  VALUES ('Industrial Auto Corp', '9876543210', 'Rahul Sharma', 'rahul@auto.in', 'GIDC Sanand', '24AAACA1234A1Z5')
  RETURNING id INTO v_party_id;

  INSERT INTO public.item_master (box_type, length_mm, width_mm, height_mm, default_labour_rate)
  VALUES ('HEAVY_CRATE_STD', 600, 400, 400, 45.00)
  ON CONFLICT (box_type) DO UPDATE SET default_labour_rate = 45.00;

  INSERT INTO public.item_master (box_type, length_mm, width_mm, height_mm, default_labour_rate)
  VALUES ('CUSTOM_PALLET_NO_RATE', 1200, 1000, 150, NULL)
  ON CONFLICT (box_type) DO UPDATE SET default_labour_rate = NULL;

  INSERT INTO public.labour_master (name, phone, piece_rate)
  VALUES ('Ramesh Carpenter', '9123456780', 45.00)
  RETURNING id INTO v_labour_id;

  INSERT INTO public.labour_master (name, phone, piece_rate)
  VALUES ('Suresh Carpenter', '9123456781', 40.00)
  RETURNING id INTO v_labour_unrated_id;

  -- Setup base order as admin
  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id, 'role', 'authenticated')::text, true);

  v_order_res := public.factory_action('order', jsonb_build_object(
    'party_id', v_party_id,
    'order_date', '2026-10-13',
    'expected_date', '2026-10-20',
    'medium', 'WhatsApp',
    'items', jsonb_build_array(
      jsonb_build_object(
        'sr_no', 1,
        'box_type', 'HEAVY_CRATE_STD',
        'ordered_qty', 100,
        'unit_rate', 750.00,
        'priority_signal', 'Green'
      ),
      jsonb_build_object(
        'sr_no', 2,
        'box_type', 'CUSTOM_PALLET_NO_RATE',
        'ordered_qty', 50,
        'unit_rate', 400.00,
        'priority_signal', 'Orange'
      )
    )
  ));
  v_order_id := (v_order_res->>'id')::uuid;

  SELECT id INTO v_item_id FROM public.order_items WHERE order_id = v_order_id AND box_type = 'HEAVY_CRATE_STD';
  SELECT id INTO v_item_unrated_id FROM public.order_items WHERE order_id = v_order_id AND box_type = 'CUSTOM_PALLET_NO_RATE';

  -- ============================================================================
  -- TEST 1: SUPERVISOR ROLE RESTRICTIONS & PIECE-RATE AUTO-COPY
  -- ============================================================================
  RAISE NOTICE 'Test 1: Testing Supervisor Role (Floor Lead)...';
  PERFORM set_config('request.jwt.claim.sub', v_supervisor_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_supervisor_id, 'role', 'authenticated')::text, true);

  -- 1. Direct SELECT on base money tables returns 0 rows due to RLS
  SELECT count(*) INTO v_count FROM public.order_items;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Supervisor could directly SELECT base order_items (got % rows)!', v_count;
  END IF;

  -- 2. Sanitized views return NULL money columns
  SELECT unit_rate INTO v_unit_rate FROM public.v_order_items WHERE id = v_item_id;
  IF v_unit_rate IS NOT NULL THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Supervisor saw order_items.unit_rate in v_order_items! Value: %', v_unit_rate;
  END IF;

  -- 3. Party contact details masked; company name visible
  SELECT company_name, phone_number INTO v_company, v_phone FROM public.v_party_master WHERE id = v_party_id;
  IF v_company <> 'Industrial Auto Corp' OR v_phone IS NOT NULL THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Supervisor party privacy leak! Name: %, Phone: %', v_company, v_phone;
  END IF;

  -- 4. Forbidden writes raise permission errors
  v_failed := false;
  BEGIN
    PERFORM public.factory_action('order', jsonb_build_object('party_id', v_party_id, 'items', '[]'::jsonb));
  EXCEPTION WHEN SQLSTATE '42501' THEN v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Supervisor was allowed to create orders!';
  END IF;

  v_failed := false;
  BEGIN
    PERFORM public.factory_action('payroll', jsonb_build_object('labour_id', v_labour_id));
  EXCEPTION WHEN SQLSTATE '42501' THEN v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Supervisor was allowed to run payroll!';
  END IF;

  v_failed := false;
  BEGIN
    PERFORM public.factory_action('close_order_short', jsonb_build_object('order_id', v_order_id, 'reason', 'Cancel balance'));
  EXCEPTION WHEN SQLSTATE '42501' THEN v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Supervisor was allowed to close order short!';
  END IF;

  -- 5. Allowed write: assign_labour copies default_labour_rate into allocation
  v_alloc_res := public.factory_action('allocate', jsonb_build_object(
    'order_item_id', v_item_id,
    'labour_id', v_labour_id,
    'allocated_qty', 40,
    'start_time', now()::text,
    'duration_hours', 4
  ));
  v_alloc_id := (v_alloc_res->>'id')::uuid;

  SELECT labour_rate, status INTO v_rate, v_status FROM public.production_allocations WHERE id = v_alloc_id;
  IF v_rate <> 45.00 OR v_status <> 'In Progress' THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Supervisor allocate did not copy default rate (45.00). Got rate: %, status: %', v_rate, v_status;
  END IF;

  -- Log complete as supervisor
  PERFORM public.factory_action('complete', jsonb_build_object('id', v_alloc_id, 'completed_qty', 40));
  RAISE NOTICE 'PASS: Test 1 (Supervisor privacy and allocation piece-rate copy verified)';

  -- ============================================================================
  -- TEST 2: DISPATCH CLERK ROLE
  -- ============================================================================
  RAISE NOTICE 'Test 2: Testing Dispatch Clerk Role (Gate Logistics)...';
  PERFORM set_config('request.jwt.claim.sub', v_dispatch_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_dispatch_id, 'role', 'authenticated')::text, true);

  -- 1. Create challan and confirm dispatch
  v_challan_res := public.factory_action('challan', jsonb_build_object(
    'order_item_id', v_item_id,
    'dispatched_qty', 30,
    'transport_carrier', 'Navata Road Transport',
    'vehicle_number', 'GJ-01-XX-5555',
    'lr_number', 'LR-9988',
    'freight_charges', 1200.00,
    'dispatch_date', now()::text
  ));
  v_challan_id := (v_challan_res->>'id')::uuid;

  PERFORM public.factory_action('dispatch', jsonb_build_object('id', v_challan_id));

  -- 2. Cannot read payroll
  SELECT count(*) INTO v_count FROM public.labour_payroll;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 2 FAILED: Dispatch clerk accessed base labour_payroll!';
  END IF;

  RAISE NOTICE 'PASS: Test 2 (Dispatch clerk challan flow verified; payroll shielded)';

  -- ============================================================================
  -- TEST 3: ACCOUNTANT ROLE
  -- ============================================================================
  RAISE NOTICE 'Test 3: Testing Accountant Role...';
  PERFORM set_config('request.jwt.claim.sub', v_accountant_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_accountant_id, 'role', 'authenticated')::text, true);

  -- 1. Can view money columns
  SELECT unit_rate INTO v_unit_rate FROM public.v_order_items WHERE id = v_item_id;
  IF v_unit_rate <> 750.00 THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Accountant could not read order unit_rate! Value: %', v_unit_rate;
  END IF;

  -- 2. Cannot create orders
  v_failed := false;
  BEGIN
    PERFORM public.factory_action('order', jsonb_build_object('party_id', v_party_id, 'items', '[]'::jsonb));
  EXCEPTION WHEN SQLSTATE '42501' THEN v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Accountant was permitted to create order!';
  END IF;

  -- 3. Can run payroll batch and record disbursement
  v_payroll_res := public.factory_action('payroll', jsonb_build_object('labour_id', v_labour_id));
  v_payroll_id := (v_payroll_res->>'id')::uuid;

  PERFORM public.factory_action('disburse', jsonb_build_object(
    'payroll_id', v_payroll_id,
    'amount', 1800.00,
    'payment_mode', 'Bank Transfer',
    'reference_notes', 'RTGS-12345678'
  ));

  RAISE NOTICE 'PASS: Test 3 (Accountant financial rights and order block verified)';

  -- ============================================================================
  -- TEST 4: MANAGER ROLE
  -- ============================================================================
  RAISE NOTICE 'Test 4: Testing Manager Role...';
  PERFORM set_config('request.jwt.claim.sub', v_manager_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_manager_id, 'role', 'authenticated')::text, true);

  -- 1. Create a draft challan and cancel it as manager
  v_challan_res := public.factory_action('challan', jsonb_build_object(
    'order_item_id', v_item_id,
    'dispatched_qty', 10,
    'transport_carrier', 'Express',
    'vehicle_number', 'GJ-01-M-1111',
    'lr_number', 'LR-DRAFT',
    'freight_charges', 0,
    'dispatch_date', now()::text
  ));
  v_challan_id := (v_challan_res->>'id')::uuid;

  PERFORM public.factory_action('cancel_challan', jsonb_build_object('id', v_challan_id));

  -- 2. Cannot close order short
  v_failed := false;
  BEGIN
    PERFORM public.factory_action('close_order_short', jsonb_build_object('order_id', v_order_id, 'reason', 'Manager truncate'));
  EXCEPTION WHEN SQLSTATE '42501' THEN v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST 4 FAILED: Manager was permitted to close order short!';
  END IF;

  -- 3. Cannot manage users
  v_failed := false;
  BEGIN
    PERFORM public.admin_set_user_role(v_viewer_id, 'supervisor');
  EXCEPTION WHEN SQLSTATE '42501' THEN v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST 4 FAILED: Manager was permitted to modify user roles!';
  END IF;

  RAISE NOTICE 'PASS: Test 4 (Manager permissions verified)';

  -- ============================================================================
  -- TEST 5: VIEWER ROLE (Read-Only)
  -- ============================================================================
  RAISE NOTICE 'Test 5: Testing Viewer Role...';
  PERFORM set_config('request.jwt.claim.sub', v_viewer_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_viewer_id, 'role', 'authenticated')::text, true);

  -- 1. Money columns in views are NULL
  SELECT unit_rate INTO v_unit_rate FROM public.v_order_items WHERE id = v_item_id;
  IF v_unit_rate IS NOT NULL THEN
    RAISE EXCEPTION 'TEST 5 FAILED: Viewer saw unit_rate! Value: %', v_unit_rate;
  END IF;

  -- 2. Direct writes fail
  v_failed := false;
  BEGIN
    PERFORM public.factory_action('borrow', jsonb_build_object('labour_id', v_labour_id, 'amount', 500, 'borrow_date', '2026-10-13'));
  EXCEPTION WHEN SQLSTATE '42501' THEN v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST 5 FAILED: Viewer was permitted to execute factory_action!';
  END IF;

  RAISE NOTICE 'PASS: Test 5 (Viewer read-only protection verified)';

  -- ============================================================================
  -- TEST 6: USER_ROLES INTEGRITY & ANTI-DEMOTION OF LAST ADMIN
  -- ============================================================================
  RAISE NOTICE 'Test 6: Testing user_roles table integrity and last admin protection...';

  -- 1. Non-admin cannot direct INSERT / UPDATE / DELETE on user_roles
  PERFORM set_config('request.jwt.claim.sub', v_supervisor_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_supervisor_id, 'role', 'authenticated')::text, true);

  v_failed := false;
  BEGIN
    UPDATE public.user_roles SET role = 'admin' WHERE user_id = v_supervisor_id;
  EXCEPTION WHEN OTHERS THEN v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST 6 FAILED: Non-admin directly updated user_roles!';
  END IF;

  -- 2. As admin: cannot demote the only remaining admin
  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id, 'role', 'authenticated')::text, true);

  -- Demote all other admins so v_admin_id is the sole admin
  DELETE FROM public.user_roles WHERE role = 'admin' AND user_id <> v_admin_id;

  v_failed := false;
  BEGIN
    UPDATE public.user_roles SET role = 'viewer' WHERE user_id = v_admin_id;
  EXCEPTION WHEN SQLSTATE '23514' THEN v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST 6 FAILED: Demoting the last administrator was permitted!';
  END IF;

  RAISE NOTICE 'PASS: Test 6 (user_roles tamper resistance & last-admin protection verified)';

  -- ============================================================================
  -- TEST 7: AUDIT LOG PRIVACY
  -- ============================================================================
  RAISE NOTICE 'Test 7: Testing audit_logs privacy...';

  -- Supervisor cannot read audit logs
  PERFORM set_config('request.jwt.claim.sub', v_supervisor_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_supervisor_id, 'role', 'authenticated')::text, true);

  SELECT count(*) INTO v_count FROM public.audit_logs;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 7 FAILED: Supervisor accessed audit_logs (got % rows)!', v_count;
  END IF;

  -- Admin can read audit logs
  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id, 'role', 'authenticated')::text, true);

  SELECT count(*) INTO v_count FROM public.audit_logs WHERE record_id = v_order_id;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'TEST 7 FAILED: Admin could not read audit logs!';
  END IF;

  RAISE NOTICE 'PASS: Test 7 (Audit logs restricted strictly to admin)';

  -- ============================================================================
  -- TEST 8: UNRATED ALLOCATION RATE-PENDING WORKFLOW
  -- ============================================================================
  RAISE NOTICE 'Test 8: Testing Rate-Pending Allocation & Payroll Skip...';

  -- Supervisor allocates item with no piece rate
  PERFORM set_config('request.jwt.claim.sub', v_supervisor_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_supervisor_id, 'role', 'authenticated')::text, true);

  v_alloc_res := public.factory_action('allocate', jsonb_build_object(
    'order_item_id', v_item_unrated_id,
    'labour_id', v_labour_unrated_id,
    'allocated_qty', 20,
    'start_time', now()::text,
    'duration_hours', 4
  ));
  v_alloc_id := (v_alloc_res->>'id')::uuid;

  SELECT labour_rate, status INTO v_rate, v_status FROM public.production_allocations WHERE id = v_alloc_id;
  IF v_rate IS NOT NULL OR v_status <> 'Rate Pending' THEN
    RAISE EXCEPTION 'TEST 8 FAILED: Allocation without default rate did not flag Rate Pending! Rate: %, Status: %', v_rate, v_status;
  END IF;

  -- Complete work
  PERFORM public.factory_action('complete', jsonb_build_object('id', v_alloc_id, 'completed_qty', 20));

  -- Accountant attempts payroll -> must skip and report unrated allocation
  PERFORM set_config('request.jwt.claim.sub', v_accountant_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_accountant_id, 'role', 'authenticated')::text, true);

  v_failed := false;
  v_err_msg := '';
  BEGIN
    PERFORM public.factory_action('payroll', jsonb_build_object('labour_id', v_labour_unrated_id));
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_err_msg := SQLERRM;
  END;

  IF NOT v_failed OR v_err_msg NOT ILIKE '%pending piece rates%' THEN
    RAISE EXCEPTION 'TEST 8 FAILED: Payroll did not skip/report unrated allocation! Error message: %', v_err_msg;
  END IF;

  RAISE NOTICE 'PASS: Test 8 (Unrated allocations flagged Rate Pending and skipped by payroll)';

  RAISE NOTICE 'ALL PHASE 1B ROLES & PRIVACY SMOKE TESTS COMPLETED SUCCESSFULLY.';
END $$;

ROLLBACK;

-- ==============================================================================
-- Migration 0012: Ensure Factory Operational Access & Queue Visibility
-- ==============================================================================
-- Ensures all authenticated staff in the shared factory workspace can view:
--   1. order_items (box specifications, dimensions, quantities, priority)
--   2. production_allocations (worker assignments, queue schedules)
--   3. delivery_challans & challan_items (dispatch queue & packing slips)
--   4. party_master & item_master (box types & clients)
--
-- This guarantees Pending Production, Order Entry, and Dispatch always load
-- operational data reliably for authenticated accounts.
-- ==============================================================================

-- 1. Ensure authenticated accounts can read order_items
DROP POLICY IF EXISTS "Money roles base select on order_items" ON public.order_items;
DROP POLICY IF EXISTS "factory_access" ON public.order_items;
DROP POLICY IF EXISTS "Allow authenticated read on order_items" ON public.order_items;

CREATE POLICY "Allow authenticated read on order_items"
  ON public.order_items FOR SELECT TO authenticated
  USING (true);

-- 2. Ensure authenticated accounts can read production_allocations
DROP POLICY IF EXISTS "Money roles base select on production_allocations" ON public.production_allocations;
DROP POLICY IF EXISTS "factory_access" ON public.production_allocations;
DROP POLICY IF EXISTS "Allow authenticated read on production_allocations" ON public.production_allocations;

CREATE POLICY "Allow authenticated read on production_allocations"
  ON public.production_allocations FOR SELECT TO authenticated
  USING (true);

-- 3. Ensure authenticated accounts can read challan_items
DROP POLICY IF EXISTS "Money roles base select on challan_items" ON public.challan_items;
DROP POLICY IF EXISTS "factory_access" ON public.challan_items;
DROP POLICY IF EXISTS "Allow authenticated read on challan_items" ON public.challan_items;

CREATE POLICY "Allow authenticated read on challan_items"
  ON public.challan_items FOR SELECT TO authenticated
  USING (true);

-- 4. Ensure authenticated accounts can read delivery_challans
DROP POLICY IF EXISTS "factory_access" ON public.delivery_challans;
DROP POLICY IF EXISTS "Allow authenticated read on delivery_challans" ON public.delivery_challans;

CREATE POLICY "Allow authenticated read on delivery_challans"
  ON public.delivery_challans FOR SELECT TO authenticated
  USING (true);

-- 5. Ensure authenticated accounts can read orders
DROP POLICY IF EXISTS "factory_access" ON public.orders;
DROP POLICY IF EXISTS "Allow authenticated read on orders" ON public.orders;

CREATE POLICY "Allow authenticated read on orders"
  ON public.orders FOR SELECT TO authenticated
  USING (true);

-- 6. Ensure authenticated accounts can read item_master (Box Types)
DROP POLICY IF EXISTS "factory_access" ON public.item_master;
DROP POLICY IF EXISTS "Allow authenticated read on item_master" ON public.item_master;

CREATE POLICY "Allow authenticated read on item_master"
  ON public.item_master FOR SELECT TO authenticated
  USING (true);

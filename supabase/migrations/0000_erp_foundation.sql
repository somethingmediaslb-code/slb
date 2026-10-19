-- ==============================================================================
-- Migration 0000: ERP Foundation (Supabase-safe, idempotent)
-- Creates all core tables if they don't already exist.
-- This was missing from supabase/migrations/ causing all post-deployment failures.
-- ==============================================================================

-- Core business tables
CREATE TABLE IF NOT EXISTS public.party_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  phone_number text,
  email text,
  gstin text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.party_master TO authenticated;
GRANT ALL ON public.party_master TO service_role;
ALTER TABLE public.party_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS factory_access ON public.party_master;
CREATE POLICY factory_access ON public.party_master FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.item_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_type text NOT NULL,
  size_dimensions text NOT NULL,
  specification text,
  unit_rate numeric NOT NULL DEFAULT 0 CHECK(unit_rate >= 0),
  created_at timestamptz DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.item_master TO authenticated;
GRANT ALL ON public.item_master TO service_role;
ALTER TABLE public.item_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS factory_access ON public.item_master;
CREATE POLICY factory_access ON public.item_master FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no text NOT NULL UNIQUE DEFAULT ('PO-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  party_id uuid REFERENCES public.party_master(id),
  is_self_stock boolean NOT NULL DEFAULT false,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_date date NOT NULL DEFAULT CURRENT_DATE,
  medium text DEFAULT 'Other' CHECK(medium IN('WhatsApp','Call','Mail','Other')),
  remarks text,
  status text NOT NULL DEFAULT 'Pending',
  created_at timestamptz DEFAULT now(),
  CHECK(is_self_stock OR party_id IS NOT NULL),
  CHECK(expected_date >= order_date)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS factory_access ON public.orders;
CREATE POLICY factory_access ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  sr_no int NOT NULL,
  box_type text NOT NULL,
  code_remarks text,
  size_dimensions text NOT NULL,
  specification text,
  ordered_qty int NOT NULL CHECK(ordered_qty > 0),
  allocated_qty int NOT NULL DEFAULT 0,
  completed_qty int NOT NULL DEFAULT 0,
  reserved_qty int NOT NULL DEFAULT 0,
  dispatched_qty int NOT NULL DEFAULT 0,
  unit_rate numeric NOT NULL DEFAULT 0 CHECK(unit_rate >= 0),
  total_price numeric GENERATED ALWAYS AS(ordered_qty * unit_rate) STORED,
  priority_signal text NOT NULL DEFAULT 'Yellow' CHECK(priority_signal IN('Red','Yellow','Green')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(order_id, sr_no),
  CHECK(0 <= dispatched_qty AND dispatched_qty + reserved_qty <= completed_qty AND completed_qty <= allocated_qty AND allocated_qty <= ordered_qty AND reserved_qty >= 0)
);
GRANT SELECT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS factory_access ON public.order_items;
CREATE POLICY factory_access ON public.order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.labour_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  labour_name text NOT NULL,
  phone text,
  daily_rate numeric NOT NULL DEFAULT 0 CHECK(daily_rate >= 0),
  unit_assignment text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.labour_master TO authenticated;
GRANT ALL ON public.labour_master TO service_role;
ALTER TABLE public.labour_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS factory_access ON public.labour_master;
CREATE POLICY factory_access ON public.labour_master FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.production_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES public.order_items(id),
  labour_id uuid NOT NULL REFERENCES public.labour_master(id),
  allocated_qty int NOT NULL CHECK(allocated_qty > 0),
  labour_rate numeric NOT NULL CHECK(labour_rate >= 0),
  start_time timestamptz NOT NULL DEFAULT now(),
  duration_hours int NOT NULL CHECK(duration_hours BETWEEN 1 AND 10),
  tentative_completion timestamptz NOT NULL,
  completed_qty int NOT NULL DEFAULT 0 CHECK(completed_qty >= 0 AND completed_qty <= allocated_qty),
  paid_earnings numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'In Progress',
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.production_allocations TO authenticated;
GRANT ALL ON public.production_allocations TO service_role;
ALTER TABLE public.production_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS factory_access ON public.production_allocations;
CREATE POLICY factory_access ON public.production_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.delivery_challans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_number text NOT NULL UNIQUE DEFAULT('DC-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  dispatch_date timestamptz NOT NULL DEFAULT now(),
  transport_carrier text,
  vehicle_number text,
  lr_number text,
  freight_charges numeric NOT NULL DEFAULT 0 CHECK(freight_charges >= 0),
  status text NOT NULL DEFAULT 'Delivery Challan Made',
  delivery_status text DEFAULT 'Pending',
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.delivery_challans TO authenticated;
GRANT ALL ON public.delivery_challans TO service_role;
ALTER TABLE public.delivery_challans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS factory_access ON public.delivery_challans;
CREATE POLICY factory_access ON public.delivery_challans FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.challan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_id uuid NOT NULL REFERENCES public.delivery_challans(id),
  order_item_id uuid NOT NULL REFERENCES public.order_items(id),
  dispatched_qty int NOT NULL CHECK(dispatched_qty > 0),
  direct_labour_cost numeric NOT NULL DEFAULT 0,
  UNIQUE(challan_id, order_item_id)
);
GRANT SELECT ON public.challan_items TO authenticated;
GRANT ALL ON public.challan_items TO service_role;
ALTER TABLE public.challan_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS factory_access ON public.challan_items;
CREATE POLICY factory_access ON public.challan_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.labour_borrowings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  labour_id uuid NOT NULL REFERENCES public.labour_master(id),
  borrow_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL CHECK(amount > 0),
  deducted_amount numeric NOT NULL DEFAULT 0 CHECK(deducted_amount >= 0 AND deducted_amount <= amount),
  remarks text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.labour_borrowings TO authenticated;
GRANT ALL ON public.labour_borrowings TO service_role;
ALTER TABLE public.labour_borrowings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS factory_access ON public.labour_borrowings;
CREATE POLICY factory_access ON public.labour_borrowings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL,
  reference_dc_id uuid REFERENCES public.delivery_challans(id),
  amount numeric NOT NULL CHECK(amount > 0),
  payment_method text DEFAULT 'Cash',
  notes text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS factory_access ON public.expenses;
CREATE POLICY factory_access ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.labour_payroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  labour_id uuid NOT NULL REFERENCES public.labour_master(id),
  payout_date date DEFAULT CURRENT_DATE,
  gross numeric NOT NULL,
  deductions numeric NOT NULL,
  net_paid numeric NOT NULL,
  status text DEFAULT 'Paid',
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.labour_payroll TO authenticated;
GRANT ALL ON public.labour_payroll TO service_role;
ALTER TABLE public.labour_payroll ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS factory_access ON public.labour_payroll;
CREATE POLICY factory_access ON public.labour_payroll FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_push ON public.push_subscriptions;
CREATE POLICY own_push ON public.push_subscriptions FOR ALL TO authenticated USING(auth.uid() = user_id) WITH CHECK(auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.factory_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  path text NOT NULL DEFAULT '/',
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.factory_notifications TO authenticated;
GRANT ALL ON public.factory_notifications TO service_role;
ALTER TABLE public.factory_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS factory_read ON public.factory_notifications;
CREATE POLICY factory_read ON public.factory_notifications FOR SELECT TO authenticated USING (true);

-- user_roles: IMPORTANT - use UNIQUE(user_id) single-column from the start
-- (the old drizzle version had UNIQUE(user_id,role) composite which broke everything)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK(role IN('admin','manager','supervisor','accountant','dispatch_clerk','viewer','user','pending')),
  allowed_pages text[] DEFAULT ARRAY['dashboard','orders','production','dispatch','parties','catalog','workers','settings','profile'],
  UNIQUE(user_id)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_role ON public.user_roles;
CREATE POLICY own_role ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- push_configuration (from 0001)
CREATE TABLE IF NOT EXISTS public.push_configuration (
  id int PRIMARY KEY DEFAULT 1 CHECK(id = 1),
  public_key text NOT NULL,
  private_key text NOT NULL
);
GRANT ALL ON public.push_configuration TO service_role;
ALTER TABLE public.push_configuration ENABLE ROW LEVEL SECURITY;

-- Realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE
      public.orders,
      public.order_items,
      public.production_allocations,
      public.delivery_challans,
      public.factory_notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN OTHERS THEN NULL;
  END;
END $$;

-- ==============================================================================
-- Migration 0016: Item Master Labour Rate Sync & Under Production Permissions
-- ==============================================================================

-- 1. Ensure default_labour_rate exists on item_master
ALTER TABLE public.item_master
  ADD COLUMN IF NOT EXISTS default_labour_rate numeric CHECK (default_labour_rate IS NULL OR default_labour_rate >= 0);

-- 2. Synchronize existing records: if default_labour_rate is null/0 but unit_rate > 0, copy it
UPDATE public.item_master
SET default_labour_rate = unit_rate
WHERE (default_labour_rate IS NULL OR default_labour_rate = 0) AND unit_rate > 0;

-- 3. If unit_rate is 0 but default_labour_rate is set, sync unit_rate
UPDATE public.item_master
SET unit_rate = default_labour_rate
WHERE unit_rate = 0 AND default_labour_rate IS NOT NULL AND default_labour_rate > 0;

-- 4. Update user_roles allowed_pages to include under_production
UPDATE public.user_roles
SET allowed_pages = array_append(allowed_pages, 'under_production')
WHERE NOT ('under_production' = ANY(allowed_pages))
  AND ('production' = ANY(allowed_pages) OR role IN ('admin', 'manager', 'supervisor', 'user'));

-- 5. Update default allowed_pages for future user_roles
ALTER TABLE public.user_roles
  ALTER COLUMN allowed_pages SET DEFAULT ARRAY[
    'dashboard', 'orders', 'production', 'under_production', 'dispatch',
    'parties', 'catalog', 'workers', 'expenses', 'reports', 'settings', 'profile'
  ];

-- 6. Safely emit realtime ping handling existing table schemas
DO $$
BEGIN
  -- If action column exists and has NOT NULL, drop it to avoid breaking future pings
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'factory_data_pings' AND column_name = 'action'
  ) THEN
    ALTER TABLE public.factory_data_pings ALTER COLUMN action DROP NOT NULL;
    
    INSERT INTO public.factory_data_pings (table_name, action, change_source)
    VALUES ('item_master', 'UPDATE', 'sync_labour_rate');
  ELSE
    INSERT INTO public.factory_data_pings (table_name, change_source)
    VALUES ('item_master', 'sync_labour_rate');
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Non-fatal: realtime ping notification should never block migration execution
  NULL;
END $$;


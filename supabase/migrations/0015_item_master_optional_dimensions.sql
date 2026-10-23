-- ==============================================================================
-- Migration 0015: Make size_dimensions optional in item_master
-- ==============================================================================
-- Product Types in master catalog do not require size dimensions
-- (size dimensions are specified per order item).
-- ==============================================================================

ALTER TABLE public.item_master ALTER COLUMN size_dimensions DROP NOT NULL;
ALTER TABLE public.item_master ALTER COLUMN size_dimensions SET DEFAULT '';

-- ============================================================================
-- Migration: Allow 'inactive' status in products_status_check constraint
-- File: supabase/migrations/20261107_allow_inactive_status.sql
-- Description:
-- Updates the products table status CHECK constraint to permit:
-- 'draft', 'active', 'inactive', 'sold_out', 'archived'
-- This eliminates the workaround where 'draft' was saved for deactivated products.
-- ============================================================================

BEGIN;

-- 1. Drop existing status check constraint if present
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_status_check;

-- 2. Add updated status check constraint allowing 'inactive'
ALTER TABLE public.products
  ADD CONSTRAINT products_status_check
  CHECK (status IN ('draft', 'active', 'inactive', 'sold_out', 'archived'));

COMMIT;

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- OPTIONAL BACKFILL MIGRATION: Backfill legacy 'draft' products to 'inactive'
-- File: supabase/migrations/20261107_backfill_draft_to_inactive.sql
--
-- IMPORTANT NOTICE FOR DATABASE ADMINISTRATOR:
-- DO NOT RUN THIS SCRIPT AUTOMATICALLY.
-- This migration is completely optional. Some products in your database may have been
-- created as actual drafts (e.g. during incomplete product creation flows) rather than
-- deactivated products.
--
-- If you are certain that all existing rows with status = 'draft' were created by
-- the previous toggle deactivation workaround and should be labelled 'inactive',
-- you may execute this script manually in the Supabase Dashboard SQL Editor.
-- ============================================================================

BEGIN;

UPDATE public.products
SET status = 'inactive',
    updated_at = NOW()
WHERE status = 'draft';

COMMIT;

NOTIFY pgrst, 'reload schema';


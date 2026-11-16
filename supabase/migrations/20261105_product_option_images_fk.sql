-- ============================================================================
-- Migration: Foreign Key & Unique Constraints for product_option_images (OPTIONAL)
-- Target: Supabase PostgreSQL
-- Timestamp: 20261105_product_option_images_fk.sql
--
-- Description:
-- Optional hardening migration to add unique (product_option_value_id) and
-- foreign key constraints to public.product_option_images.
-- NOTE: The create_product_with_variants RPC enforces these in application logic
-- and does not rely on these constraints being pre-installed.
-- ============================================================================

BEGIN;

-- 1. Ensure option_value_id / product_option_value_id column alignment
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'product_option_images' AND column_name = 'option_value_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'product_option_images' AND column_name = 'product_option_value_id'
  ) THEN
    ALTER TABLE public.product_option_images RENAME COLUMN option_value_id TO product_option_value_id;
  END IF;
END $$;

-- 2. Add UNIQUE constraint on (product_option_value_id) if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_option_images_value_unique'
  ) THEN
    ALTER TABLE public.product_option_images
      ADD CONSTRAINT product_option_images_value_unique
      UNIQUE (product_option_value_id);
  END IF;
END $$;

-- 3. Add product_id FK constraint to products table if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_option_images_product_fk'
  ) THEN
    ALTER TABLE public.product_option_images
      ADD CONSTRAINT product_option_images_product_fk
      FOREIGN KEY (product_id)
      REFERENCES public.products(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Add FK constraint to product_option_values if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_option_images_value_fk'
  ) THEN
    ALTER TABLE public.product_option_images
      ADD CONSTRAINT product_option_images_value_fk
      FOREIGN KEY (product_option_value_id)
      REFERENCES public.product_option_values (id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 5. Index on (product_id)
CREATE INDEX IF NOT EXISTS idx_product_option_images_product_id 
  ON public.product_option_images(product_id);

COMMIT;


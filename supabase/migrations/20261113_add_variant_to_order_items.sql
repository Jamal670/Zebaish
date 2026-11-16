-- ============================================================================
-- Migration: Add Variant Information & Constraints to order_items
-- Target: Supabase PostgreSQL
-- Timestamp: 20261113_add_variant_to_order_items.sql
-- ============================================================================

BEGIN;

-- 1. Add variant_id UUID NULL to order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id UUID NULL;

-- 2. Add variant_options_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb to order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_options_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

-- (Note: variant_sku_snapshot varchar(100) NULL was already added by the owner)
-- For idempotency, ensure it exists:
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_sku_snapshot VARCHAR(100) NULL;

-- 3. Ensure product_variants has a unique constraint on (id, product_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.product_variants'::regclass 
      AND conname = 'product_variants_id_product_id_key'
  ) THEN
    ALTER TABLE public.product_variants
      ADD CONSTRAINT product_variants_id_product_id_key UNIQUE (id, product_id);
  END IF;
END $$;

-- 4. Add composite foreign key order_items(variant_id, product_id) -> product_variants(id, product_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.order_items'::regclass 
      AND conname = 'fk_order_items_variant'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT fk_order_items_variant
      FOREIGN KEY (variant_id, product_id)
      REFERENCES public.product_variants(id, product_id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- 5. Ensure products has a composite unique constraint on (id, seller_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.products'::regclass 
      AND conname = 'products_id_seller_id_key'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_id_seller_id_key UNIQUE (id, seller_id);
  END IF;
END $$;

-- 6. Add composite foreign key order_items(product_id, seller_id) -> products(id, seller_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.order_items'::regclass 
      AND conname = 'fk_order_items_product_seller'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT fk_order_items_product_seller
      FOREIGN KEY (product_id, seller_id)
      REFERENCES public.products(id, seller_id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- 7. Ensure alias compatibility: if product_variant_option_values table doesn't exist,
-- create view product_variant_option_values pointing to variant_option_values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'product_variant_option_values'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'variant_option_values'
  ) THEN
    CREATE OR REPLACE VIEW public.product_variant_option_values AS
    SELECT * FROM public.variant_option_values;
  END IF;
END $$;

-- 8. Add helpful index on order_items(variant_id) for fast variant order lookups
CREATE INDEX IF NOT EXISTS idx_order_items_variant_id ON public.order_items(variant_id);

-- 9. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;


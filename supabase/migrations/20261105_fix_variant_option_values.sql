-- ============================================================================
-- Migration: Fix Mis-Wired variant_option_values Schema
-- Target: Supabase PostgreSQL
-- Timestamp: 20261105_fix_variant_option_values.sql
--
-- Description:
-- Fixes the schema bug in public.variant_option_values where foreign keys and
-- column names prevented valid variant-option links. Ensures clean (variant_id,
-- product_id, product_option_value_id, option_id) shape matching the catalog design.
-- ============================================================================

BEGIN;

-- 1. Ensure option_id column exists
ALTER TABLE public.variant_option_values
  ADD COLUMN IF NOT EXISTS option_id UUID;

-- 2. If product_option_value_id does not exist but option_value_id exists, align column name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'variant_option_values' AND column_name = 'option_value_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'variant_option_values' AND column_name = 'product_option_value_id'
  ) THEN
    ALTER TABLE public.variant_option_values RENAME COLUMN option_value_id TO product_option_value_id;
  END IF;
END $$;

-- 3. If product_option_value_id was missing entirely, add it
ALTER TABLE public.variant_option_values
  ADD COLUMN IF NOT EXISTS product_option_value_id UUID;

-- 4. Backfill option_id from product_option_values if any existing rows exist
UPDATE public.variant_option_values v
SET option_id = pov.option_id
FROM public.product_option_values pov
WHERE pov.id = v.product_option_value_id
  AND v.option_id IS NULL;

-- 5. Drop outdated / mis-wired constraints if present
ALTER TABLE public.variant_option_values
  DROP CONSTRAINT IF EXISTS variant_option_values_value_product_option_fk,
  DROP CONSTRAINT IF EXISTS variant_option_values_value_fk,
  DROP CONSTRAINT IF EXISTS variant_option_values_pk,
  DROP CONSTRAINT IF EXISTS variant_option_values_pkey,
  DROP CONSTRAINT IF EXISTS variant_option_values_one_per_option;

-- 6. Enforce NOT NULL on option_id and product_option_value_id
ALTER TABLE public.variant_option_values
  ALTER COLUMN option_id SET NOT NULL,
  ALTER COLUMN product_option_value_id SET NOT NULL;

-- 7. Add primary key and corrected foreign keys
ALTER TABLE public.variant_option_values
  ADD CONSTRAINT variant_option_values_pk
    PRIMARY KEY (variant_id, option_id);

ALTER TABLE public.variant_option_values
  ADD CONSTRAINT variant_option_values_value_fk
    FOREIGN KEY (product_option_value_id, product_id, option_id)
    REFERENCES public.product_option_values (id, product_id, option_id)
    ON DELETE RESTRICT;

ALTER TABLE public.variant_option_values
  ADD CONSTRAINT variant_option_values_one_per_option
    UNIQUE (variant_id, option_id);

-- 8. Clean up unused product_variant_id duplicate column if present
-- (Neither check_variant_option_completeness nor any other system logic uses it)
ALTER TABLE public.variant_option_values
  DROP COLUMN IF EXISTS product_variant_id;

-- 9. Re-verify and ensure check_variant_option_completeness reads correct columns
CREATE OR REPLACE FUNCTION public.check_variant_option_completeness()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_variant_id UUID;
  v_product_id UUID;
  v_expected BIGINT;
  v_actual BIGINT;
BEGIN
  IF TG_TABLE_NAME = 'product_variants' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN NULL;
    END IF;
    v_variant_id := NEW.id;
    v_product_id := NEW.product_id;
  ELSE
    IF TG_OP = 'DELETE' THEN
      v_variant_id := OLD.variant_id;
      v_product_id := OLD.product_id;
    ELSE
      v_variant_id := NEW.variant_id;
      v_product_id := NEW.product_id;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.product_variants
    WHERE id = v_variant_id AND product_id = v_product_id
  ) THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_expected
  FROM public.product_options
  WHERE product_id = v_product_id;

  IF v_expected = 0 THEN
    RAISE EXCEPTION 'Variant product % must define at least one option dimension', v_product_id;
  END IF;

  SELECT count(*) INTO v_actual
  FROM public.variant_option_values
  WHERE variant_id = v_variant_id AND product_id = v_product_id;

  IF v_actual <> v_expected THEN
    RAISE EXCEPTION
      'Variant % has % option selections; expected %',
      v_variant_id, v_actual, v_expected;
  END IF;

  RETURN NULL;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';


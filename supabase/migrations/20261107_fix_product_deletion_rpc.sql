-- ============================================================================
-- Migration: Atomic Product Deletion RPC with Deferred Trigger Guards
-- File: supabase/migrations/20261107_fix_product_deletion_rpc.sql
-- Description:
-- 1. Updates completeness trigger check_variant_option_completeness to return early
--    when the parent variant or parent product no longer exists (correctness guard
--    for atomic deletions so deferred constraint checks do not fail when parent is deleted).
-- 2. Defines atomic delete_product(p_product_id UUID) RPC:
--    - Verifies seller ownership using auth.uid() and locks row FOR UPDATE.
--    - Collects orphaned storage paths (starting with {sellerId}/{productId}/).
--    - Deletes records strictly from the 10 designated product tables in safe foreign-key order:
--      1. product_option_images
--      2. inventory_movements
--      3. variant_option_values
--      4. product_variants
--      5. product_option_values
--      6. product_options
--      7. product_attribute_values
--      8. product_custom_attributes
--      9. product_images
--      10. products
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TRIGGER GUARD FOR check_variant_option_completeness
-- ============================================================================

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

  -- Early return guard 1: If the parent product no longer exists (deleted in this transaction), skip check
  IF NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE id = v_product_id
  ) THEN
    RETURN NULL;
  END IF;

  -- Early return guard 2: If the parent variant no longer exists (deleted in this transaction), skip check
  IF NOT EXISTS (
    SELECT 1 FROM public.product_variants
    WHERE id = v_variant_id AND product_id = v_product_id
  ) THEN
    RETURN NULL;
  END IF;

  -- Check option count for existing products
  SELECT count(*) INTO v_expected
  FROM public.product_options
  WHERE product_id = v_product_id;

  -- Early return guard 3: If product options were deleted, skip check
  IF v_expected = 0 THEN
    RETURN NULL;
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


-- ============================================================================
-- 2. ATOMIC PRODUCT DELETION RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_product(
  p_product_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id UUID;
  v_product RECORD;
  v_orphaned_paths JSONB := '[]'::jsonb;
BEGIN
  -- 1. Authenticate caller
  v_seller_id := auth.uid();
  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'VALIDATION: Authentication required. You must be signed in as a seller.';
  END IF;

  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'VALIDATION: Product ID is required.';
  END IF;

  -- 2. Verify ownership and lock product row FOR UPDATE
  SELECT *
  INTO v_product
  FROM public.products
  WHERE id = p_product_id
    AND seller_id = v_seller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VALIDATION: Product not found or you do not have permission to delete it.';
  END IF;

  -- 3. Collect candidate storage paths for client-side bucket cleanup
  -- Rules:
  -- (a) Must start with {sellerId}/{productId}/
  -- (b) Must not be referenced by any other row in product_images or product_option_images outside this product
  WITH candidate_paths AS (
    SELECT storage_path FROM public.product_images
    WHERE product_id = p_product_id AND storage_path IS NOT NULL AND length(trim(storage_path)) > 0
    UNION
    SELECT storage_path FROM public.product_option_images
    WHERE product_id = p_product_id AND storage_path IS NOT NULL AND length(trim(storage_path)) > 0
  )
  SELECT COALESCE(
    jsonb_agg(cp.storage_path),
    '[]'::jsonb
  )
  INTO v_orphaned_paths
  FROM candidate_paths cp
  WHERE cp.storage_path LIKE (v_seller_id::text || '/' || p_product_id::text || '/%')
    AND NOT EXISTS (
      SELECT 1 FROM public.product_images pi
      WHERE pi.product_id <> p_product_id
        AND pi.storage_path = cp.storage_path
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.product_option_images poi
      WHERE poi.product_id <> p_product_id
        AND poi.storage_path = cp.storage_path
    );

  -- 4. Safe sequential deletion strictly across the 10 product tables in foreign-key dependency order
  -- (Each statement completes in the same transaction; missing child rows are tolerated)

  -- 4.1. product_option_images (Has no FK cascade from variants or options; delete explicitly first)
  DELETE FROM public.product_option_images
  WHERE product_id = p_product_id;

  -- 4.2. inventory_movements (FK to products & product_variants with ON DELETE RESTRICT)
  DELETE FROM public.inventory_movements
  WHERE product_id = p_product_id;

  -- 4.3. variant_option_values (FK references product_option_values with ON DELETE RESTRICT)
  DELETE FROM public.variant_option_values
  WHERE product_id = p_product_id;

  -- 4.4. product_variants (FK references products)
  DELETE FROM public.product_variants
  WHERE product_id = p_product_id;

  -- 4.5. product_option_values (FK references product_options)
  DELETE FROM public.product_option_values
  WHERE product_id = p_product_id;

  -- 4.6. product_options (FK references products)
  DELETE FROM public.product_options
  WHERE product_id = p_product_id;

  -- 4.7. product_attribute_values (FK references products)
  DELETE FROM public.product_attribute_values
  WHERE product_id = p_product_id;

  -- 4.8. product_custom_attributes (FK references products)
  DELETE FROM public.product_custom_attributes
  WHERE product_id = p_product_id;

  -- 4.9. product_images (FK references products)
  DELETE FROM public.product_images
  WHERE product_id = p_product_id;

  -- 4.10. Finally delete the parent products row
  DELETE FROM public.products
  WHERE id = p_product_id
    AND seller_id = v_seller_id;

  RETURN jsonb_build_object(
    'outcome', 'deleted',
    'orphanedPaths', v_orphaned_paths
  );
END;
$$;

-- Revoke execute from public/anon and grant to authenticated sellers
REVOKE ALL ON FUNCTION public.delete_product(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_product(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_product(UUID) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

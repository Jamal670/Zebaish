-- ============================================================================
-- ZEBAISH: CONSOLIDATED PRODUCT CREATION MIGRATION & RPC SETUP
-- Target: Supabase PostgreSQL (Project: bimpkdflxntdkoptuafw)
-- Timestamp: 20261105_all_in_one_product_creation.sql
--
-- Description:
-- Run this script once in your Supabase Dashboard SQL Editor to:
-- 1. Fix the variant_option_values schema blocker (adds option_id, fixes FKs).
-- 2. Create the string normalization helper (normalize_option_name).
-- 3. Update the category attribute validation trigger.
-- 4. Create the atomic product creation RPC (public.create_product_with_variants).
-- 5. Establish RLS policies for sellers and public access.
-- 6. Configure storage bucket 'productImages' and policies.
-- 7. Notify PostgREST to immediately refresh its schema cache.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. FIX MIS-WIRED variant_option_values SCHEMA
-- ============================================================================

-- 1.1 Ensure option_id column exists
ALTER TABLE public.variant_option_values
  ADD COLUMN IF NOT EXISTS option_id UUID;

-- 1.2 Align column name if option_value_id was used
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

ALTER TABLE public.variant_option_values
  ADD COLUMN IF NOT EXISTS product_option_value_id UUID;

-- 1.3 Backfill option_id from product_option_values if existing rows exist
UPDATE public.variant_option_values v
SET option_id = pov.option_id
FROM public.product_option_values pov
WHERE pov.id = v.product_option_value_id
  AND v.option_id IS NULL;

-- 1.4 Drop mis-wired constraints
ALTER TABLE public.variant_option_values
  DROP CONSTRAINT IF EXISTS variant_option_values_value_product_option_fk,
  DROP CONSTRAINT IF EXISTS variant_option_values_value_fk,
  DROP CONSTRAINT IF EXISTS variant_option_values_pk,
  DROP CONSTRAINT IF EXISTS variant_option_values_pkey,
  DROP CONSTRAINT IF EXISTS variant_option_values_one_per_option;

-- 1.5 Enforce NOT NULL
ALTER TABLE public.variant_option_values
  ALTER COLUMN option_id SET NOT NULL,
  ALTER COLUMN product_option_value_id SET NOT NULL;

-- 1.6 Add primary key and valid composite foreign key
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

-- 1.7 Drop redundant product_variant_id column
ALTER TABLE public.variant_option_values
  DROP COLUMN IF EXISTS product_variant_id;

-- 1.8 Update completeness trigger function
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

-- ============================================================================
-- 2. NORMALIZATION HELPER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.normalize_option_name(p_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_normalized TEXT;
BEGIN
  IF p_input IS NULL THEN
    RETURN NULL;
  END IF;

  v_normalized := lower(trim(p_input));
  v_normalized := regexp_replace(v_normalized, '[^a-z0-9]+', '_', 'g');
  v_normalized := regexp_replace(v_normalized, '^_+|_+$', '', 'g');

  RETURN v_normalized;
END;
$$;

-- ============================================================================
-- 3. UPDATE ATTRIBUTE VALIDATION TO ALLOW CUSTOM SELLER OPTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_product_attribute_value()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_type TEXT;
  v_options JSONB;
  v_item JSONB;
BEGIN
  SELECT data_type, options
    INTO v_type, v_options
  FROM public.category_attribute_definitions
  WHERE id = NEW.attribute_id
    AND category_id = NEW.category_id
    AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attribute definition % is missing, inactive, or belongs to another category', NEW.attribute_id;
  END IF;

  IF v_type = 'text' THEN
    IF NEW.value_text IS NULL OR length(trim(NEW.value_text)) = 0 THEN
      RAISE EXCEPTION 'Text attribute requires a non-empty value_text';
    END IF;
  ELSIF v_type = 'number' THEN
    IF NEW.value_number IS NULL THEN
      RAISE EXCEPTION 'Number attribute requires value_number';
    END IF;
  ELSIF v_type = 'boolean' THEN
    IF NEW.value_boolean IS NULL THEN
      RAISE EXCEPTION 'Boolean attribute requires value_boolean';
    END IF;
  ELSIF v_type = 'select' THEN
    IF NEW.value_text IS NULL OR length(trim(NEW.value_text)) = 0 THEN
      RAISE EXCEPTION 'Select attribute requires a non-empty value_text';
    END IF;
  ELSIF v_type = 'multi_select' THEN
    IF NEW.value_jsonb IS NULL OR jsonb_typeof(NEW.value_jsonb) <> 'array' OR jsonb_array_length(NEW.value_jsonb) = 0 THEN
      RAISE EXCEPTION 'Multi-select attribute requires a non-empty JSON array';
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(NEW.value_jsonb)
    LOOP
      IF jsonb_typeof(v_item) <> 'string' OR length(trim(v_item #>> '{}')) = 0 THEN
        RAISE EXCEPTION 'Multi-select values must be non-empty strings';
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 4. ATOMIC PRODUCT CREATION RPC: create_product_with_variants
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_product_with_variants(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  -- Seller context
  v_seller_id UUID;
  
  -- Product core
  v_product_id UUID;
  v_category_id UUID;
  v_title TEXT;
  v_description TEXT;
  v_defect TEXT;
  v_inventory_mode TEXT;
  
  -- Simple product pricing & stock
  v_simple_price NUMERIC(12,2);
  v_simple_compare NUMERIC(12,2);
  v_simple_qty INTEGER;
  
  -- Calculated variant aggregates
  v_min_price NUMERIC(12,2);
  v_max_price NUMERIC(12,2);
  v_total_qty INTEGER := 0;
  
  -- Iterators & loop structures
  v_img_elem JSONB;
  v_img_idx INTEGER := 0;
  v_storage_path TEXT;
  v_image_url TEXT;
  
  v_spec_elem JSONB;
  v_spec_idx INTEGER := 0;
  v_spec_name TEXT;
  v_spec_norm TEXT;
  v_spec_val TEXT;
  
  v_attr_elem JSONB;
  v_attr_id UUID;
  v_attr_type TEXT;
  v_attr_name TEXT;
  v_attr_is_req BOOLEAN;
  v_val_text TEXT;
  v_val_num NUMERIC(18,4);
  v_val_bool BOOLEAN;
  v_val_jsonb JSONB;
  v_req_attr RECORD;
  
  -- Options & variants structures
  v_options JSONB;
  v_variants JSONB;
  v_opt_elem JSONB;
  v_opt_idx INTEGER := 0;
  v_opt_name TEXT;
  v_opt_norm TEXT;
  v_opt_id UUID;
  v_val_elem JSONB;
  v_val_idx INTEGER := 0;
  v_val_text_opt TEXT;
  v_val_norm TEXT;
  v_val_id UUID;
  v_val_img_path TEXT;
  v_val_img_url TEXT;
  
  v_var_elem JSONB;
  v_var_idx INTEGER := 0;
  v_var_id UUID;
  v_var_price NUMERIC(12,2);
  v_var_qty INTEGER;
  v_var_sku TEXT;
  v_sku_prefix TEXT;
  v_var_values JSONB;
  v_val_str TEXT;
  v_combo_parts TEXT[];
  v_combo_key TEXT;
  v_total_options_count INTEGER := 0;
  v_expected_combos INTEGER := 1;
  
  -- In-memory ID lookup tables
  v_opt_ids JSONB := '{}'::jsonb;
  v_val_ids JSONB := '{}'::jsonb;
  v_seen_combos JSONB := '{}'::jsonb;
  v_seen_paths JSONB := '{}'::jsonb;
  
  -- Return counts
  v_image_count INTEGER := 0;
  v_spec_count INTEGER := 0;
  v_attr_count INTEGER := 0;
  v_option_count INTEGER := 0;
  v_variant_count INTEGER := 0;

BEGIN
  -- ==========================================================================
  -- A. AUTHENTICATION & SELLER VERIFICATION
  -- ==========================================================================
  v_seller_id := auth.uid();
  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'VALIDATION: Authentication required. You must be logged in as a seller.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.sellers WHERE id = v_seller_id) THEN
    RAISE EXCEPTION 'VALIDATION: Seller profile not found for user %.', v_seller_id;
  END IF;

  -- ==========================================================================
  -- B. BASIC PAYLOAD VALIDATION
  -- ==========================================================================
  IF p_payload IS NULL THEN
    RAISE EXCEPTION 'VALIDATION: Missing product payload.';
  END IF;

  -- Product ID validation
  BEGIN
    v_product_id := (p_payload->>'productId')::UUID;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'VALIDATION: Invalid product UUID: %', p_payload->>'productId';
  END;

  IF EXISTS (SELECT 1 FROM public.products WHERE id = v_product_id) THEN
    RAISE EXCEPTION 'VALIDATION: Product with ID % already exists.', v_product_id;
  END IF;

  -- Category validation (must exist, be active, and be a child category)
  BEGIN
    v_category_id := (p_payload->>'categoryId')::UUID;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'VALIDATION: Invalid category UUID: %', p_payload->>'categoryId';
  END;

  IF NOT EXISTS (
    SELECT 1 FROM public.categories
    WHERE id = v_category_id AND is_active = TRUE AND parent_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'VALIDATION: Category % does not exist, is inactive, or is a top-level department.', v_category_id;
  END IF;

  -- Title validation (trimmed length 3 to 255)
  v_title := trim(COALESCE(p_payload->>'title', ''));
  IF length(v_title) < 3 OR length(v_title) > 255 THEN
    RAISE EXCEPTION 'VALIDATION: Product title must be between 3 and 255 characters long.';
  END IF;

  -- Description and Defect
  v_description := NULLIF(trim(COALESCE(p_payload->>'description', '')), '');
  v_defect := NULLIF(trim(COALESCE(p_payload->>'defect', '')), '');

  -- Options & variants arrays
  v_options := COALESCE(p_payload->'options', '[]'::jsonb);
  v_variants := COALESCE(p_payload->'variants', '[]'::jsonb);

  -- Derive inventory mode
  IF jsonb_array_length(v_options) > 0 THEN
    v_inventory_mode := 'variants';
  ELSE
    v_inventory_mode := 'simple';
  END IF;

  -- Mode consistency checks (exactly one mode used)
  IF v_inventory_mode = 'simple' THEN
    IF p_payload->'simple' IS NULL OR p_payload->'simple' = 'null'::jsonb THEN
      RAISE EXCEPTION 'VALIDATION: Simple product pricing and quantity details are required.';
    END IF;
    IF jsonb_array_length(v_variants) > 0 THEN
      RAISE EXCEPTION 'VALIDATION: Simple product cannot contain variation rows.';
    END IF;

    v_simple_price := (p_payload->'simple'->>'sellingPrice')::NUMERIC(12,2);
    v_simple_compare := (p_payload->'simple'->>'compareAtPrice')::NUMERIC(12,2);
    v_simple_qty := (p_payload->'simple'->>'quantity')::INTEGER;

    IF v_simple_price IS NULL OR v_simple_price <= 0 THEN
      RAISE EXCEPTION 'VALIDATION: Selling price must be greater than 0.';
    END IF;

    IF v_simple_compare IS NOT NULL AND v_simple_compare < v_simple_price THEN
      RAISE EXCEPTION 'VALIDATION: Compare price (%) cannot be less than selling price (%).', v_simple_compare, v_simple_price;
    END IF;

    IF v_simple_qty IS NULL OR v_simple_qty < 0 THEN
      RAISE EXCEPTION 'VALIDATION: Quantity must be an integer greater than or equal to 0.';
    END IF;

    IF v_simple_qty = 0 THEN
      RAISE EXCEPTION 'VALIDATION: Total stock must be greater than 0 to list product.';
    END IF;

    v_total_qty := v_simple_qty;
  ELSE
    -- Variants mode
    IF p_payload->'simple' IS NOT NULL AND p_payload->'simple' <> 'null'::jsonb THEN
      RAISE EXCEPTION 'VALIDATION: Variant product must not include simple pricing details.';
    END IF;

    v_total_options_count := jsonb_array_length(v_options);
    IF v_total_options_count < 1 OR v_total_options_count > 5 THEN
      RAISE EXCEPTION 'VALIDATION: Products with variations must define between 1 and 5 option dimensions.';
    END IF;

    IF jsonb_array_length(v_variants) < 1 THEN
      RAISE EXCEPTION 'VALIDATION: At least one variation combination row is required.';
    END IF;

    IF jsonb_array_length(v_variants) > 100 THEN
      RAISE EXCEPTION 'VALIDATION: A maximum of 100 variation combinations is allowed.';
    END IF;
  END IF;

  -- ==========================================================================
  -- C. GALLERY IMAGES VALIDATION
  -- ==========================================================================
  IF p_payload->'images' IS NULL OR jsonb_array_length(p_payload->'images') = 0 THEN
    RAISE EXCEPTION 'VALIDATION: At least 1 collection image is required.';
  END IF;

  IF jsonb_array_length(p_payload->'images') > 10 THEN
    RAISE EXCEPTION 'VALIDATION: Maximum 10 images allowed per product.';
  END IF;

  -- Validate image storage paths & security isolation
  FOR v_img_elem IN SELECT * FROM jsonb_array_elements(p_payload->'images')
  LOOP
    v_storage_path := trim(COALESCE(v_img_elem->>'storagePath', ''));
    v_image_url := trim(COALESCE(v_img_elem->>'imageUrl', ''));

    IF length(v_storage_path) = 0 THEN
      RAISE EXCEPTION 'VALIDATION: Image storagePath cannot be empty.';
    END IF;

    -- Security isolation: path must begin with {auth.uid()}/{productId}/
    IF NOT (v_storage_path LIKE (v_seller_id::text || '/' || v_product_id::text || '/%')) THEN
      RAISE EXCEPTION 'VALIDATION: Security violation: Image storage path must start with %/%/', v_seller_id, v_product_id;
    END IF;

    -- Image URL isolation: must end with productImages/<storage_path>
    IF NOT (v_image_url LIKE ('%productImages/' || v_storage_path)) THEN
      RAISE EXCEPTION 'VALIDATION: Invalid image URL for storage path %.', v_storage_path;
    END IF;
  END LOOP;

  -- ==========================================================================
  -- D. INSERT CORE PRODUCT (status = 'draft' to satisfy BEFORE INSERT triggers)
  -- ==========================================================================
  INSERT INTO public.products (
    id,
    seller_id,
    category_id,
    title,
    brand,
    description,
    condition,
    condition_details,
    inventory_mode,
    selling_price,
    compare_at_price,
    quantity,
    status,
    cached_min_variant_price,
    cached_max_variant_price,
    cached_total_variant_quantity
  ) VALUES (
    v_product_id,
    v_seller_id,
    v_category_id,
    v_title,
    NULL,
    v_description,
    'new',
    v_defect,
    v_inventory_mode,
    CASE WHEN v_inventory_mode = 'simple' THEN v_simple_price ELSE NULL END,
    CASE WHEN v_inventory_mode = 'simple' THEN v_simple_compare ELSE NULL END,
    CASE WHEN v_inventory_mode = 'simple' THEN v_simple_qty ELSE NULL END,
    'draft', -- Initially draft; updated to 'active' at completion
    NULL,
    NULL,
    NULL
  );

  -- ==========================================================================
  -- E. INSERT PRODUCT IMAGES
  -- De-dupe gallery by path before inserting, then assign display_order from 0
  -- and is_thumbnail to the first (display_order = 0).
  -- ==========================================================================
  v_seen_paths := '{}'::jsonb;
  v_img_idx := 0;
  FOR v_img_elem IN SELECT * FROM jsonb_array_elements(p_payload->'images')
  LOOP
    v_storage_path := trim(COALESCE(v_img_elem->>'storagePath', ''));
    v_image_url := trim(COALESCE(v_img_elem->>'imageUrl', ''));

    -- De-dupe gallery by path: skip if already inserted
    IF v_seen_paths ? v_storage_path THEN
      CONTINUE;
    END IF;
    v_seen_paths := jsonb_set(v_seen_paths, ARRAY[v_storage_path], 'true'::jsonb);

    INSERT INTO public.product_images (
      product_id,
      storage_path,
      image_url,
      alt_text,
      is_thumbnail,
      display_order
    ) VALUES (
      v_product_id,
      v_storage_path,
      v_image_url,
      'image not showing',
      (v_img_idx = 0),
      v_img_idx
    );

    v_img_idx := v_img_idx + 1;
  END LOOP;
  v_image_count := v_img_idx;

  -- ==========================================================================
  -- F. INSERT CUSTOM SPECIFICATIONS (product_custom_attributes)
  -- ==========================================================================
  IF p_payload->'customSpecs' IS NOT NULL AND jsonb_array_length(p_payload->'customSpecs') > 0 THEN
    FOR v_spec_elem IN SELECT * FROM jsonb_array_elements(p_payload->'customSpecs')
    LOOP
      v_spec_name := trim(COALESCE(v_spec_elem->>'name', ''));
      v_spec_val := trim(COALESCE(v_spec_elem->>'value', ''));

      IF length(v_spec_name) = 0 OR length(v_spec_val) = 0 THEN
        RAISE EXCEPTION 'VALIDATION: Custom specification name and value cannot be empty.';
      END IF;

      v_spec_norm := public.normalize_option_name(v_spec_name);
      IF v_spec_norm IS NULL OR length(v_spec_norm) = 0 THEN
        RAISE EXCEPTION 'VALIDATION: Specification name "%" normalizes to empty.', v_spec_name;
      END IF;

      -- Upsert without relying on non-existent unique constraint in live DB
      IF EXISTS (
        SELECT 1 FROM public.product_custom_attributes
        WHERE product_id = v_product_id AND normalized_name = v_spec_norm
      ) THEN
        UPDATE public.product_custom_attributes
        SET value = v_spec_val, display_order = v_spec_idx
        WHERE product_id = v_product_id AND normalized_name = v_spec_norm;
      ELSE
        INSERT INTO public.product_custom_attributes (
          product_id,
          name,
          normalized_name,
          value,
          display_order
        ) VALUES (
          v_product_id,
          v_spec_name,
          v_spec_norm,
          v_spec_val,
          v_spec_idx
        );
      END IF;

      v_spec_idx := v_spec_idx + 1;
    END LOOP;
    v_spec_count := v_spec_idx;
  END IF;

  -- ==========================================================================
  -- G. INSERT CATEGORY ATTRIBUTE VALUES (product_attribute_values)
  -- ==========================================================================
  FOR v_req_attr IN 
    SELECT id, name FROM public.category_attribute_definitions
    WHERE category_id = v_category_id AND is_active = TRUE AND is_required = TRUE
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(p_payload->'attributeValues', '[]'::jsonb)) elem
      WHERE (elem->>'attributeId')::UUID = v_req_attr.id
        AND elem->'value' IS NOT NULL
        AND (
          (jsonb_typeof(elem->'value') = 'string' AND length(trim(elem->>'value')) > 0)
          OR (jsonb_typeof(elem->'value') = 'number')
          OR (jsonb_typeof(elem->'value') = 'boolean')
          OR (jsonb_typeof(elem->'value') = 'array' AND jsonb_array_length(elem->'value') > 0)
        )
    ) THEN
      RAISE EXCEPTION 'VALIDATION: Required category attribute "%" is missing.', v_req_attr.name;
    END IF;
  END LOOP;

  IF p_payload->'attributeValues' IS NOT NULL AND jsonb_array_length(p_payload->'attributeValues') > 0 THEN
    FOR v_attr_elem IN SELECT * FROM jsonb_array_elements(p_payload->'attributeValues')
    LOOP
      BEGIN
        v_attr_id := (v_attr_elem->>'attributeId')::UUID;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'VALIDATION: Invalid attribute definition UUID: %', v_attr_elem->>'attributeId';
      END;

      SELECT data_type, name, is_required
        INTO v_attr_type, v_attr_name, v_attr_is_req
      FROM public.category_attribute_definitions
      WHERE id = v_attr_id AND category_id = v_category_id AND is_active = TRUE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'VALIDATION: Attribute % does not exist or is inactive for this category.', v_attr_id;
      END IF;

      v_val_text := NULL;
      v_val_num := NULL;
      v_val_bool := NULL;
      v_val_jsonb := NULL;

      IF v_attr_type = 'text' OR v_attr_type = 'select' THEN
        v_val_text := trim(COALESCE(v_attr_elem->>'value', ''));
        IF length(v_val_text) = 0 THEN
          IF v_attr_is_req THEN
            RAISE EXCEPTION 'VALIDATION: % is required.', v_attr_name;
          END IF;
          CONTINUE;
        END IF;
      ELSIF v_attr_type = 'number' THEN
        IF v_attr_elem->>'value' IS NULL OR trim(v_attr_elem->>'value') = '' THEN
          IF v_attr_is_req THEN
            RAISE EXCEPTION 'VALIDATION: % is required.', v_attr_name;
          END IF;
          CONTINUE;
        END IF;
        BEGIN
          v_val_num := (v_attr_elem->>'value')::NUMERIC(18,4);
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'VALIDATION: Value for % must be a valid number.', v_attr_name;
        END;
      ELSIF v_attr_type = 'boolean' THEN
        IF v_attr_elem->'value' IS NULL OR v_attr_elem->>'value' = '' THEN
          IF v_attr_is_req THEN
            RAISE EXCEPTION 'VALIDATION: % is required.', v_attr_name;
          END IF;
          CONTINUE;
        END IF;
        v_val_bool := (v_attr_elem->>'value')::BOOLEAN;
      ELSIF v_attr_type = 'multi_select' THEN
        IF v_attr_elem->'value' IS NULL OR jsonb_typeof(v_attr_elem->'value') <> 'array' OR jsonb_array_length(v_attr_elem->'value') = 0 THEN
          IF v_attr_is_req THEN
            RAISE EXCEPTION 'VALIDATION: % is required.', v_attr_name;
          END IF;
          CONTINUE;
        END IF;
        v_val_jsonb := v_attr_elem->'value';
      ELSE
        v_val_text := trim(COALESCE(v_attr_elem->>'value', ''));
        IF length(v_val_text) = 0 THEN
          CONTINUE;
        END IF;
      END IF;

      -- Upsert without relying on non-existent unique constraint in live DB
      IF EXISTS (
        SELECT 1 FROM public.product_attribute_values
        WHERE product_id = v_product_id AND attribute_id = v_attr_id
      ) THEN
        UPDATE public.product_attribute_values
        SET
          category_id = v_category_id,
          value_text = v_val_text,
          value_number = v_val_num,
          value_boolean = v_val_bool,
          value_jsonb = v_val_jsonb,
          updated_at = now()
        WHERE product_id = v_product_id AND attribute_id = v_attr_id;
      ELSE
        INSERT INTO public.product_attribute_values (
          product_id,
          category_id,
          attribute_id,
          value_text,
          value_number,
          value_boolean,
          value_jsonb
        ) VALUES (
          v_product_id,
          v_category_id,
          v_attr_id,
          v_val_text,
          v_val_num,
          v_val_bool,
          v_val_jsonb
        );
      END IF;

      v_attr_count := v_attr_count + 1;
    END LOOP;
  END IF;

  -- ==========================================================================
  -- H. INSERT VARIATION DIMENSIONS & VALUES (IF VARIANTS MODE)
  -- ==========================================================================
  IF v_inventory_mode = 'variants' THEN
    -- 1. Insert product_options and product_option_values
    FOR v_opt_elem IN SELECT * FROM jsonb_array_elements(v_options)
    LOOP
      v_opt_name := trim(COALESCE(v_opt_elem->>'name', ''));
      IF length(v_opt_name) = 0 OR length(v_opt_name) > 100 THEN
        RAISE EXCEPTION 'VALIDATION: Dimension name must be between 1 and 100 characters.';
      END IF;

      v_opt_norm := public.normalize_option_name(v_opt_name);
      IF v_opt_norm IS NULL OR length(v_opt_norm) = 0 THEN
        RAISE EXCEPTION 'VALIDATION: Dimension name "%" normalizes to empty.', v_opt_name;
      END IF;

      IF v_opt_ids ? v_opt_norm THEN
        RAISE EXCEPTION 'VALIDATION: Duplicate dimension name "%" specified.', v_opt_name;
      END IF;

      INSERT INTO public.product_options (
        product_id,
        name,
        display_order
      ) VALUES (
        v_product_id,
        v_opt_name,
        v_opt_idx
      ) RETURNING id INTO v_opt_id;

      v_opt_ids := jsonb_set(v_opt_ids, ARRAY[v_opt_norm], to_jsonb(v_opt_id::text));

      -- Process values of this dimension
      IF v_opt_elem->'values' IS NULL OR jsonb_array_length(v_opt_elem->'values') = 0 THEN
        RAISE EXCEPTION 'VALIDATION: Dimension "%" must have at least one value.', v_opt_name;
      END IF;

      IF jsonb_array_length(v_opt_elem->'values') > 20 THEN
        RAISE EXCEPTION 'VALIDATION: Dimension "%" exceeds maximum limit of 20 values.', v_opt_name;
      END IF;

      v_expected_combos := v_expected_combos * jsonb_array_length(v_opt_elem->'values');

      v_val_idx := 0;
      FOR v_val_elem IN SELECT * FROM jsonb_array_elements(v_opt_elem->'values')
      LOOP
        v_val_text_opt := trim(COALESCE(v_val_elem->>'value', ''));
        IF length(v_val_text_opt) = 0 OR length(v_val_text_opt) > 120 THEN
          RAISE EXCEPTION 'VALIDATION: Option value must be between 1 and 120 characters.';
        END IF;

        v_val_norm := public.normalize_option_name(v_val_text_opt);
        IF v_val_norm IS NULL OR length(v_val_norm) = 0 THEN
          RAISE EXCEPTION 'VALIDATION: Value "%" normalizes to empty.', v_val_text_opt;
        END IF;

        IF v_val_ids ? (v_opt_norm || '::' || v_val_norm) THEN
          RAISE EXCEPTION 'VALIDATION: Duplicate value "%" in dimension "%".', v_val_text_opt, v_opt_name;
        END IF;

        INSERT INTO public.product_option_values (
          product_id,
          option_id,
          value,
          normalized_value,
          display_order
        ) VALUES (
          v_product_id,
          v_opt_id,
          v_val_text_opt,
          v_val_norm,
          v_val_idx
        ) RETURNING id INTO v_val_id;

        v_val_ids := jsonb_set(v_val_ids, ARRAY[v_opt_norm || '::' || v_val_norm], to_jsonb(v_val_id::text));

        -- If option image is attached to this value
        IF v_val_elem->'image' IS NOT NULL AND v_val_elem->'image' <> 'null'::jsonb THEN
          -- Enforce max one image per value (reject values carrying more than one)
          IF jsonb_typeof(v_val_elem->'image') = 'array' THEN
            IF jsonb_array_length(v_val_elem->'image') > 1 THEN
              RAISE EXCEPTION 'VALIDATION: Value "%" in dimension "%" carries more than one image. At most one image per value is allowed.', v_val_text_opt, v_opt_name;
            ELSIF jsonb_array_length(v_val_elem->'image') = 1 THEN
              v_val_img_path := trim(COALESCE(v_val_elem->'image'->0->>'storagePath', ''));
              v_val_img_url := trim(COALESCE(v_val_elem->'image'->0->>'imageUrl', ''));
            ELSE
              v_val_img_path := '';
              v_val_img_url := '';
            END IF;
          ELSIF jsonb_typeof(v_val_elem->'image') = 'object' THEN
            v_val_img_path := trim(COALESCE(v_val_elem->'image'->>'storagePath', ''));
            v_val_img_url := trim(COALESCE(v_val_elem->'image'->>'imageUrl', ''));
          ELSE
            RAISE EXCEPTION 'VALIDATION: Invalid image specification for value "%" in dimension "%".', v_val_text_opt, v_opt_name;
          END IF;

          IF length(v_val_img_path) > 0 THEN
            -- Security validation for option image storage path and URL
            -- Must start with {auth.uid()}/{productId}/ and end with productImages/<storage_path>
            IF NOT (v_val_img_path LIKE (v_seller_id::text || '/' || v_product_id::text || '/%')) THEN
              RAISE EXCEPTION 'VALIDATION: Security violation: Option image path must start with %/%/', v_seller_id, v_product_id;
            END IF;

            IF NOT (v_val_img_url LIKE ('%productImages/' || v_val_img_path)) THEN
              RAISE EXCEPTION 'VALIDATION: Invalid option image URL for storage path %.', v_val_img_path;
            END IF;

            -- Both product_id and product_option_value_id must be supplied on every insert.
            -- No ON CONFLICT: table has no unique constraint in live DB.
            INSERT INTO public.product_option_images (
              product_id,
              product_option_value_id,
              storage_path,
              image_url
            ) VALUES (
              v_product_id,
              v_val_id,
              v_val_img_path,
              v_val_img_url
            );
          END IF;
        END IF;

        v_val_idx := v_val_idx + 1;
      END LOOP;

      v_opt_idx := v_opt_idx + 1;
    END LOOP;
    v_option_count := v_opt_idx;

    -- Verify Cartesian product count matches
    IF jsonb_array_length(v_variants) <> v_expected_combos THEN
      RAISE EXCEPTION 'VALIDATION: Incomplete combination set. Expected % combinations, received %.',
        v_expected_combos, jsonb_array_length(v_variants);
    END IF;

    -- 2. Insert product_variants & variant_option_values
    v_sku_prefix := UPPER(SUBSTRING(REPLACE(v_product_id::text, '-', ''), 1, 8));

    FOR v_var_elem IN SELECT * FROM jsonb_array_elements(v_variants)
    LOOP
      v_var_price := (v_var_elem->>'sellingPrice')::NUMERIC(12,2);
      v_var_qty := (v_var_elem->>'quantity')::INTEGER;

      IF v_var_price IS NULL OR v_var_price <= 0 THEN
        RAISE EXCEPTION 'VALIDATION: Variant price must be greater than 0.';
      END IF;

      IF v_var_qty IS NULL OR v_var_qty < 0 THEN
        RAISE EXCEPTION 'VALIDATION: Variant quantity must be an integer >= 0.';
      END IF;

      v_var_values := v_var_elem->'values';
      IF v_var_values IS NULL OR jsonb_array_length(v_var_values) <> v_total_options_count THEN
        RAISE EXCEPTION 'VALIDATION: Variant row must specify exactly % values matching options.', v_total_options_count;
      END IF;

      -- Build combination key in strict option order
      v_combo_parts := ARRAY[]::TEXT[];
      FOR v_opt_idx IN 0..(v_total_options_count - 1)
      LOOP
        v_opt_name := trim(v_options->v_opt_idx->>'name');
        v_opt_norm := public.normalize_option_name(v_opt_name);
        v_val_str := trim(v_var_values->>v_opt_idx);
        v_val_norm := public.normalize_option_name(v_val_str);

        IF NOT (v_val_ids ? (v_opt_norm || '::' || v_val_norm)) THEN
          RAISE EXCEPTION 'VALIDATION: Unknown option value "%" for dimension "%".', v_val_str, v_opt_name;
        END IF;

        v_combo_parts := array_append(v_combo_parts, v_opt_norm || ':' || v_val_norm);
      END LOOP;

      v_combo_key := array_to_string(v_combo_parts, '|');

      IF v_seen_combos ? v_combo_key THEN
        RAISE EXCEPTION 'VALIDATION: Duplicate combination row: %', v_combo_key;
      END IF;
      v_seen_combos := jsonb_set(v_seen_combos, ARRAY[v_combo_key], 'true'::jsonb);

      v_var_idx := v_var_idx + 1;
      v_var_sku := v_sku_prefix || '-' || LPAD(v_var_idx::text, 3, '0');

      -- Insert variant
      INSERT INTO public.product_variants (
        product_id,
        sku,
        combination_key,
        selling_price,
        compare_at_price,
        quantity,
        is_active
      ) VALUES (
        v_product_id,
        v_var_sku,
        v_combo_key,
        v_var_price,
        NULL,
        v_var_qty,
        TRUE
      ) RETURNING id INTO v_var_id;

      -- Link variant to each option value
      FOR v_opt_idx IN 0..(v_total_options_count - 1)
      LOOP
        v_opt_name := trim(v_options->v_opt_idx->>'name');
        v_opt_norm := public.normalize_option_name(v_opt_name);
        v_val_str := trim(v_var_values->>v_opt_idx);
        v_val_norm := public.normalize_option_name(v_val_str);

        v_opt_id := (v_opt_ids->>v_opt_norm)::UUID;
        v_val_id := (v_val_ids->>(v_opt_norm || '::' || v_val_norm))::UUID;

        INSERT INTO public.variant_option_values (
          variant_id,
          product_id,
          option_id,
          product_option_value_id
        ) VALUES (
          v_var_id,
          v_product_id,
          v_opt_id,
          v_val_id
        );
      END LOOP;

      -- Inventory movement for variant (skip zero stock)
      IF v_var_qty > 0 THEN
        INSERT INTO public.inventory_movements (
          product_id,
          variant_id,
          quantity_delta,
          reason,
          reference_type,
          reference_id,
          note,
          created_by
        ) VALUES (
          v_product_id,
          v_var_id,
          v_var_qty,
          'opening_stock',
          'initial',
          NULL,
          'Initial stock added by seller',
          v_seller_id
        );
      END IF;

    END LOOP;
    v_variant_count := v_var_idx;

    -- Calculate aggregates and update cached columns
    SELECT
      MIN(selling_price),
      MAX(selling_price),
      COALESCE(SUM(quantity), 0)
    INTO v_min_price, v_max_price, v_total_qty
    FROM public.product_variants
    WHERE product_id = v_product_id;

    IF v_total_qty <= 0 THEN
      RAISE EXCEPTION 'VALIDATION: Total quantity across all variants must be greater than 0.';
    END IF;

    UPDATE public.products
    SET
      cached_min_variant_price = v_min_price,
      cached_max_variant_price = v_max_price,
      cached_total_variant_quantity = v_total_qty
    WHERE id = v_product_id;

  ELSE
    -- Simple inventory movement (variant_id = NULL)
    IF v_simple_qty > 0 THEN
      INSERT INTO public.inventory_movements (
        product_id,
        variant_id,
        quantity_delta,
        reason,
        reference_type,
        reference_id,
        note,
        created_by
      ) VALUES (
        v_product_id,
        NULL,
        v_simple_qty,
        'opening_stock',
        'initial',
        NULL,
        'Initial stock added by seller',
        v_seller_id
      );
    END IF;
  END IF;

  -- ==========================================================================
  -- I. FINALIZE STATUS TO 'active'
  -- ==========================================================================
  UPDATE public.products
  SET status = 'active'
  WHERE id = v_product_id;

  -- ==========================================================================
  -- J. RETURN SUMMARY RESPONSE
  -- ==========================================================================
  RETURN jsonb_build_object(
    'success', true,
    'product_id', v_product_id,
    'inventory_mode', v_inventory_mode,
    'status', 'active',
    'counts', jsonb_build_object(
      'images', v_image_count,
      'custom_specs', v_spec_count,
      'attribute_values', v_attr_count,
      'options', v_option_count,
      'variants', v_variant_count,
      'total_quantity', v_total_qty
    )
  );

END;
$$;

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES FOR SELLER PRIVILEGES
-- ============================================================================

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_custom_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variant_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- Products RLS
DROP POLICY IF EXISTS "Sellers manage own products" ON public.products;
CREATE POLICY "Sellers manage own products"
  ON public.products FOR ALL
  TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "Public read active products" ON public.products;
CREATE POLICY "Public read active products"
  ON public.products FOR SELECT
  USING (status = 'active' OR seller_id = auth.uid());

-- Product Images RLS
DROP POLICY IF EXISTS "Sellers manage product images" ON public.product_images;
CREATE POLICY "Sellers manage product images"
  ON public.product_images FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_images.product_id AND p.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_images.product_id AND p.seller_id = auth.uid()));

DROP POLICY IF EXISTS "Public read product images" ON public.product_images;
CREATE POLICY "Public read product images"
  ON public.product_images FOR SELECT
  USING (TRUE);

-- Product Custom Attributes RLS
DROP POLICY IF EXISTS "Sellers manage product custom attributes" ON public.product_custom_attributes;
CREATE POLICY "Sellers manage product custom attributes"
  ON public.product_custom_attributes FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_custom_attributes.product_id AND p.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_custom_attributes.product_id AND p.seller_id = auth.uid()));

DROP POLICY IF EXISTS "Public read product custom attributes" ON public.product_custom_attributes;
CREATE POLICY "Public read product custom attributes"
  ON public.product_custom_attributes FOR SELECT
  USING (TRUE);

-- Product Attribute Values RLS
DROP POLICY IF EXISTS "Sellers manage product attribute values" ON public.product_attribute_values;
CREATE POLICY "Sellers manage product attribute values"
  ON public.product_attribute_values FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_attribute_values.product_id AND p.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_attribute_values.product_id AND p.seller_id = auth.uid()));

DROP POLICY IF EXISTS "Public read product attribute values" ON public.product_attribute_values;
CREATE POLICY "Public read product attribute values"
  ON public.product_attribute_values FOR SELECT
  USING (TRUE);

-- Product Options RLS
DROP POLICY IF EXISTS "Sellers manage product options" ON public.product_options;
CREATE POLICY "Sellers manage product options"
  ON public.product_options FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_options.product_id AND p.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_options.product_id AND p.seller_id = auth.uid()));

DROP POLICY IF EXISTS "Public read product options" ON public.product_options;
CREATE POLICY "Public read product options"
  ON public.product_options FOR SELECT
  USING (TRUE);

-- Product Option Values RLS
DROP POLICY IF EXISTS "Sellers manage product option values" ON public.product_option_values;
CREATE POLICY "Sellers manage product option values"
  ON public.product_option_values FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_option_values.product_id AND p.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_option_values.product_id AND p.seller_id = auth.uid()));

DROP POLICY IF EXISTS "Public read product option values" ON public.product_option_values;
CREATE POLICY "Public read product option values"
  ON public.product_option_values FOR SELECT
  USING (TRUE);

-- Product Variants RLS
DROP POLICY IF EXISTS "Sellers manage product variants" ON public.product_variants;
CREATE POLICY "Sellers manage product variants"
  ON public.product_variants FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND p.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND p.seller_id = auth.uid()));

DROP POLICY IF EXISTS "Public read product variants" ON public.product_variants;
CREATE POLICY "Public read product variants"
  ON public.product_variants FOR SELECT
  USING (TRUE);

-- Variant Option Values RLS
DROP POLICY IF EXISTS "Sellers manage variant option values" ON public.variant_option_values;
CREATE POLICY "Sellers manage variant option values"
  ON public.variant_option_values FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = variant_option_values.product_id AND p.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = variant_option_values.product_id AND p.seller_id = auth.uid()));

DROP POLICY IF EXISTS "Public read variant option values" ON public.variant_option_values;
CREATE POLICY "Public read variant option values"
  ON public.variant_option_values FOR SELECT
  USING (TRUE);

-- Product Option Images RLS
DROP POLICY IF EXISTS "Sellers manage product option images" ON public.product_option_images;
CREATE POLICY "Sellers manage product option images"
  ON public.product_option_images FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_option_images.product_id AND p.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_option_images.product_id AND p.seller_id = auth.uid()));

DROP POLICY IF EXISTS "Public read product option images" ON public.product_option_images;
CREATE POLICY "Public read product option images"
  ON public.product_option_images FOR SELECT
  USING (TRUE);

-- Inventory Movements RLS
DROP POLICY IF EXISTS "Sellers view own inventory movements" ON public.inventory_movements;
CREATE POLICY "Sellers view own inventory movements"
  ON public.inventory_movements FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = inventory_movements.product_id AND p.seller_id = auth.uid()));

DROP POLICY IF EXISTS "Sellers insert own inventory movements" ON public.inventory_movements;
CREATE POLICY "Sellers insert own inventory movements"
  ON public.inventory_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() 
    AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = inventory_movements.product_id AND p.seller_id = auth.uid())
  );

-- ============================================================================
-- 6. STORAGE BUCKET CONFIGURATION FOR productImages
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'productImages',
  'productImages',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow productImages uploads" ON storage.objects;
CREATE POLICY "Allow productImages uploads"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'productImages');

DROP POLICY IF EXISTS "Allow public read productImages" ON storage.objects;
CREATE POLICY "Allow public read productImages"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'productImages');

DROP POLICY IF EXISTS "Allow seller delete productImages" ON storage.objects;
CREATE POLICY "Allow seller delete productImages"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'productImages');

COMMIT;

-- ============================================================================
-- 7. REFRESH POSTGREST SCHEMA CACHE
-- ============================================================================
NOTIFY pgrst, 'reload schema';


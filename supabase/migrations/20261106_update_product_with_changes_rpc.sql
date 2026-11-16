-- ============================================================================
-- Migration: Transactional Product Edit/Update RPC (Stable IDs, Change-Only Writes)
-- File: supabase/migrations/20261106_update_product_with_changes_rpc.sql
-- Target: Supabase PostgreSQL
-- ============================================================================

-- Ensure normalization helper exists
CREATE OR REPLACE FUNCTION public.normalize_option_name(p_input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT lower(regexp_replace(trim(p_input), '\s+', ' ', 'g'));
$$;

GRANT EXECUTE ON FUNCTION public.normalize_option_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_option_name(TEXT) TO anon;

-- Function: public.update_product_with_changes
-- Atomically applies diffed product edits, updates child tables with stable IDs,
-- manages two-phase reordering, performs safe inventory delta movements,
-- and identifies orphaned storage paths for client cleanup.

DROP FUNCTION IF EXISTS public.update_product_with_changes(UUID, TIMESTAMPTZ, JSONB);
DROP FUNCTION IF EXISTS public.update_product_with_changes(UUID, JSONB);

CREATE OR REPLACE FUNCTION public.update_product_with_changes(
  p_product_id UUID,
  p_expected_updated_at TIMESTAMPTZ DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_seller_id UUID := auth.uid();
  v_product RECORD;
  v_new_updated_at TIMESTAMPTZ;
  v_target_mode TEXT;
  v_category_id UUID;
  v_title TEXT;
  v_description TEXT;
  v_defect TEXT;

  -- Simple mode fields
  v_simple JSONB;
  v_selling_price NUMERIC;
  v_compare_price NUMERIC;
  v_quantity INTEGER;
  v_simple_qty_delta INTEGER;

  -- Variants mode fields
  v_options JSONB;
  v_variants JSONB;
  v_sku_prefix TEXT;
  v_max_sku_num INTEGER := 0;
  v_total_options_count INTEGER := 0;
  v_min_price NUMERIC;
  v_max_price NUMERIC;
  v_total_qty INTEGER := 0;

  -- Loop variables
  v_elem JSONB;
  v_idx INTEGER;
  v_id UUID;
  v_name TEXT;
  v_norm_name TEXT;
  v_value TEXT;
  v_attr_id UUID;
  v_attr_def RECORD;
  v_val_text TEXT;
  v_val_num NUMERIC;
  v_val_bool BOOLEAN;
  v_val_jsonb JSONB;
  v_val_elem JSONB;

  -- Option & Value ID lookup maps: key -> UUID
  v_opt_ids JSONB := '{}'::jsonb;
  v_opt_ref_to_id JSONB := '{}'::jsonb;
  v_val_ref_to_id JSONB := '{}'::jsonb;
  v_val_id_to_norm JSONB := '{}'::jsonb;
  v_opt_id UUID;
  v_val_id UUID;
  v_val_text_opt TEXT;
  v_val_norm TEXT;

  -- Variant processing
  v_var_id UUID;
  v_var_sku TEXT;
  v_var_price NUMERIC;
  v_var_qty INTEGER;
  v_var_refs JSONB;
  v_combo_parts TEXT[];
  v_combo_key TEXT;
  v_seen_combos JSONB := '{}'::jsonb;
  v_kept_var_ids UUID[] := ARRAY[]::UUID[];
  v_old_var_qty INTEGER;
  v_var_delta INTEGER;

  -- Option images
  v_opt_img JSONB;
  v_img_storage_path TEXT;
  v_img_url TEXT;

  -- Storage cleanup detection
  v_original_product_paths TEXT[] := ARRAY[]::TEXT[];
  v_orphaned_paths TEXT[] := ARRAY[]::TEXT[];
  v_kept_image_ids UUID[] := ARRAY[]::UUID[];
  v_image_count INTEGER := 0;
  v_variant_count INTEGER := 0;

  -- Conversions
  v_is_conversion BOOLEAN := FALSE;
BEGIN
  -- 1. AUTHENTICATION & OWNERSHIP VERIFICATION
  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'VALIDATION: You must be authenticated to edit a product.';
  END IF;

  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'VALIDATION: Product ID is required.';
  END IF;

  -- Lock core product row for update to prevent concurrent mutations
  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id AND seller_id = v_seller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VALIDATION: Product not found or you do not have permission to edit it.';
  END IF;

  -- Optimistic concurrency check: match updated_at
  IF p_expected_updated_at IS NOT NULL AND v_product.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'CONFLICT: This product was changed elsewhere. Please reload to review the latest changes.';
  END IF;

  -- 2. VALIDATE PAYLOAD & TARGET MODE
  v_target_mode := trim(COALESCE(p_payload->>'targetMode', v_product.inventory_mode, 'simple'));
  IF v_target_mode NOT IN ('simple', 'variants') THEN
    RAISE EXCEPTION 'VALIDATION: Invalid target mode "%". Must be simple or variants.', v_target_mode;
  END IF;

  v_title := trim(COALESCE(p_payload->'product'->>'title', p_payload->>'title', v_product.title));
  IF length(v_title) < 3 OR length(v_title) > 255 THEN
    RAISE EXCEPTION 'VALIDATION: Title must be between 3 and 255 characters.';
  END IF;

  IF (p_payload ? 'product' AND p_payload->'product' ? 'description') OR p_payload ? 'description' THEN
    v_description := trim(COALESCE(p_payload->'product'->>'description', p_payload->>'description', ''));
    IF length(v_description) = 0 THEN
      v_description := NULL;
    END IF;
  ELSE
    v_description := v_product.description;
  END IF;

  IF (p_payload ? 'product' AND p_payload->'product' ? 'defect') OR p_payload ? 'defect' THEN
    v_defect := trim(COALESCE(p_payload->'product'->>'defect', p_payload->>'defect', ''));
    IF length(v_defect) = 0 THEN
      v_defect := NULL;
    END IF;
  ELSE
    v_defect := v_product.condition_details;
  END IF;

  -- Category change is strictly prohibited (Section 8 item 3)
  IF p_payload ? 'categoryId' THEN
    v_category_id := (p_payload->>'categoryId')::UUID;
    IF v_category_id IS DISTINCT FROM v_product.category_id THEN
      RAISE EXCEPTION 'VALIDATION: category cannot be changed';
    END IF;
  ELSE
    v_category_id := v_product.category_id;
  END IF;

  -- Check mode conversion restrictions
  IF v_product.inventory_mode = 'variants' AND v_target_mode = 'simple' THEN
    IF NOT (p_payload->'confirm'->>'conversion' = 'true') THEN
      RAISE EXCEPTION 'VALIDATION: Converting variants to simple product requires explicit confirmation.';
    END IF;
    -- Check if product has historical movements/variants that forbid conversion
    IF EXISTS (SELECT 1 FROM public.product_variants WHERE product_id = p_product_id) THEN
      RAISE EXCEPTION 'VALIDATION: Variants products with existing inventory history cannot be converted to simple mode.';
    END IF;
  END IF;

  IF v_product.inventory_mode = 'simple' AND v_target_mode = 'variants' THEN
    IF NOT (p_payload->'confirm'->>'conversion' = 'true') THEN
      RAISE EXCEPTION 'VALIDATION: Converting simple product to variants requires explicit confirmation.';
    END IF;
    v_is_conversion := TRUE;
  END IF;

  -- 3. VALIDATE CHILD RECORD IDS BELONG TO THIS PRODUCT
  -- Check images
  FOR v_elem IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'images', '[]'::jsonb))
  LOOP
    IF v_elem ? 'id' THEN
      v_id := (v_elem->>'id')::UUID;
      IF NOT EXISTS (SELECT 1 FROM public.product_images WHERE id = v_id AND product_id = p_product_id) THEN
        RAISE EXCEPTION 'VALIDATION: Image ID % does not belong to this product.', v_id;
      END IF;
    END IF;
  END LOOP;

  -- Check custom specs
  FOR v_elem IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'customSpecs', '[]'::jsonb))
  LOOP
    IF v_elem ? 'id' THEN
      v_id := (v_elem->>'id')::UUID;
      IF NOT EXISTS (SELECT 1 FROM public.product_custom_attributes WHERE id = v_id AND product_id = p_product_id) THEN
        RAISE EXCEPTION 'VALIDATION: Custom specification ID % does not belong to this product.', v_id;
      END IF;
    END IF;
  END LOOP;

  -- Check options and option values
  FOR v_elem IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'options', '[]'::jsonb))
  LOOP
    IF v_elem ? 'id' THEN
      v_id := (v_elem->>'id')::UUID;
      IF NOT EXISTS (SELECT 1 FROM public.product_options WHERE id = v_id AND product_id = p_product_id) THEN
        RAISE EXCEPTION 'VALIDATION: Option ID % does not belong to this product.', v_id;
      END IF;
    END IF;
    FOR v_val_elem IN SELECT * FROM jsonb_array_elements(COALESCE(v_elem->'values', '[]'::jsonb))
    LOOP
      IF v_val_elem ? 'id' THEN
        v_id := (v_val_elem->>'id')::UUID;
        IF NOT EXISTS (SELECT 1 FROM public.product_option_values WHERE id = v_id AND product_id = p_product_id) THEN
          RAISE EXCEPTION 'VALIDATION: Option value ID % does not belong to this product.', v_id;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  -- Check variants
  FOR v_elem IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'variants', '[]'::jsonb))
  LOOP
    IF v_elem ? 'id' THEN
      v_id := (v_elem->>'id')::UUID;
      IF NOT EXISTS (SELECT 1 FROM public.product_variants WHERE id = v_id AND product_id = p_product_id) THEN
        RAISE EXCEPTION 'VALIDATION: Variant ID % does not belong to this product.', v_id;
      END IF;
    END IF;
  END LOOP;

  -- 4. CAPTURE ORIGINAL STORAGE PATHS TO COMPUTE ORPHANS LATER
  SELECT array_agg(DISTINCT sp) INTO v_original_product_paths
  FROM (
    SELECT storage_path AS sp FROM public.product_images WHERE product_id = p_product_id AND storage_path IS NOT NULL
    UNION
    SELECT storage_path AS sp FROM public.product_option_images WHERE product_id = p_product_id AND storage_path IS NOT NULL
  ) existing_paths;

  -- 5. SIMPLE INVENTORY VALIDATION
  IF v_target_mode = 'simple' THEN
    v_simple := p_payload->'simple';
    IF v_simple IS NOT NULL THEN
      IF v_simple ? 'sellingPrice' THEN
        v_selling_price := (v_simple->>'sellingPrice')::NUMERIC;
        IF v_selling_price IS NULL OR v_selling_price <= 0 THEN
          RAISE EXCEPTION 'VALIDATION: Selling price must be greater than 0.';
        END IF;
      ELSE
        v_selling_price := v_product.selling_price;
      END IF;

      IF v_simple ? 'compareAtPrice' THEN
        v_compare_price := (v_simple->>'compareAtPrice')::NUMERIC;
        IF v_compare_price IS NOT NULL AND v_compare_price <= 0 THEN
          v_compare_price := NULL;
        END IF;
      ELSE
        v_compare_price := v_product.compare_at_price;
      END IF;

      IF v_simple ? 'quantity' THEN
        IF jsonb_typeof(v_simple->'quantity') = 'object' THEN
          -- Compare-and-set: check baseline value
          IF v_product.quantity IS DISTINCT FROM (v_simple->'quantity'->>'from')::INTEGER THEN
            RAISE EXCEPTION 'CONFLICT: stock changed since you opened this product';
          END IF;
          v_quantity := (v_simple->'quantity'->>'to')::INTEGER;
        ELSE
          v_quantity := (v_simple->>'quantity')::INTEGER;
        END IF;
        IF v_quantity IS NULL OR v_quantity < 0 THEN
          RAISE EXCEPTION 'VALIDATION: Quantity must be 0 or greater.';
        END IF;
      ELSE
        v_quantity := v_product.quantity;
      END IF;
    ELSE
      v_selling_price := v_product.selling_price;
      v_compare_price := v_product.compare_at_price;
      v_quantity := v_product.quantity;
    END IF;

    IF v_product.status = 'active' AND v_quantity = 0 THEN
      RAISE EXCEPTION 'VALIDATION: An active product cannot have a quantity of 0. Please set quantity greater than 0, or mark the listing as Sold Out first.';
    END IF;
  END IF;

  -- 6. UPDATE CORE PRODUCT (Always touches updated_at)
  UPDATE public.products
  SET
    title = v_title,
    description = v_description,
    condition_details = v_defect,
    category_id = v_category_id,
    inventory_mode = v_target_mode,
    selling_price = CASE WHEN v_target_mode = 'simple' THEN v_selling_price ELSE NULL END,
    compare_at_price = CASE WHEN v_target_mode = 'simple' THEN v_compare_price ELSE NULL END,
    quantity = CASE WHEN v_target_mode = 'simple' THEN v_quantity ELSE NULL END,
    updated_at = now()
  WHERE id = p_product_id
  RETURNING updated_at INTO v_new_updated_at;

  -- 7. TWO-PHASE PRODUCT IMAGES REORDERING & INSERTION
  -- Validate images count: 1 to 10
  v_image_count := jsonb_array_length(COALESCE(p_payload->'images', '[]'::jsonb));
  IF v_image_count < 1 OR v_image_count > 10 THEN
    RAISE EXCEPTION 'VALIDATION: Product must have between 1 and 10 images.';
  END IF;

  -- Collect kept image IDs
  SELECT array_agg((elem->>'id')::UUID) INTO v_kept_image_ids
  FROM jsonb_array_elements(p_payload->'images') elem
  WHERE elem ? 'id';

  -- Phase 1: Delete removed images from product_images
  IF v_kept_image_ids IS NOT NULL AND array_length(v_kept_image_ids, 1) > 0 THEN
    DELETE FROM public.product_images
    WHERE product_id = p_product_id AND id <> ALL(v_kept_image_ids);
  ELSE
    DELETE FROM public.product_images WHERE product_id = p_product_id;
  END IF;

  -- Phase 2: Clear thumbnail flags & move display_order to offset to prevent unique constraint collision
  UPDATE public.product_images
  SET is_thumbnail = FALSE, display_order = display_order + 1000
  WHERE product_id = p_product_id;

  -- Phase 3: Set final display order for kept rows and insert new ones
  v_idx := 0;
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_payload->'images')
  LOOP
    IF v_elem ? 'id' THEN
      UPDATE public.product_images
      SET display_order = v_idx, is_thumbnail = (v_idx = 0)
      WHERE id = (v_elem->>'id')::UUID AND product_id = p_product_id;
    ELSE
      v_img_storage_path := trim(COALESCE(v_elem->>'storagePath', ''));
      v_img_url := trim(COALESCE(v_elem->>'imageUrl', ''));

      IF length(v_img_storage_path) = 0 THEN
        RAISE EXCEPTION 'VALIDATION: Image storagePath cannot be empty.';
      END IF;

      IF NOT (v_img_storage_path LIKE (v_seller_id::text || '/' || p_product_id::text || '/%')) THEN
        RAISE EXCEPTION 'VALIDATION: Security violation: Image storage path must start with %/%/', v_seller_id, p_product_id;
      END IF;

      INSERT INTO public.product_images (
        product_id,
        storage_path,
        image_url,
        alt_text,
        is_thumbnail,
        display_order
      ) VALUES (
        p_product_id,
        v_img_storage_path,
        v_img_url,
        'image not showing',
        (v_idx = 0),
        v_idx
      );
    END IF;
    v_idx := v_idx + 1;
  END LOOP;

  -- Ensure display_order 0 is always thumbnail
  UPDATE public.product_images
  SET is_thumbnail = TRUE
  WHERE product_id = p_product_id AND display_order = 0;

  -- 8. CUSTOM ATTRIBUTES (product_custom_attributes)
  -- Step A: Delete removed custom specs
  DELETE FROM public.product_custom_attributes
  WHERE product_id = p_product_id
    AND id NOT IN (
      SELECT (elem->>'id')::UUID
      FROM jsonb_array_elements(COALESCE(p_payload->'customSpecs', '[]'::jsonb)) elem
      WHERE elem ? 'id'
    );

  -- Step B: Rename kept specs to temp normalized_name to prevent swap collision
  UPDATE public.product_custom_attributes
  SET normalized_name = 'temp_' || id::text || '_' || normalized_name
  WHERE product_id = p_product_id;

  -- Step C: Update kept specs and insert new specs
  v_idx := 0;
  FOR v_elem IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'customSpecs', '[]'::jsonb))
  LOOP
    v_name := trim(COALESCE(v_elem->>'name', ''));
    v_value := trim(COALESCE(v_elem->>'value', ''));

    IF length(v_name) = 0 OR length(v_value) = 0 THEN
      RAISE EXCEPTION 'VALIDATION: Specification name and value cannot be empty.';
    END IF;

    v_norm_name := public.normalize_option_name(v_name);

    IF v_elem ? 'id' THEN
      UPDATE public.product_custom_attributes
      SET
        name = v_name,
        normalized_name = v_norm_name,
        value = v_value,
        display_order = v_idx
      WHERE id = (v_elem->>'id')::UUID AND product_id = p_product_id;
    ELSE
      INSERT INTO public.product_custom_attributes (
        product_id,
        name,
        normalized_name,
        value,
        display_order
      ) VALUES (
        p_product_id,
        v_name,
        v_norm_name,
        v_value,
        v_idx
      );
    END IF;
    v_idx := v_idx + 1;
  END LOOP;

  -- 9. CATEGORY ATTRIBUTE VALUES (product_attribute_values)
  IF v_product.category_id IS DISTINCT FROM v_category_id THEN
    -- Category changed: delete all old attribute values for this product
    DELETE FROM public.product_attribute_values WHERE product_id = p_product_id;
  ELSE
    -- Same category: delete removed attributes
    DELETE FROM public.product_attribute_values
    WHERE product_id = p_product_id
      AND attribute_id NOT IN (
        SELECT (elem->>'attributeId')::UUID
        FROM jsonb_array_elements(COALESCE(p_payload->'attributeValues', '[]'::jsonb)) elem
        WHERE elem ? 'attributeId'
      );
  END IF;

  -- Validate required attribute definitions for this category
  FOR v_attr_def IN
    SELECT id, name, data_type
    FROM public.category_attribute_definitions
    WHERE category_id = v_category_id AND is_active = TRUE AND is_required = TRUE
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(p_payload->'attributeValues', '[]'::jsonb)) elem
      WHERE (elem->>'attributeId')::UUID = v_attr_def.id
    ) THEN
      RAISE EXCEPTION 'VALIDATION: Required attribute "%" is missing.', v_attr_def.name;
    END IF;
  END LOOP;

  -- Upsert category attribute values
  FOR v_elem IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'attributeValues', '[]'::jsonb))
  LOOP
    v_attr_id := (v_elem->>'attributeId')::UUID;
    SELECT * INTO v_attr_def
    FROM public.category_attribute_definitions
    WHERE id = v_attr_id AND category_id = v_category_id AND is_active = TRUE;

    IF FOUND THEN
      v_val_text := NULL;
      v_val_num := NULL;
      v_val_bool := NULL;
      v_val_jsonb := NULL;

      IF v_attr_def.data_type IN ('text', 'select') THEN
        v_val_text := trim(COALESCE(v_elem->>'value', ''));
      ELSIF v_attr_def.data_type = 'number' THEN
        v_val_num := (v_elem->>'value')::NUMERIC;
      ELSIF v_attr_def.data_type = 'boolean' THEN
        v_val_bool := (v_elem->>'value')::BOOLEAN;
      ELSIF v_attr_def.data_type = 'multi_select' THEN
        v_val_jsonb := v_elem->'value';
      ELSE
        v_val_text := trim(COALESCE(v_elem->>'value', ''));
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.product_attribute_values
        WHERE product_id = p_product_id AND attribute_id = v_attr_id
      ) THEN
        UPDATE public.product_attribute_values
        SET
          category_id = v_category_id,
          value_text = v_val_text,
          value_number = v_val_num,
          value_boolean = v_val_bool,
          value_jsonb = v_val_jsonb,
          updated_at = now()
        WHERE product_id = p_product_id AND attribute_id = v_attr_id;
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
          p_product_id,
          v_category_id,
          v_attr_id,
          v_val_text,
          v_val_num,
          v_val_bool,
          v_val_jsonb
        );
      END IF;
    END IF;
  END LOOP;

  -- 10. VARIANTS MODE PROCESSING
  IF v_target_mode = 'variants' THEN
    v_options := COALESCE(p_payload->'options', '[]'::jsonb);
    v_variants := COALESCE(p_payload->'variants', '[]'::jsonb);
    v_total_options_count := jsonb_array_length(v_options);

    IF v_total_options_count < 1 OR v_total_options_count > 5 THEN
      RAISE EXCEPTION 'VALIDATION: Product must have between 1 and 5 variation dimensions.';
    END IF;

    -- Block adding/removing dimensions on existing variant products
    IF NOT v_is_conversion THEN
      IF (SELECT count(*) FROM public.product_options WHERE product_id = p_product_id) <> v_total_options_count THEN
        RAISE EXCEPTION 'VALIDATION: Modifying the number of option dimensions on an existing variants product is restricted to preserve historical SKU combinations.';
      END IF;
    END IF;

    -- Process Options and Values (Update or reuse hidden values, insert new)
    v_idx := 0;
    FOR v_elem IN SELECT * FROM jsonb_array_elements(v_options)
    LOOP
      v_name := trim(COALESCE(v_elem->>'name', ''));
      IF length(v_name) = 0 OR length(v_name) > 100 THEN
        RAISE EXCEPTION 'VALIDATION: Option name must be between 1 and 100 characters.';
      END IF;
      v_norm_name := public.normalize_option_name(v_name);

      IF v_elem ? 'id' THEN
        v_opt_id := (v_elem->>'id')::UUID;
        UPDATE public.product_options
        SET name = v_name, display_order = v_idx
        WHERE id = v_opt_id AND product_id = p_product_id;
      ELSE
        INSERT INTO public.product_options (product_id, name, display_order)
        VALUES (p_product_id, v_name, v_idx)
        RETURNING id INTO v_opt_id;
      END IF;

      -- Map option ref & normalized name to ID
      v_opt_ids := jsonb_set(v_opt_ids, ARRAY[v_norm_name], to_jsonb(v_opt_id::text));
      IF v_elem ? 'ref' THEN
        v_opt_ref_to_id := jsonb_set(v_opt_ref_to_id, ARRAY[v_elem->>'ref'], to_jsonb(v_opt_id::text));
      END IF;

      -- Process values of this option
      FOR v_val_elem IN SELECT * FROM jsonb_array_elements(COALESCE(v_elem->'values', '[]'::jsonb))
      LOOP
        v_val_text_opt := trim(COALESCE(v_val_elem->>'value', ''));
        IF length(v_val_text_opt) = 0 OR length(v_val_text_opt) > 120 THEN
          RAISE EXCEPTION 'VALIDATION: Option value must be between 1 and 120 characters.';
        END IF;
        v_val_norm := public.normalize_option_name(v_val_text_opt);

        IF v_val_elem ? 'id' THEN
          v_val_id := (v_val_elem->>'id')::UUID;
          UPDATE public.product_option_values
          SET value = v_val_text_opt, normalized_value = v_val_norm
          WHERE id = v_val_id AND option_id = v_opt_id AND product_id = p_product_id;
        ELSE
          -- Check if hidden value with same normalized name exists for this option
          SELECT id INTO v_val_id
          FROM public.product_option_values
          WHERE option_id = v_opt_id AND normalized_value = v_val_norm
          LIMIT 1;

          IF v_val_id IS NOT NULL THEN
            -- Reuse existing hidden value
            UPDATE public.product_option_values
            SET value = v_val_text_opt
            WHERE id = v_val_id;
          ELSE
            INSERT INTO public.product_option_values (
              product_id,
              option_id,
              value,
              normalized_value,
              display_order
            ) VALUES (
              p_product_id,
              v_opt_id,
              v_val_text_opt,
              v_val_norm,
              0
            ) RETURNING id INTO v_val_id;
          END IF;
        END IF;

        -- Record value ref mappings
        IF v_val_elem ? 'ref' THEN
          v_val_ref_to_id := jsonb_set(v_val_ref_to_id, ARRAY[v_val_elem->>'ref'], to_jsonb(v_val_id::text));
        END IF;
        v_val_ref_to_id := jsonb_set(v_val_ref_to_id, ARRAY[v_val_id::text], to_jsonb(v_val_id::text));
        v_val_ref_to_id := jsonb_set(v_val_ref_to_id, ARRAY[v_val_text_opt], to_jsonb(v_val_id::text));
        v_val_ref_to_id := jsonb_set(v_val_ref_to_id, ARRAY[v_norm_name || '::' || v_val_norm], to_jsonb(v_val_id::text));
        v_val_id_to_norm := jsonb_set(v_val_id_to_norm, ARRAY[v_val_id::text], to_jsonb(v_norm_name || ':' || v_val_norm));

        -- Handle option images (product_option_images)
        -- Contract: If 'image' key is missing, images were not loaded in this session -> treat as UNCHANGED.
        -- Only an explicit null or empty image removes the image.
        IF v_val_elem ? 'image' THEN
          IF v_val_elem->'image' IS NOT NULL AND v_val_elem->'image' <> 'null'::jsonb THEN
            v_opt_img := v_val_elem->'image';
            v_img_storage_path := trim(COALESCE(v_opt_img->>'storagePath', ''));
            v_img_url := trim(COALESCE(v_opt_img->>'imageUrl', ''));

            IF length(v_img_storage_path) > 0 THEN
              IF EXISTS (
                SELECT 1 FROM public.product_option_images
                WHERE product_id = p_product_id AND product_option_value_id = v_val_id
              ) THEN
                UPDATE public.product_option_images
                SET storage_path = v_img_storage_path, image_url = v_img_url
                WHERE product_id = p_product_id AND product_option_value_id = v_val_id;
              ELSE
                INSERT INTO public.product_option_images (
                  product_id,
                  product_option_value_id,
                  storage_path,
                  image_url
                ) VALUES (
                  p_product_id,
                  v_val_id,
                  v_img_storage_path,
                  v_img_url
                );
              END IF;
            END IF;
          ELSE
            -- Explicit null -> Remove option image if cleared
            DELETE FROM public.product_option_images
            WHERE product_id = p_product_id AND product_option_value_id = v_val_id;
          END IF;
        END IF;
      END LOOP;
      v_idx := v_idx + 1;
    END LOOP;

    -- SKU Generation prefix
    v_sku_prefix := UPPER(SUBSTRING(REPLACE(p_product_id::text, '-', '') FROM 1 FOR 8));
    SELECT COALESCE(MAX(NULLIF(regexp_replace(sku, '^.*-', ''), '')::INTEGER), 0) INTO v_max_sku_num
    FROM public.product_variants
    WHERE product_id = p_product_id;

    -- Process Variants: Update, Reactivate or Insert
    FOR v_elem IN SELECT * FROM jsonb_array_elements(v_variants)
    LOOP
      v_var_price := (v_elem->>'sellingPrice')::NUMERIC;
      IF v_var_price IS NULL OR v_var_price <= 0 THEN
        RAISE EXCEPTION 'VALIDATION: Variant selling price must be greater than 0.';
      END IF;

      IF jsonb_typeof(v_elem->'quantity') = 'object' THEN
        v_var_qty := (v_elem->'quantity'->>'to')::INTEGER;
      ELSE
        v_var_qty := (v_elem->>'quantity')::INTEGER;
      END IF;

      IF v_var_qty IS NULL OR v_var_qty < 0 THEN
        RAISE EXCEPTION 'VALIDATION: Variant quantity must be 0 or greater.';
      END IF;

      v_var_refs := COALESCE(v_elem->'valueRefs', v_elem->'values');
      IF v_var_refs IS NULL OR jsonb_array_length(v_var_refs) <> v_total_options_count THEN
        RAISE EXCEPTION 'VALIDATION: Variant must reference exactly one value per dimension.';
      END IF;

      -- Build combination key
      v_combo_parts := ARRAY[]::TEXT[];
      FOR v_idx IN 0..(v_total_options_count - 1)
      LOOP
        v_val_id := (v_val_ref_to_id->>(v_var_refs->>v_idx))::UUID;
        IF v_val_id IS NULL THEN
          RAISE EXCEPTION 'VALIDATION: Unresolved option value reference "%".', v_var_refs->>v_idx;
        END IF;
        v_combo_parts := array_append(v_combo_parts, v_val_id_to_norm->>v_val_id::text);
      END LOOP;

      v_combo_key := array_to_string(v_combo_parts, '|');

      IF v_seen_combos ? v_combo_key THEN
        RAISE EXCEPTION 'VALIDATION: Duplicate variant combination: %', v_combo_key;
      END IF;
      v_seen_combos := jsonb_set(v_seen_combos, ARRAY[v_combo_key], 'true'::jsonb);

      -- Check if variant is specified by ID or combination_key
      v_var_id := NULL;
      IF v_elem ? 'id' THEN
        v_var_id := (v_elem->>'id')::UUID;
      ELSE
        -- Match existing (possibly inactive) variant by combination_key
        SELECT id INTO v_var_id
        FROM public.product_variants
        WHERE product_id = p_product_id AND combination_key = v_combo_key
        LIMIT 1;
      END IF;

      IF v_var_id IS NOT NULL THEN
        -- Read old quantity to compute delta
        SELECT quantity INTO v_old_var_qty
        FROM public.product_variants
        WHERE id = v_var_id;

        -- Compare-and-set stock check
        IF jsonb_typeof(v_elem->'quantity') = 'object' THEN
          IF COALESCE(v_old_var_qty, 0) IS DISTINCT FROM (v_elem->'quantity'->>'from')::INTEGER THEN
            RAISE EXCEPTION 'CONFLICT: stock changed since you opened this product';
          END IF;
        END IF;

        -- Update and reactivate existing variant
        UPDATE public.product_variants
        SET
          combination_key = v_combo_key,
          selling_price = v_var_price,
          quantity = v_var_qty,
          is_active = TRUE
        WHERE id = v_var_id;

        -- Record inventory movement if delta <> 0
        v_var_delta := v_var_qty - COALESCE(v_old_var_qty, 0);
        IF v_var_delta <> 0 THEN
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
            p_product_id,
            v_var_id,
            v_var_delta,
            'correction',
            'product_edit',
            NULL,
            'Stock adjusted during product edit',
            v_seller_id
          );
        END IF;
      ELSE
        -- Insert new variant combination
        v_max_sku_num := v_max_sku_num + 1;
        v_var_sku := v_sku_prefix || '-' || LPAD(v_max_sku_num::text, 3, '0');

        INSERT INTO public.product_variants (
          product_id,
          sku,
          combination_key,
          selling_price,
          compare_at_price,
          quantity,
          is_active
        ) VALUES (
          p_product_id,
          v_var_sku,
          v_combo_key,
          v_var_price,
          NULL,
          v_var_qty,
          TRUE
        ) RETURNING id INTO v_var_id;

        -- Link variant to option values in variant_option_values
        FOR v_idx IN 0..(v_total_options_count - 1)
        LOOP
          v_val_id := (v_val_ref_to_id->>(v_var_refs->>v_idx))::UUID;
          SELECT option_id INTO v_opt_id
          FROM public.product_option_values
          WHERE id = v_val_id;

          INSERT INTO public.variant_option_values (
            variant_id,
            product_id,
            option_id,
            product_option_value_id
          ) VALUES (
            v_var_id,
            p_product_id,
            v_opt_id,
            v_val_id
          );
        END LOOP;

        -- Record initial opening stock movement for new variant if qty > 0
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
            p_product_id,
            v_var_id,
            v_var_qty,
            'correction',
            'product_edit',
            NULL,
            'Initial stock for newly added variant',
            v_seller_id
          );
        END IF;
      END IF;

      v_kept_var_ids := array_append(v_kept_var_ids, v_var_id);
    END LOOP;

    -- Deactivate removed variants and write off their remaining stock
    FOR v_var_id, v_old_var_qty IN
      SELECT id, quantity
      FROM public.product_variants
      WHERE product_id = p_product_id
        AND is_active = TRUE
        AND id <> ALL(v_kept_var_ids)
    LOOP
      UPDATE public.product_variants
      SET is_active = FALSE, quantity = 0
      WHERE id = v_var_id;

      IF v_old_var_qty > 0 THEN
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
          p_product_id,
          v_var_id,
          -v_old_var_qty,
          'correction',
          'product_edit',
          NULL,
          'Variant removed during product edit',
          v_seller_id
        );
      END IF;
    END LOOP;

    -- Handle simple -> variants conversion inventory deduction
    IF v_is_conversion AND COALESCE(v_product.quantity, 0) > 0 THEN
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
        p_product_id,
        NULL,
        -v_product.quantity,
        'correction',
        'product_edit',
        NULL,
        'Converted to variants',
        v_seller_id
      );
    END IF;

    -- Recompute cached prices & total quantity from ACTIVE variants only
    SELECT
      MIN(selling_price),
      MAX(selling_price),
      COALESCE(SUM(quantity), 0)
    INTO v_min_price, v_max_price, v_total_qty
    FROM public.product_variants
    WHERE product_id = p_product_id AND is_active = TRUE;

    IF v_product.status = 'active' AND v_total_qty = 0 THEN
      RAISE EXCEPTION 'VALIDATION: An active product cannot have a total quantity of 0. Please set quantity greater than 0, or mark the listing as Sold Out first.';
    END IF;

    UPDATE public.products
    SET
      cached_min_variant_price = v_min_price,
      cached_max_variant_price = v_max_price,
      cached_total_variant_quantity = v_total_qty
    WHERE id = p_product_id;

    v_variant_count := array_length(v_kept_var_ids, 1);
  ELSE
    -- SIMPLE INVENTORY MOVEMENT
    v_simple_qty_delta := v_quantity - COALESCE(v_product.quantity, 0);
    IF v_simple_qty_delta <> 0 THEN
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
        p_product_id,
        NULL,
        v_simple_qty_delta,
        'correction',
        'product_edit',
        NULL,
        'Stock adjusted during product edit',
        v_seller_id
      );
    END IF;

    -- Clear caches in simple mode
    UPDATE public.products
    SET
      cached_min_variant_price = NULL,
      cached_max_variant_price = NULL,
      cached_total_variant_quantity = NULL
    WHERE id = p_product_id;
  END IF;

  -- 11. COMPUTE ORPHANED STORAGE PATHS
  -- Paths that belonged to this product but are no longer referenced anywhere in product_images or product_option_images
  IF v_original_product_paths IS NOT NULL AND array_length(v_original_product_paths, 1) > 0 THEN
    SELECT COALESCE(array_agg(old_p), ARRAY[]::TEXT[]) INTO v_orphaned_paths
    FROM unnest(v_original_product_paths) AS old_p
    WHERE old_p NOT IN (
      SELECT storage_path FROM public.product_images WHERE storage_path = old_p
      UNION
      SELECT storage_path FROM public.product_option_images WHERE storage_path = old_p
    );
  END IF;

  -- 12. RETURN SUMMARY RESPONSE
  RETURN jsonb_build_object(
    'success', true,
    'product_id', p_product_id,
    'updated_at', v_new_updated_at,
    'target_mode', v_target_mode,
    'orphaned_paths', COALESCE(v_orphaned_paths, ARRAY[]::TEXT[]),
    'images_count', v_image_count,
    'variants_count', v_variant_count
  );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.update_product_with_changes(UUID, TIMESTAMPTZ, JSONB) TO authenticated;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

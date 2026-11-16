-- ============================================================================
-- Migration: Optimized Unified Collection Products RPC
-- File: supabase/migrations/20261111_get_collection_products_rpc.sql
-- Description:
-- Handles both:
--   Case A: Main Category only (e.g. 'fashion', 'home-garden') -> includes parent + all subcategories
--   Case B: Subcategory (e.g. 'women-accessories', 'kitchen-dining-bar') -> only that subcategory
-- Supports:
--   - Single round-trip database query
--   - Window function total_count for infinite scroll & pagination
--   - Uses index on (category_id, status, created_at DESC)
--   - Safe LATERAL thumbnail image resolution (no duplicate product rows)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_collection_products(
  main_slug text,
  sub_slug text DEFAULT NULL,
  page_limit int DEFAULT 20,
  page_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  seller_id uuid,
  brand text,
  title text,
  condition text,
  inventory_mode text,
  selling_price numeric,
  compare_at_price numeric,
  quantity int,
  cached_min_variant_price numeric,
  cached_max_variant_price numeric,
  cached_total_variant_quantity int,
  category_id uuid,
  description text,
  status text,
  created_at timestamptz,
  average_rating numeric,
  review_count int,
  shop_name text,
  store_image_url text,
  thumbnail_url text,
  storage_path text,
  total_count bigint
) AS $$
  WITH main_cat AS (
    SELECT c.id
    FROM public.categories c
    WHERE main_slug IS NOT NULL
      AND main_slug <> ''
      AND LOWER(c.slug) = LOWER(main_slug)
    LIMIT 1
  ),
  target_ids AS (
    -- Case B: agar sub_slug diya hai to sirf us subcategory ki id (parent = main category)
    SELECT c.id AS category_id
    FROM public.categories c
    INNER JOIN main_cat mc ON c.parent_id = mc.id
    WHERE sub_slug IS NOT NULL
      AND sub_slug <> ''
      AND LOWER(c.slug) = LOWER(sub_slug)
    UNION
    -- Case A: agar sub_slug nahi diya to main category ki apni id
    SELECT mc.id AS category_id
    FROM main_cat mc
    WHERE sub_slug IS NULL OR sub_slug = ''
    UNION
    -- Case A: agar sub_slug nahi diya to saari child subcategories ki ids
    SELECT c.id AS category_id
    FROM public.categories c
    INNER JOIN main_cat mc ON c.parent_id = mc.id
    WHERE sub_slug IS NULL OR sub_slug = ''
  )
  SELECT
    p.id,
    p.seller_id,
    p.brand::text,
    p.title::text,
    p.condition::text,
    p.inventory_mode::text,
    p.selling_price,
    p.compare_at_price,
    p.quantity,
    p.cached_min_variant_price,
    p.cached_max_variant_price,
    p.cached_total_variant_quantity,
    p.category_id,
    p.description,
    p.status::text,
    p.created_at,
    p.average_rating,
    p.review_count,
    s.shop_name::text,
    s.store_image_url,
    pi.image_url AS thumbnail_url,
    pi.storage_path AS storage_path,
    COUNT(*) OVER() AS total_count
  FROM public.products p
  INNER JOIN public.sellers s ON s.id = p.seller_id
  LEFT JOIN LATERAL (
    SELECT img.image_url, img.storage_path
    FROM public.product_images img
    WHERE img.product_id = p.id
    ORDER BY img.is_thumbnail DESC, img.display_order ASC, img.created_at ASC
    LIMIT 1
  ) pi ON true
  WHERE p.status = 'active'
    AND (
      main_slug IS NULL
      OR main_slug = ''
      OR p.category_id IN (SELECT category_id FROM target_ids)
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT page_limit OFFSET page_offset;
$$ LANGUAGE sql STABLE;

-- Grant execution permissions to anon and authenticated clients
GRANT EXECUTE ON FUNCTION public.get_collection_products(text, text, int, int) TO anon, authenticated, service_role;


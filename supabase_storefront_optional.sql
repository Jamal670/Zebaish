-- ============================================================================
-- OPTIONAL — NOT APPLIED, NOT REQUIRED BY THE CODE
-- File: supabase_storefront_optional.sql
--
-- The public storefront (components/ResellerStorefront.tsx +
-- src/api/storefrontService.ts) works without any of this. Everything below only
-- removes the remaining workarounds and can be applied later, one block at a time.
-- Nothing in the frontend depends on these objects.
--
-- 1. `sellers.shop_slug` — canonical storefront URLs are the shop name with the
--    spaces removed ("The Economy Store" -> /theeconomystore). Today the client
--    first tries an exact `ilike` on `shop_name` and then falls back to a bounded
--    scan of `sellers` to compare slugs locally. With `shop_slug`, requests B and C
--    could filter directly on the slug and run in parallel with request A.
-- 2. `public_seller_profiles` — RLS is row-level, not column-level, so any column
--    of a row the API can select is exposed (email, phone, cnic, iban, ...). This
--    view (with `security_invoker`) keeps the row policy and narrows the columns.
-- 3. `products.storefront_price` — price sorting currently orders by
--    `selling_price`, which is NULL for every `variants` product. A generated
--    COALESCE column would sort simple and variant products together.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. Pre-flight: are there duplicate shop names? (run before the unique indexes)
-- ----------------------------------------------------------------------------
-- SELECT lower(shop_name) AS name, count(*)
--   FROM public.sellers
--  GROUP BY 1
-- HAVING count(*) > 1;

-- ----------------------------------------------------------------------------
-- 1a. Slug column + indexes
-- ----------------------------------------------------------------------------
ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS shop_slug text
  GENERATED ALWAYS AS (lower(regexp_replace(coalesce(shop_name, ''), '[\s\-_]+', '', 'g'))) STORED;

CREATE INDEX IF NOT EXISTS sellers_shop_slug_idx
  ON public.sellers (shop_slug);

-- Only safe when the pre-flight query above returns no rows:
-- CREATE UNIQUE INDEX IF NOT EXISTS sellers_shop_slug_key ON public.sellers (shop_slug);
-- CREATE UNIQUE INDEX IF NOT EXISTS sellers_shop_name_lower_key ON public.sellers (lower(shop_name));

-- ----------------------------------------------------------------------------
-- 1b. Narrow public view (keeps RLS through security_invoker)
-- Remove `review_count` from the list below if that column does not exist;
-- the client already falls back to a select without it.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.public_seller_profiles
WITH (security_invoker = true) AS
SELECT
  id,
  shop_name,
  status,
  store_image_url,
  average_rating,
  review_count,
  created_at
FROM public.sellers;

GRANT SELECT ON public.public_seller_profiles TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Sortable price for both inventory modes
-- ----------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS storefront_price numeric
  GENERATED ALWAYS AS (COALESCE(selling_price, cached_min_variant_price)) STORED;

CREATE INDEX IF NOT EXISTS products_storefront_price_idx
  ON public.products (seller_id, status, storefront_price);

COMMIT;

NOTIFY pgrst, 'reload schema';

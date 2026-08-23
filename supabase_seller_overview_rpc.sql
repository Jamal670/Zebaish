-- ====================================================================
-- SUPABASE RPC MIGRATION FOR SELLER DASHBOARD OVERVIEW (2-PHASE LOAD)
-- ====================================================================

-- --------------------------------------------------------------------
-- RLS POLICIES FOR SELLER-SCOPED DATA ENFORCEMENT
-- --------------------------------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Products policy: Sellers can select their own products
DO $$ BEGIN
  CREATE POLICY "Sellers can view own products" ON public.products
    FOR SELECT USING (seller_id = auth.uid() OR seller_id::text = current_setting('app.current_seller_id', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seller orders policy: Sellers can select their own order partitions
DO $$ BEGIN
  CREATE POLICY "Sellers can view own seller_orders" ON public.seller_orders
    FOR SELECT USING (seller_id = auth.uid() OR seller_id::text = current_setting('app.current_seller_id', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Order items policy: Sellers can select order items assigned to them
DO $$ BEGIN
  CREATE POLICY "Sellers can view own order_items" ON public.order_items
    FOR SELECT USING (seller_id = auth.uid() OR seller_id::text = current_setting('app.current_seller_id', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --------------------------------------------------------------------
-- PHASE 1 RPC: get_seller_overview_kpis(p_seller_id UUID)
-- Fast, lightweight query returning ONLY Section 1 + Section 2 KPI cards
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_seller_overview_kpis(p_seller_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_total_revenue NUMERIC := 0;
  v_available_payout NUMERIC := 0;
  v_active_listings INT := 0;
  v_pending_dispatch INT := 0;
  v_delivered_orders INT := 0;
  
  v_revenue_7d NUMERIC := 0;
  v_orders_7d INT := 0;
  v_avg_order_value_7d NUMERIC := 0;
  v_pending_fulfillment_7d INT := 0;
  v_new_reviews_7d INT := 0;
  v_units_sold_7d INT := 0;
BEGIN
  -- 1. SECTION 1 — MAIN KPI CARDS
  -- 1a & 1b. Total Revenue and Available Payout (from status IN ('Shipped', 'Delivered'))
  SELECT 
    COALESCE(SUM(seller_total), 0),
    COALESCE(SUM(CASE WHEN payment_status = 'Pending' THEN seller_total ELSE 0 END), 0)
  INTO v_total_revenue, v_available_payout
  FROM public.seller_orders
  WHERE seller_id = p_seller_id
    AND status IN ('Shipped', 'Delivered');

  -- 1c. Active Listings
  SELECT COALESCE(COUNT(id), 0)
  INTO v_active_listings
  FROM public.products
  WHERE seller_id = p_seller_id
    AND status = 'Active';

  -- 1d. Pending Dispatch
  SELECT COALESCE(COUNT(id), 0)
  INTO v_pending_dispatch
  FROM public.seller_orders
  WHERE seller_id = p_seller_id
    AND status IN ('Pending', 'Confirmed');

  -- 1e. Delivered Orders
  SELECT COALESCE(COUNT(id), 0)
  INTO v_delivered_orders
  FROM public.seller_orders
  WHERE seller_id = p_seller_id
    AND status IN ('Shipped', 'Delivered');

  -- 2. SECTION 2 — LAST 7 DAYS PERFORMANCE CARDS (NOW() - INTERVAL '7 days')
  -- 2a. Revenue (Last 7D) - updated_at >= NOW() - INTERVAL '7 days'
  SELECT COALESCE(SUM(seller_total), 0)
  INTO v_revenue_7d
  FROM public.seller_orders
  WHERE seller_id = p_seller_id
    AND status IN ('Shipped', 'Delivered')
    AND updated_at >= (NOW() - INTERVAL '7 days');

  -- 2b. Orders (Last 7D) - created_at >= NOW() - INTERVAL '7 days'
  SELECT COALESCE(COUNT(id), 0)
  INTO v_orders_7d
  FROM public.seller_orders
  WHERE seller_id = p_seller_id
    AND status != 'Cancelled'
    AND created_at >= (NOW() - INTERVAL '7 days');

  -- 2c. Avg Order Value (Last 7D) - created_at >= NOW() - INTERVAL '7 days'
  SELECT COALESCE(ROUND(AVG(seller_total)), 0)
  INTO v_avg_order_value_7d
  FROM public.seller_orders
  WHERE seller_id = p_seller_id
    AND created_at >= (NOW() - INTERVAL '7 days');

  -- 2d. Pending Fulfillment (Last 7D) - status = 'Pending', created_at >= NOW() - INTERVAL '7 days'
  SELECT COALESCE(COUNT(id), 0)
  INTO v_pending_fulfillment_7d
  FROM public.seller_orders
  WHERE seller_id = p_seller_id
    AND status = 'Pending'
    AND created_at >= (NOW() - INTERVAL '7 days');

  -- 2e. New Reviews (Last 7D) - products owned by seller
  SELECT COALESCE(COUNT(r.id), 0)
  INTO v_new_reviews_7d
  FROM public.reviews r
  INNER JOIN public.products p ON p.id = r.product_id
  WHERE p.seller_id = p_seller_id
    AND r.created_at >= (NOW() - INTERVAL '7 days');

  -- 2f. Units Sold (Last 7D) - order_items joined to seller_orders
  SELECT COALESCE(SUM(oi.quantity), 0)
  INTO v_units_sold_7d
  FROM public.order_items oi
  INNER JOIN public.seller_orders so 
    ON oi.order_id = so.order_id 
   AND oi.seller_id = so.seller_id
  WHERE so.seller_id = p_seller_id
    AND so.status IN ('Shipped', 'Delivered')
    AND so.created_at >= (NOW() - INTERVAL '7 days');

  -- Build final JSON result for Phase 1
  v_result := jsonb_build_object(
    'section1_kpis', jsonb_build_object(
      'total_revenue', v_total_revenue,
      'available_payout', v_available_payout,
      'active_listings', v_active_listings,
      'pending_dispatch', v_pending_dispatch,
      'delivered_orders', v_delivered_orders
    ),
    'section2_last_7d', jsonb_build_object(
      'revenue_7d', v_revenue_7d,
      'orders_7d', v_orders_7d,
      'avg_order_value_7d', v_avg_order_value_7d,
      'pending_fulfillment_7d', v_pending_fulfillment_7d,
      'new_reviews_7d', v_new_reviews_7d,
      'units_sold_7d', v_units_sold_7d
    )
  );

  RETURN v_result;
END;
$$;


-- --------------------------------------------------------------------
-- PHASE 2 RPC: get_seller_overview_details(p_seller_id UUID)
-- Returns 5 graphs data + Recent Orders table (LIMIT 3)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_seller_overview_details(p_seller_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_daily_revenue_trajectory JSONB;
  v_daily_order_volume JSONB;
  v_order_status_breakdown JSONB;
  v_top_products_sold JSONB;
  v_payment_method_share JSONB;
  v_recent_orders JSONB;
BEGIN
  -- 1. DAILY REVENUE TRAJECTORY ($) & DAILY ORDER VOLUME
  -- Uses generate_series to guarantee all 7 days appear zero-filled
  WITH days AS (
    SELECT generate_series(
      (CURRENT_DATE - INTERVAL '6 days')::date,
      CURRENT_DATE,
      INTERVAL '1 day'
    )::date AS day_date
  ),
  daily_stats AS (
    SELECT
      d.day_date,
      to_char(d.day_date, 'Mon DD') AS date_label,
      to_char(d.day_date, 'Dy') AS short_day,
      COALESCE(SUM(CASE WHEN so.status IN ('Shipped', 'Delivered') THEN so.seller_total ELSE 0 END), 0) AS revenue,
      COALESCE(COUNT(so.id), 0) AS orders_count
    FROM days d
    LEFT JOIN public.seller_orders so
      ON so.seller_id = p_seller_id
     AND so.created_at::date = d.day_date
    GROUP BY d.day_date
    ORDER BY d.day_date ASC
  )
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'date', date_label,
        'shortDay', short_day,
        'revenue', revenue
      )
    ),
    jsonb_agg(
      jsonb_build_object(
        'date', date_label,
        'shortDay', short_day,
        'orders_count', orders_count
      )
    )
  INTO v_daily_revenue_trajectory, v_daily_order_volume
  FROM daily_stats;

  -- 2. 7-DAY ORDER STATUS BREAKDOWN
  -- Explicitly covers ALL 5 statuses: Pending, Confirmed, Shipped, Delivered, Cancelled
  WITH status_categories AS (
    SELECT unnest(ARRAY['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled']) AS status_name
  ),
  seller_status_counts AS (
    SELECT 
      sc.status_name,
      COALESCE(COUNT(so.id), 0) AS status_count
    FROM status_categories sc
    LEFT JOIN public.seller_orders so
      ON so.status = sc.status_name
     AND so.seller_id = p_seller_id
     AND so.created_at >= (NOW() - INTERVAL '7 days')
    GROUP BY sc.status_name
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'status', status_name,
      'count', status_count
    )
  ) INTO v_order_status_breakdown
  FROM seller_status_counts;

  -- 3. TOP 5 PRODUCTS SOLD (Last 7 Days)
  -- Single joined query: order_items JOIN seller_orders
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_title', product_title,
        'brand', brand,
        'units_sold', units_sold,
        'revenue', total_rev
      )
    ),
    '[]'::jsonb
  ) INTO v_top_products_sold
  FROM (
    SELECT
      oi.product_title,
      COALESCE(oi.brand, 'Designer Brand') AS brand,
      SUM(oi.quantity) AS units_sold,
      SUM(oi.subtotal) AS total_rev
    FROM public.order_items oi
    INNER JOIN public.seller_orders so
      ON so.order_id = oi.order_id
     AND so.seller_id = oi.seller_id
    WHERE so.seller_id = p_seller_id
      AND so.created_at >= (NOW() - INTERVAL '7 days')
    GROUP BY oi.product_title, oi.brand
    ORDER BY units_sold DESC
    LIMIT 5
  ) tp;

  -- 4. PAYMENT METHOD SHARE (COD vs Online)
  -- Single joined query: seller_orders JOIN orders
  WITH payment_counts AS (
    SELECT
      COALESCE(COUNT(CASE WHEN o.payment_method = 'COD' THEN 1 END), 0) AS cod_count,
      COALESCE(COUNT(CASE WHEN o.payment_method = 'Online' THEN 1 END), 0) AS online_count,
      COUNT(so.id) AS total_count
    FROM public.seller_orders so
    INNER JOIN public.orders o ON o.id = so.order_id
    WHERE so.seller_id = p_seller_id
      AND so.created_at >= (NOW() - INTERVAL '7 days')
  )
  SELECT jsonb_build_object(
    'cod', cod_count,
    'online', online_count,
    'cod_pct', CASE WHEN total_count > 0 THEN ROUND((cod_count::numeric / total_count * 100)) ELSE 0 END,
    'online_pct', CASE WHEN total_count > 0 THEN ROUND((online_count::numeric / total_count * 100)) ELSE 0 END
  ) INTO v_payment_method_share
  FROM payment_counts;

  -- 5. SECTION 4 — RECENT ORDERS & DISPATCH STATUS TABLE (LIMIT 3)
  -- Single joined query: seller_orders JOIN orders JOIN order_items
  WITH order_items_summary AS (
    SELECT
      oi.order_id,
      oi.seller_id,
      MIN(oi.brand) AS primary_brand,
      MIN(oi.product_title) AS primary_product,
      COUNT(oi.id) AS total_item_types
    FROM public.order_items oi
    WHERE oi.seller_id = p_seller_id
    GROUP BY oi.order_id, oi.seller_id
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', so.id,
        'order_number', o.order_number,
        'customer_name', o.customer_name,
        'city', o.city,
        'brand', COALESCE(ois.primary_brand, 'Standard Brand'),
        'product_title', CASE 
          WHEN ois.total_item_types > 1 THEN ois.primary_product || ' (+' || (ois.total_item_types - 1)::text || ' more)'
          ELSE ois.primary_product
        END,
        'seller_total', so.seller_total,
        'status', so.status,
        'created_at', so.created_at
      )
    ),
    '[]'::jsonb
  ) INTO v_recent_orders
  FROM (
    SELECT id, order_id, seller_id, seller_total, status, created_at
    FROM public.seller_orders
    WHERE seller_id = p_seller_id
    ORDER BY created_at DESC
    LIMIT 3
  ) so
  INNER JOIN public.orders o ON o.id = so.order_id
  LEFT JOIN order_items_summary ois 
    ON ois.order_id = so.order_id 
   AND ois.seller_id = so.seller_id;

  -- Build final JSON result for Phase 2
  v_result := jsonb_build_object(
    'graphs', jsonb_build_object(
      'daily_revenue_trajectory', v_daily_revenue_trajectory,
      'daily_order_volume', v_daily_order_volume,
      'order_status_breakdown', v_order_status_breakdown,
      'top_products_sold', v_top_products_sold,
      'payment_method_share', v_payment_method_share
    ),
    'recent_orders', v_recent_orders
  );

  RETURN v_result;
END;
$$;

-- =========================================================
-- SUPABASE RPC MIGRATION FOR SELLER LAST 7 DAYS ANALYTICS
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_seller_last_7_days(p_seller_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_daily_breakdown JSONB;
  v_summary_kpis JSONB;
  v_top_products JSONB;
  v_payment_method_split JSONB;
BEGIN
  -- 1. Generate 7 daily breakdown buckets (current_date - 6 days to current_date)
  WITH days AS (
    SELECT generate_series(
      (CURRENT_DATE - INTERVAL '6 days')::date,
      CURRENT_DATE,
      INTERVAL '1 day'
    )::date AS day_date
  ),
  daily_items AS (
    SELECT
      d.day_date,
      COALESCE(SUM(oi.subtotal), 0) AS revenue,
      COUNT(DISTINCT oi.order_id) AS orders_count,
      COALESCE(SUM(oi.quantity), 0) AS units_sold,
      COUNT(CASE WHEN so.status = 'Pending' THEN 1 END) AS count_pending,
      COUNT(CASE WHEN so.status = 'Confirmed' THEN 1 END) AS count_confirmed,
      COUNT(CASE WHEN so.status = 'Processing' THEN 1 END) AS count_processing,
      COUNT(CASE WHEN so.status = 'Shipped' THEN 1 END) AS count_shipped,
      COUNT(CASE WHEN so.status = 'Delivered' THEN 1 END) AS count_delivered,
      COUNT(CASE WHEN so.status = 'Cancelled' THEN 1 END) AS count_cancelled,
      COUNT(DISTINCT CASE WHEN o.payment_method = 'COD' THEN oi.order_id END) AS cod_orders,
      COUNT(DISTINCT CASE WHEN o.payment_method = 'Online' THEN oi.order_id END) AS online_orders
    FROM days d
    LEFT JOIN public.order_items oi
      ON oi.seller_id = p_seller_id
     AND oi.created_at::date = d.day_date
    LEFT JOIN public.orders o
      ON o.id = oi.order_id
    LEFT JOIN public.seller_orders so
      ON so.order_id = oi.order_id
     AND so.seller_id = p_seller_id
    GROUP BY d.day_date
    ORDER BY d.day_date ASC
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', to_char(day_date, 'Mon DD'),
      'shortDay', to_char(day_date, 'Dy'),
      'revenue', revenue,
      'orders_count', orders_count,
      'units_sold', units_sold,
      'order_status', jsonb_build_object(
        'pending', count_pending,
        'confirmed', count_confirmed,
        'processing', count_processing,
        'shipped', count_shipped,
        'delivered', count_delivered,
        'cancelled', count_cancelled
      ),
      'payment_method', jsonb_build_object(
        'cod', cod_orders,
        'online', online_orders
      )
    )
  ) INTO v_daily_breakdown
  FROM daily_items;

  -- 2. Calculate summary KPIs
  WITH curr_window AS (
    SELECT
      COALESCE(SUM(oi.subtotal), 0) AS rev,
      COUNT(DISTINCT oi.order_id) AS ord_cnt,
      COALESCE(SUM(oi.quantity), 0) AS units
    FROM public.order_items oi
    WHERE oi.seller_id = p_seller_id
      AND oi.created_at >= (NOW() - INTERVAL '7 days')
  ),
  prev_window AS (
    SELECT
      COALESCE(SUM(oi.subtotal), 0) AS rev,
      COUNT(DISTINCT oi.order_id) AS ord_cnt
    FROM public.order_items oi
    WHERE oi.seller_id = p_seller_id
      AND oi.created_at >= (NOW() - INTERVAL '14 days')
      AND oi.created_at < (NOW() - INTERVAL '7 days')
  ),
  pending_queue AS (
    SELECT COUNT(id) AS cnt
    FROM public.seller_orders
    WHERE seller_id = p_seller_id
      AND status IN ('Pending', 'Confirmed', 'Processing')
  ),
  reviews_stats AS (
    SELECT
      COUNT(CASE WHEN r.created_at >= (NOW() - INTERVAL '7 days') THEN 1 END) AS new_cnt,
      COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0.0) AS avg_rat
    FROM public.reviews r
    INNER JOIN public.products p ON p.id = r.product_id
    WHERE p.seller_id = p_seller_id
      AND r.status = 'Approved'
  )
  SELECT jsonb_build_object(
    'total_revenue', c.rev,
    'previous_7_days_revenue', pr.rev,
    'total_orders_count', c.ord_cnt,
    'previous_7_days_orders_count', pr.ord_cnt,
    'average_order_value', CASE WHEN c.ord_cnt > 0 THEN ROUND(c.rev / c.ord_cnt) ELSE 0 END,
    'revenue_trend_pct', CASE WHEN pr.rev > 0 THEN ROUND(((c.rev - pr.rev) / pr.rev * 100)::numeric, 1) ELSE 0 END,
    'orders_trend_pct', CASE WHEN pr.ord_cnt > 0 THEN ROUND(((c.ord_cnt - pr.ord_cnt)::numeric / pr.ord_cnt * 100)::numeric, 1) ELSE 0 END,
    'units_sold', c.units,
    'pending_fulfillment_count', pq.cnt,
    'new_reviews_count', r.new_cnt,
    'average_rating', r.avg_rat
  ) INTO v_summary_kpis
  FROM curr_window c, prev_window pr, pending_queue pq, reviews_stats r;

  -- 3. Top 5 Products Sold in 7 Days
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_title', product_title,
        'brand', brand,
        'units_sold', total_units,
        'revenue', total_rev
      )
    ),
    '[]'::jsonb
  ) INTO v_top_products
  FROM (
    SELECT
      oi.product_title,
      oi.brand,
      SUM(oi.quantity) AS total_units,
      SUM(oi.subtotal) AS total_rev
    FROM public.order_items oi
    WHERE oi.seller_id = p_seller_id
      AND oi.created_at >= (NOW() - INTERVAL '7 days')
    GROUP BY oi.product_title, oi.brand
    ORDER BY total_units DESC
    LIMIT 5
  ) tp;

  -- 4. Payment Method Split
  WITH pay_split AS (
    SELECT
      COUNT(DISTINCT CASE WHEN o.payment_method = 'COD' THEN oi.order_id END) AS cod_cnt,
      COUNT(DISTINCT CASE WHEN o.payment_method = 'Online' THEN oi.order_id END) AS online_cnt
    FROM public.order_items oi
    INNER JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.seller_id = p_seller_id
      AND oi.created_at >= (NOW() - INTERVAL '7 days')
  )
  SELECT jsonb_build_object(
    'cod', cod_cnt,
    'online', online_cnt,
    'cod_pct', CASE WHEN (cod_cnt + online_cnt) > 0 THEN ROUND((cod_cnt::numeric / (cod_cnt + online_cnt) * 100)) ELSE 0 END,
    'online_pct', CASE WHEN (cod_cnt + online_cnt) > 0 THEN ROUND((online_cnt::numeric / (cod_cnt + online_cnt) * 100)) ELSE 0 END
  ) INTO v_payment_method_split
  FROM pay_split;

  -- Combine into final JSON result
  v_result := jsonb_build_object(
    'dateRangeLabel', to_char(NOW() - INTERVAL '6 days', 'Mon DD') || ' - ' || to_char(NOW(), 'Mon DD, YYYY'),
    'daily_breakdown', v_daily_breakdown,
    'summary_kpis', v_summary_kpis,
    'top_products', v_top_products,
    'payment_method_split', v_payment_method_split
  );

  RETURN v_result;
END;
$$;

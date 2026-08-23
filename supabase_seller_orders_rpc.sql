-- =========================================================
-- SELLER ORDERS MANAGEMENT RLS POLICIES & SINGLE-JOIN RPC FUNCTIONS
-- =========================================================

-- ---------------------------------------------------------
-- 0. SCHEMA MIGRATION FOR COURIER & DISPATCH TIMESTAMPS
-- ---------------------------------------------------------
ALTER TABLE public.seller_orders
  ADD COLUMN IF NOT EXISTS courier_name TEXT,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- ---------------------------------------------------------
-- 1. ROW LEVEL SECURITY (RLS) POLICIES
-- ---------------------------------------------------------

-- Enable RLS on seller_orders
ALTER TABLE public.seller_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seller_orders_seller_policy ON public.seller_orders;
CREATE POLICY seller_orders_seller_policy ON public.seller_orders
  FOR ALL
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- Enable RLS on order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_items_seller_policy ON public.order_items;
CREATE POLICY order_items_seller_policy ON public.order_items
  FOR ALL
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- Enable RLS on orders (sellers can view parent orders that contain their items)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_seller_read_policy ON public.orders;
CREATE POLICY orders_seller_read_policy ON public.orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.seller_orders
      WHERE seller_orders.order_id = orders.id
      AND seller_orders.seller_id = auth.uid()
    ) OR (user_id IS NOT NULL AND user_id = auth.uid())
  );

-- ---------------------------------------------------------
-- 2. GET SELLER ORDERS TABLE LIST (SINGLE JOIN & SERVER-SIDE AGGREGATION)
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_seller_orders(
  p_seller_id UUID,
  p_status_filter TEXT DEFAULT 'Actionable',
  p_search TEXT DEFAULT '',
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 10,
  p_sort_by TEXT DEFAULT 'created_at',
  p_sort_order TEXT DEFAULT 'desc'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset INT;
  v_total_count INT;
  v_orders JSONB;
BEGIN
  v_offset := (GREATEST(p_page, 1) - 1) * p_page_size;

  -- 1. Calculate total count for pagination
  SELECT COUNT(DISTINCT so.id) INTO v_total_count
  FROM public.seller_orders so
  INNER JOIN public.orders o ON so.order_id = o.id
  WHERE so.seller_id = p_seller_id
    AND (
      CASE
        WHEN LOWER(p_status_filter) = 'actionable' THEN so.status IN ('Pending', 'Processing', 'Shipped')
        WHEN LOWER(p_status_filter) = 'all' THEN TRUE
        ELSE so.status = p_status_filter
      END
    )
    AND (
      p_search IS NULL OR p_search = '' OR (
        o.order_number ILIKE '%' || p_search || '%' OR
        o.customer_name ILIKE '%' || p_search || '%'
      )
    );

  -- 2. Fetch aggregated rows joining seller_orders, orders, and order_items
  SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) INTO v_orders
  FROM (
    SELECT 
      so.id AS seller_order_id,
      so.order_id,
      so.seller_id,
      so.seller_total,
      so.status AS seller_order_status,
      so.courier_name,
      so.tracking_number,
      so.shipped_at,
      so.delivered_at,
      so.created_at AS order_created_at,
      so.updated_at AS order_updated_at,
      o.order_number,
      o.customer_name,
      o.customer_phone,
      o.city,
      o.payment_method,
      o.payment_status,
      COALESCE(SUM(oi.quantity), 0)::INT AS total_items_qty,
      STRING_AGG(CONCAT(oi.product_title, ' ×', oi.quantity), ', ') AS aggregated_items
    FROM public.seller_orders so
    INNER JOIN public.orders o ON so.order_id = o.id
    INNER JOIN public.order_items oi ON oi.order_id = so.order_id AND oi.seller_id = so.seller_id
    WHERE so.seller_id = p_seller_id
      AND (
        CASE
          WHEN LOWER(p_status_filter) = 'actionable' THEN so.status IN ('Pending', 'Processing', 'Shipped')
          WHEN LOWER(p_status_filter) = 'all' THEN TRUE
          ELSE so.status = p_status_filter
        END
      )
      AND (
        p_search IS NULL OR p_search = '' OR (
          o.order_number ILIKE '%' || p_search || '%' OR
          o.customer_name ILIKE '%' || p_search || '%'
        )
      )
    GROUP BY so.id, o.id
    ORDER BY 
      CASE WHEN LOWER(p_sort_by) = 'seller_total' AND LOWER(p_sort_order) = 'asc' THEN so.seller_total END ASC,
      CASE WHEN LOWER(p_sort_by) = 'seller_total' AND LOWER(p_sort_order) = 'desc' THEN so.seller_total END DESC,
      CASE WHEN LOWER(p_sort_by) = 'created_at' AND LOWER(p_sort_order) = 'asc' THEN so.created_at END ASC,
      CASE WHEN LOWER(p_sort_by) = 'created_at' AND LOWER(p_sort_order) = 'desc' THEN so.created_at END DESC,
      so.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset
  ) row_data;

  RETURN jsonb_build_object(
    'total_count', COALESCE(v_total_count, 0),
    'page', p_page,
    'page_size', p_page_size,
    'orders', v_orders
  );
END;
$$;

-- ---------------------------------------------------------
-- 3. GET SELLER ORDER FULL DETAIL (MODAL DATA)
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_seller_order_detail(
  p_seller_id UUID,
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_so RECORD;
  v_o RECORD;
  v_items JSONB;
BEGIN
  -- Fetch seller_order row
  SELECT * INTO v_so
  FROM public.seller_orders
  WHERE order_id = p_order_id AND seller_id = p_seller_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or unauthorized for this seller.';
  END IF;

  -- Fetch main order row
  SELECT * INTO v_o
  FROM public.orders
  WHERE id = p_order_id;

  -- Fetch order_items belonging to this seller
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', oi.id,
      'product_id', oi.product_id,
      'product_title', oi.product_title,
      'brand', oi.brand,
      'quantity', oi.quantity,
      'price', oi.price,
      'subtotal', oi.subtotal,
      'created_at', oi.created_at
    )
  ), '[]'::jsonb) INTO v_items
  FROM public.order_items oi
  WHERE oi.order_id = p_order_id AND oi.seller_id = p_seller_id;

  RETURN jsonb_build_object(
    'seller_order_id', v_so.id,
    'order_id', v_o.id,
    'order_number', v_o.order_number,
    'seller_id', v_so.seller_id,
    'status', v_so.status,
    'seller_total', v_so.seller_total,
    'courier_name', v_so.courier_name,
    'tracking_number', v_so.tracking_number,
    'shipped_at', v_so.shipped_at,
    'delivered_at', v_so.delivered_at,
    'created_at', v_so.created_at,
    'updated_at', v_so.updated_at,
    'customer', jsonb_build_object(
      'user_id', v_o.user_id,
      'is_registered', (v_o.user_id IS NOT NULL),
      'name', v_o.customer_name,
      'email', v_o.customer_email,
      'phone', v_o.customer_phone
    ),
    'shipping', jsonb_build_object(
      'address', v_o.shipping_address,
      'city', v_o.city,
      'postal_code', v_o.postal_code
    ),
    'payment', jsonb_build_object(
      'method', v_o.payment_method,
      'status', v_o.payment_status,
      'seller_total', v_so.seller_total
    ),
    'items', v_items
  );
END;
$$;

-- ---------------------------------------------------------
-- 4. UPDATE SELLER ORDER STATUS INLINE WITH COURIER DETAILS & DISPATCH TIMESTAMPS
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_seller_order_status(
  p_seller_order_id UUID,
  p_seller_id UUID,
  p_new_status TEXT,
  p_courier_name TEXT DEFAULT NULL,
  p_tracking_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_valid_statuses TEXT[] := ARRAY['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
  v_updated_at TIMESTAMPTZ := NOW();
  v_curr_shipped_at TIMESTAMPTZ;
  v_count INT;
BEGIN
  -- Validate status enum value
  IF NOT (p_new_status = ANY(v_valid_statuses)) THEN
    RAISE EXCEPTION 'Invalid status "%". Allowed values: Pending, Confirmed, Processing, Shipped, Delivered, Cancelled', p_new_status;
  END IF;

  -- Get current shipped_at timestamp to check edge-case backfilling
  SELECT shipped_at INTO v_curr_shipped_at
  FROM public.seller_orders
  WHERE id = p_seller_order_id AND seller_id = p_seller_id;

  IF p_new_status = 'Shipped' THEN
    UPDATE public.seller_orders
    SET status = p_new_status,
        courier_name = COALESCE(p_courier_name, courier_name),
        tracking_number = COALESCE(p_tracking_number, tracking_number),
        shipped_at = v_updated_at,
        updated_at = v_updated_at
    WHERE id = p_seller_order_id AND seller_id = p_seller_id;

  ELSIF p_new_status = 'Delivered' THEN
    UPDATE public.seller_orders
    SET status = p_new_status,
        courier_name = COALESCE(p_courier_name, courier_name),
        tracking_number = COALESCE(p_tracking_number, tracking_number),
        delivered_at = v_updated_at,
        shipped_at = CASE WHEN v_curr_shipped_at IS NULL THEN v_updated_at ELSE v_curr_shipped_at END,
        updated_at = v_updated_at
    WHERE id = p_seller_order_id AND seller_id = p_seller_id;

  ELSE
    UPDATE public.seller_orders
    SET status = p_new_status,
        updated_at = v_updated_at
    WHERE id = p_seller_order_id AND seller_id = p_seller_id;
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Update failed: Seller order #% not found or access denied for seller %', p_seller_order_id, p_seller_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'seller_order_id', p_seller_order_id,
    'status', p_new_status,
    'updated_at', v_updated_at
  );
END;
$$;

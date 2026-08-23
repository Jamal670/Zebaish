-- =========================================================
-- MIGRATION FOR GUEST CHECKOUT & POSTAL CODE & ATOMIC ORDER CREATION RPC
-- =========================================================

-- 1. Make orders.user_id nullable to support Guest Checkout
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add postal_code column to public.orders and size column to order_items if not exist
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS postal_code VARCHAR(50);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS size VARCHAR(50);

-- 3. Create RPC function for Atomic Order Creation with Stock Locking & Variant Support
CREATE OR REPLACE FUNCTION public.create_checkout_order(
  p_order_number VARCHAR(50),
  p_user_id UUID,
  p_customer_name VARCHAR(255),
  p_customer_email VARCHAR(255),
  p_customer_phone VARCHAR(50),
  p_shipping_address TEXT,
  p_city VARCHAR(100),
  p_postal_code VARCHAR(50),
  p_payment_method VARCHAR(30),
  p_payment_status VARCHAR(30),
  p_order_status VARCHAR(30),
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_total_amount DECIMAL(12, 2) := 0;
  v_item RECORD;
  v_product RECORD;
  v_variant RECORD;
  v_seller_id UUID;
  v_unit_price DECIMAL(12, 2);
  v_item_subtotal DECIMAL(12, 2);
  v_seller_totals JSONB := '{}'::jsonb;
  v_seller_key TEXT;
  v_curr_total DECIMAL(12, 2);
  v_cart_id UUID;
  v_avail_stock INT;
  v_size_name TEXT;
BEGIN
  -- A. Pre-check stock & lock rows for all requested items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    product_id UUID,
    size TEXT,
    quantity INT
  )
  LOOP
    SELECT * INTO v_product FROM public.products WHERE id = v_item.product_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', v_item.product_id;
    END IF;

    IF v_product.status IS NOT NULL AND v_product.status <> 'Active' THEN
      RAISE EXCEPTION 'Product "%" is currently unavailable (% status).', v_product.suit_title, v_product.status;
    END IF;

    v_size_name := COALESCE(v_item.size, 'Unstitched');
    v_avail_stock := 0;

    -- Check if matching variant exists
    SELECT * INTO v_variant FROM public.product_variants
    WHERE product_id = v_item.product_id
      AND (LOWER(size) = LOWER(v_size_name) OR (v_size_name = 'Unstitched' AND LOWER(size) = 'unstitched'))
    FOR UPDATE;

    IF FOUND THEN
      v_avail_stock := v_variant.quantity;
    ELSE
      SELECT * INTO v_variant FROM public.product_variants
      WHERE product_id = v_item.product_id
      LIMIT 1 FOR UPDATE;
      IF FOUND THEN
        v_avail_stock := v_variant.quantity;
      END IF;
    END IF;

    IF v_avail_stock < v_item.quantity THEN
      RAISE EXCEPTION 'Only % left for "%" (%), but you requested %.',
        v_avail_stock, v_product.suit_title, v_size_name, v_item.quantity;
    END IF;
  END LOOP;

  -- B. Insert main order record
  INSERT INTO public.orders (
    order_number,
    user_id,
    customer_name,
    customer_email,
    customer_phone,
    shipping_address,
    city,
    postal_code,
    total_amount,
    payment_method,
    payment_status,
    order_status
  ) VALUES (
    p_order_number,
    p_user_id,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_shipping_address,
    p_city,
    COALESCE(p_postal_code, '00000'),
    0,
    p_payment_method,
    p_payment_status,
    p_order_status
  ) RETURNING id INTO v_order_id;

  -- C. Process order items using original_retail_price as THE primary price
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    product_id UUID,
    size TEXT,
    quantity INT
  )
  LOOP
    SELECT * INTO v_product FROM public.products WHERE id = v_item.product_id;
    v_seller_id := v_product.seller_id;
    v_size_name := COALESCE(v_item.size, 'Unstitched');
    
    -- Price calculation rule: original_retail_price primary, surplus_selling_price fallback
    v_unit_price := COALESCE(v_product.original_retail_price, v_product.surplus_selling_price, 0);
    v_item_subtotal := v_unit_price * v_item.quantity;
    v_total_amount := v_total_amount + v_item_subtotal;

    -- Insert into order_items
    INSERT INTO public.order_items (
      order_id,
      product_id,
      seller_id,
      product_title,
      brand,
      size,
      quantity,
      price,
      subtotal
    ) VALUES (
      v_order_id,
      v_product.id,
      v_seller_id,
      v_product.suit_title,
      v_product.brand,
      v_size_name,
      v_item.quantity,
      v_unit_price,
      v_item_subtotal
    );

    -- Aggregate seller totals
    v_seller_key := v_seller_id::text;
    v_curr_total := COALESCE((v_seller_totals->>v_seller_key)::numeric, 0);
    v_seller_totals := jsonb_set(v_seller_totals, ARRAY[v_seller_key], to_jsonb(v_curr_total + v_item_subtotal));

    -- Deduct variant stock if variant exists
    UPDATE public.product_variants
    SET quantity = GREATEST(0, quantity - v_item.quantity),
        updated_at = NOW()
    WHERE product_id = v_product.id
      AND (LOWER(size) = LOWER(v_size_name) OR (v_size_name = 'Unstitched' AND LOWER(size) = 'unstitched'));

    -- Update product status if all variants are sold out
    IF NOT EXISTS (
      SELECT 1 FROM public.product_variants
      WHERE product_id = v_product.id AND quantity > 0
    ) THEN
      UPDATE public.products
      SET status = 'Sold Out',
          updated_at = NOW()
      WHERE id = v_product.id;
    END IF;
  END LOOP;

  -- D. Insert seller_orders records for each distinct seller
  FOR v_seller_key IN SELECT jsonb_object_keys(v_seller_totals)
  LOOP
    INSERT INTO public.seller_orders (
      order_id,
      seller_id,
      seller_total,
      status,
      payment_status
    ) VALUES (
      v_order_id,
      v_seller_key::uuid,
      (v_seller_totals->>v_seller_key)::numeric,
      'Pending',
      'Pending'
    );
  END LOOP;

  -- E. Update order final total_amount
  UPDATE public.orders
  SET total_amount = v_total_amount,
      updated_at = NOW()
  WHERE id = v_order_id;

  -- F. Clear DB cart_items for logged-in user
  IF p_user_id IS NOT NULL THEN
    SELECT id INTO v_cart_id FROM public.carts WHERE user_id = p_user_id;
    IF v_cart_id IS NOT NULL THEN
      FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID)
      LOOP
        DELETE FROM public.cart_items WHERE cart_id = v_cart_id AND product_id = v_item.product_id;
      END LOOP;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', p_order_number,
    'total_amount', v_total_amount
  );
END;
$$;

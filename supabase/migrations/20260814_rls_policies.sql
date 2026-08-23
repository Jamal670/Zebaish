-- Migration: Row Level Security (RLS) Policies for Zebaish Marketplace
-- Enforces database-level authorization for sellers, customers, products, orders, carts, wishlists, and reviews

-- =========================================================
-- 1. SELLERS TABLE RLS
-- =========================================================
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers view own profile" ON public.sellers;
CREATE POLICY "Sellers view own profile"
  ON public.sellers FOR SELECT
  USING (auth.uid() = id OR status = 'Active');

DROP POLICY IF EXISTS "Sellers update own profile" ON public.sellers;
CREATE POLICY "Sellers update own profile"
  ON public.sellers FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Sellers insert own profile" ON public.sellers;
CREATE POLICY "Sellers insert own profile"
  ON public.sellers FOR INSERT
  WITH CHECK (auth.uid() = id);

-- =========================================================
-- 2. USERS TABLE RLS
-- =========================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own profile" ON public.users;
CREATE POLICY "Users view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON public.users;
CREATE POLICY "Users update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users insert own profile" ON public.users;
CREATE POLICY "Users insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- =========================================================
-- 3. PRODUCTS TABLE RLS
-- =========================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active products" ON public.products;
CREATE POLICY "Public read active products"
  ON public.products FOR SELECT
  USING (is_deactivated IS NOT TRUE OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Sellers manage own products" ON public.products;
CREATE POLICY "Sellers manage own products"
  ON public.products FOR ALL
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- =========================================================
-- 4. ORDERS & ORDER ITEMS RLS
-- =========================================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers view own orders" ON public.orders;
CREATE POLICY "Customers view own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers insert own orders" ON public.orders;
CREATE POLICY "Customers insert own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers view own order_items" ON public.order_items;
CREATE POLICY "Customers view own order_items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
    OR auth.uid() = seller_id
  );

DROP POLICY IF EXISTS "Customers insert order_items" ON public.order_items;
CREATE POLICY "Customers insert order_items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- =========================================================
-- 5. CARTS & CART ITEMS RLS
-- =========================================================
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers manage own cart" ON public.carts;
CREATE POLICY "Customers manage own cart"
  ON public.carts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers manage own cart items" ON public.cart_items;
CREATE POLICY "Customers manage own cart items"
  ON public.cart_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.carts
      WHERE carts.id = cart_items.cart_id
      AND carts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.carts
      WHERE carts.id = cart_items.cart_id
      AND carts.user_id = auth.uid()
    )
  );

-- =========================================================
-- 6. WISHLISTS & WISHLIST ITEMS RLS
-- =========================================================
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers manage own wishlist" ON public.wishlists;
CREATE POLICY "Customers manage own wishlist"
  ON public.wishlists FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers manage own wishlist items" ON public.wishlist_items;
CREATE POLICY "Customers manage own wishlist items"
  ON public.wishlist_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.wishlists
      WHERE wishlists.id = wishlist_items.wishlist_id
      AND wishlists.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.wishlists
      WHERE wishlists.id = wishlist_items.wishlist_id
      AND wishlists.user_id = auth.uid()
    )
  );

-- =========================================================
-- 7. REVIEWS RLS
-- =========================================================
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read reviews" ON public.reviews;
CREATE POLICY "Public read reviews"
  ON public.reviews FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Customers insert own reviews" ON public.reviews;
CREATE POLICY "Customers insert own reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
  );

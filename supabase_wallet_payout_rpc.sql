-- ====================================================================
-- SELLER WALLET & PAYOUT SYSTEM (COMMISSION MONTHLY CYCLE SCHEMA)
-- RLS POLICIES, INDEXES & RPC TRANSACTIONS
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. DATABASE SCHEMA & TABLES
-- --------------------------------------------------------------------

-- 1A. Monthly Commission Cycles Table
CREATE TABLE IF NOT EXISTS public.seller_commission_monthly_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL CHECK (year >= 2020),
  gross_amount NUMERIC NOT NULL DEFAULT 0,
  commission_percentage NUMERIC(5,2) DEFAULT 5.00,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  commission_paid NUMERIC NOT NULL DEFAULT 0,
  commission_remaining NUMERIC NOT NULL DEFAULT 0,
  pending_amount NUMERIC DEFAULT 0,
  confirmed_amount NUMERIC DEFAULT 0,
  shipped_amount NUMERIC DEFAULT 0,
  delivered_amount NUMERIC DEFAULT 0,
  cancelled_amount NUMERIC DEFAULT 0,
  due_date TIMESTAMPTZ NULL,
  extended_date TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (status IN ('Unpaid', 'Partially Paid', 'Paid', 'Overdue')),
  closed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_seller_month_year UNIQUE (seller_id, month, year)
);

-- 1B. Seller Payments Table
CREATE TABLE IF NOT EXISTS public.seller_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL,
  gross_amount NUMERIC NOT NULL,
  commission_percentage NUMERIC(5,2) DEFAULT 5.00,
  commission_amount NUMERIC NOT NULL,
  net_amount NUMERIC NOT NULL,
  payment_method TEXT DEFAULT 'Online',
  transaction_reference TEXT NULL,
  receipt_image TEXT NOT NULL,
  notes TEXT NULL,
  status TEXT NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Pending', 'Submitted', 'Verified', 'Rejected')),
  commission_cycle_id UUID NULL REFERENCES public.seller_commission_monthly_cycles(id) ON DELETE SET NULL,
  verified_by UUID NULL,
  verified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1C. Commission Cycle Order Items Junction Table
CREATE TABLE IF NOT EXISTS public.seller_commission_cycle_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES public.seller_commission_monthly_cycles(id) ON DELETE CASCADE,
  seller_order_id UUID NOT NULL REFERENCES public.seller_orders(id) ON DELETE CASCADE,
  gross_amount NUMERIC NOT NULL,
  commission_percentage NUMERIC(5,2) DEFAULT 5.00,
  commission_amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY (RLS) POLICIES
-- --------------------------------------------------------------------
ALTER TABLE public.seller_commission_monthly_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_commission_cycle_items ENABLE ROW LEVEL SECURITY;

-- 2A. Monthly Cycles Policy (Seller can only view own cycles)
DO $$ BEGIN
  DROP POLICY IF EXISTS seller_cycles_seller_policy ON public.seller_commission_monthly_cycles;
  CREATE POLICY seller_cycles_seller_policy ON public.seller_commission_monthly_cycles
    FOR ALL USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2B. Seller Payments Policy (Seller can only view/insert own payments)
DO $$ BEGIN
  DROP POLICY IF EXISTS seller_payments_seller_policy ON public.seller_payments;
  CREATE POLICY seller_payments_seller_policy ON public.seller_payments
    FOR ALL USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2C. Cycle Items Policy (Seller can only view cycle items linked to own cycles)
DO $$ BEGIN
  DROP POLICY IF EXISTS seller_cycle_items_seller_policy ON public.seller_commission_cycle_items;
  CREATE POLICY seller_cycle_items_seller_policy ON public.seller_commission_cycle_items
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.seller_commission_monthly_cycles c
        WHERE c.id = seller_commission_cycle_items.cycle_id AND c.seller_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --------------------------------------------------------------------
-- 3. SUPPORTING INDEXES
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_cycles_seller_month_year ON public.seller_commission_monthly_cycles (seller_id, month, year);
CREATE INDEX IF NOT EXISTS idx_seller_payments_seller_created ON public.seller_payments (seller_id, created_at);
CREATE INDEX IF NOT EXISTS idx_seller_payments_cycle_id ON public.seller_payments (commission_cycle_id);
CREATE INDEX IF NOT EXISTS idx_cycle_items_cycle_id ON public.seller_commission_cycle_items (cycle_id);

-- --------------------------------------------------------------------
-- 4. SHARED HELPER FUNCTION — PREVIOUS CALENDAR MONTH & YEAR NUMBERS
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_previous_month_year(p_date TIMESTAMPTZ DEFAULT NOW())
RETURNS TABLE (prev_month INT, prev_year INT)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_curr_month INT;
  v_curr_year INT;
BEGIN
  v_curr_month := EXTRACT(MONTH FROM p_date)::INT;
  v_curr_year := EXTRACT(YEAR FROM p_date)::INT;

  IF v_curr_month = 1 THEN
    RETURN QUERY SELECT 12, v_curr_year - 1;
  ELSE
    RETURN QUERY SELECT v_curr_month - 1, v_curr_year;
  END IF;
END;
$$;

-- --------------------------------------------------------------------
-- 5. QUERY 1 — WALLET SUMMARY & CURRENT PAYABLE CYCLE (COMBINED SINGLE FETCH)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_seller_wallet_kpis(p_seller_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_sales NUMERIC := 0;
  v_prev_month INT;
  v_prev_year INT;
  v_current_cycle JSONB := NULL;
  v_cycle_id UUID := NULL;
  v_remaining_commission NUMERIC := 0;
  v_submitted_payments NUMERIC := 0;
  v_verified_payments NUMERIC := 0;
  v_cycle_rec RECORD;
  v_order_gross NUMERIC := 0;
  v_order_comm NUMERIC := 0;
BEGIN
  -- 1st KPI Card — Total Sales / Gross Amount: sum gross_amount across all matching seller records in seller_commission_monthly_cycles
  SELECT COALESCE(SUM(gross_amount), 0) INTO v_total_sales
  FROM public.seller_commission_monthly_cycles
  WHERE seller_id = p_seller_id;

  -- Compute Previous Calendar Month & Year as numbers
  SELECT prev_month, prev_year INTO v_prev_month, v_prev_year
  FROM public.get_previous_month_year(NOW());

  -- 2nd KPI Card — Remaining Commission: lookup previous month & year record
  SELECT
    id,
    month,
    year,
    gross_amount,
    commission_percentage,
    commission_amount,
    commission_paid,
    commission_remaining,
    due_date,
    extended_date,
    status
  INTO v_cycle_rec
  FROM public.seller_commission_monthly_cycles
  WHERE seller_id = p_seller_id
    AND month = v_prev_month
    AND year = v_prev_year;

  IF FOUND THEN
    v_cycle_id := v_cycle_rec.id;
    v_remaining_commission := COALESCE(v_cycle_rec.commission_remaining, 0);

    v_current_cycle := jsonb_build_object(
      'id', v_cycle_rec.id,
      'month', v_cycle_rec.month,
      'year', v_cycle_rec.year,
      'gross_amount', v_cycle_rec.gross_amount,
      'commission_percentage', v_cycle_rec.commission_percentage,
      'commission_amount', v_cycle_rec.commission_amount,
      'commission_paid', v_cycle_rec.commission_paid,
      'commission_remaining', v_cycle_rec.commission_remaining,
      'due_date', v_cycle_rec.due_date,
      'extended_date', v_cycle_rec.extended_date,
      'status', v_cycle_rec.status
    );
  ELSE
    -- Fallback logic if cycle record does not exist in db yet
    SELECT COALESCE(SUM(seller_total), 0) INTO v_order_gross
    FROM public.seller_orders
    WHERE seller_id = p_seller_id
      AND status IN ('Shipped', 'Delivered');

    v_order_comm := v_order_gross * 0.05;
    v_remaining_commission := v_order_comm;

    v_current_cycle := jsonb_build_object(
      'id', NULL,
      'month', v_prev_month,
      'year', v_prev_year,
      'gross_amount', v_order_gross,
      'commission_percentage', 5.00,
      'commission_amount', v_order_comm,
      'commission_paid', 0,
      'commission_remaining', v_order_comm,
      'due_date', (DATE_TRUNC('month', NOW()) + INTERVAL '14 days'),
      'extended_date', NULL,
      'status', 'Unpaid'
    );
  END IF;

  -- 3rd KPI Card — Submitted Payments: SUM of net_amount from seller_payments where status = 'Submitted' & cycle_id matches
  IF v_cycle_id IS NOT NULL THEN
    SELECT COALESCE(SUM(net_amount), 0) INTO v_submitted_payments
    FROM public.seller_payments
    WHERE seller_id = p_seller_id
      AND commission_cycle_id = v_cycle_id
      AND status = 'Submitted';

    -- 4th KPI Card — Verified Payments: SUM of net_amount from seller_payments where status = 'Verified' & cycle_id matches
    SELECT COALESCE(SUM(net_amount), 0) INTO v_verified_payments
    FROM public.seller_payments
    WHERE seller_id = p_seller_id
      AND commission_cycle_id = v_cycle_id
      AND status = 'Verified';
  ELSE
    SELECT COALESCE(SUM(net_amount), 0) INTO v_submitted_payments
    FROM public.seller_payments
    WHERE seller_id = p_seller_id AND status = 'Submitted';

    SELECT COALESCE(SUM(net_amount), 0) INTO v_verified_payments
    FROM public.seller_payments
    WHERE seller_id = p_seller_id AND status = 'Verified';
  END IF;

  RETURN jsonb_build_object(
    'total_sales', v_total_sales,
    'remaining_commission', v_remaining_commission,
    'submitted_payments', v_submitted_payments,
    'verified_payments', v_verified_payments,
    'total_available_payout', v_total_sales,
    'current_cycle', v_current_cycle
  );
END;
$$;

-- --------------------------------------------------------------------
-- 6. ACTION — ATOMIC POSTGRES TRANSACTION FOR COMMISSION VERIFICATION SUBMIT
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_seller_commission_verification(
  p_seller_id UUID,
  p_paid_amount NUMERIC,
  p_receipt_image TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prev_month INT;
  v_prev_year INT;
  v_cycle_id UUID;
  v_gross_amount NUMERIC := 0;
  v_commission_amount NUMERIC := 0;
  v_commission_paid NUMERIC := 0;
  v_commission_remaining NUMERIC := 0;
  v_new_commission_paid NUMERIC := 0;
  v_new_status TEXT := 'Unpaid';
  v_payment_id UUID;
  v_due_date TIMESTAMPTZ;
BEGIN
  IF p_paid_amount IS NULL OR p_paid_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid paid commission amount.';
  END IF;

  -- Compute Previous Month/Year server-side
  SELECT prev_month, prev_year INTO v_prev_month, v_prev_year
  FROM public.get_previous_month_year(NOW());

  -- STEP 1: Re-fetch the target cycle row fresh server-side
  SELECT id, gross_amount, commission_amount, commission_paid, commission_remaining
  INTO v_cycle_id, v_gross_amount, v_commission_amount, v_commission_paid, v_commission_remaining
  FROM public.seller_commission_monthly_cycles
  WHERE seller_id = p_seller_id AND month = v_prev_month AND year = v_prev_year;

  -- If cycle doesn't exist, create it dynamically
  IF v_cycle_id IS NULL THEN
    SELECT COALESCE(SUM(seller_total), 0) INTO v_gross_amount
    FROM public.seller_orders
    WHERE seller_id = p_seller_id AND status IN ('Shipped', 'Delivered');

    v_commission_amount := v_gross_amount * 0.05;
    v_commission_paid := 0;
    v_commission_remaining := v_commission_amount;
    v_due_date := DATE_TRUNC('month', NOW()) + INTERVAL '14 days';

    INSERT INTO public.seller_commission_monthly_cycles (
      seller_id, month, year, gross_amount, commission_percentage,
      commission_amount, commission_paid, commission_remaining,
      due_date, status
    ) VALUES (
      p_seller_id, v_prev_month, v_prev_year, v_gross_amount, 5.00,
      v_commission_amount, 0, v_commission_amount,
      v_due_date, 'Unpaid'
    ) RETURNING id INTO v_cycle_id;
  END IF;

  -- STEP 3: Insert one row into seller_payments
  INSERT INTO public.seller_payments (
    seller_id,
    gross_amount,
    commission_percentage,
    commission_amount,
    net_amount,
    payment_method,
    transaction_reference,
    receipt_image,
    notes,
    status,
    commission_cycle_id
  ) VALUES (
    p_seller_id,
    v_gross_amount,
    5.00,
    v_commission_amount,
    p_paid_amount,
    'Online',
    NULL,
    p_receipt_image,
    p_notes,
    'Submitted',
    v_cycle_id
  ) RETURNING id INTO v_payment_id;

  -- STEP 4: Determine and update cycle's status & paid amounts
  -- Note: In this seller submission flow, the submitted payment amount immediately updates commission_paid & status
  -- (Partially Paid or Paid) for seller feedback. Admin verification can audit and confirm or reject if required.
  v_new_commission_paid := v_commission_paid + p_paid_amount;
  IF v_new_commission_paid >= v_commission_amount THEN
    v_new_status := 'Paid';
  ELSE
    v_new_status := 'Partially Paid';
  END IF;

  UPDATE public.seller_commission_monthly_cycles
  SET commission_paid = v_new_commission_paid,
      commission_remaining = GREATEST(v_commission_amount - v_new_commission_paid, 0),
      status = v_new_status,
      updated_at = NOW()
  WHERE id = v_cycle_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'cycle_id', v_cycle_id,
    'net_amount', p_paid_amount,
    'new_status', v_new_status
  );
END;
$$;

-- --------------------------------------------------------------------
-- 7. QUERY 2 — PAGINATED COMMISSION PAYMENT HISTORY TABLE RPC (DEFAULT 5 PER PAGE)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_seller_commission_history(
  p_seller_id UUID,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset INT;
  v_total_count INT;
  v_records JSONB;
BEGIN
  v_offset := (GREATEST(p_page, 1) - 1) * p_page_size;

  SELECT COUNT(id) INTO v_total_count
  FROM public.seller_payments
  WHERE seller_id = p_seller_id;

  SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_records
  FROM (
    SELECT
      sp.id,
      sp.seller_id,
      sp.gross_amount,
      sp.commission_percentage,
      sp.commission_amount,
      sp.net_amount,
      sp.payment_method,
      sp.transaction_reference,
      sp.receipt_image,
      sp.notes,
      sp.status,
      sp.commission_cycle_id,
      sp.verified_by,
      sp.verified_at,
      sp.created_at,
      sp.updated_at
    FROM public.seller_payments sp
    WHERE sp.seller_id = p_seller_id
    ORDER BY sp.created_at DESC, sp.id DESC
    LIMIT p_page_size
    OFFSET v_offset
  ) r;

  RETURN jsonb_build_object(
    'total_count', COALESCE(v_total_count, 0),
    'page', p_page,
    'page_size', p_page_size,
    'total_pages', CEIL(COALESCE(v_total_count, 0)::NUMERIC / GREATEST(p_page_size, 1)),
    'has_more', (v_offset + p_page_size) < COALESCE(v_total_count, 0),
    'records', v_records
  );
END;
$$;

-- --------------------------------------------------------------------
-- 8. DETAIL MODAL — LAZY-LOADED JOINED RPC WITH INNER ORDERS PAGINATION
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_seller_payment_detail(
  p_payment_id UUID,
  p_seller_id UUID,
  p_order_page INT DEFAULT 1,
  p_order_page_size INT DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment RECORD;
  v_cycle RECORD;
  v_cycle_summary JSONB := NULL;
  v_offset INT;
  v_total_orders INT := 0;
  v_orders JSONB;
BEGIN
  v_offset := (GREATEST(p_order_page, 1) - 1) * p_order_page_size;

  -- STEP 1: Get full row from seller_payments
  SELECT * INTO v_payment
  FROM public.seller_payments
  WHERE id = p_payment_id AND seller_id = p_seller_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment record not found or access denied.';
  END IF;

  -- STEP 2: Get cycle summary from seller_commission_monthly_cycles
  IF v_payment.commission_cycle_id IS NOT NULL THEN
    SELECT month, year, due_date, extended_date, status INTO v_cycle
    FROM public.seller_commission_monthly_cycles
    WHERE id = v_payment.commission_cycle_id AND seller_id = p_seller_id;

    IF FOUND THEN
      v_cycle_summary := jsonb_build_object(
        'month', v_cycle.month,
        'year', v_cycle.year,
        'due_date', v_cycle.due_date,
        'extended_date', v_cycle.extended_date,
        'status', v_cycle.status
      );
    END IF;
  END IF;

  -- STEP 3 & 4: Get order items and count with pagination
  SELECT COUNT(DISTINCT oi.id) INTO v_total_orders
  FROM public.seller_commission_cycle_items sci
  INNER JOIN public.seller_orders so ON sci.seller_order_id = so.id AND so.seller_id = p_seller_id
  INNER JOIN public.order_items oi ON oi.order_id = so.order_id AND oi.seller_id = p_seller_id
  WHERE sci.cycle_id = v_payment.commission_cycle_id;

  -- If no cycle items, fallback to seller_orders direct match
  IF v_total_orders = 0 THEN
    SELECT COUNT(DISTINCT oi.id) INTO v_total_orders
    FROM public.order_items oi
    INNER JOIN public.seller_orders so ON oi.order_id = so.order_id AND so.seller_id = p_seller_id
    WHERE so.seller_id = p_seller_id;
  END IF;

  SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_orders
  FROM (
    SELECT
      oi.product_id,
      oi.product_title,
      oi.brand,
      oi.quantity,
      oi.price,
      so.status,
      pi.image_url AS thumbnail_url
    FROM public.seller_commission_cycle_items sci
    INNER JOIN public.seller_orders so ON sci.seller_order_id = so.id AND so.seller_id = p_seller_id
    INNER JOIN public.order_items oi ON oi.order_id = so.order_id AND oi.seller_id = p_seller_id
    LEFT JOIN public.product_images pi ON pi.product_id = oi.product_id AND pi.is_thumbnail = true
    WHERE sci.cycle_id = v_payment.commission_cycle_id
    ORDER BY oi.created_at DESC
    LIMIT p_order_page_size
    OFFSET v_offset
  ) r;

  RETURN jsonb_build_object(
    'payment_summary', jsonb_build_object(
      'id', v_payment.id,
      'gross_amount', v_payment.gross_amount,
      'commission_percentage', v_payment.commission_percentage,
      'commission_amount', v_payment.commission_amount,
      'net_amount', v_payment.net_amount,
      'status', v_payment.status,
      'receipt_image', v_payment.receipt_image,
      'notes', v_payment.notes,
      'created_at', v_payment.created_at,
      'verified_at', v_payment.verified_at
    ),
    'cycle_summary', v_cycle_summary,
    'orders', v_orders,
    'orders_pagination', jsonb_build_object(
      'total_orders', COALESCE(v_total_orders, 0),
      'page', p_order_page,
      'page_size', p_order_page_size,
      'total_pages', CEIL(COALESCE(v_total_orders, 0)::NUMERIC / GREATEST(p_order_page_size, 1)),
      'has_more', (v_offset + p_order_page_size) < COALESCE(v_total_orders, 0)
    )
  );
END;
$$;

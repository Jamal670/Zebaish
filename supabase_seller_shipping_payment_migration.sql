-- =========================================================
-- MIGRATION FOR SELLER SHIPPING & PAYMENT CONFIGURATION
-- =========================================================

-- 1. Add cod, advance_pay_full, and advance_pay_dc columns to sellers table if not exist
ALTER TABLE public.sellers 
ADD COLUMN IF NOT EXISTS cod BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS advance_pay_full BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS advance_pay_dc BOOLEAN DEFAULT FALSE;

-- 2. Add CHECK constraint for shipping_charges range (0 to 500 PKR)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sellers_shipping_charges_check'
  ) THEN
    ALTER TABLE public.sellers 
    ADD CONSTRAINT sellers_shipping_charges_check 
    CHECK (shipping_charges >= 0 AND shipping_charges <= 500);
  END IF;
END $$;

-- 3. Add CHECK constraint for advance payment mutual exclusivity
-- (advance_pay_full and advance_pay_dc cannot both be true simultaneously)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sellers_advance_pay_mutual_exclusive'
  ) THEN
    ALTER TABLE public.sellers 
    ADD CONSTRAINT sellers_advance_pay_mutual_exclusive 
    CHECK (NOT (advance_pay_full AND advance_pay_dc));
  END IF;
END $$;

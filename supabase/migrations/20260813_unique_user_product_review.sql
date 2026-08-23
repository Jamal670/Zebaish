-- Migration: Prevent duplicate reviews for same user and product
-- Adds unique constraint on (user_id, product_id) in public.reviews table

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_product_review'
    ) THEN
        ALTER TABLE public.reviews
        ADD CONSTRAINT unique_user_product_review
        UNIQUE (user_id, product_id);
    END IF;
END $$;

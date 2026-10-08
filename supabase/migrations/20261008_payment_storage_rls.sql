-- Migration: Supabase Storage RLS Policies for Payment Bucket
-- Allows both guest (anon) and authenticated customers to upload payment screenshots

-- 1. Create or ensure the 'payment' bucket exists with public access
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment',
  'payment',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing conflicting INSERT policies for payment bucket
DROP POLICY IF EXISTS "Allow customer payment proof uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow payment proof uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow payment uploads" ON storage.objects;

-- 3. Create INSERT policy allowing both anon (guest) and authenticated users to upload
CREATE POLICY "Allow customer payment proof uploads"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'payment'
);

-- 4. Ensure SELECT (read) access for viewing payment screenshots
DROP POLICY IF EXISTS "Allow public read payment proofs" ON storage.objects;
CREATE POLICY "Allow public read payment proofs"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'payment'
);

-- 5. Allow DELETE access for order rollback cleanup
DROP POLICY IF EXISTS "Allow delete payment proofs" ON storage.objects;
CREATE POLICY "Allow delete payment proofs"
ON storage.objects
FOR DELETE
TO anon, authenticated
USING (
  bucket_id = 'payment'
);

-- Migration: Supabase Storage RLS Policies for Products Bucket
-- Solves "StorageApiError: new row violates row-level security policy" on product image uploads

-- 1. Create or update the 'products' bucket with public access
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'products',
  'products',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2. Allow INSERT (upload) access for public & authenticated users
DROP POLICY IF EXISTS "Allow product image uploads" ON storage.objects;
CREATE POLICY "Allow product image uploads"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'products');

-- 3. Allow SELECT (read) access for public
DROP POLICY IF EXISTS "Allow public read product images" ON storage.objects;
CREATE POLICY "Allow public read product images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'products');

-- 4. Allow UPDATE access for public & authenticated users
DROP POLICY IF EXISTS "Allow update product images" ON storage.objects;
CREATE POLICY "Allow update product images"
  ON storage.objects FOR UPDATE
  TO public
  USING (bucket_id = 'products');

-- 5. Allow DELETE access for public & authenticated users
DROP POLICY IF EXISTS "Allow delete product images" ON storage.objects;
CREATE POLICY "Allow delete product images"
  ON storage.objects FOR DELETE
  TO public
  USING (bucket_id = 'products');

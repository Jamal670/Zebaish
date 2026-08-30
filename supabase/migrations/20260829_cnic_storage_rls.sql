-- Migration: Supabase Storage RLS Policies for CNIC Bucket
-- Fixes "StorageApiError: new row violates row-level security policy" on CNIC uploads

-- 1. Create or update the 'cnic' bucket with public access
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cnic',
  'cnic',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Allow INSERT (upload) access for public & authenticated users
DROP POLICY IF EXISTS "Allow CNIC uploads" ON storage.objects;
CREATE POLICY "Allow CNIC uploads"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'cnic');

-- 3. Allow SELECT (read) access for public
DROP POLICY IF EXISTS "Allow public read CNIC images" ON storage.objects;
CREATE POLICY "Allow public read CNIC images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'cnic');

-- 4. Allow UPDATE access for public & authenticated users
DROP POLICY IF EXISTS "Allow update CNIC images" ON storage.objects;
CREATE POLICY "Allow update CNIC images"
  ON storage.objects FOR UPDATE
  TO public
  USING (bucket_id = 'cnic');

-- 5. Allow DELETE access for public & authenticated users
DROP POLICY IF EXISTS "Allow delete CNIC images" ON storage.objects;
CREATE POLICY "Allow delete CNIC images"
  ON storage.objects FOR DELETE
  TO public
  USING (bucket_id = 'cnic');

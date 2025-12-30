-- Migration: Create Storage Bucket for Odds JSON
-- Run this in your Supabase SQL Editor

-- Create public bucket for odds data
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('odds-data', 'odds-data', true, 5242880) -- 5MB limit
ON CONFLICT (id) DO NOTHING;

-- Policy to allow public (anonymous) read access
CREATE POLICY "Public read access for odds data"
ON storage.objects FOR SELECT
USING (bucket_id = 'odds-data');

-- Policy to allow service key write access (INSERT)
CREATE POLICY "Service key insert access for odds data"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'odds-data');

-- Policy to allow service key update access
CREATE POLICY "Service key update access for odds data"
ON storage.objects FOR UPDATE
USING (bucket_id = 'odds-data');

-- Policy to allow service key delete access
CREATE POLICY "Service key delete access for odds data"
ON storage.objects FOR DELETE
USING (bucket_id = 'odds-data');


-- Add programme_pdf_url column to formations
ALTER TABLE public.formations ADD COLUMN programme_pdf_url text DEFAULT NULL;

-- Create storage bucket for formation programmes
INSERT INTO storage.buckets (id, name, public) VALUES ('formation-programmes', 'formation-programmes', true);

-- Allow internal users to upload/read/delete from the bucket
CREATE POLICY "Internal users can upload programmes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'formation-programmes' AND
  is_internal_user(auth.uid())
);

CREATE POLICY "Internal users can read programmes"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'formation-programmes' AND
  is_internal_user(auth.uid())
);

CREATE POLICY "Internal users can delete programmes"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'formation-programmes' AND
  is_internal_user(auth.uid())
);

CREATE POLICY "Public can read programmes"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'formation-programmes');

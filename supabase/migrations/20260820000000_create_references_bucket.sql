-- Create the storage bucket for references
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'references',
    'references',
    false,
    50000000,
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Set up storage RLS policies for the references bucket
-- 1. Allow authenticated read access for project owners
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Project owners can read" ON storage.objects;
CREATE POLICY "Project owners can read"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'references' AND
    (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.projects WHERE user_id = auth.uid()
    )
);

-- 2. Allow authenticated users to upload files
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'references' AND
    (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.projects WHERE user_id = auth.uid()
    ) AND
    (LOWER(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi'))
);

-- 3. Allow users to update/delete their own uploads (optional, based on auth.uid())
DROP POLICY IF EXISTS "Users can manage their own uploads" ON storage.objects;
CREATE POLICY "Users can manage their own uploads"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'references' AND auth.uid() = owner );

DROP POLICY IF EXISTS "Users can delete their own uploads" ON storage.objects;
CREATE POLICY "Users can delete their own uploads"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'references' AND auth.uid() = owner );

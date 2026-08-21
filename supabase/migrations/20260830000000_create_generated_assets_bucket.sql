-- Public bucket for generated media (images, carousels, videos).
-- Runtime uses getPublicUrl, so the bucket must be public-readable.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'generated-assets',
    'generated-assets',
    true,
    100000000,
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
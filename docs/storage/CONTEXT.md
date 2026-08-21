# Storage Context

## Overview
Supabase Storage holds user-uploaded references and generated assets.

## Buckets
- `references` — **private**. Manual reference uploads (images/videos) and fetched media. Accessed via signed URLs (`app/dashboard/projects/[id]/page.tsx` uses `createSignedUrl`). RLS gates reads to project owners by bucket folder `{projectId}`.
- `generated-assets` — **public**. Generated images, carousel slides, and videos. Written by `lib/post-processing.ts` (`applyPostProcessing`, `uploadVideoToSupabase`) and read via `getPublicUrl`. Foldered as `{projectId}/{assetId}.jpg|.mp4`. Seed data (`seed.ts`) additionally uploads image and carousel slide `.svg` files here as seed-only assets.

## Constraints
- Bucket definitions live in `supabase/migrations/` (`20260820000000_create_references_bucket.sql`, `20260830000000_create_generated_assets_bucket.sql`). Apply via `npx supabase db push`.
- Carousel `media_url` is a JSON-array string of per-slide public URLs.
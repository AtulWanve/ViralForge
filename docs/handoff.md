# ViralForge Hand-Off Document

## Implementation Summary

The ViralForge PoC implements the full reference→analysis→generation→schedule→publish loop according to `BLUEPRINT.md` and the assignment brief.

### 1. Database & Schema
- SQL migrations in `supabase/migrations/` build: `users`, `projects`, `references_table`, `content_profiles`, `content_ideas`, `generated_assets`, `scheduled_posts`, `regeneration_requests`.
- RLS enforced: direct ownership on `users`/`projects`; `project_id` join policies on child tables; read-only admin SELECT policies (migration `20260829000000_add_admin_access.sql`).
- Storage buckets: `references` (private) + `generated-assets` (public, `20260830000000_create_generated_assets_bucket.sql`).

### 2. Frontend
Next.js 16 App Router at project root. Views: projects list/detail/new, asset library, calendar, and admin dashboard (`app/dashboard/admin/page.tsx`, role-gated server-side). `ProfileEditor` makes the Content Profile editable in the UI.

### 3. Background Workers (Inngest)
- `analyze-project` — queues Gemini multimodal analysis; persists `content_profiles`.
- `generate-ideas` — Gemini generates a batch of ideas from the (user-editable) profile; supports idempotent regeneration via `regeneration_requests` RPCs.
- `generate-media` — branches by format:
  - image → fal.ai SDXL → Sharp hook-overlay → upload to `generated-assets`.
  - video → fal.ai minimax → download → upload to `generated-assets`.
  - carousel → Gemini slide-split → 3× fal.ai → Sharp per-slide overlays → JSON-array `media_url`.
- `publish-scheduled-posts` — cron `* * * * *` claims due posts via `claim_scheduled_posts` RPC and fans out publishes.

### 4. AI Integration
- `lib/gemini.ts`: Gemini 2.5 Flash via `@google/genai`, with strict response `Schema`s for profiles, ideas, and carousel splits.
- `lib/providers/`: `MediaProvider` interface with `FalProvider` (real fal.ai via `@fal-ai/client`) and `MockProvider` (deterministic, tests/no-key). `createMediaProvider()` returns the real provider when a valid `FAL_KEY` is present, else mock.
- `lib/time.ts`: pure timezone/DST wall-time→UTC resolution used by the scheduler (`resolveToUtc`).

### 5. Tests
Vitest suite (`npm test`) — 14 tests across the brief's risky parts: analysis parser validation (`contentProfileSchema`), scheduler timezone/DST (`lib/time.ts`), and the provider abstraction (`createMediaProvider`/`MockProvider`). Writing the scheduler tests surfaced and fixed a real bug where `wallParts` returned Intl keys (`year`/`hour`...) but consumers read `y`/`h`..., making `resolveToUtc` always fail for non-UTC timezones. Fixed in `lib/time.ts` by mapping keys to `y`/`m`/`d`/`h`/`min`.

## Known Limitations & Mocked Components

1. **Publishing**: Ayrshare when `AYRSHARE_API_KEY` present; otherwise a 2s mock with 10% failure (allowed at the provider boundary by the brief).
2. **URL scraping**: mock ingestion with a manual upload fallback; not a live Instagram scraper.
3. **Seeded video**: reviewer project's video points at a public sample mp4 rather than a Supabase Storage upload.
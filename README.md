# ViralForge 🚀

ViralForge is an AI-powered social media content generation pipeline. It learns from viral references, generates new content ideas using Google's Gemini Multimodal models, creates visual assets (using fal.ai SDXL for images and minimax-video for videos, with Sharp performing text overlays), and schedules them for automatic publishing (using Ayrshare with Inngest fan-out).

## 🌟 Features

1. **Multimodal Analysis**: Upload reference images or paste social media URLs (mock scraping implemented with fallback). Gemini 2.5 Flash breaks down the visual style, caption structure, hooks, and content pillars.
2. **AI Content Generation**: Generates batches of ready-to-use content ideas based on the learned profile using Gemini.
3. **Asset Generation Pipeline**: Approving an idea triggers an Inngest background worker to generate the final media (using Fal.ai SDXL for images and minimax-video for videos, with Sharp performing text overlays).
   - **Images**: fal.ai + Sharp hook-text overlay (post-processing step).
   - **Videos**: fal.ai minimax-video, downloaded and served from Supabase Storage.
   - **Carousels**: 3-slide decks — Gemini splits the visual prompt into per-slide prompts/copy, fal.ai generates each slide, Sharp overlays per-slide copy, stored as a JSON array of URLs.
4. **Automated Publishing**: Background workers check the schedule every minute and publish your posts (via real Ayrshare API with fan-out, falling back to mock if `AYRSHARE_API_KEY` is not provided).
5. **Admin Dashboard**: `/dashboard/admin` shows all users, projects, and asset counts. Enforced server-side by role (`users.role = 'admin'`); non-admins are redirected. Read-only via dedicated RLS policies.
6. **Next.js 16 App Router**: Uses the latest features including async server components and server actions.

## 🛠️ Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS v4 & Shadcn UI
- **Database/Auth**: Supabase (PostgreSQL, Auth, Storage)
- **Background Jobs**: Inngest
- **AI Models**: Google Gemini (`@google/genai`)

## 🚀 Getting Started

### 1. Prerequisites

You'll need API keys for:
- [Supabase](https://supabase.com) (Create a new project)
- [Inngest](https://www.inngest.com)
- [Google AI Studio](https://aistudio.google.com/) (Gemini API)
- [Fal.ai](https://fal.ai) (for image and video generation)
- [Ayrshare](https://www.ayrshare.com) (optional, for real social media publishing)

### 2. Environment Setup

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

INNGEST_EVENT_KEY=local
INNGEST_SIGNING_KEY=local

GEMINI_API_KEY=your_gemini_key

# Optional: For real media generation via fal.ai.
# Leave unset or set to "mock-key" to use the MockProvider (placeholder media). Any
# other nonempty value selects the real provider, so a valid fal.ai key is required.
FAL_KEY=mock-key

# Optional: Required for real social media publishing via Ayrshare
# If not provided, publishing falls back to mock mode
```

> ⚠️ `FAL_KEY` selects the real fal.ai provider only when set to a nonempty value other than `mock-key`. Leave it unset or set to `mock-key` to use the MockProvider (placeholder images/videos). Any other value — including an invalid or partial key — selects the fal.ai provider and fails at generation time. A valid fal.ai credential is required for real media generation.

### 3. Database Setup

Run the migrations to create tables, buckets, and RLS policies (`npx supabase init` is only for new directories; this project is already initialized):

```bash
npx supabase link --project-ref your-project-ref
npx supabase db push
```

Two migrations were added for the recent features:
- `20260829000000_add_admin_access.sql` — promotes `admin@viralforge.test` to `role = 'admin'` and adds read-only admin SELECT policies.
- `20260830000000_create_generated_assets_bucket.sql` — creates the public `generated-assets` storage bucket used for generated images/videos/carousels.

Apply both or real generation and admin view will not work.

### 4. Running Locally

You need two terminal windows:

Terminal 1: Next.js Dev Server
```bash
npm run dev
```

Terminal 2: Inngest Dev Server (for background jobs)
```bash
npx inngest-cli@latest dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## 🗄️ Architecture Overview

The background job architecture is built on Inngest to avoid Vercel serverless timeouts (which usually cap at 10 seconds on the free tier).

1. `viralforge/project.analyze`: Triggered when references are uploaded. Calls Gemini with images.
2. `app/generate-ideas`: Triggered manually. Calls Gemini to generate 5 JSON ideas.
3. `app/generate-media`: Triggered when an idea is approved. Branches by format:
   - `image` → fal.ai SDXL → Sharp hook-overlay → upload to `generated-assets`.
   - `video` → fal.ai minimax-video → download → upload to `generated-assets`.
   - `carousel` → Gemini slide-split → 3× fal.ai images → Sharp per-slide overlays → JSON array URL.
4. `publish-scheduled-posts`: Cron job running `* * * * *` to check for due posts.

## 🗃️ Data Model

- `users` — Supabase auth-joined profile, `role` (`admin`/`user`).
- `projects` — a content workspace; `target_platform`, `brand_voice`.
- `references_table` — ingested URLs / manual uploads.
- `content_profiles` — 1:1 analysis output per project (visual style, hooks, caption structure, format mix, pillars).
- `content_ideas` — proposed/approved/discarded prompt batches.
- `generated_assets` — status machine (`queued → generating → ready / failed`); `media_url` may be a single URL or a JSON array (carousels).
- `scheduled_posts` — calendar state (`draft → scheduled → publishing → published / failed`) with IANA `timezone`.

## 🙈 Seeding

`seed.ts` populates `reviewer@viralforge.test`'s example project with:
- 4 references.
- 3 approved ideas (image / carousel / video).
- 3 ready assets: an SVG image and 3-slide carousel uploaded to `generated-assets`, plus a hosted sample video.
- 3 scheduled posts in mixed states (scheduled / published / failed).

It also ensures the `admin@viralforge.test` account exists (creating it from `SEED_ADMIN_PASSWORD` when missing) and promotes it to `role='admin'`, so `/dashboard/admin` is reachable after a fresh setup.

It refuses to run against a non-local DB and guards against clobbering another user's data. The seeded video currently points at a public sample mp4 (see Known Limitations).

## 📝 Testing

1. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `SEED_ENV=true`, and `SEED_USER_ID` (the email of the account the seeded data attaches to), plus a real `FAL_KEY` for real media. Optionally set `SEED_ADMIN_PASSWORD` so the seed can create the admin account if it doesn't exist yet.
2. Link supabase and run migrations (`npx supabase db push`).
3. Create an account on the UI through `/signup` and verify it in your Supabase Auth interface. Confirm `SEED_USER_ID` is set to that account's email (or leave it matching the `reviewer@viralforge.test` credential).
4. Run `npx tsx seed.ts` to initialize the project and load references and generation examples. It requires `SEED_ENV=true` and will refuse to run otherwise.
5. Run both the `npm run dev` and `npx inngest-cli@latest dev` servers.
6. Create a project in the Dashboard.
7. Upload some reference content (URL or image) into the project.
8. Click "Analyze References" — this calls the authenticated server action in `app/actions/analyze-actions.ts` to queue the analysis. Wait and view the generated output in the UI.
9. Click "Generate Content Ideas", and after they are returned, approve one.
10. Once the generated asset is ready, open the Assets page and schedule it via the schedule dialog for a time a few minutes in the future.
11. Open the Calendar section to see the scheduled post and watch the background worker process the publishing pipeline.

## 🛑 Known Limitations

1. **Authentication:** Basic email/password via Supabase. Magic links/OAuth not implemented. Seeded users: `admin@viralforge.test` and `reviewer@viralforge.test`.
2. **Scraping:** URL ingestion is mock-scraped with a fallback. True Instagram/LinkedIn scraping needs dedicated proxy services to avoid rate limits.
3. **Publishing:** Uses Ayrshare real fetch with fan-out via Inngest, falling back to mock if no API key. Native app approvals take weeks.
4. **Video generation:** Uses fal.ai minimax-video with Sharp text overlays. Requires a valid `FAL_KEY`.
5. **Seeded video:** The seeded reviewer project's video points at a stable public sample mp4 (`BigBuckBunny`) rather than a Supabase Storage upload. Override via `SEED_VIDEO_URL`, or swap to a real uploaded clip once a generated asset exists.
6. **Provider unit test:** `MediaProvider` interface, `MockProvider`, and `createMediaProvider()` factory exist in `lib/providers/`. A vitest suite (`npm test`) covers the brief's risky parts — analysis parser, scheduler timezone/DST resolution, and the provider abstraction. Adding these tests surfaced and fixed a real scheduler bug.
7. **Admin nav link:** now role-gated server-side (`users.role === 'admin'`) in `app/dashboard/layout.tsx`, matching the `/dashboard/admin` page boundary.
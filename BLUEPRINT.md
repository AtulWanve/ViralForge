# ViralForge — Implementation Blueprint & Execution Plan

## 1. The Architecture
- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS v4 + Shadcn UI
- **Database & Auth:** Supabase (PostgreSQL + RLS + Storage)
- **Background Jobs:** Inngest (Serverless queues + Cron)
- **AI Multimodal:** Google Gemini 2.5 Flash (via `@google/genai`)
- **Image Generation:** fal.ai (FLUX schnell)
- **Video Processing:** Remote worker (Render/Railway) using Inngest + FFmpeg (to bypass Vercel timeouts)

## 2. Database Schema (Types Generated)
The exact schema has been generated in `types/database.ts`. It maps exactly to the features needed:
- `users` (Managed by Supabase Auth)
- `projects` (Target platforms, tone)
- `references_table` (Ingested URLs and manual uploads)
- `content_profiles` (The 1-to-1 analysis output from Gemini)
- `content_ideas` (The prompt batches before generation)
- `generated_assets` (The status machine: queued → ready)
- `scheduled_posts` (The calendar state)

*All tables will be secured with Row Level Security (RLS) defining policies per table and role. Child tables use ownership joins through appropriate parent relationships instead of applying `auth.uid() = user_id` directly, and include explicit least-privilege admin policies for required administrative access.*

## 3. Data Flow Mechanisms

### A. Reference Ingestion & Analysis
1. User uploads an image + caption OR pastes an Instagram URL.
2. Server Action (`analyze-actions.ts`) validates the request and queues `viralforge/project.analyze`.
3. Inngest function `analyze-project` calls Gemini.
4. Gemini returns a strict JSON schema (`ContentProfile`).
5. Inngest function saves the result to `content_profiles`.

### B. Asset Generation
1. User clicks "Generate Batch".
2. Server Action triggers Inngest event: `app/generate-ideas`.
3. Gemini creates 5 `ContentIdea` rows (status: `proposed`).
4. User approves an idea.
5. Server Action triggers Inngest event: `app/generate-media`.
6. Worker calls `fal.ai` FLUX schnell.
7. fal.ai returns a URL. Worker downloads it, overlays text using `sharp`, uploads to Supabase Storage, and marks `GeneratedAsset` as `ready`.

### C. The Publishing Scheduler
1. Inngest cron job runs `* * * * *` (every minute).
2. Queries `scheduled_posts` where `scheduled_for <= now()` and `status = 'scheduled'`.
3. For each post, attempts to publish (we will use a 2-second mock delay + 10% random failure rate to demonstrate error handling).
4. Updates status to `published` or `failed`.

## 4. Execution Plan (Days 2-7)

**Day 2: Supabase Setup & Projects**
- Create Supabase project, execute SQL schema, setup RLS policies.
- Build Project Creation form (Server Actions).
- Build Project details page.
- Build Reference upload component (Supabase storage for manual images).

**Day 3: Multimodal Analysis (Gemini)**
- Set up Inngest route handler.
- Write the `analyze-project` Inngest function.
- Integrate `@google/genai` with a strict JSON response schema.
- Build the Content Profile UI view.

**Day 4: Generation Pipeline (fal.ai)**
- Write the `generate-ideas` function (Gemini).
- Write the `generate-media` function (fal.ai FLUX).
- Build the UI to approve ideas and see asset loading states.

**Day 5: Media Processing Worker**
- Write a small external Node.js script using `fluent-ffmpeg`.
- Deploy it to a free Render web service listening to Inngest to handle video generation without hitting Vercel's 10-second timeout.

**Day 6: Scheduling & Mocking**
- Build the Calendar UI.
- Write the Inngest cron scheduler.
- Implement the mock publisher.

**Day 7: Seeding & Handover**
- Create the admin and reviewer seed script.
- Final README and video walkthrough.
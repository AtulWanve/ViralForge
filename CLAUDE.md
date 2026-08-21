# ViralForge

## Project Overview
ViralForge is a web application that helps users produce social media content modeled on content that has already gone viral, and then schedule it to their own social accounts.

**Core Loop:**
1. User provides references (viral content).
2. App learns the pattern (Multimodal Analysis).
3. App generates new content in that pattern (AI generation).
4. User reviews and approves.
5. App schedules and publishes to connected accounts.

## Constraints & Rules
- **Stack:** Next.js 16 (App Router), Tailwind, Shadcn-UI, Supabase, Inngest, Gemini API, fal.ai (image/video), Sharp, Ayrshare (optional).
- **Goal:** Working Proof of Concept (PoC) deployed to the web within 7 days.
- **Shortcuts Allowed:** 
  - Mock social media publishing (wait 2 seconds, 10% fail; failed attempts get a failure status, successful ones get the published status) when no Ayrshare key; real Ayrshare publish when key present.
  - Manual ingestion fallback (upload image + paste caption) instead of complex scraping.
  - Media generation via `lib/providers/`: real fal.ai when `FAL_KEY` set, else `MockProvider` (picsum/sample mp4). Video generation is a real fal.ai call, NOT an FFmpeg slideshow — FFmpeg-only would not satisfy the assignment's video-generation requirement.
- **Never Do:** Do not store API keys in code. Use `.env`.

## Mandatory References (Read BEFORE writing code)
- **Database types:** Always adhere to `types/database.ts`. Never invent columns or tables not defined there.
- **Next.js 16 patterns:** Read `docs/nextjs-patterns.md` before writing any route, page, layout, API handler, or Server Action. Next.js 16 has breaking changes from v14 — `params`, `searchParams`, `cookies()`, `headers()` are all async and MUST be awaited.
- **Inngest patterns:** Read `docs/inngest-patterns.md` before writing any background job, worker, or cron function.
- **Fetch caching:** `fetch()` and GET route handlers are NOT cached by default in Next.js 16. Explicitly opt in with `{ cache: 'force-cache' }` or `{ next: { revalidate: N } }` when needed.

## Architecture Map (Project Worktree)
- `app/`, `components/` -> Next.js Dashboard (inspired by Nellavio) [See docs/frontend/CONTEXT.md]
- `app/api/`, `lib/inngest/` -> Next.js API Routes + Inngest Background Jobs [See docs/backend/CONTEXT.md]
- `lib/providers/` -> Media abstraction: `MediaProvider` interface + `FalProvider`/`MockProvider` + `createMediaProvider()` factory; Ayrshare publishing provider `publishToAyrshare()`
- `lib/post-processing.ts` -> Sharp image overlays + Supabase Storage upload for generated media
- `supabase/` -> Supabase (PostgreSQL) [See docs/database/CONTEXT.md]
- `supabase/` -> Supabase Storage: `references` (private) + `generated-assets` (public) [See docs/storage/CONTEXT.md]
- `seed.ts` -> Seeds reviewer/admin example project (image and carousel assets use real Supabase Storage URLs; the video asset uses an external BigBuckBunny MP4 URL by default, overridable via `SEED_VIDEO_URL`; mixed calendar states)

## AI Token Optimization (Gemini/Opus Routing)
- **Your Role (Executor):** You are running on Gemini. You handle all context gathering, file reading, syntax checking, and code writing. 
- **Opus Delegation (Thinker):** Opus API usage is highly constrained compared to Gemini (roughly 1:100 ratio). For complex tasks (e.g., database schema design, architecture, tricky debugging, security reviews, or multi-file refactoring), you MUST NOT make the final architectural decision yourself.
- **Workflow:** 
  1. Read the necessary files (Gemini).
  2. Spawn a subagent via the Agent tool with `model: "opus"`.
  3. Feed the Opus subagent a highly compressed summary of the problem and ask it for a design/plan. Do not send entire raw files to Opus unless strictly necessary.
  4. Once Opus returns the plan, you (Gemini) execute the plan and write the code.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

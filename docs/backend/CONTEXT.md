# Backend Context

## Overview
The backend is Next.js Route Handlers + Server Actions plus Inngest for background jobs.

## Core Structure
- `app/api/`: Next.js Route Handlers. Check ownership by `.eq('user_id', user.id)` before triggering work (e.g. `generate-ideas/route.ts`). Idea state routes: `approve`, `discard`, `regenerate`.
- `app/actions/`: Server Actions for project/reference/idea/asset/schedule/analyze mutations. Must await `createClient()` and `getUser()`.
- `lib/inngest/functions/`: Inngest workers + cron (`analyze-project`, `generate-ideas`, `generate-media`, `publish-scheduled-posts`).
- `lib/providers/`: media abstraction. `MediaProvider` interface, `FalProvider`, `MockProvider`, `createMediaProvider()` factory, `ayrshare-provider.ts` for publishing.
- `lib/post-processing.ts`: Sharp image overlays + Supabase Storage upload for media.
- `lib/gemini.ts`: Gemini 2.5 Flash client, response schemas, `splitCarouselPrompts`.

## Ownership & Security
- Inngest workers run with the service role, so RLS is bypassed there. **App-code ownership checks are mandatory in every route/action before enqueueing**; never rely on worker-side RLS.
- Admin page (`/dashboard/admin`) checks `users.role === 'admin'` server-side and redirects; RLS additionally exposes read-only admin SELECT.

## Constraints
- Next.js 16 Route Handlers: external integrations and REST endpoints.
- Server Actions: used in forms/UI to mutate DB or trigger jobs.
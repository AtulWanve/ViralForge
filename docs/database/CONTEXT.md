# Database Context

## Overview
Supabase PostgreSQL with RLS. Auth is delegated to Supabase; `public.users` extends profile + role.

## Core Tables
- `auth.users` — managed by Supabase Auth.
- `public.users` — profile rows; `role` (`admin`/`user`), backfilled via trigger `handle_new_user`.
- `projects` — target platform, brand voice, analysis status.
- `references_table` — ingested URLs + manual uploads (private bucket).
- `content_profiles` — 1:1 analysis output; editable in UI and fed into generation prompts.
- `content_ideas` — proposed/approved/discarded batches.
- `generated_assets` — status machine (`queued → generating → ready | failed`); `media_url` URL or JSON-array (carousel).
- `scheduled_posts` — calendar state; IANA `timezone` + UTC `scheduled_for`.

## Admin
Migration `20260829000000_add_admin_access.sql` promotes `admin@viralforge.test` and adds read-only SELECT policies for `role = 'admin'` on `users`, `projects`, `generated_assets`.

## Constraints
- **RLS**: enabled on every table. Direct ownership (`auth.uid() = id`/`user_id`) on top-level tables; `project_id` join policies on child tables; least-privilege read-only admin policies.
- **Types**: strictly `types/database.ts`. Do not invent columns not defined there.
- Workers (service role) bypass RLS → app code must check ownership before enqueueing.
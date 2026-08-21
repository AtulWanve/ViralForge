# Database Context

## Overview
The database layer uses Supabase with PostgreSQL.

## Core Tables
- `auth.users`: Managed by Supabase Auth
- `public.users`: Application-maintained user profiles
- `projects`: Target platforms, tone
- `references_table`: Ingested URLs and manual uploads
- `content_profiles`: 1-to-1 analysis output from Gemini
- `content_ideas`: Prompt batches before generation
- `generated_assets`: Status machine (queued → generating → ready | failed)
- `scheduled_posts`: Calendar state

## Constraints
- **RLS**: All tables must have Row Level Security enabled. Use direct ownership policies for `public.users` and `project_id`-based ownership joins for project-scoped tables (like `references`), rather than requiring `auth.uid() = user_id` on every table.
- **Types**: Must strictly adhere to `types/database.ts`. Do not invent unmapped columns.

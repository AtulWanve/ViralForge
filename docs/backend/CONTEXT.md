# Backend Context

## Overview
The backend is primarily handled by Next.js Route Handlers and Inngest for background jobs.

## Core Structure
- `app/api/`: Next.js Route Handlers
- `app/actions/`: Next.js Server Actions
- `lib/inngest/functions/`: Inngest background workers and cron jobs

## Constraints
- **Next.js Route Handlers (`app/api/`)**: External integrations (like webhooks) and public REST endpoints.
- **Server Actions (`app/actions/`)**: Used in frontend code to interact with DB/trigger jobs.
- **Inngest (`lib/inngest/functions/`)**: Background processing for multimodal analysis and scheduling.

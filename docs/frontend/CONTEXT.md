# Frontend Context

## Overview
The frontend is a Next.js 16 App Router application utilizing Tailwind CSS v4 and Shadcn UI components.

## Core Structure
- `app/`: Next.js 16 app router structure (pages, layouts, api routes)
- `components/`: UI components (Shadcn, shared, etc)
- `lib/`: Utility functions and shared helpers
- `types/`: Shared TypeScript type definitions

## Constraints
- **Next.js 16 specific**: All `params`, `searchParams`, `cookies()`, and `headers()` must be treated as async and awaited.
- **Caching**: `fetch()` and GET routes are NOT cached by default. Explicitly use `{ cache: 'force-cache' }` when caching is required.

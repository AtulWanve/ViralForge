# Next.js 16 App Router Patterns for ViralForge

> **Source:** Verified from nextjs.org/blog/next-16 (Aug 21, 2026)
> **Purpose:** Ground-truth reference. Read this BEFORE writing any route, component, or API handler.

---

## 1. Page Component (Server Component by default)

```tsx
// app/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div>
      <h1>Dashboard</h1>
      {projects?.map((project) => (
        <div key={project.id}>{project.name}</div>
      ))}
    </div>
  );
}
```

## 2. Async Params (CRITICAL - Next.js 16 Breaking Change)

```tsx
// app/projects/[id]/page.tsx

// params is now a Promise - MUST await it
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  return <div>{project?.name}</div>;
}
```

## 3. Async searchParams (CRITICAL - Next.js 16 Breaking Change)

```tsx
// app/search/page.tsx

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  // ... use q and page
}
```

## 4. Async cookies() and headers()

```tsx
// CORRECT in Next.js 16:
import { cookies } from 'next/headers';

export default async function Page() {
  const cookieStore = await cookies();    // MUST await
  const token = cookieStore.get('token');
  // ...
}
```

## 5. Layout Component

```tsx
// app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ViralForge',
  description: 'Create viral content with AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

## 6. Loading & Error States

```tsx
// app/dashboard/loading.tsx
export default function Loading() {
  return <div>Loading dashboard...</div>;
}

// app/dashboard/error.tsx
'use client'; // Error components MUST be Client Components

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
```

## 7. Server Actions (Data Mutations)

```tsx
// app/actions/project-actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ProjectInsert } from '@/types/database';

export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Unauthorized');
  }

  const name = formData.get('name');
  const description = formData.get('description');
  const target_platform = formData.get('platform');

  if (!name || typeof name !== 'string') {
    throw new Error('Name is required');
  }

  if (target_platform !== 'instagram' && target_platform !== 'linkedin') {
    throw new Error('Invalid platform');
  }

  const project: ProjectInsert = {
    user_id: user.id,
    name: name,
    description: typeof description === 'string' ? description : null,
    target_platform: target_platform,
  };

  const { error } = await supabase.from('projects').insert(project);

  if (error) {
    throw new Error('Failed to create project');
  }

  revalidatePath('/dashboard');
  redirect('/dashboard');
}
```

Using in a Client Component:
```tsx
// app/components/CreateProjectForm.tsx
'use client';

import { createProject } from '@/app/actions/project-actions';

export function CreateProjectForm() {
  return (
    <form action={createProject}>
      <input name="name" placeholder="Project name" required />
      <textarea name="description" placeholder="Description" />
      <select name="platform">
        <option value="instagram">Instagram</option>
        <option value="linkedin">LinkedIn</option>
      </select>
      <button type="submit">Create Project</button>
    </form>
  );
}
```

## 8. API Route Handlers

```tsx
// app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET is NOT cached by default in Next.js 16
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const insertData = {
    user_id: user.id,
    name: body.name,
    description: body.description,
    target_platform: body.target_platform
  };

  const { data, error } = await supabase
    .from('projects')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
```

## 9. Dynamic Route with Params (API)

```tsx
// app/api/projects/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // MUST await in Next.js 16
  // ...
}
```

## 10. Middleware (Auth Protection)

```tsx
// proxy.ts (root of project)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
```

## 11. Client Component Navigation

```tsx
'use client';

// CORRECT: use next/navigation (NOT next/router)
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export function NavigationExample() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <button onClick={() => router.push('/dashboard')}>
      Go to Dashboard
    </button>
  );
}
```

## 12. next.config.ts (TypeScript Config)

```ts
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // for image uploads
    },
  },
};

export default nextConfig;
```

## 13. Metadata (SEO)

```tsx
// Static metadata
export const metadata: Metadata = {
  title: 'Dashboard | ViralForge',
  description: 'Manage your viral content projects',
};

// Dynamic metadata
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params; // MUST await in Next.js 16
  // fetch project name...
  return {
    title: `Project ${id} | ViralForge`,
  };
}
```

## 14. Caching Patterns (Next.js 16 Defaults)

```tsx
// Default: NO caching (Next.js 16 changed this!)
const res = await fetch('https://api.example.com/data');

// Opt INTO caching:
const res = await fetch('https://api.example.com/data', {
  cache: 'force-cache',
});

// ISR-style revalidation:
const res = await fetch('https://api.example.com/data', {
  next: { revalidate: 3600 }, // revalidate every hour
});

// Force dynamic:
const res = await fetch('https://api.example.com/data', {
  cache: 'no-store',
});
```

## Key Reminders

| Pattern | Next.js 14 | Next.js 15+ |
|---------|-----------|-----------|
| `cookies()` | Synchronous | **Async (must await)** |
| `headers()` | Synchronous | **Async (must await)** |
| `params` prop | Synchronous | **Async (must await)** |
| `searchParams` prop | Synchronous | **Async (must await)** |
| `fetch()` caching | Cached by default | **NOT cached by default** |
| GET Route Handlers | Cached by default | **NOT cached by default** |
| Router Cache (pages) | staleTime: 30s | **staleTime: 0** |

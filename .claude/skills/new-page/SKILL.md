---
name: new-page
description: Scaffold a Next.js App Router page following project conventions — async server components with Supabase auth, route groups, metadata, and proper client/server separation
---

# New Page Scaffold

Create App Router pages matching the project's conventions.

## Project Route Structure

```
src/app/
├── (auth)/               # Public auth pages — use 'use client' + @/lib/supabase/client
│   ├── layout.tsx         # Centered card layout, no nav
│   ├── login/page.tsx     # Client component with useState, forms
│   ├── signup/page.tsx    # Client component with useState, forms
│   └── callback/route.ts  # Server route handler for OAuth
│
├── (dashboard)/          # Protected pages — async server components + @/lib/supabase/server
│   ├── layout.tsx         # DashboardShell wrapper, auth check + redirect
│   ├── dashboard/page.tsx # Server component, fetches data
│   ├── missions/page.tsx  # Server component, fetches data
│   ├── analytics/page.tsx # Server component, fetches data
│   └── settings/page.tsx  # Server component, fetches data
│
├── privacy/page.tsx      # Public static page
├── terms/page.tsx        # Public static page
└── page.tsx              # Landing page
```

## Template: Dashboard Page (Server Component)

```tsx
import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Page Title | Murphy',
}

export default async function PageNamePage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch page-specific data
  const { data } = await supabase
    .from('table_name')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold font-sans">Page Title</h1>
      {/* Page content */}
    </div>
  )
}
```

## Template: Auth Page (Client Component)

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function PageNamePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form handling logic

  return (
    <Card className="w-full max-w-md bg-card">
      {/* Card content */}
    </Card>
  )
}
```

## Template: Static Public Page

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Page Title | Murphy',
}

export default function PageNamePage() {
  return (
    <div>
      {/* Static content */}
    </div>
  )
}
```

## Critical Rules

1. **NEVER import `@/lib/supabase/client` in dashboard pages** — always use `createServerSupabaseClient` from `@/lib/supabase/server`
2. **NEVER use `getSession()`** — always use `getUser()` (security requirement, see middleware.ts)
3. **Dashboard pages are async server components** — no `'use client'`, no `useState`
4. **Auth pages ARE client components** — they need `'use client'` for form state
5. **Always export `metadata`** with `| Murphy` suffix in title
6. **New dashboard routes** must be added to the middleware matcher in `middleware.ts` if they need auth protection beyond `/dashboard/*`

## Middleware Update Checklist

If adding a new top-level protected route (not under `/dashboard/`), update `middleware.ts`:
```ts
// Add to the protection check:
request.nextUrl.pathname.startsWith('/your-new-route')
```

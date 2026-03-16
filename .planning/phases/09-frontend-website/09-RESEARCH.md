# Phase 9: Frontend Website - Research

**Researched:** 2026-03-16
**Domain:** Next.js 16, Supabase Auth SSR, shadcn/ui, Tailwind CSS 4, Vercel multi-framework deployment
**Confidence:** HIGH (core stack verified via npm registry + official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Next.js as frontend framework (deploys natively to Vercel)
- Must coexist with existing Express backend on same Vercel deployment (route splitting via vercel.json)
- Express handles /webhooks/telnyx and /health; Next.js handles everything else
- Dark + modern theme: dark backgrounds, accent colors, glassmorphism cards, subtle animations
- Tech-forward SaaS aesthetic (not generic Bootstrap)
- Responsive design, Lighthouse > 90
- No specific brand guidelines exist yet — establish them in this phase
- Supabase Auth with email + Google OAuth
- User accounts tied to phone number for call history lookup
- Landing page: hero ("One call replaces five"), features, social proof, CTA to call +1-888-830-6873, BuyMeACoffee
- Dashboard: call history (dates, service types, providers contacted, outcomes), missions (active/completed, real-time status), analytics (call counts, success rates, common service types)
- Settings: profile management (name, phone, email), notification preferences, account management (delete, export)
- Phone number: +1-888-830-6873
- Domain: murphy.help (already configured)
- BuyMeACoffee username from env: BUYMEACOFFEE_USERNAME
- Agent persona: "Murphy"
- Supabase is already configured (SUPABASE_URL, keys in .env)

### Claude's Discretion
- Component library choice (shadcn/ui, Radix, etc.)
- State management approach
- CSS framework (Tailwind CSS recommended)
- Dashboard chart library
- Real-time subscription approach for mission updates
- Folder structure within Next.js app

### Deferred Ideas (OUT OF SCOPE)
- Billing/payment processing (v2)
- Provider-facing portal
- Mobile app
- Multi-language frontend (French)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WEB-01 | murphy.help serves a polished dark-themed landing page with hero, features, social proof, and CTA | Next.js 16 App Router pages + shadcn/ui + Tailwind CSS 4 dark config |
| WEB-02 | User can sign up and log in via Supabase Auth (email + Google OAuth) | @supabase/ssr 0.9.0 with middleware pattern + Google OAuth callback route |
| WEB-03 | Authenticated dashboard displays call history with dates, service types, providers, and outcomes | Supabase server-side query + CallState type shape from src/lib/voice/call-state.ts |
| WEB-04 | Dashboard shows missions with real-time status and results | Supabase Realtime channel subscription in 'use client' component + Mission type from src/types/mission.ts |
| WEB-05 | Settings page for profile, notifications, and account management | Supabase user metadata update + shadcn/ui Form components |
| WEB-06 | Next.js frontend coexists with Express backend on the same Vercel deployment | vercel.json builds + routes array — Express at /api/express entry, Next.js separately |
| WEB-07 | All pages responsive and performant (Lighthouse > 90) | next/image, next/font, Tailwind responsive utilities, Suspense boundaries |
</phase_requirements>

---

## Summary

Phase 9 adds a full SaaS frontend to the existing OpenClaw Express monorepo. The primary technical challenges are: (1) coexisting Next.js 16 and the Express backend on the same Vercel deployment via vercel.json route splitting, (2) implementing Supabase Auth with SSR using the new `@supabase/ssr` package and middleware-based session management, and (3) building a real-time dashboard that subscribes to mission updates via Supabase Realtime channels.

The recommended stack is Next.js 16 App Router + shadcn/ui + Tailwind CSS 4 + @supabase/ssr. This combination is the current production standard for SaaS dashboards on Vercel as of March 2026. The Vercel coexistence pattern requires restructuring vercel.json to use `builds` + `routes` arrays rather than the current simple `rewrites` catch-all — Express becomes a Vercel Function at `/api/express`, and Next.js handles all other routes.

**Primary recommendation:** Use Next.js 16 App Router with shadcn/ui charts (built on Recharts), keep the frontend in a `frontend/` subdirectory of the repo with its own `package.json` and `next.config.ts`, and split routing via vercel.json so Express handles `/webhooks/telnyx` and `/health` while Next.js owns everything else.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.1.6 | Frontend framework + SSR + API routes | Native Vercel platform, React 19, App Router stable |
| @supabase/supabase-js | 2.99.2 | Supabase client (browser) | Project already uses this exact package |
| @supabase/ssr | 0.9.0 | Server-side Supabase auth (cookies) | Required for App Router SSR auth; replaces deprecated auth-helpers |
| tailwindcss | 4.2.1 | Utility-first CSS | Project convention; CSS-first config (no tailwind.config.js) |
| shadcn | 4.0.8 | Component CLI + primitives | Standard dark SaaS UI; Tailwind v4 compatible as of 2026 |
| next-themes | 0.4.6 | Dark mode ThemeProvider | Required for shadcn dark mode in Next.js |
| recharts | 3.8.0 | Chart rendering (via shadcn charts) | Embedded in shadcn chart primitives |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vercel/analytics | latest | Page view tracking | Add to root layout for Vercel dashboard visibility |
| zod | 4.3.6 (project uses) | Form validation | Already in project; use for settings form schemas |
| react-hook-form | latest | Form state management | Pairs with zod for shadcn Form components |
| @hookform/resolvers | latest | zod adapter for react-hook-form | Required for zod integration |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn/ui charts (Recharts) | Tremor Raw | Tremor was acquired by Vercel Jan 2025; still OSS but shadcn charts are more tightly integrated |
| next-themes | Custom dark mode | next-themes eliminates flash-of-wrong-theme via suppressHydrationWarning |
| @supabase/ssr | Supabase auth-helpers | auth-helpers is deprecated; ssr package is the successor |

**Installation (frontend workspace):**
```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"
npx shadcn@latest init
npx shadcn@latest add button card form input label tabs badge separator avatar dropdown-menu
npx shadcn@latest add chart
npm install @supabase/supabase-js @supabase/ssr next-themes react-hook-form @hookform/resolvers zod
```

**Version verification (confirmed 2026-03-16):**
- `next`: 16.1.6
- `@supabase/ssr`: 0.9.0
- `@supabase/supabase-js`: 2.99.2
- `shadcn`: 4.0.8
- `tailwindcss`: 4.2.1
- `next-themes`: 0.4.6
- `recharts`: 3.8.0

---

## Architecture Patterns

### Monorepo Structure (Critical Decision)

The current repo is a pure Express/Node project. Next.js must be added alongside it without breaking the existing build. The recommended approach is a `frontend/` subdirectory with its own `package.json`:

```
/ (repo root)
├── src/                     # Existing Express backend (unchanged)
├── tests/                   # Existing Express tests (unchanged)
├── frontend/                # NEW: Next.js app
│   ├── package.json         # Next.js dependencies
│   ├── next.config.ts       # Next.js config
│   ├── src/
│   │   ├── app/             # App Router pages
│   │   │   ├── layout.tsx   # Root layout (ThemeProvider, fonts)
│   │   │   ├── page.tsx     # Landing page (/)
│   │   │   ├── (auth)/      # Route group — auth pages, no layout nav
│   │   │   │   ├── login/page.tsx
│   │   │   │   ├── signup/page.tsx
│   │   │   │   └── callback/route.ts   # OAuth callback
│   │   │   └── (dashboard)/ # Route group — protected pages, with nav
│   │   │       ├── layout.tsx           # Dashboard shell (sidebar)
│   │   │       ├── dashboard/page.tsx   # /dashboard
│   │   │       ├── missions/page.tsx    # /missions (real-time)
│   │   │       └── settings/page.tsx    # /settings
│   │   ├── components/      # Shared components
│   │   │   ├── ui/          # shadcn primitives (auto-generated)
│   │   │   ├── landing/     # Landing page sections
│   │   │   └── dashboard/   # Dashboard-specific components
│   │   └── lib/
│   │       ├── supabase/
│   │       │   ├── client.ts    # Browser client (createBrowserClient)
│   │       │   └── server.ts    # Server client (createServerClient)
│   │       └── types.ts         # Shared frontend types (re-export from backend)
│   └── middleware.ts         # Supabase auth token refresh
├── vercel.json              # UPDATED: builds + routes for coexistence
└── package.json             # Root: scripts to build both
```

### Pattern 1: Vercel Route Splitting (Express + Next.js Coexistence)

**What:** vercel.json uses `builds` to compile both Express (as a Vercel Function) and Next.js separately, then `routes` to direct traffic by path prefix.

**When to use:** Any Vercel deployment with two runtime targets on the same domain.

**Key insight from research:** The current `vercel.json` with `"rewrites": [{ "source": "/(.*)", "destination": "/api" }]` sends ALL traffic to Express. This must be replaced with a `builds` + `routes` structure. Vercel does NOT support running Next.js as a custom Express server — they must be separate build targets.

**Example:**
```json
// vercel.json (REPLACES current file)
{
  "version": 2,
  "builds": [
    {
      "src": "src/server.ts",
      "use": "@vercel/node"
    },
    {
      "src": "frontend/package.json",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    { "src": "/webhooks/(.*)", "dest": "src/server.ts" },
    { "src": "/health", "dest": "src/server.ts" },
    { "src": "/(.*)", "dest": "frontend/src/app/$1" }
  ]
}
```

**Warning:** This approach has complexity. Validate the exact `@vercel/node` + `@vercel/next` builder combination by testing a preview deployment early. Alternative: use Vercel's monorepo feature (two separate Vercel projects on same domain via Multi Zones). If route splitting proves brittle, Multi Zones is the fallback.

### Pattern 2: Supabase Auth with App Router SSR

**What:** `@supabase/ssr` provides `createServerClient` (for Server Components, Route Handlers, middleware) and `createBrowserClient` (for Client Components). A `middleware.ts` file refreshes the auth token on every request via cookies.

**When to use:** Every authenticated request in the App Router.

**Critical security rule:** Never use `supabase.auth.getSession()` in server code (middleware or Server Components). Always use `supabase.auth.getUser()` — it validates the token with Supabase's auth server on every call.

**Example — middleware.ts:**
```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Always use getUser(), never getSession()
  const { data: { user } } = await supabase.auth.getUser()

  // Protect dashboard routes
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

**Example — Server Component data fetch:**
```typescript
// Source: Supabase SSR docs
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
```

### Pattern 3: Supabase Realtime for Mission Updates

**What:** Client Components subscribe to Supabase Realtime channels to receive mission status updates without polling.

**When to use:** The missions dashboard page (WEB-04).

**Prerequisite:** Enable Realtime for the `missions` table in the Supabase dashboard (Publication settings).

**Example:**
```typescript
'use client'
// Source: https://supabase.com/docs/guides/realtime/realtime-with-nextjs
import { createBrowserClient } from '@supabase/ssr'
import { useEffect, useState } from 'react'
import type { Mission } from '@/lib/types'

export function MissionsTable({ initialMissions }: { initialMissions: Mission[] }) {
  const [missions, setMissions] = useState(initialMissions)
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const channel = supabase
      .channel('missions-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'missions',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        // Update local state on INSERT/UPDATE/DELETE
        setMissions(prev => updateMissionsFromPayload(prev, payload))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  return <table>...</table>
}
```

### Pattern 4: Dark Theme Setup (shadcn + Tailwind CSS 4)

**What:** Tailwind CSS 4 uses CSS-first configuration. No `tailwind.config.js` — all config in the main CSS file. shadcn's init command now scaffolds for Tailwind v4 automatically.

**When to use:** Project initialization (Wave 0 / Plan 01).

**Key change from Tailwind 3:** Colors are OKLCH instead of HSL. CSS variables under `@theme` directive instead of `tailwind.config.js`.

**Example — globals.css:**
```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme {
  --color-background: oklch(0.08 0.01 240);   /* deep dark */
  --color-foreground: oklch(0.96 0.01 240);
  --color-primary: oklch(0.65 0.2 280);        /* purple accent */
  --color-card: oklch(0.12 0.01 240 / 0.8);   /* glassmorphism */
}
```

**Dark mode in root layout:**
```typescript
// app/layout.tsx
import { ThemeProvider } from 'next-themes'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### Pattern 5: Google OAuth Flow

**What:** Supabase handles Google OAuth via the `signInWithOAuth` method. The callback is handled by a Next.js Route Handler that exchanges the code for a session.

**Required:** Google OAuth credentials configured in Supabase dashboard (Authentication > Providers > Google). Redirect URL set to `https://murphy.help/auth/callback`.

**Example — login page:**
```typescript
'use client'
const supabase = createBrowserClient(url, anonKey)
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: `${location.origin}/auth/callback` }
})
```

**Example — callback route handler:**
```typescript
// app/(auth)/callback/route.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(url, anonKey, {
      cookies: { getAll() { return cookieStore.getAll() },
                 setAll(c) { c.forEach(({name,value,options}) => cookieStore.set(name, value, options)) } }
    })
    await supabase.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(`${origin}/dashboard`)
}
```

### Anti-Patterns to Avoid
- **Using `getSession()` in server code:** Returns unvalidated JWT data from storage. Always use `getUser()` for server-side auth checks.
- **Applying a single catch-all rewrite in vercel.json:** The current config sends everything to Express. Next.js needs its own build target, not a rewrite destination.
- **Running Next.js as a custom Express server on Vercel:** Vercel explicitly does not support this. They must be separate build targets.
- **Global express.json() middleware:** Already a project rule — raw body needed for Telnyx webhook signatures. The Express route in vercel.json must still respect this.
- **Enabling Realtime without table publication:** The `missions` table must have Realtime enabled in the Supabase dashboard before subscriptions work.
- **Importing backend TypeScript types directly in frontend:** Use a shared `types.ts` re-export or duplicate the interface — do not create a cross-package import from `src/types/mission.ts` into `frontend/src/`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth token refresh across SSR/CSR | Cookie sync logic | `@supabase/ssr` middleware pattern | Edge cases with HttpOnly cookies, token expiry, concurrent requests |
| Dark mode without flash | Manual class toggle | `next-themes` with `suppressHydrationWarning` | Hydration mismatch is a well-known React SSR trap |
| Form validation | Custom validation | `react-hook-form` + zod resolvers | Async validation, field-level errors, accessibility |
| Charts | Custom SVG charts | shadcn chart primitives (Recharts) | Responsive, accessible, theming built-in |
| Google OAuth flow | Custom OAuth handshake | Supabase `signInWithOAuth` | State, PKCE, token storage handled by Supabase |
| Route protection | Manual JWT checks in each page | Middleware + `getUser()` | Runs at edge before page renders; cannot be bypassed by client |

**Key insight:** The auth layer is the highest-risk area. The `@supabase/ssr` middleware pattern eliminates entire categories of session bugs that plague hand-rolled implementations.

---

## Common Pitfalls

### Pitfall 1: Current vercel.json Catches All Traffic
**What goes wrong:** The existing `"rewrites": [{ "source": "/(.*)", "destination": "/api" }]` routes every request to the Express server. Adding Next.js as a second build target while keeping this rewrite means Next.js pages are never served.
**Why it happens:** The current vercel.json was written for Express-only; Next.js was not a deployment target.
**How to avoid:** Replace the rewrites array with a `builds` + `routes` structure. Express gets specific path prefixes (`/webhooks/`, `/health`); Next.js catches everything else.
**Warning signs:** Visiting murphy.help returns the Express JSON response `{ service: 'OpenClaw Service Matchmaker' }` instead of the landing page.

### Pitfall 2: Using getSession() Instead of getUser() in Middleware
**What goes wrong:** `supabase.auth.getSession()` returns whatever is in the cookie without re-validating with Supabase auth servers. An attacker can forge a valid-looking session cookie.
**Why it happens:** `getSession()` feels like the obvious API; `getUser()` has a slightly higher latency cost.
**How to avoid:** Always use `supabase.auth.getUser()` in middleware and server components. It makes a network call to validate the token — that is intentional and required.
**Warning signs:** Auth works locally but fails to catch forged tokens in production.

### Pitfall 3: Supabase ANON Key vs SERVICE_ROLE Key in Frontend
**What goes wrong:** The existing `src/lib/db/supabase-client.ts` uses `SUPABASE_SERVICE_ROLE_KEY` (server-side only). The frontend browser client MUST use `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon key is safe to expose publicly because RLS policies protect the data.
**Why it happens:** Developers copy the backend Supabase setup into the frontend without switching keys.
**How to avoid:** Create separate frontend env vars: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
**Warning signs:** Vercel build warnings about server-only env vars being used in client bundles.

### Pitfall 4: Tailwind CSS 4 Config Not CSS-First
**What goes wrong:** Generating a `tailwind.config.js` file (Tailwind 3 pattern) when Tailwind 4 expects CSS-first configuration via `@theme` in the main CSS file.
**Why it happens:** Documentation and blog posts for Tailwind 3 are far more prevalent; shadcn init with older templates may scaffold the wrong config.
**How to avoid:** Verify shadcn version is 4.x (`npx shadcn@latest`). Check that `globals.css` starts with `@import "tailwindcss"` not `@tailwind base`.
**Warning signs:** `tailwind.config.js` exists alongside Tailwind v4; classes stop working.

### Pitfall 5: Realtime Subscription Not Cleaned Up
**What goes wrong:** Navigating away from the missions page without removing the Supabase Realtime channel causes memory leaks and ghost subscriptions that accumulate.
**Why it happens:** `useEffect` cleanup is easy to forget when the subscription setup looks like a fire-and-forget call.
**How to avoid:** Always return `() => { supabase.removeChannel(channel) }` from the `useEffect`.
**Warning signs:** Supabase dashboard shows an increasing number of active realtime connections per user session.

### Pitfall 6: TypeScript Cross-Package Import Between Express and Next.js
**What goes wrong:** Importing `import type { Mission } from '../../../src/types/mission'` from inside `frontend/src/` creates a cross-package TypeScript reference that breaks Vercel's isolated build for the Next.js project.
**Why it happens:** It works in local `ts-node` but breaks when Vercel builds `frontend/` in isolation.
**How to avoid:** Copy the Mission, MissionStep, CallState interfaces into `frontend/src/lib/types.ts` as a duplication — or publish them as a shared internal package. Do not use relative `../` paths that cross the `frontend/` boundary.

---

## Code Examples

### Landing Page Hero Section (Server Component)
```typescript
// Source: shadcn/ui pattern + project copy
// frontend/src/app/page.tsx
export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-6xl font-bold tracking-tight text-foreground">
          One call replaces five.
        </h1>
        <p className="mt-6 text-xl text-muted-foreground max-w-2xl mx-auto">
          Murphy finds local service providers, calls them to check availability,
          then connects you live — all while you wait on the line.
        </p>
        <a
          href="tel:+18888306873"
          className="mt-10 inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-full text-lg font-semibold hover:bg-primary/90 transition"
        >
          Call Murphy: +1-888-830-6873
        </a>
      </section>
    </main>
  )
}
```

### Dashboard Call History (Server Component with Supabase fetch)
```typescript
// frontend/src/app/(dashboard)/dashboard/page.tsx
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  const { data: calls } = await supabase
    .from('call_history')
    .select('*')
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return <CallHistoryTable calls={calls ?? []} />
}
```

### shadcn Chart for Analytics
```typescript
// Source: https://ui.shadcn.com/charts
'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'

export function ServiceTypeChart({ data }: { data: { type: string; count: number }[] }) {
  return (
    <ChartContainer config={{ count: { label: 'Calls', color: 'var(--color-primary)' } }}>
      <BarChart data={data}>
        <XAxis dataKey="type" />
        <YAxis />
        <ChartTooltip />
        <Bar dataKey="count" fill="var(--color-primary)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | auth-helpers is deprecated; ssr is the replacement |
| `tailwind.config.js` | CSS-first `@theme` in globals.css | Tailwind v4 (2025) | No JS config file; all in CSS |
| HSL color variables | OKLCH color variables | Tailwind v4 | Better perceptual uniformity; shadcn migrated |
| Next.js 15 | Next.js 16.x | Dec 2025 | Turbopack file system caching stable; same App Router API |
| `supabase.auth.getSession()` in middleware | `supabase.auth.getUser()` | 2024 security guidance | getSession() is insecure in server context |
| Tremor | shadcn charts (Recharts-based) | 2025 | Tremor acquired by Vercel Jan 2025; shadcn charts are now the primary recommendation |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Use `@supabase/ssr` instead.
- `tailwind.config.js` with Tailwind v4: Use CSS `@theme` directive.
- `supabase.auth.getSession()` in server code: Use `supabase.auth.getUser()`.
- `next/head` in App Router: Use `export const metadata` instead.

---

## Open Questions

1. **Vercel Build Target for Express + Next.js in Same Repo**
   - What we know: `builds` + `routes` in vercel.json can route path prefixes to separate functions; `@vercel/node` handles Express; `@vercel/next` handles Next.js.
   - What's unclear: Whether the current `src/server.ts` (which requires the OpenClaw gateway process) will behave correctly as a Vercel Function given the gateway startup sequence. The gateway runs as a child process — Vercel Functions are stateless.
   - Recommendation: The existing Express server has OpenClaw gateway startup logic in the CLI entrypoint guard (`isDirectExecution`). On Vercel, it runs as a serverless function (not a long-lived process), so the gateway startup code will NOT run. This is likely fine since Telnyx webhooks only need the Express route handler, not the gateway. Verify this assumption in Wave 0 (Plan 01) before building the frontend.

2. **Supabase call_history Table Schema**
   - What we know: `CallState` in `src/lib/voice/call-state.ts` defines the in-memory shape; `POST-04` (Phase 6) requires persisting call data to Supabase — but Phase 6 is not yet implemented.
   - What's unclear: Whether a `call_history` table exists in Supabase yet. If not, the dashboard will need a placeholder or the table must be created in Wave 0.
   - Recommendation: Create the `call_history` table as part of this phase's Wave 0 database migration if it doesn't already exist.

3. **Phone Number Linkage for User Accounts**
   - What we know: User accounts are tied to phone number for call history lookup (from CONTEXT.md).
   - What's unclear: The mechanism — is it done at signup (user provides their phone number) or inferred from call data?
   - Recommendation: Collect phone number at signup via a profile completion step after OAuth. Store in Supabase user metadata (`user_metadata.phone`). Use it to query call history by `caller_phone`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 + supertest 7.2.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements — Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WEB-01 | Landing page renders at / | smoke | `npm test -- --grep "landing"` | ❌ Wave 0 |
| WEB-02 | Auth middleware redirects unauthenticated to /login | unit | `npm test -- --grep "middleware"` | ❌ Wave 0 |
| WEB-03 | Call history fetched from Supabase for authenticated user | integration | `npm test -- --grep "call history"` | ❌ Wave 0 |
| WEB-04 | Mission realtime subscription set up and torn down cleanly | unit | `npm test -- --grep "missions realtime"` | ❌ Wave 0 |
| WEB-05 | Settings form saves profile updates | unit | `npm test -- --grep "settings"` | ❌ Wave 0 |
| WEB-06 | Express webhook route still accessible (routing not broken) | integration | `npm test -- tests/api/webhooks.test.ts` | ✅ exists |
| WEB-07 | Pages render without errors (smoke test) | smoke | `npm test -- --grep "render"` | ❌ Wave 0 |

**Note on WEB-07 (Lighthouse > 90):** Lighthouse is not automatable in Vitest. Manual verification via Chrome DevTools or `npx lighthouse https://murphy.help --output html` after deployment.

### Sampling Rate
- **Per task commit:** `npm test -- tests/api/webhooks.test.ts` (ensures Express routing is not broken)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green + manual Lighthouse check before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `frontend/src/app/__tests__/landing.test.tsx` — covers WEB-01 (renders hero, phone number CTA)
- [ ] `frontend/src/middleware.test.ts` — covers WEB-02 (auth redirect behavior)
- [ ] `frontend/src/__tests__/call-history.test.tsx` — covers WEB-03 (Supabase query mock)
- [ ] `frontend/src/__tests__/missions-realtime.test.tsx` — covers WEB-04 (channel subscribe/unsubscribe)
- [ ] `frontend/src/__tests__/settings.test.tsx` — covers WEB-05 (form submit)
- [ ] `frontend/vitest.config.ts` — Vitest config for the frontend workspace
- [ ] `frontend/package.json` — Next.js workspace package
- [ ] Supabase `call_history` table migration — required before WEB-03 dashboard data loads

---

## Sources

### Primary (HIGH confidence)
- npm registry (2026-03-16) — verified package versions for next, @supabase/ssr, @supabase/supabase-js, shadcn, tailwindcss, next-themes, recharts
- https://supabase.com/docs/guides/auth/server-side/nextjs — Supabase SSR auth setup, getUser() vs getSession(), middleware pattern
- https://vercel.com/docs/frameworks/full-stack/nextjs — Vercel Next.js deployment capabilities
- https://vercel.com/guides/using-express-with-vercel — Express as Vercel Function deployment model
- https://ui.shadcn.com/docs/tailwind-v4 — shadcn Tailwind v4 compatibility and CSS-first config
- https://ui.shadcn.com/docs/dark-mode/next — next-themes setup for shadcn dark mode

### Secondary (MEDIUM confidence)
- https://vercel.com/docs/monorepos — Vercel monorepo support and Related Projects feature
- WebSearch: "Vercel Next.js Express coexist same deployment" — confirmed builds+routes approach; no single official doc covers this precisely
- WebSearch: "shadcn/ui Next.js dark theme Tailwind CSS 4 setup 2026" — confirmed Tailwind v4 CSS-first config and OKLCH colors
- WebSearch: Next.js 16.1.6 release notes (releasebot.io/updates/vercel/next-js) — confirmed current version

### Tertiary (LOW confidence)
- WebSearch: builds+routes vercel.json pattern for Next.js + Express coexistence — pattern described across community sources but no single authoritative Vercel doc confirms the exact builder combination `@vercel/next` + `@vercel/node` in one vercel.json. Validate in Wave 0.

---

## Metadata

**Confidence breakdown:**
- Standard stack versions: HIGH — confirmed via npm registry 2026-03-16
- Supabase auth patterns: HIGH — verified against official Supabase docs
- Vercel coexistence (Express + Next.js): MEDIUM — community pattern; no single Vercel doc confirms exact builder syntax; validate early
- Tailwind v4 + shadcn: HIGH — official shadcn docs confirm Tailwind v4 support
- Realtime subscription pattern: MEDIUM — official Supabase docs exist but exact Next.js 16 compatibility not confirmed
- Architecture pitfalls: HIGH — all identified from known Vercel/Supabase constraints in official docs

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (Supabase SSR API evolves; re-verify @supabase/ssr changelog if > 30 days)

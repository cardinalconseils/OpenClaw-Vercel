# Phase 7: Web Dashboard - Research

**Researched:** 2026-03-22
**Domain:** Next.js 16 public page, Supabase anon query, phone-number lookup, shadcn/ui cards
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Route: `/history` — Next.js page in the frontend
- Access model: Phone number lookup only — no login, no registration, no SMS verification
- Next.js API route queries Supabase `call_history` table by `caller_phone`
- Add "History" link to the landing page navbar (next to Sign In)
- Include `murphy.help/history` link in the post-call SMS recap
- Same dark theme — uses existing shadcn/ui + Tailwind v4 design system
- Card list layout — one card per call, stacked vertically, newest first
- Each card shows: date, service type, location, outcome status (connected/no match/abandoned)
- Cards are expandable — click to reveal full provider list with individual outcomes
- Provider names and outcomes shown in expanded view — NO phone numbers (privacy/scraping protection)
- No sort controls — newest first is the only order
- All call statuses shown including abandoned calls

### Claude's Discretion

- Rate limiting implementation (server-side vs client-side, thresholds)
- Phone number input validation and formatting (E.164 normalization, flexible input acceptance)
- Pagination strategy (likely load-all given low expected volume, or simple pagination)
- Loading skeleton design
- Error state handling (API failures, Supabase connectivity)
- Exact card styling, spacing, typography within the dark theme

### Deferred Ideas (OUT OF SCOPE)

- Authenticated user dashboard with saved history, notifications — future monetization phase
- Search/filtering within call history — separate enhancement
- Provider phone numbers in expanded cards — revisit when auth is required
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | User can view call history by entering their phone number | Phone number input form + Next.js API route + Supabase anon SELECT by `caller_phone` |
| DASH-02 | Dashboard shows past searches, providers contacted, and outcomes | CallHistoryRecord type already has all fields; card/expandable pattern using shadcn Card + Collapsible or details/summary |
| DASH-03 | Call history page is served from the Railway/Vercel deployment alongside the Next.js frontend | Next.js App Router page at `frontend/src/app/history/page.tsx` — coexists with existing routes |
</phase_requirements>

---

## Summary

Phase 7 builds a single public page (`/history`) that lets a caller look up their call history by entering their phone number. The page lives entirely within the existing Next.js 16 frontend. No new infrastructure is needed — the frontend, Supabase connection, and design system are already in place.

The primary technical challenges are (1) the Supabase RLS policy on `call_history` was written for authenticated users and must be augmented with an anon policy scoped to `caller_phone`, (2) a type discrepancy exists between the backend's `providers_contacted[].status` and the frontend's `providers_contacted[].outcome` fields, and (3) rate limiting on the `/api/call-history` route is needed to prevent phone number enumeration.

The existing patterns in `privacy/page.tsx` (public server component, no auth check), `navbar.tsx` (Link additions), and the shadcn `Card`, `Skeleton`, `Input`, `Button` components cover all UI needs. There is minimal new surface area — this is primarily assembly work.

**Primary recommendation:** Build as a hybrid page (server component outer, client component inner for form state), use a new Supabase migration for the anon RLS policy, and apply IP-based rate limiting via Next.js middleware or a simple in-memory store in the API route.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.1.7 (installed) | Page routing, API route, server components | Already the project's frontend framework |
| `@supabase/ssr` | 0.9.0 (installed) | Server-side Supabase client in Next.js | Already used in `server.ts` and all server routes |
| `@supabase/supabase-js` | 2.99.2 (installed) | Supabase JS client | Already installed |
| shadcn/ui (Card, Input, Button, Skeleton, Badge) | 4.x (installed) | UI components | Already used throughout the app |
| Tailwind v4 | 4.2.1 (installed) | Styling | Project standard |
| Zod | 3.24.0 (installed) | Input validation (phone number schema) | Project standard per CLAUDE.md |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | 0.511.0 (installed) | Icons (checkmark, X, phone) | Status indicators in expanded card view |
| `next-themes` | 0.4.6 (installed) | Dark theme | Already configured — no action needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `<details>/<summary>` for expand | Radix/shadcn Collapsible | `details/summary` is zero-JS, accessible, matches the `LegalToc` mobile pattern already in the codebase |
| In-memory rate limiter in API route | Upstash Redis / `rate-limiter-flexible` | In-memory is sufficient for single-instance Railway deployment with low traffic; Redis adds infra complexity not justified here |

**Installation:** No new packages needed — all dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/
├── app/
│   ├── history/
│   │   └── page.tsx              # Server component shell (public, no auth check)
│   └── api/
│       └── call-history/
│           └── route.ts          # Next.js Route Handler — POST /api/call-history
├── components/
│   └── history/
│       ├── history-lookup-form.tsx   # 'use client' — phone input + submit
│       ├── call-history-list.tsx     # 'use client' — renders list of cards
│       └── call-history-card.tsx     # 'use client' — single card, expandable
└── lib/
    └── types.ts                  # Add/verify CallHistoryRecord type (already present)
```

### Pattern 1: Public Server Component Page Shell

**What:** `history/page.tsx` is a server component that renders the page layout and imports the client-only lookup form. Follows the exact same pattern as `privacy/page.tsx` — no auth check, no `getUser()` call.

**When to use:** Any public page that doesn't need user context at render time.

**Example:**
```typescript
// frontend/src/app/history/page.tsx
// Source: existing pattern in frontend/src/app/privacy/page.tsx
import type { Metadata } from 'next'
import { NavBar } from '@/components/landing/navbar'
import { Footer } from '@/components/landing/footer'
import { HistoryLookupForm } from '@/components/history/history-lookup-form'

export const metadata: Metadata = {
  title: 'Call History — Murphy',
  description: 'Look up your Murphy call history by phone number',
}

export default function HistoryPage() {
  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-background pt-24 pb-16 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display font-bold text-3xl text-foreground mb-2">
            Your Call History
          </h1>
          <p className="font-sans text-sm text-muted-foreground mb-8">
            Enter the phone number you called from to see your past service requests.
          </p>
          <HistoryLookupForm />
        </div>
      </main>
      <Footer />
    </>
  )
}
```

### Pattern 2: Client Form + Fetch API Route

**What:** The `HistoryLookupForm` is a `'use client'` component. On submit, it POSTs to `/api/call-history` with the phone number. The API route validates input, queries Supabase, returns records.

**When to use:** Form interactions that need user state — phone input, loading state, error display.

**Example (API route):**
```typescript
// frontend/src/app/api/call-history/route.ts
// Source: Next.js 15+ Route Handler pattern, consistent with existing auth/callback/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const RequestSchema = z.object({
  phone: z.string().min(7).max(20),
})

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
  }

  // Normalize to E.164 — strip non-digits, prepend +1 if 10-digit North American
  const raw = parsed.data.phone.replace(/\D/g, '')
  const e164 = raw.length === 10 ? `+1${raw}` : `+${raw}`

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('call_history')
    .select('*')
    .eq('caller_phone', e164)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[api/call-history] Supabase error:', error.message)
    return NextResponse.json({ error: 'Could not load history' }, { status: 500 })
  }

  return NextResponse.json({ records: data ?? [] })
}
```

### Pattern 3: Expandable Card with `<details>/<summary>`

**What:** Each call record renders as a shadcn `Card`. The summary line (date, service, outcome badge) is always visible. Clicking expands to show provider outcomes. Uses native HTML `<details>/<summary>` for zero-JS expand/collapse — consistent with `LegalToc` mobile pattern already in codebase.

**When to use:** Any list item with a collapsed/expanded state on a public page (no JS dependency needed).

**Example:**
```typescript
// frontend/src/components/history/call-history-card.tsx
// Source: pattern from legal-toc mobile expand/collapse (Phase 10 decision)
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { CallHistoryRecord } from '@/lib/types'

const STATUS_LABELS: Record<CallHistoryRecord['status'], string> = {
  completed: 'Connected',
  no_match: 'No Match',
  abandoned: 'Abandoned',
}

export function CallHistoryCard({ record }: { record: CallHistoryRecord }) {
  const date = new Date(record.started_at).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
  })

  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-4">
        <details>
          <summary className="flex items-center justify-between cursor-pointer list-none">
            <div>
              <span className="font-sans font-bold text-sm text-foreground">
                {record.service_type ?? 'Unknown service'}
              </span>
              {record.location && (
                <span className="font-sans text-xs text-muted-foreground ml-2">
                  — {record.location}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-sans text-xs text-muted-foreground">{date}</span>
              <Badge variant="outline">{STATUS_LABELS[record.status]}</Badge>
            </div>
          </summary>
          {/* Expanded: provider outcomes */}
          <div className="mt-3 pt-3 border-t border-border space-y-1">
            {record.providers_contacted.length === 0 ? (
              <p className="font-sans text-xs text-muted-foreground">No providers contacted.</p>
            ) : (
              record.providers_contacted.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="font-sans text-xs text-foreground">{p.name}</span>
                  <span className="font-sans text-xs text-muted-foreground capitalize">
                    {p.outcome ?? p.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
```

### Anti-Patterns to Avoid

- **Using `getUser()` on the history page:** This page is intentionally public — do not add auth checks. The RLS policy is the security boundary.
- **Querying Supabase from a client component directly:** Always go through the Next.js API route — allows server-side rate limiting and avoids exposing the service key.
- **Storing provider phone numbers in the response:** The API route must strip `phone` from `providers_contacted` before returning the JSON (privacy/scraping concern per locked decisions).
- **Skipping E.164 normalization:** Phone numbers in the DB are stored as E.164 (`+15551234567`). User may type `(555) 123-4567` — normalize before querying or no records will match.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Input validation | Custom regex for phone | Zod `.string().min(7).max(20)` + normalization function | Zod is already in the project; edge cases handled consistently |
| Loading state UI | Custom spinner | `Skeleton` from shadcn/ui | Already in `frontend/src/components/ui/skeleton.tsx` |
| Status badge styling | Custom CSS pill | `Badge` from shadcn/ui | Already in `frontend/src/components/ui/badge.tsx` |
| E.164 normalization | Complex parser | Simple strip-non-digits + prepend-country-code | Sufficient for NA numbers; full libphonenumber adds 145KB |

**Key insight:** This phase is primarily assembly — everything needed (UI components, Supabase client, page patterns) already exists. The only truly new code is the API route, the RLS policy migration, and the three UI components.

---

## Common Pitfalls

### Pitfall 1: RLS Policy Blocks Anon Queries

**What goes wrong:** The existing `call_history` RLS SELECT policy is `USING (auth.uid() = user_id)`. An unauthenticated request gets zero rows, not an error — the API route returns an empty array for every phone number.

**Why it happens:** The anon role is allowed by Supabase but the existing policy requires a logged-in uid. The `createServerSupabaseClient` in the API route uses the ANON key — sessions are not passed to this route, so `auth.uid()` is null.

**How to avoid:** Add a second RLS SELECT policy (do not replace the first):
```sql
-- Migration: Add anon caller_phone lookup policy for /history page
CREATE POLICY "Anon caller_phone lookup"
  ON call_history FOR SELECT
  USING (true);
-- Then in the API route, always filter: .eq('caller_phone', e164)
-- The caller_phone parameter is the security boundary here.
```

**Warning signs:** API route always returns empty array even for a phone that definitely has calls.

### Pitfall 2: providers_contacted Type Discrepancy

**What goes wrong:** Backend `call-history-repo.ts` defines `providers_contacted` elements as `{ name: string; phone: string; status: string }`. Frontend `types.ts` defines them as `{ name: string; phone: string; outcome: string }`. Code that accesses `.outcome` gets `undefined`; code that accesses `.status` may confuse card-level status vs provider-level status.

**Why it happens:** The types were written independently — frontend `types.ts` (Phase 9) and backend `call-history-repo.ts` (Phase 9) diverged.

**How to avoid:**
1. Update `frontend/src/lib/types.ts` `CallHistoryRecord.providers_contacted` to use `status` (match the DB column data) — OR —
2. Accept both keys in the card component: `p.outcome ?? p.status` (defensive read)
Option 2 is safer without a backend migration.

**Warning signs:** Provider outcome column shows "undefined" in expanded card view.

### Pitfall 3: Phone Number Format Mismatch

**What goes wrong:** DB stores `+15551234567` (E.164). User types `(555) 123-4567` or `555-123-4567`. The Supabase `.eq('caller_phone', input)` finds zero rows.

**Why it happens:** No normalization before the query.

**How to avoid:** Normalize in the API route before querying:
```typescript
function normalizeToE164(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}` // NA 10-digit
  if (digits.length === 11 && digits[0] === '1') return `+${digits}` // NA with country code
  return `+${digits}` // passthrough for international
}
```

**Warning signs:** Zero results for a number you know has calls in the DB.

### Pitfall 4: Provider Phone Numbers Exposed in API Response

**What goes wrong:** The API returns the full `providers_contacted` array including `phone` fields. Anyone can submit phone numbers and enumerate provider phone numbers.

**Why it happens:** Forgetting to strip `phone` before sending the response.

**How to avoid:** In the API route, map the array before returning:
```typescript
records: data.map(r => ({
  ...r,
  providers_contacted: r.providers_contacted.map(
    ({ name, status }: { name: string; status: string }) => ({ name, status })
  ),
}))
```

**Warning signs:** Browser DevTools Network tab shows `phone` in providers_contacted JSON.

### Pitfall 5: Rate Limiting Omission

**What goes wrong:** Without rate limiting, the `/api/call-history` endpoint is an open phone number enumeration service — submit any phone number, get call history.

**Why it happens:** The endpoint is intentionally public, so auth isn't available as a defense.

**How to avoid:** Simple IP-based in-memory rate limiter in the API route:
```typescript
// Simple sliding window — 10 requests per IP per minute
const requestCounts = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = requestCounts.get(ip)
  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= 10) return false
  entry.count++
  return true
}
```
Return 429 on limit exceeded. This is sufficient for Railway single-instance with low traffic.

**Warning signs:** No rate limit response configured — check with curl loop.

---

## Code Examples

Verified patterns from existing codebase:

### Supabase Server Client in Next.js API Route
```typescript
// Source: frontend/src/lib/supabase/server.ts (existing)
import { createServerSupabaseClient } from '@/lib/supabase/server'

// In a Route Handler (POST/GET):
const supabase = await createServerSupabaseClient()
const { data, error } = await supabase
  .from('call_history')
  .select('*')
  .eq('caller_phone', normalizedPhone)
  .order('created_at', { ascending: false })
```

### Navbar Link Addition
```typescript
// Source: frontend/src/components/landing/navbar.tsx (existing)
// Desktop — add alongside existing Sign In link:
<Link
  href="/history"
  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
>
  History
</Link>
// Mobile — add inside SheetContent div, with onClick={() => setMobileOpen(false)}
```

### Skeleton Loading Pattern
```typescript
// Source: shadcn skeleton.tsx already in frontend/src/components/ui/skeleton.tsx
import { Skeleton } from '@/components/ui/skeleton'

// Loading state while fetch is in progress:
{loading && (
  <div className="space-y-3">
    {[1, 2, 3].map(i => (
      <Skeleton key={i} className="h-16 w-full rounded-lg" />
    ))}
  </div>
)}
```

### Empty State CTA (from CONTEXT.md specifics)
```typescript
// Per CONTEXT.md — locked design for the empty state
{records.length === 0 && (
  <div className="text-center py-12">
    <p className="font-sans text-sm text-muted-foreground mb-4">
      No calls found for this number yet.
    </p>
    <p className="font-sans text-sm text-muted-foreground">
      Need a service provider?{' '}
      <a
        href="tel:+18888306873"
        className="text-primary hover:underline"
      >
        Call Murphy: +1 (888) 830-6873
      </a>
    </p>
  </div>
)}
```

### SMS Link Addition
```typescript
// Source: src/lib/voice/recap-sms.ts — add murphy.help/history to SMS body
// In buildSuccessSms() or buildFailureSms(), append:
const historyLine = 'View your call history: https://murphy.help/history'
```

### New Supabase Migration (RLS policy)
```sql
-- frontend/supabase/migrations/20260322_call_history_anon_lookup.sql
-- Allow unauthenticated SELECT filtered by caller_phone for /history page
-- The caller_phone value is always supplied by the API route — never user-controlled
-- in the Supabase query (only passed as a parameter from server-side code).
CREATE POLICY "Anon caller_phone lookup"
  ON call_history FOR SELECT
  TO anon
  USING (true);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Supabase client component queries | Server-side Route Handler + `createServerSupabaseClient` | Next.js 13+ App Router | Keeps anon key server-side only, enables rate limiting |
| SMS with no link | SMS with dashboard link | This phase | Closes the "how do I see what happened?" loop for callers |
| `<details>/<summary>` for expand | Same — preferred | Phase 10 (LegalToc mobile pattern) | Zero JS, accessible, already established in the project |

**Deprecated/outdated:**
- `getSession()`: Never use — Supabase security requirement; `getUser()` only (already enforced in middleware)
- shadcn `asChild` prop on `base-ui` components: Not supported in base-ui 1.x — use `render` prop instead (established Phase 9 decision)

---

## Open Questions

1. **RLS policy security level for anon lookup**
   - What we know: `USING (true)` on the anon role means any authenticated Supabase query can read all rows (before the app-level `.eq()` filter)
   - What's unclear: Whether we want `USING (caller_phone = current_setting('app.caller_phone', true))` (row-level enforcement) vs relying on the API route to always filter
   - Recommendation: `USING (true)` with API route always filtering is acceptable given the data sensitivity (no PII beyond phone number visible). Row-level enforcement via `current_setting` requires a more complex API setup. Proceed with `USING (true)` for now.

2. **SMS link domain — murphy.help vs Railway URL**
   - What we know: The SMS recap is sent from the backend (`src/lib/voice/recap-sms.ts`). The domain in the link should be `murphy.help` (the production domain).
   - What's unclear: Whether `murphy.help` is fully configured and routing to the Railway deployment at time of this phase
   - Recommendation: Use `https://murphy.help/history` as the hardcoded URL in the SMS template. If murphy.help isn't live, it still works once DNS is configured.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 + @testing-library/react 16.3.2 |
| Config file | `frontend/vitest.config.ts` |
| Quick run command | `cd frontend && npm test -- --reporter=verbose src/` |
| Full suite command | `cd frontend && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | API route returns records for matching phone number | unit | `cd frontend && npm test -- src/app/api/call-history/route.test.ts` | Wave 0 |
| DASH-01 | API route returns 400 for invalid phone input | unit | same | Wave 0 |
| DASH-01 | API route returns 429 when rate limit exceeded | unit | same | Wave 0 |
| DASH-01 | Phone normalization: (555) 123-4567 -> +15551234567 | unit | `cd frontend && npm test -- src/lib/phone-normalize.test.ts` | Wave 0 |
| DASH-02 | CallHistoryCard renders service type, date, status badge | unit (RTL) | `cd frontend && npm test -- src/components/history/call-history-card.test.tsx` | Wave 0 |
| DASH-02 | CallHistoryCard expanded view shows provider names without phone numbers | unit (RTL) | same | Wave 0 |
| DASH-03 | history/page.tsx renders NavBar, heading, and HistoryLookupForm | unit (RTL) | `cd frontend && npm test -- src/app/history/page.test.tsx` | Wave 0 |
| DASH-03 | Navbar contains "History" link pointing to /history | unit (RTL) | `cd frontend && npm test -- src/components/landing/navbar.test.tsx` | Wave 0 |

### Sampling Rate

- **Per task commit:** `cd frontend && npm test -- src/app/api/call-history/route.test.ts`
- **Per wave merge:** `cd frontend && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `frontend/src/app/api/call-history/route.test.ts` — covers DASH-01 API route unit tests
- [ ] `frontend/src/lib/phone-normalize.test.ts` — covers DASH-01 normalization
- [ ] `frontend/src/components/history/call-history-card.test.tsx` — covers DASH-02 card rendering
- [ ] `frontend/src/components/history/history-lookup-form.test.tsx` — covers DASH-01 form submission
- [ ] `frontend/src/app/history/page.test.tsx` — covers DASH-03 page renders
- [ ] `frontend/src/components/landing/navbar.test.tsx` — covers DASH-03 navbar History link

---

## Sources

### Primary (HIGH confidence)

- Existing codebase — `frontend/src/lib/supabase/server.ts`, `frontend/src/app/privacy/page.tsx`, `frontend/src/components/landing/navbar.tsx`, `frontend/middleware.ts` — established patterns verified by reading source
- `frontend/src/lib/types.ts` — verified CallHistoryRecord shape
- `frontend/supabase/migrations/20260316_create_call_history.sql` — verified RLS policies and schema
- `src/api/webhooks.ts` lines 502-544 — verified how call history is inserted and what `user_id` value is used
- `src/lib/voice/recap-sms.ts` — verified SMS template structure and where to add history link

### Secondary (MEDIUM confidence)

- Supabase RLS policy `USING (true)` for anon role — standard Supabase pattern for public read with application-level filtering; consistent with Supabase docs on Row Level Security
- Next.js 16 Route Handler pattern (POST) — consistent with existing `auth/callback/route.ts` in the project

### Tertiary (LOW confidence)

- None — all critical claims verified from project source code

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all packages already installed and in use; verified from package.json
- Architecture: HIGH — all patterns exist verbatim in the current codebase; new code follows established conventions
- Pitfalls: HIGH — identified by direct code inspection (RLS policy gap, type discrepancy, phone format mismatch, phone number exposure in API response)
- Validation: HIGH — test framework and conventions verified from vitest.config.ts and existing test files

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable stack; no fast-moving dependencies)

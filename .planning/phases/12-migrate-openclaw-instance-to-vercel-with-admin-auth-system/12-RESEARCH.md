# Phase 12: Migrate OpenClaw Instance to Railway with /admin Auth System - Research

**Researched:** 2026-03-20
**Domain:** Railway deployment, Next.js reverse proxy (WebSocket), Supabase RBAC, domain migration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Deploy OpenClaw on Railway using the official Railway template (clawdbot-railway-template)
- Move the Next.js frontend from Vercel to Railway — single platform, single deployment
- Remove Vercel Sandbox entirely — no more dual-build vercel.json
- Railway Volume mounted at `/data` for persistent OpenClaw state/workspace
- Railway HTTP Proxy on port 8080 for public access
- Required env vars: SETUP_PASSWORD, PORT=8080, OPENCLAW_STATE_DIR=/data/.openclaw, OPENCLAW_WORKSPACE_DIR=/data/workspace, OPENCLAW_GATEWAY_TOKEN
- Proxy/embed OpenClaw's built-in Control UI (Vite + Lit SPA on port 18789) at `/admin`
- No custom admin panel to build — use OpenClaw's existing Control UI as-is
- Supabase user_metadata role-based access: `role='admin'` in user_metadata
- Non-admin authenticated users silently redirected to landing page (/)
- Middleware checks admin role on all `/admin/*` routes
- Login/signup stays visible on landing page navbar (future monetization potential)
- Fresh start — current dashboard components contain fake data
- Remove existing /dashboard route group entirely
- All admin functionality comes from OpenClaw Control UI at /admin

### Claude's Discretion
- Whether to consolidate Express routes into Next.js API routes or keep Express alongside Next.js on Railway
- Gateway manager / keep-alive / device pairing code: keep dormant or remove
- How to proxy the Control UI WebSocket connection through Next.js to the Gateway
- Railway service configuration (single service vs multi-service)

### Deferred Ideas (OUT OF SCOPE)
- Regular user dashboard with call history (when monetization is added) — separate phase
- Express to Next.js API route consolidation — can happen independently
- ClawdTalk client installation as OpenClaw skill — may be handled by Railway template
</user_constraints>

---

## Summary

Phase 12 migrates the entire deployment stack from Vercel to Railway and adds a Supabase-gated `/admin` route that proxies OpenClaw's built-in Control UI. The work breaks into three distinct problems: (1) Railway service architecture for running OpenClaw + Next.js together, (2) WebSocket-capable reverse proxy in Next.js for the Control UI, and (3) Supabase admin role check in middleware to gate `/admin/*` routes.

**Railway architecture:** The right approach is two separate Railway services within one project sharing private networking. The OpenClaw Railway template (`clawdbot-railway-template`) runs OpenClaw on port 8080 (with the gateway internally on 18789). The Next.js frontend is a separate service with its root directory set to `/frontend`. The services communicate over `openclaw-service.railway.internal:18789` (private network). Attempting to run both in a single service with multi-process support is not supported by Railway's Nixpacks — only a single process is permitted.

**WebSocket proxy:** Next.js `rewrites` in `next.config.ts` handle HTTP proxy to the Control UI well, but rewrites do NOT proxy WebSocket connections. The Control UI requires WebSocket for real-time features. The solution is a Next.js custom server (`server.ts`) using `http-proxy-middleware` (v3.0.5) that intercepts the WebSocket Upgrade event and forwards it to `openclaw-service.railway.internal:18789`. This is a known working pattern — the proxy library supports WebSocket upgrade forwarding natively.

**Admin auth:** The CONTEXT.md locks `user_metadata.role='admin'`, but security research shows `user_metadata` can be modified by any authenticated user. The planner must note this tradeoff: `user_metadata` is the locked decision, but the safe alternative is `app_metadata` (requires service role to write, unmodifiable by user). The middleware pattern is straightforward — call `getUser()`, check `user.user_metadata?.role === 'admin'`, redirect to `/` if not.

**Primary recommendation:** Two Railway services (OpenClaw + Next.js), private networking for internal proxy, custom Next.js server for WebSocket forwarding, middleware RBAC using `user_metadata.role`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `http-proxy-middleware` | 3.0.5 | HTTP + WebSocket reverse proxy in custom Next.js server | Only library that reliably proxies WebSocket upgrades in Next.js |
| `@supabase/ssr` | 0.9.0 (already installed) | Server-side Supabase client for middleware | Already in project, official Supabase SSR pattern |
| `next` | 16.1.7 (already installed) | Next.js framework | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `http-proxy` | 1.18.1 | Lower-level proxy if custom upgrade handling needed | Fallback if http-proxy-middleware has edge cases |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom server + http-proxy-middleware | Next.js `rewrites` in next.config.ts | Rewrites work for HTTP but silently drop WebSocket upgrades — Control UI breaks |
| Custom server + http-proxy-middleware | Separate nginx sidecar on Railway | More infra, another service to manage, solves same problem |
| Two Railway services | One service with Procfile multi-process | Railway Nixpacks only supports single process — multi-process requires Dockerfile |
| `user_metadata.role` | `app_metadata.role` | user_metadata is locked decision; app_metadata is more secure (service-role-only write) |

**Installation (new deps only — add to frontend/package.json):**
```bash
npm install http-proxy-middleware
```

**Version verification:**
- `http-proxy-middleware`: 3.0.5 (verified via `npm view` on 2026-03-20)

---

## Architecture Patterns

### Recommended Project Structure (Railway Services)

```
Railway Project: openclaw-prod
├── Service: openclaw          # clawdbot-railway-template
│   ├── Port: 8080 (public)
│   ├── Internal: openclaw.railway.internal:18789
│   ├── Volume: /data
│   └── Env: SETUP_PASSWORD, OPENCLAW_GATEWAY_TOKEN, PORT=8080, ...
│
└── Service: frontend          # Next.js, root dir = /frontend
    ├── Port: 3000 (public)
    ├── Custom domain: murphy.help
    └── Env: NEXT_PUBLIC_SUPABASE_URL, OPENCLAW_INTERNAL_URL, ...
```

### Next.js Directory Structure Changes
```
frontend/
├── server.ts              # NEW: Custom Node.js server (replaces next start)
├── middleware.ts          # MODIFIED: Add /admin RBAC check
├── next.config.ts         # MODIFIED: output: 'standalone', remove turbopack root
├── src/app/
│   ├── (admin)/           # NEW: Route group for admin layout
│   │   └── admin/
│   │       └── [[...path]]/
│   │           └── page.tsx  # Catch-all: shows 403 for non-admins (proxy handles real rendering)
│   ├── (auth)/            # KEEP as-is
│   ├── (dashboard)/       # REMOVE entirely
│   ├── page.tsx           # KEEP: landing page
│   ├── privacy/           # KEEP as-is
│   └── terms/             # KEEP as-is
```

### Pattern 1: Railway Two-Service Setup

**What:** Deploy OpenClaw via Railway template as `openclaw` service; deploy Next.js frontend as `frontend` service. Both in same Railway project and environment. Private networking enables `frontend` to reach `openclaw.railway.internal:18789`.

**When to use:** Any time you need two separate processes on Railway — this is the correct architecture.

**railway.toml for Next.js service:**
```toml
[build]
buildCommand = "npm install && npm run build"

[deploy]
startCommand = "node server.js"

[[services]]
rootDirectory = "/frontend"
```

**Service Settings (Railway UI):**
- Service `frontend`: Root Directory → `frontend/`
- Build Command: `npm run build`
- Start Command: `node server.js` (custom server, see Pattern 2)

### Pattern 2: Custom Next.js Server with WebSocket Proxy

**What:** A `server.ts` file at `frontend/` that starts Next.js programmatically, intercepts HTTP upgrade events, and proxies `/admin/*` to the OpenClaw Control UI via `http-proxy-middleware`.

**When to use:** Required because Next.js `rewrites` silently drop WebSocket upgrade headers. The Control UI uses WebSocket for real-time log streaming and chat — without WebSocket proxy the UI loads but is non-functional.

**Example:**
```typescript
// frontend/server.ts
// Source: http-proxy-middleware docs + Next.js custom server pattern
import { createServer } from 'http'
import next from 'next'
import { createProxyMiddleware } from 'http-proxy-middleware'

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

const OPENCLAW_INTERNAL = process.env.OPENCLAW_INTERNAL_URL ?? 'http://openclaw.railway.internal:18789'

const controlUiProxy = createProxyMiddleware({
  target: OPENCLAW_INTERNAL,
  changeOrigin: true,
  ws: true,                          // Enable WebSocket proxying
  pathRewrite: { '^/admin': '' },    // Strip /admin prefix before forwarding
})

app.prepare().then(() => {
  const server = createServer((req, res) => {
    if (req.url?.startsWith('/admin')) {
      return controlUiProxy(req, res, () => {})
    }
    handle(req, res)
  })

  // Forward WebSocket upgrades for /admin paths
  server.on('upgrade', (req, socket, head) => {
    if (req.url?.startsWith('/admin')) {
      controlUiProxy.upgrade!(req, socket, head)
    }
  })

  server.listen(process.env.PORT ?? 3000, () => {
    console.log(`Ready on port ${process.env.PORT ?? 3000}`)
  })
})
```

**Critical note on path rewrite:** The OpenClaw Control UI is served at `/` on port 18789 (not `/admin`). The proxy MUST strip the `/admin` prefix. Verify actual Control UI path by checking the Railway template's `/openclaw` vs root path behavior — the template docs mention `/openclaw` as the control UI endpoint. If the Control UI is at `/openclaw` on port 18789, the rewrite changes to: `pathRewrite: { '^/admin': '/openclaw' }`.

### Pattern 3: Middleware Admin RBAC Check

**What:** Extend existing `middleware.ts` to check `user.user_metadata?.role === 'admin'` on all `/admin/*` routes.

**When to use:** Every request to `/admin/*`. Combined with the custom server proxy — middleware runs first to auth-gate, then the custom server proxies authenticated requests through to OpenClaw.

**Example:**
```typescript
// middleware.ts — extend existing middleware with /admin check
// Source: Supabase SSR docs + existing codebase pattern

// Add inside the middleware function, before existing dashboard checks:

// Protect /admin routes — require admin role
if (request.nextUrl.pathname.startsWith('/admin')) {
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  const role = user.user_metadata?.role
  if (role !== 'admin') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)  // Silently redirect non-admins to landing
  }
}
```

**Security note (for planner):** The locked decision is `user_metadata.role`. This field CAN be modified by the authenticated user themselves via `supabase.auth.updateUser()`. For a gated admin panel controlling production infrastructure, the safer approach is `app_metadata.role` (requires service role key to write, invisible to client SDK). The planner should flag this tradeoff in tasks — the decision is locked, but a follow-up hardening task can migrate to app_metadata later.

### Pattern 4: next.config.ts for Railway Standalone Build

**What:** Next.js must output a standalone build for Railway (self-hosted). Without `output: 'standalone'`, the start command `node server.js` won't work.

```typescript
// frontend/next.config.ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'standalone',
  // Remove turbopack.root — not needed for Railway production build
}

export default config
```

**Note:** Remove `turbopack: { root: ... }` — this was only needed to resolve the Vercel dual-lockfile warning. On Railway it's irrelevant and may cause issues.

### Anti-Patterns to Avoid
- **Next.js `rewrites` for Control UI:** `rewrites` in `next.config.ts` proxy HTTP requests only. WebSocket upgrades are silently dropped. The Control UI appears to load but real-time features (logs, chat) silently fail.
- **Single Railway service with both processes via Procfile:** Railway Nixpacks supports only one process. Use two services with private networking instead.
- **Running the proxy in API routes:** Serverless API routes are short-lived and cannot hold a WebSocket connection open. Custom server is required.
- **`app_metadata` in middleware with anon key:** `app_metadata` requires service role to read via admin API — you cannot read it efficiently in edge middleware. `user_metadata` is the correct choice for middleware-accessible role data (with the security tradeoff noted above).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP + WebSocket proxy | Custom proxy using raw `net.Socket` | `http-proxy-middleware` | Handles headers, CORS, connection reuse, upgrade events, error recovery |
| Domain validation | Custom CNAME polling | Railway UI + automatic Let's Encrypt | Railway provisions SSL automatically, no custom cert management needed |
| Admin role check | JWT decode in middleware | `supabase.auth.getUser()` + `user_metadata.role` | getUser() validates token with Supabase auth server on every request — safe |

**Key insight:** The Control UI proxy is the only technically novel piece. Everything else (auth, routing, deployment) follows patterns already established in the codebase or in official tooling.

---

## Common Pitfalls

### Pitfall 1: WebSocket Connections Silently Dropped by Next.js Rewrites
**What goes wrong:** Developer adds `rewrites` to `next.config.ts` pointing `/admin/:path*` at the Control UI. HTTP pages load. WebSocket connections for live logs and chat open but immediately close. The Control UI shows a "disconnected" state.
**Why it happens:** Next.js rewrites are implemented at the HTTP level only. The WebSocket handshake starts with an HTTP Upgrade request which rewrites do not intercept.
**How to avoid:** Use a custom server with `http-proxy-middleware` `ws: true` and listen to the `upgrade` event on the HTTP server (see Pattern 2).
**Warning signs:** Control UI loads but shows "Connection lost" or live log panel is empty.

### Pitfall 2: /admin Proxy Path Prefix Mismatch
**What goes wrong:** Proxy forwards `/admin/styles.css` to the Control UI which expects `/styles.css`. All static assets return 404. The UI shell loads but is unstyled/broken.
**Why it happens:** The Control UI SPA is mounted at root on port 18789. Internal links reference `/` paths. If the proxy doesn't strip `/admin`, all asset requests include the prefix the upstream doesn't recognize.
**How to avoid:** Set `pathRewrite: { '^/admin': '' }` in `http-proxy-middleware` config. Verify by checking the Control UI's root HTML for asset paths.
**Warning signs:** Network tab shows 404 for CSS/JS assets under `/admin/assets/`.

### Pitfall 3: Railway Private Networking Not Resolving
**What goes wrong:** `openclaw.railway.internal` DNS lookup fails in the frontend service. Proxy returns 502.
**Why it happens:** Private networking must be explicitly enabled per Railway environment. New projects/environments have it enabled by default, but it must be verified. Also, service names must match exactly — the Railway service name is the DNS subdomain.
**How to avoid:** Confirm private networking is enabled in Railway project settings. Use the exact service name set in Railway UI (e.g., if service is named `openclaw-service`, the hostname is `openclaw-service.railway.internal`). Fall back to the Railway-provided `${{openclaw-service.RAILWAY_PRIVATE_DOMAIN}}` reference variable.
**Warning signs:** `ENOTFOUND openclaw.railway.internal` errors in frontend service logs.

### Pitfall 4: next.config.ts Missing `output: 'standalone'`
**What goes wrong:** Railway starts the Next.js service, the build succeeds, but `node server.js` fails with "Cannot find module" or the default `next start` is used instead of the custom server.
**Why it happens:** The custom server file imports next internals that require the standalone output mode to be self-contained.
**How to avoid:** Set `output: 'standalone'` in `next.config.ts`. Also update the Railway start command to `node server.js` (not `npm start` or `next start`).
**Warning signs:** Build succeeds, runtime crashes immediately with module resolution errors.

### Pitfall 5: Middleware Auth Redirect Loop for /admin
**What goes wrong:** Authenticated admin user gets redirect-looped on `/admin` routes.
**Why it happens:** Existing middleware redirects authenticated users away from `/login` to `/dashboard`. After removing `/dashboard`, the redirect target doesn't exist. Also, if middleware runs on `/admin` assets (JS/CSS), it may redirect them to login.
**How to avoid:** Update middleware redirect from `/dashboard` to `/` for post-login authenticated users. Ensure the middleware matcher excludes `_next/static`, `_next/image`, and favicon (already correct in existing config). Check that proxy asset requests under `/admin` do not trigger the middleware auth check — they should pass through once the admin role check confirms the session.
**Warning signs:** Infinite redirect loop in browser after login.

### Pitfall 6: user_metadata.role Not Set on Existing Users
**What goes wrong:** Admin user signs in. `user.user_metadata?.role` is `undefined`. Middleware redirects them to `/` even though they should have admin access.
**Why it happens:** Existing Supabase users were created before the role field was added. The field must be manually set via the Supabase dashboard or via a Supabase admin API call.
**How to avoid:** Include a task to set `role: 'admin'` on the admin user via Supabase Dashboard (Authentication > Users > Edit User > user_metadata). Document this as a one-time setup step.
**Warning signs:** Admin user redirected to landing page immediately after login.

### Pitfall 7: Domain Migration DNS Downtime
**What goes wrong:** murphy.help goes dark during the Vercel → Railway DNS transition.
**Why it happens:** Vercel's custom domain is removed before Railway's CNAME is verified and propagated.
**How to avoid:** Add the custom domain to Railway FIRST and verify it resolves correctly (Railway provides a test URL). Then update DNS CNAME to point at Railway. Only remove from Vercel after Railway is confirmed live. DNS TTL should be lowered to 60s in advance if possible.
**Warning signs:** murphy.help returns Vercel's "No deployment" error or blank page.

---

## Code Examples

### Setting admin role via Supabase Admin API (one-time setup)
```typescript
// Run once via a script or Supabase dashboard UI
// Source: Supabase Auth Admin API docs
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // service role key required
)

await supabase.auth.admin.updateUserById(USER_ID, {
  user_metadata: { role: 'admin' }
})
```

### Environment variables for Next.js service on Railway
```bash
# Railway environment variables for frontend service
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
OPENCLAW_INTERNAL_URL=http://openclaw.railway.internal:18789
NODE_ENV=production
PORT=3000
```

### Railway private networking reference variable (railway.toml)
```toml
# Reference a variable from another service using Railway template syntax
[variables]
OPENCLAW_INTERNAL_URL = "http://${{openclaw.RAILWAY_PRIVATE_DOMAIN}}:18789"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vercel dual-build (vercel.json builds+routes) | Railway multi-service | Phase 12 | Simpler deployment, no Vercel Sandbox |
| Next.js Middleware | Next.js Proxy (renamed) | Next.js 16 (Dec 2025) | Same API, file still named `middleware.ts` works, export name is the same |
| Vercel Sandbox keep-alive / pre-pairing hack | Railway Volume for persistence | Phase 12 | No more process restart workarounds |
| Fake dashboard (call history, missions) | OpenClaw Control UI at /admin | Phase 12 | Real functionality replaces placeholder UI |

**Deprecated/outdated:**
- `vercel.json`: Entire file removed — Railway does not use this.
- `/dashboard`, `/missions`, `/analytics`, `/settings` routes: Removed in this phase.
- `turbopack: { root: ... }` in `next.config.ts`: Was a Vercel dual-lockfile workaround — remove for Railway.

---

## Open Questions

1. **Control UI mount path on port 18789**
   - What we know: The Railway template docs mention `/openclaw` as the Control UI endpoint. The `entrypoint.sh` runs an internal gateway on `127.0.0.1:18789`. The search results mention `/setup`, `/logs`, `/tui`, `/healthz` endpoints.
   - What's unclear: Is the Vite + Lit SPA served at `/` on port 18789, or at `/openclaw`? This determines whether the proxy `pathRewrite` strips to `''` or to `/openclaw`.
   - Recommendation: After Railway deployment, curl `http://openclaw.railway.internal:18789/` and `http://openclaw.railway.internal:18789/openclaw` from the frontend service to determine which path the SPA responds to. Write the proxy rewrite accordingly. If at root: `pathRewrite: { '^/admin': '' }`. If at `/openclaw`: `pathRewrite: { '^/admin': '/openclaw' }`.

2. **OPENCLAW_GATEWAY_TOKEN usage in Control UI**
   - What we know: The Control UI requires `OPENCLAW_GATEWAY_TOKEN` for UI-to-Gateway connection auth. This token is set as env var on the OpenClaw service.
   - What's unclear: Does the Control UI read this token from a cookie/header when proxied through Next.js, or does the browser client connect directly to the gateway? If the client JS connects directly (bypassing the proxy) to `openclaw.railway.internal`, that would require the gateway to be publicly accessible, defeating the proxy auth model.
   - Recommendation: Research the Control UI network tab after initial Railway deployment. If client JS makes direct WebSocket connections to the internal hostname, you may need to relay the token via a cookie or query param set by the middleware before forwarding.

3. **Express backend co-location on Railway**
   - What we know: The existing codebase has an Express server at `src/server.ts` handling `/webhooks/*`, `/health`, `/api/*`. The CONTEXT.md marks Express consolidation as Claude's discretion.
   - What's unclear: Should Express run as a third Railway service, or should it stay in the monorepo with its own Railway service config?
   - Recommendation: Keep Express as a separate Railway service (root dir `/`, start command `npm start`) for now. Defer consolidation. The Telnyx webhook URL needs to stay stable — changing it is a separate task.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `frontend/vitest.config.ts` |
| Quick run command | `cd frontend && npm test` |
| Full suite command | `cd frontend && npm test` |

### Phase Requirements → Test Map

Phase 12 has no formal requirement IDs yet (marked TBD in CONTEXT.md). The behaviors are migration/infrastructure tasks — most are smoke tests or manual verification rather than unit tests.

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| Middleware redirects non-admin to `/` | unit | `cd frontend && npm test -- middleware` | Wave 0 |
| Middleware redirects unauthenticated to `/login` for `/admin` | unit | `cd frontend && npm test -- middleware` | Wave 0 |
| Middleware allows admin role through to `/admin` | unit | `cd frontend && npm test -- middleware` | Wave 0 |
| `/dashboard` routes removed (no 200 on old paths) | smoke | manual — check 404 in browser | N/A |
| `/admin` proxies to Control UI over HTTP | smoke | manual — load `/admin` in browser | N/A |
| `/admin` WebSocket connects (live logs work) | smoke | manual — open Control UI, verify WS in DevTools | N/A |
| Railway deployment health check | smoke | `curl https://murphy.help/healthz` | N/A |

### Sampling Rate
- **Per task commit:** `cd frontend && npm test`
- **Per wave merge:** `cd frontend && npm test`
- **Phase gate:** Full suite green + manual smoke tests before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `frontend/src/__tests__/middleware.test.ts` — covers admin role redirect, unauthenticated redirect, authenticated non-admin redirect
- [ ] No framework install needed — Vitest already configured

---

## Sources

### Primary (HIGH confidence)
- [Railway clawdbot-railway-template GitHub](https://github.com/codetitlan/openclaw-railway-template) — env vars, port config, volume setup, endpoint list
- [Railway Monorepo Docs](https://docs.railway.com/guides/monorepo) — root directory per service, multi-service setup
- [Railway Private Networking Docs](https://docs.railway.com/networking/private-networking) — `service.railway.internal` hostname format, internal communication
- [Railway Custom Domains Docs](https://docs.railway.com/networking/domains/working-with-domains) — CNAME setup, SSL, apex domain requirements
- [Next.js Proxy Docs](https://nextjs.org/docs/app/getting-started/proxy) — Middleware/Proxy functionality and limitations (v16.1.7)
- [http-proxy-middleware npm](https://www.npmjs.com/package/next-http-proxy-middleware) — WebSocket proxy via `ws: true` and upgrade event

### Secondary (MEDIUM confidence)
- [Supabase user_metadata vs app_metadata discussion](https://github.com/orgs/supabase/discussions/32746) — security comparison, app_metadata requires service role
- [Next.js WebSocket proxy discussion #38057](https://github.com/vercel/next.js/discussions/38057) — confirmed rewrites don't proxy WebSocket; custom server required
- [Railway multi-service help station](https://station.railway.com/questions/start-multiple-node-js-process-in-single-cf2146c0) — confirmed single process per service limitation

### Tertiary (LOW confidence)
- OpenClaw docs at `docs.openclaw.ai` — SSL connection error prevented direct fetch; information synthesized from Railway template search results and GitHub repositories

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — libraries verified via npm registry, patterns verified via official Next.js docs
- Railway architecture: HIGH — verified via official Railway docs and template repository
- WebSocket proxy pattern: HIGH — confirmed via multiple Next.js community sources and http-proxy-middleware docs
- Admin RBAC: HIGH — verified via Supabase official discussion and docs
- Control UI path (port 18789): LOW — docs.openclaw.ai was unreachable; synthesized from search results mentioning `/openclaw` endpoint

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (Railway and Next.js APIs stable; OpenClaw template may update faster)

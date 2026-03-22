# Phase 12: Migrate OpenClaw Instance to Railway with /admin Auth System - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy OpenClaw on Railway using their one-click template, move the Next.js frontend from Vercel to Railway alongside it, proxy OpenClaw's built-in Control UI at `/admin` behind Supabase admin-only auth, and remove the Vercel Sandbox deployment.

</domain>

<decisions>
## Implementation Decisions

### Deployment Architecture
- Deploy OpenClaw on Railway using the official Railway template (clawdbot-railway-template)
- Move the Next.js frontend from Vercel to Railway — single platform, single deployment
- Remove Vercel Sandbox entirely — no more dual-build vercel.json
- Railway Volume mounted at `/data` for persistent OpenClaw state/workspace
- Railway HTTP Proxy on port 8080 for public access
- Required env vars: SETUP_PASSWORD, PORT=8080, OPENCLAW_STATE_DIR=/data/.openclaw, OPENCLAW_WORKSPACE_DIR=/data/workspace, OPENCLAW_GATEWAY_TOKEN

### Admin Panel (/admin)
- Proxy/embed OpenClaw's built-in Control UI (Vite + Lit SPA on port 18789) at `/admin`
- The Control UI provides: chat, channel management, sessions, cron jobs, skills, config editing, logs, updates
- No custom admin panel to build — use OpenClaw's existing Control UI as-is
- `/setup` web wizard handles initial OpenClaw configuration (password protected)

### Admin Authentication
- Supabase user metadata role-based access: `role='admin'` in user_metadata
- Non-admin authenticated users silently redirected to landing page (/)
- Middleware checks admin role on all `/admin/*` routes
- Login/signup stays visible on landing page navbar (future monetization potential)
- Any user can sign up, but only admin-role users access /admin

### Dashboard Migration
- Fresh start — current dashboard components (call history, missions, analytics) contain fake data
- Remove existing /dashboard route group entirely
- All admin functionality comes from OpenClaw Control UI at /admin
- Existing landing page, auth pages, privacy/terms pages remain

### Claude's Discretion
- Whether to consolidate Express routes into Next.js API routes or keep Express alongside Next.js on Railway
- Gateway manager / keep-alive / device pairing code: keep dormant or remove
- How to proxy the Control UI WebSocket connection through Next.js to the Gateway
- Railway service configuration (single service vs multi-service)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### OpenClaw Deployment
- `https://docs.openclaw.ai/install/railway` — Official Railway deployment guide: one-click template, volume setup, env vars, setup flow
- `https://docs.openclaw.ai/web/control-ui` — Control UI docs: features, auth, WebSocket connection, device pairing, Tailnet access

### ClawdTalk Integration
- `https://github.com/team-telnyx/clawdtalk-client` — ClawdTalk skill module: WebSocket client, voice/SMS, missions

### Existing Codebase
- `middleware.ts` — Current Supabase auth middleware protecting dashboard routes (needs /admin route protection added)
- `vercel.json` — Current dual-build config (to be removed)
- `src/app/(dashboard)/layout.tsx` — Current dashboard layout with auth check (pattern to reuse for /admin)
- `src/lib/supabase/server.ts` — Server-side Supabase client (reuse for admin role check)
- `src/app/(auth)/` — Existing auth pages (login, signup, callback — keep as-is)

### Vercel AI Gateway
- `https://vercel.com/docs/ai-gateway/chat-platforms/openclaw` — Vercel AI Gateway integration for model access

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `middleware.ts`: Auth middleware pattern — extend to check admin role on /admin routes
- `src/lib/supabase/server.ts`: createServerSupabaseClient() — reuse for admin role verification
- `src/app/(auth)/`: Login/signup/callback pages — keep as-is, already working with Supabase Auth
- `src/app/page.tsx`: Landing page — keep as-is
- `src/app/privacy/` and `src/app/terms/`: Legal pages — keep as-is

### Established Patterns
- Route groups `(auth)`, `(dashboard)` for layout separation
- Server component layout with auth check + redirect pattern (dashboard/layout.tsx)
- `getUser()` (not `getSession()`) for all server-side auth — security requirement

### Integration Points
- Next.js API routes or reverse proxy to forward `/admin/*` to OpenClaw Control UI on port 18789
- Supabase user_metadata for admin role storage
- Railway environment for both Next.js and OpenClaw processes

</code_context>

<specifics>
## Specific Ideas

- OpenClaw Control UI runs as Vite + Lit SPA on Gateway port 18789 — must proxy WebSocket connection for real-time features
- Railway template handles OpenClaw installation automatically — no manual `curl install.sh`
- The `/setup` endpoint (password-protected) handles initial OpenClaw config (model provider, channel tokens)
- Domain murphy.help needs to point to Railway instead of Vercel
- Backup/export available at `/setup/export` for migration safety

</specifics>

<deferred>
## Deferred Ideas

- Regular user dashboard with call history (when monetization is added) — separate phase
- Express to Next.js API route consolidation — can happen independently
- ClawdTalk client installation as OpenClaw skill — may be handled by Railway template

</deferred>

---

*Phase: 12-migrate-openclaw-instance-to-vercel-with-admin-auth-system*
*Context gathered: 2026-03-20*

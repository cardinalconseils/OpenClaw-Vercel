# Phase 11: Fix Murphy phone number 18888306873 Telnyx redirect configuration - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix inbound call routing so that calls to +18888306873 (Murphy's toll-free number) are answered by the OpenClaw Express webhook handler. Currently calls ring then drop after ~30 seconds, indicating Telnyx delivers the call but the webhook either isn't reachable or isn't responding with an `answer` command.

</domain>

<decisions>
## Implementation Decisions

### Diagnostic approach
- Diagnose first, then fix — add a diagnostic checklist task that verifies each link in the chain before making changes
- Chain to verify: Telnyx number → Call Control Application → webhook URL → Vercel deployment → Express server → webhook handler responds with `answer`

### Current Telnyx configuration (verified via API)
- Phone number: +18888306873 — **active**, toll-free, assigned to connection "OpenClaw" (ID: 2917100803690858224)
- Call Control Application "OpenClaw" — **active**, webhook API v2
- Webhook URL: `https://murphy.help/webhooks/telnyx`
- Failover URL: `https://murphy.help/webhooks/telnyx` (same — no failover)
- First command timeout: 30 seconds (matches the "rings then drops" symptom)
- Outbound voice profile: 2818705591873046264

### Likely failure points to investigate
- Vercel deployment may not be serving the Express backend at `/webhooks/telnyx` (verify `vercel.json` routing works in production)
- Express server may fail to start on Vercel (missing env vars, build errors)
- Webhook signature verification (`telnyxWebhookVerifier`) may reject requests if `TELNYX_PUBLIC_KEY` is misconfigured
- The `express.raw()` middleware may not receive the raw body correctly on Vercel's Node.js runtime

### Vercel routing (from vercel.json)
- `/webhooks/*` routes to `src/server.ts` (Express)
- `/health` routes to `src/server.ts`
- `/api/*` routes to `src/server.ts`
- `/*` catch-all routes to `frontend/` (Next.js)

### Scope
- Fix the routing so calls are answered — no new features
- Do NOT add observability, LangSmith tracing, or enhanced logging in this phase

### Claude's Discretion
- Exact diagnostic steps and order
- Whether to adjust `first_command_timeout_secs` or add a failover URL
- Whether webhook-url-updater.ts needs changes for the production URL

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Telnyx webhook handling
- `src/api/webhooks.ts` — Main webhook handler; answers incoming calls, processes events
- `src/lib/voice/webhook-verify.ts` — Ed25519 signature verification middleware
- `src/lib/voice/telnyx-client.ts` — Singleton Telnyx SDK client

### Vercel deployment
- `vercel.json` — Route splitting between Express backend and Next.js frontend
- `src/server.ts` — Express server entrypoint (Vercel serverless function)

### Startup/configuration
- `src/startup/webhook-url-updater.ts` — Auto-updates webhook URL on Telnyx connection
- `.env.example` — Required environment variables (TELNYX_API_KEY, TELNYX_PUBLIC_KEY, TELNYX_CONNECTION_ID, TELNYX_PHONE_NUMBER)

### Infrastructure context
- `.planning/phases/01-infrastructure-foundation/01-RESEARCH.md` — Original Telnyx setup research
- `docs/VOICE-PIPELINE.md` — Voice pipeline architecture and env var documentation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `webhook-url-updater.ts`: Already has logic to update webhook URL via Telnyx API — can be used to fix/verify the URL
- `getTelnyxClient()`: Singleton client for all Telnyx API calls
- `telnyxWebhookVerifier`: Ed25519 verification middleware — potential failure point if TELNYX_PUBLIC_KEY is wrong

### Established Patterns
- Route-level `express.raw({ type: 'application/json' })` for webhook signature integrity
- Immediate 200 response + `setImmediate()` for async processing (Telnyx 2-second requirement)
- `call.initiated` with `direction === 'incoming'` triggers auto-answer

### Integration Points
- `vercel.json` routes `/webhooks/*` to Express — this must work in production Vercel deployment
- Telnyx Call Control Application webhook URL must match the actual deployment URL
- Environment variables must be configured in Vercel project settings (not just `.env`)

</code_context>

<specifics>
## Specific Ideas

- User confirmed: calls ring for ~30 seconds then drop (matches `first_command_timeout_secs: 30`)
- User confirmed: +18888306873 is the same number as `TELNYX_PHONE_NUMBER` env var
- User was unsure if Vercel Sandbox was running during test calls — sandbox status is a primary diagnostic target
- Telnyx MCP tools are available for API-level diagnostics and configuration changes

</specifics>

<deferred>
## Deferred Ideas

- LangSmith observability integration — separate phase
- Enhanced Telnyx event logging — separate phase
- Webhook failover URL configuration — consider adding if fix is straightforward, but not primary goal

</deferred>

---

*Phase: 11-fix-murphy-phone-number-18888306873-telnyx-redirect-configuration*
*Context gathered: 2026-03-19*

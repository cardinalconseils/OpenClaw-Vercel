# Phase 1: Infrastructure Foundation - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Provision and configure the runtime environment so that a test call to the Telnyx number connects to the OpenClaw gateway running on Vercel Sandbox. Includes: Vercel Sandbox setup, Telnyx number provisioning, device pre-pairing, keep-alive loop, webhook routing, and 10DLC SMS registration initiation.

</domain>

<decisions>
## Implementation Decisions

### Sandbox Startup
- Auto-start on deploy — sandbox boot script launches OpenClaw gateway + Express server automatically
- Pre-pair with paired.json — bake pairing credentials into startup, gateway is paired before any call arrives
- Single process model — Express server spawns the gateway as a child process, one lifecycle to manage
- Auto-restart with exponential backoff on gateway crash — self-healing, process supervisor style

### Keep-Alive Strategy
- Internal self-ping every 5 minutes via setInterval — no external dependency
- Health check scope: gateway process only (not webhook connectivity)
- On unresponsive gateway: log the failure, kill the process, restart it (auto-restart with backoff handles recovery)

### Webhook URL Handling
- Auto-update via Telnyx API on startup — detect current public URL from environment variable (VERCEL_URL or custom), call Telnyx API to update phone number webhook URL
- Self-test after URL update — send a test request to the webhook URL to confirm reachability before accepting calls
- Telnyx webhook signature verification from day one — validate signatures on every inbound request

### 10DLC & Caller ID
- Brand registration under "Cardinal Conseils" (business entity name)
- Use case category: Customer care (transactional post-call recaps)
- Expected volume: Low (under 1,000 SMS/month)
- CNAM caller ID displays "Cardinal Conseils" for outbound calls to providers
- Free Caller Registry registration for spam score mitigation

### Claude's Discretion
- Exact paired.json schema (verify against current OpenClaw release during research)
- Process supervisor implementation details (simple loop vs library)
- Express server port configuration and HTTPS setup within Vercel Sandbox
- Telnyx API client setup and authentication pattern
- Startup script language and structure

</decisions>

<specifics>
## Specific Ideas

- Gateway must be paired BEFORE first webhook arrives — the "pairing required" error from success criteria #1 must be impossible
- 10DLC registration has 1-5 business day lead time — initiate on day one of Phase 1, don't block on approval
- Conference bridge pattern (decided at project level) means Telnyx number needs Call Control v2 enabled, not just basic voice

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `bin/setup.sh`: Project setup script — can be extended with gateway startup logic
- `.claude/hooks/`: Pre-commit and dependency check hooks already in place

### Established Patterns
- Directory structure scaffolded: `src/api/`, `src/lib/voice/`, `src/lib/state/`, `src/lib/ai/`, `src/lib/tools/`, `src/types/`
- No code exists yet — Phase 1 establishes all foundational patterns

### Integration Points
- `src/api/` — webhook handler will be the first API route
- `src/lib/voice/` — Telnyx Call Control integration lives here
- Environment variables pattern via `.env.example`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-infrastructure-foundation*
*Context gathered: 2026-03-14*

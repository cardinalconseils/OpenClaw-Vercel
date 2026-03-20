# Phase 11: Fix Murphy Phone Routing — ClawdTalk Integration - Context

**Gathered:** 2026-03-20 (updated)
**Status:** Ready for planning

<domain>
## Phase Boundary

Route Canadian callers to Murphy through ClawdTalk. The original problem (calls to +18888306873 dropping after 30s) is resolved by switching the call path: instead of Telnyx webhooks → Express → Murphy, calls now flow through ClawdTalk → WebSocket → OpenClaw Gateway → Murphy. The Canadian toll-free number +18888306873 needs to forward to ClawdTalk's dedicated US number +18885440160.

Additionally, fix SMS delivery: Murphy's post-call SMS recap is not arriving when calls come through ClawdTalk. Diagnose whether ClawdTalk's built-in SMS (via `sessions_send` tool) or Telnyx direct SMS should be used, and wire it up.

**Not in scope:** French/bilingual support (separate phase), new features, observability.

</domain>

<decisions>
## Implementation Decisions

### Phone number strategy
- **Primary entry point:** ClawdTalk dedicated number +18885440160 (Starter plan, $12/mo)
- **Canadian coverage:** Forward +18888306873 (Canadian toll-free, Telnyx) → +18885440160 (ClawdTalk) at the Telnyx level
- **Old Telnyx direct path:** No longer the primary call path — ClawdTalk abstracts the telephony layer
- **Call flow:** User dials → Telnyx forwards to ClawdTalk → ClawdTalk STT → OpenClaw Gateway → Murphy → ClawdTalk TTS → User hears response

### ClawdTalk integration status
- **Voice:** Working — Murphy answers calls on +18885440160, understands speech, responds (English only)
- **SMS:** Not working — Murphy requested an SMS during test call but it never arrived
- **Gateway:** Running and paired on Vercel Sandbox
- **ClawdTalk plan:** Starter ($12/mo, 100 min/month, dedicated number)

### SMS approach
- ClawdTalk has built-in SMS via `sessions_send` tool and `sms.sh` scripts
- ClawdTalk SMS must be enabled in the gateway tool allowlist: `"allow": ["sessions_send"]`
- Diagnose whether `sessions_send` is allowed and working before considering Telnyx fallback
- If ClawdTalk SMS works: use it for all SMS when call arrives via ClawdTalk
- If ClawdTalk SMS doesn't work: fall back to Telnyx SMS using `TELNYX_PHONE_NUMBER`

### Canadian forwarding approach
- Configure call forwarding at the Telnyx level (Call Control Application or portal)
- +18888306873 → unconditional forward to +18885440160
- This way Canadian callers get a toll-free number and reach Murphy via ClawdTalk

### Scope
- Fix call routing (Canadian → ClawdTalk forwarding)
- Fix SMS delivery through ClawdTalk path
- Do NOT add French/bilingual support in this phase
- Do NOT add observability or enhanced logging
- Do NOT modify the Telnyx webhook path (keep it for potential future direct-Telnyx use)

### Claude's Discretion
- Whether to configure forwarding via Telnyx API (MCP tools) or portal
- Whether `sessions_send` needs gateway config changes vs code changes
- Whether to adjust `first_command_timeout_secs` on the Telnyx connection
- Exact diagnostic steps and order

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### ClawdTalk integration
- `https://github.com/team-telnyx/clawdtalk-client` — ClawdTalk client skill: WebSocket protocol, SMS via sessions_send, gateway tool allowlist config
- `https://clawdtalk.com/` — ClawdTalk service: plans, phone number provisioning, voice capabilities

### OpenClaw gateway config
- `src/startup/openclaw-config.ts` — OpenClaw config generator; ClawdTalk channel already defined (lines 72-78)
- `bin/sandbox-start.sh` — Sandbox startup sequence: config write → frontend → Express → gateway health → webhook URL update

### Telnyx telephony
- `src/api/webhooks.ts` — Telnyx webhook handler (keep for future direct-Telnyx path)
- `src/lib/voice/webhook-verify.ts` — Ed25519 signature verification (not used by ClawdTalk path)
- `src/lib/voice/telnyx-client.ts` — Telnyx SDK client (may be used for call forwarding config)

### Deployment
- `vercel.json` — Route splitting between Express backend and Next.js frontend
- `src/server.ts` — Express + GatewayManager + keep-alive entrypoint
- `.env.example` — Required env vars including CLAWDTALK_API_KEY and CLAWDTALK_BOT_ID

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `openclaw-config.ts`: Already has ClawdTalk channel config with `apiKey` and `botId` — may need `sessions_send` tool allowlist addition
- `getTelnyxClient()`: Can be used to configure call forwarding on +18888306873 via Telnyx API
- Telnyx MCP tools available for API-level configuration changes

### Established Patterns
- OpenClaw gateway handles the bot logic; channels (Telnyx voice, ClawdTalk) are plugins/skills
- ClawdTalk connects via WebSocket (no public endpoint needed) — works behind NAT/firewall
- ClawdTalk sends transcribed text to gateway at `/v1/chat/completions`, gateway responds with text, ClawdTalk speaks it back

### Integration Points
- Gateway tool allowlist must include `sessions_send` for ClawdTalk SMS to work
- Telnyx Call Control Application for +18888306873 needs forwarding rule to +18885440160
- No code changes expected in Express/webhook layer — this is a configuration and gateway skill issue

</code_context>

<specifics>
## Specific Ideas

- User confirmed: voice calls work through ClawdTalk (English), SMS does not arrive
- User does NOT have shell access to the Vercel Sandbox — all diagnostics must be done through code, API, or MCP tools
- The `sessions_send` tool must be in the gateway's tool allowlist or SMS will fail with 404
- ClawdTalk client repo at `team-telnyx/clawdtalk-client` is the authoritative reference for SMS integration

</specifics>

<deferred>
## Deferred Ideas

- French/bilingual support — separate phase (user confirmed: fix routing + SMS first)
- LangSmith observability integration — separate phase
- Enhanced Telnyx event logging — separate phase
- Telnyx direct call path as fallback if ClawdTalk is down — future resilience phase

</deferred>

---

*Phase: 11-fix-murphy-phone-number-18888306873-telnyx-redirect-configuration*
*Context gathered: 2026-03-20*

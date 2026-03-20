# Phase 11: Fix Murphy Phone Number 18888306873 Telnyx Redirect Configuration - Research

**Researched:** 2026-03-19
**Domain:** Telnyx Call Control v2, Vercel serverless deployment, webhook signature verification
**Confidence:** HIGH

## Summary

The infrastructure chain between Telnyx and the Vercel-deployed Express backend is mostly functional. Live testing confirmed that `https://murphy.help/webhooks/telnyx` is reachable and responds correctly to HTTP requests: the health endpoint returns `{"status":"ok"}` and the webhook endpoint returns `{"error":"Invalid webhook signature"}` for unsigned requests — exactly the expected behavior. This proves the Express app is running, the route is mounted correctly, and the `telnyxWebhookVerifier` middleware is executing.

The phone number `+18888306873` is active on Telnyx, connected to the `OpenClaw` Call Control Application (ID: `2917100803690858224`), and that application has `webhook_event_url` set to `https://murphy.help/webhooks/telnyx`. Telnyx is delivering webhooks to the correct URL. The public key returned by the Telnyx API (`wJMd8IPWKTdnZTGghRIxaRScLwo/wQgVNWLvKmrD3Ic=`) matches the value in the local `.env` file.

The most probable root cause is that `TELNYX_PUBLIC_KEY` in the Vercel production environment contains an incorrect value — possibly set to a different key string, with whitespace padding, or copied from a different account. Since Vercel encrypts environment variable values, the correctness of the stored value cannot be verified without making a real signed Telnyx webhook request and watching the function logs. A secondary risk is that `first_command_timeout_secs: 30` causes Telnyx to drop calls after 30 seconds of no `answer` command — which aligns precisely with the reported symptom.

**Primary recommendation:** Diagnostic-first: make a live test call while streaming Vercel function logs to capture the error message from `telnyxWebhookVerifier`. If the log shows `Webhook verification failed`, update `TELNYX_PUBLIC_KEY` in Vercel to match the value from `GET /v2/public_key`. If the log shows a different error, follow that path.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Diagnose first, then fix — add a diagnostic checklist task that verifies each link in the chain before making changes
- Chain to verify: Telnyx number → Call Control Application → webhook URL → Vercel deployment → Express server → webhook handler responds with `answer`
- Current Telnyx configuration (verified via API): phone number active, connected to `OpenClaw` connection, webhook URL = `https://murphy.help/webhooks/telnyx`, `first_command_timeout_secs: 30`
- Likely failure points: Vercel env var misconfiguration, webhook signature verification failure, express.raw() body capture issue
- Scope: fix the routing so calls are answered — no new features

### Claude's Discretion
- Exact diagnostic steps and order
- Whether to adjust `first_command_timeout_secs` or add a failover URL
- Whether webhook-url-updater.ts needs changes for the production URL

### Deferred Ideas (OUT OF SCOPE)
- LangSmith observability integration — separate phase
- Enhanced Telnyx event logging — separate phase
- Webhook failover URL configuration — consider adding if fix is straightforward, but not primary goal
</user_constraints>

---

## Verified State of the Infrastructure

The following were verified live during research (2026-03-19):

| Component | Status | Evidence |
|-----------|--------|----------|
| Phone number `+18888306873` | Active | Telnyx API: `"status":"active"` |
| Connection assignment | Connected | `connection_id: 2917100803690858224` = "OpenClaw" |
| Call Control App | Active | `"active":true`, `webhook_api_version:"2"` |
| Webhook URL in Telnyx | Correct | `webhook_event_url: "https://murphy.help/webhooks/telnyx"` |
| `https://murphy.help/health` | Responding | Returns `{"status":"ok"}` |
| `https://murphy.help/webhooks/telnyx` | Responding | Returns `{"error":"Invalid webhook signature"}` for unsigned POST |
| Vercel deployment | Ready | `dpl_DYashUKyQnCL5qQdwput4XpNQvrH`, status: Ready |
| `TELNYX_PUBLIC_KEY` in Vercel | SET (value unverified) | `vercel env ls` shows it as Encrypted |
| `TELNYX_API_KEY` in Vercel | SET | `vercel env ls` shows it as Encrypted |
| TypeScript compilation | Clean | `tsc --noEmit` produces zero errors |
| Test suite | 379/379 passing | `npm test` |

---

## Standard Stack

### Core (already in use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `telnyx` | `^6.13.0` | Telnyx SDK — call control + webhook verification | Official SDK, Ed25519 verify via `webhooks.unwrap()` |
| `express` | `^5.2.1` | HTTP server, route middleware | Established project choice |
| `@vercel/node` | (Vercel-managed) | Serverless Node.js runtime | Project is deployed to Vercel |

### Diagnostic Tools (available)
| Tool | How to Use | Purpose |
|------|-----------|---------|
| `vercel logs <url>` | `vercel logs openclaw-76jh5mwts-cardinal-conseils.vercel.app` | Stream function invocation logs |
| `curl` | `curl -s -L https://murphy.help/webhooks/telnyx -X POST ...` | Test endpoint reachability |
| Telnyx API | `GET /v2/public_key` with API key | Retrieve the correct public key value |
| Telnyx API | `GET /v2/call_control_applications/{id}` | Check webhook URL configuration |
| `vercel env` | `vercel env add TELNYX_PUBLIC_KEY production` | Update environment variables |

---

## Architecture Patterns

### Webhook Delivery Chain

```
Caller dials +18888306873
    ↓
Telnyx PSTN → Call Control App "OpenClaw"
    ↓
POST https://murphy.help/webhooks/telnyx
  Headers: Telnyx-Signature-Ed25519, Telnyx-Timestamp
  Body: {"data":{"event_type":"call.initiated","payload":{...}}}
    ↓
Vercel → api/index.func (Node.js 24.x, arm64)
    ↓
Express app (src/server.ts → app.use('/webhooks/telnyx', webhookRouter))
    ↓
express.raw({ type: 'application/json' })  ← captures body as Buffer
    ↓
telnyxWebhookVerifier  ← Ed25519 verify using TELNYX_PUBLIC_KEY
    ↓
res.status(200).json({ received: true })  ← MUST happen before 2s Telnyx deadline
    ↓ (setImmediate)
getTelnyxClient().calls.actions.answer(callControlId, { client_state })
    ↓
Telnyx answers the call and fires call.answered webhook
```

### Vercel Build Configuration (as deployed)
The `.vercel/output/functions/api/index.func/.vc-config.json` shows:
- `handler: "api/index.js"` — which re-exports `app` from `src/server.ts`
- `runtime: "nodejs24.x"`, `launcherType: "Nodejs"`, `shouldAddHelpers: true`
- The Express app handles all routing; Vercel passes raw HTTP requests through

### Ed25519 Signature Verification (Telnyx SDK v6)
```typescript
// Source: node_modules/telnyx/src/webhooks.ts + resources/webhooks.ts
// The signed payload is: timestamp + "|" + body (as string)
// Tolerance window: ±300 seconds from current time

const event = await telnyxClient.webhooks.unwrap(rawBody, {
  headers: req.headers as Record<string, string>,
  key: publicKey,  // Base64-encoded Ed25519 public key from Telnyx Mission Control
});
```

The `rawBody` MUST be the exact bytes Telnyx signed. If the body is re-serialized (parsed then stringified), or if `String(req.body)` is called on a pre-parsed object, the signature will not match.

### Body Capture Pattern (Critical)
```typescript
// Route-level only — never global — to preserve raw bytes for signature
webhookRouter.post(
  '/',
  express.raw({ type: 'application/json' }),  // Must come BEFORE telnyxWebhookVerifier
  telnyxWebhookVerifier,
  handler
);

// In webhook-verify.ts
const rawBody = req.body instanceof Buffer
  ? req.body.toString('utf8')
  : String(req.body ?? '');  // Fallback — if body is Object, String() returns '[object Object]'
```

**Risk:** If Vercel pre-parses the request body (via `shouldAddHelpers` behaviors), `req.body` may arrive as a parsed JavaScript object rather than a Buffer. `String({...})` produces `"[object Object]"`, causing signature failure.

**Current evidence suggests this is NOT the problem** (the endpoint responds correctly to unsigned POSTs), but it must be verified with a real Telnyx-signed request + logs.

### Anti-Patterns to Avoid
- **Bypassing signature verification:** Never return 200 to unsigned requests to diagnose — Telnyx expects proper verification; removing it is a security regression
- **Comparing env vars visually:** Cannot detect whitespace, encoding differences — always use `vercel env pull` or set fresh
- **Modifying webhook URL:** The URL is already correct; changing it could break things

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ed25519 webhook verification | Custom crypto | `telnyxClient.webhooks.unwrap()` | Already implemented; handles timestamp tolerance, encoding |
| Updating Telnyx webhook URL | Manual API call | `webhook-url-updater.ts` | Already exists with self-test |
| Checking Telnyx config | Browser portal | `curl` + Telnyx REST API with API key | Faster, scriptable, already verified working |
| Reading Vercel env vars | Checking Vercel dashboard | `vercel env ls` / `vercel env pull` | CLI is faster and shows all environments |

---

## Common Pitfalls

### Pitfall 1: Unverifiable Encrypted Env Vars
**What goes wrong:** `vercel env ls` shows `TELNYX_PUBLIC_KEY` is SET but doesn't show the value. The value could be wrong.
**Why it happens:** Vercel encrypts sensitive env vars; visual inspection is impossible.
**How to avoid:** Use `vercel env pull .env.local` to pull to a file, then compare to `GET /v2/public_key` response.
**Warning signs:** `vercel logs` shows `Webhook verification failed: Signature verification failed: signature does not match payload`

### Pitfall 2: Body Parsing Race Condition
**What goes wrong:** If any middleware or Vercel runtime helper parses the JSON body before `express.raw()` runs, `req.body` becomes a JavaScript object. `String(object)` returns `"[object Object]"` — not the raw JSON.
**Why it happens:** `shouldAddHelpers: true` in `.vc-config.json` may add body-parsing behavior; Express middleware order matters.
**How to avoid:** Check logs for the specific verification error. If body-mangled, the fix is `JSON.stringify(req.body)` as fallback OR restructuring the middleware.
**Warning signs:** Error says `signature does not match payload` but public key is confirmed correct.

### Pitfall 3: first_command_timeout Behavior
**What goes wrong:** Telnyx drops the call after `first_command_timeout_secs: 30` if no `answer` command is received. The current config shows `first_command_timeout: false` (timeout DISABLED) but `first_command_timeout_secs: 30` is set.
**Why it happens:** Ambiguous Telnyx API field. `first_command_timeout: false` means the feature is disabled — so 30s is just a stored value, not an active timeout.
**How to avoid:** The 30-second ring-then-drop may actually be Telnyx's default no-answer behavior, not a configurable timeout. Focus on making the webhook respond with `answer` correctly.
**Warning signs:** Calls always ring for exactly 30 seconds before dropping.

### Pitfall 4: Env Var Name Mismatch
**What goes wrong:** Vercel has `SUPABASE_PUBLISHIBLE_KEY` and `SUPABASE_SECRET_KEY`, but the code needs `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY`.
**Why it doesn't affect this phase:** `getSupabaseClient()` is only called from `initMissions()` which runs in the CLI startup path, not from the Vercel serverless function webhook handler. The webhook handler path has no Supabase dependency.
**Future risk:** If Supabase-dependent features (mission tracking, call history) are needed in webhook context, this mismatch must be fixed first.

### Pitfall 5: Vercel Function Cold Start Delay
**What goes wrong:** Cold starts could delay the first request after a period of inactivity. If >30 seconds, Telnyx might time out.
**Why it's unlikely here:** The function is 1.39MB. Node.js 24.x cold starts for this size are typically 200-800ms, well within the 30-second window.
**How to verify:** `vercel logs` will show function initialization duration for each invocation.

---

## Code Examples

### Diagnostic: Get the Correct Public Key from Telnyx API
```bash
# Retrieves the Ed25519 public key for this Telnyx account
curl -s -X GET "https://api.telnyx.com/v2/public_key" \
  -H "Authorization: Bearer $TELNYX_API_KEY"
# Expected: {"data":{"public":"wJMd8IPWKTdnZTGghRIxaRScLwo/wQgVNWLvKmrD3Ic=","record_type":"public_key",...}}
```

### Diagnostic: Verify Webhook URL in Telnyx Connection
```bash
curl -s -X GET "https://api.telnyx.com/v2/call_control_applications/$TELNYX_CONNECTION_ID" \
  -H "Authorization: Bearer $TELNYX_API_KEY" | python3 -m json.tool
# Check: webhook_event_url = https://murphy.help/webhooks/telnyx
# Check: first_command_timeout, first_command_timeout_secs
```

### Diagnostic: Update TELNYX_PUBLIC_KEY in Vercel
```bash
# Pull current Vercel env to compare
vercel env pull .env.vercel.local

# Update the public key (interactive)
vercel env rm TELNYX_PUBLIC_KEY production
vercel env add TELNYX_PUBLIC_KEY production
# Paste: wJMd8IPWKTdnZTGghRIxaRScLwo/wQgVNWLvKmrD3Ic=

# Redeploy to pick up new env var
vercel deploy --prod
```

### Diagnostic: Stream Vercel Logs During Test Call
```bash
# In one terminal: stream logs
vercel logs openclaw-76jh5mwts-cardinal-conseils.vercel.app

# In another terminal (or phone): call +18888306873
# Look for: [webhooks] Received event: call.initiated
# Look for: [webhooks] Answering inbound call <callControlId>
# OR: [webhooks] Webhook verification failed: <error message>
# OR: [webhooks] CRITICAL: TELNYX_PUBLIC_KEY is not set
```

### Fix: Improve rawBody Fallback for Pre-Parsed Bodies
```typescript
// webhook-verify.ts — improved fallback handles pre-parsed objects
const rawBody = req.body instanceof Buffer
  ? req.body.toString('utf8')
  : typeof req.body === 'string'
    ? req.body
    : typeof req.body === 'object' && req.body !== null
      ? JSON.stringify(req.body)   // Re-serialize if Vercel pre-parsed
      : String(req.body ?? '');
```

Note: This fix only helps if the body arrives pre-parsed AND the serialization round-trip produces byte-identical output to what Telnyx signed. In practice, property order differences could still cause mismatch. The real fix is to ensure `express.raw()` receives the raw stream before any parsing occurs.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `telnyx.calls.answer()` direct | `getTelnyxClient().calls.actions.answer()` | SDK v6 | Breaking — old code throws |
| `telnyxClient.webhooks.constructEvent()` | `telnyxClient.webhooks.unwrap()` | SDK v6 | Phase 01 decision locked in STATE.md |
| Global `express.json()` middleware | Route-level `express.raw({ type: 'application/json' })` | Phase 01 | Required for Ed25519 verification |

**Deprecated:**
- `telnyxClient.webhooks.constructEvent()`: Not present in SDK v6; removed in favor of `unwrap()`.
- `telnyx.calls.answer()` (flat): SDK v6 uses `calls.actions.*` namespace for all call control commands.

---

## Diagnostic Plan (Ordered by Likelihood)

The following ordered checklist should guide the planning tasks:

1. **Live test with log streaming** — make a test call while `vercel logs` is streaming. This reveals the actual error in real-time. Takes 2 minutes.

2. **Verify TELNYX_PUBLIC_KEY value** — compare `vercel env pull` value against `GET /v2/public_key` API response. If different: update Vercel, redeploy, retest.

3. **Verify webhook URL in Telnyx** — `GET /v2/call_control_applications/{id}` to confirm `webhook_event_url` is still `https://murphy.help/webhooks/telnyx`. Already verified correct during research.

4. **Improve rawBody fallback** — if logs show body-parsing issue, update `webhook-verify.ts` to handle pre-parsed object bodies more robustly.

5. **Consider failover URL** — currently both primary and failover URLs point to the same endpoint. Adding a different failover (e.g., logging endpoint) is low priority per CONTEXT.md scope.

---

## Open Questions

1. **Is TELNYX_PUBLIC_KEY correctly set in Vercel production?**
   - What we know: The env var IS set (encrypted); the correct value is `wJMd8IPWKTdnZTGghRIxaRScLwo/wQgVNWLvKmrD3Ic=`
   - What's unclear: Whether the stored value matches exactly (no whitespace, no extra chars)
   - Recommendation: `vercel env pull` and diff against local `.env` TELNYX_PUBLIC_KEY value

2. **Does `first_command_timeout: false` actually disable the timeout?**
   - What we know: Telnyx API returns `first_command_timeout: false`, `first_command_timeout_secs: 30`
   - What's unclear: Whether `false` disables the timeout or is a UI artifact
   - Recommendation: Test by watching call behavior after fixing the signature issue; if calls still drop, set `first_command_timeout: true` and `first_command_timeout_secs: 60` via API

3. **Does `shouldAddHelpers: true` in `.vc-config.json` cause body pre-parsing?**
   - What we know: The endpoint responds correctly to test POSTs; the fallback in `webhook-verify.ts` handles non-Buffer bodies
   - What's unclear: Whether Vercel's helpers parse the JSON body before Express sees it
   - Recommendation: Check logs after a real test call; if body-mangling is the cause, the error will be different from a key mismatch

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

This phase has no formal requirement IDs (it is a bug-fix phase). Tests validate that the fix did not break existing behavior:

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| `call.initiated` incoming triggers `calls.actions.answer()` | unit | `npm test -- tests/api/webhooks.test.ts` | Yes |
| Webhook verifier passes valid signature | unit | `npm test` | Yes (mocked) |
| Webhook verifier rejects invalid signature → 403 | integration (live) | manual test call | No — live only |
| Express server responds to GET /health | integration (live) | `curl https://murphy.help/health` | No — live only |

### Sampling Rate
- **Per task commit:** `npm test` (full suite, 379 tests, 1.76s)
- **Phase gate:** Live test call succeeds (call is answered) before marking phase complete

### Wave 0 Gaps
- None — existing test infrastructure covers all automated aspects of this phase. The critical validation is a live call, which is manual-only.

---

## Sources

### Primary (HIGH confidence)
- Live API call `GET https://api.telnyx.com/v2/call_control_applications/2917100803690858224` — verified webhook URL, connection status, timeout config
- Live API call `GET https://api.telnyx.com/v2/phone_numbers` — verified phone number active and connected
- Live API call `GET https://api.telnyx.com/v2/public_key` — retrieved canonical Ed25519 public key
- Live endpoint test `POST https://murphy.help/webhooks/telnyx` — verified Express server responds correctly
- `node_modules/telnyx/src/webhooks.ts` — Ed25519 verification implementation, 5-minute tolerance window
- `node_modules/telnyx/src/resources/webhooks.ts` — `unwrap()` method, `options.key` parameter handling
- `.vercel/output/functions/api/index.func/.vc-config.json` — runtime config, `shouldAddHelpers: true`
- `vercel env ls` — confirmed all required Telnyx env vars are SET (values unverifiable)

### Secondary (MEDIUM confidence)
- `vercel logs` output — confirms no recent invocations (no traffic to analyze)
- `.vercel/output/builds.json` — confirms Express app is bundled as expected

### Tertiary (LOW confidence)
- Hypothesis that `shouldAddHelpers: true` causes body pre-parsing — unconfirmed, requires live test to validate

---

## Metadata

**Confidence breakdown:**
- Verified infrastructure state: HIGH — all Telnyx API calls and endpoint tests were live
- Root cause identification: MEDIUM — TELNYX_PUBLIC_KEY mismatch is most likely but not confirmed
- Fix approach: HIGH — standard procedure (check key, update Vercel, redeploy)
- Body parsing risk: LOW — hypothesis, not confirmed

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable domain; Telnyx SDK v6 API is unlikely to change)

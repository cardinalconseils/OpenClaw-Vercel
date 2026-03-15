# Phase 1: Infrastructure Foundation - Research

**Researched:** 2026-03-14
**Domain:** Vercel Sandbox lifecycle, OpenClaw gateway pre-pairing, Telnyx provisioning, 10DLC SMS registration
**Confidence:** MEDIUM-HIGH (Vercel Sandbox SDK HIGH; Telnyx provisioning HIGH; OpenClaw paired.json MEDIUM — community-sourced schema, not official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sandbox Startup**
- Auto-start on deploy — sandbox boot script launches OpenClaw gateway + Express server automatically
- Pre-pair with paired.json — bake pairing credentials into startup, gateway is paired before any call arrives
- Single process model — Express server spawns the gateway as a child process, one lifecycle to manage
- Auto-restart with exponential backoff on gateway crash — self-healing, process supervisor style

**Keep-Alive Strategy**
- Internal self-ping every 5 minutes via setInterval — no external dependency
- Health check scope: gateway process only (not webhook connectivity)
- On unresponsive gateway: log the failure, kill the process, restart it (auto-restart with backoff handles recovery)

**Webhook URL Handling**
- Auto-update via Telnyx API on startup — detect current public URL from environment variable (VERCEL_URL or custom), call Telnyx API to update phone number webhook URL
- Self-test after URL update — send a test request to the webhook URL to confirm reachability before accepting calls
- Telnyx webhook signature verification from day one — validate signatures on every inbound request

**10DLC & Caller ID**
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

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | OpenClaw gateway runs on Vercel Sandbox with Telnyx phone number configured | Vercel Sandbox SDK `extendTimeout`, OpenClaw gateway startup, `nohup` detached process, Telnyx number provisioning via API |
| INFRA-02 | Telnyx webhook receives inbound calls and routes to OpenClaw voice-call plugin | Express v5 webhook handler, Telnyx Call Control Applications API for webhook URL update, `constructEvent` signature verification |
| INFRA-03 | Device pre-pairing is automated (sandbox pairing bug workaround) | `paired.json` schema with `deviceId`, `publicKey`, `role=operator`, scopes; `pending.json` clear; `trustedProxies` config |
| INFRA-04 | Sandbox timeout is extended and kept alive during active calls | `sandbox.extendTimeout(duration)` SDK method; plan limits (45 min Hobby, 5 hr Pro); internal `setInterval` keep-alive |
| INFRA-05 | 10DLC SMS registration is initiated for outbound SMS compliance | Telnyx 10DLC brand + campaign API; brand fields; Customer Care use case; CNAM registration; Free Caller Registry |
</phase_requirements>

---

## Summary

Phase 1 is a provisioning and infrastructure phase — almost no product logic is written here, but four blocking pitfalls must be resolved before any telephony testing is possible. The core tasks are: (1) get OpenClaw running in Vercel Sandbox without the device pairing error, (2) extend sandbox lifetime so active calls are not dropped, (3) make the webhook URL auto-update on every sandbox restart, and (4) initiate 10DLC and caller-ID registration ahead of the multi-day approval window.

The Vercel Sandbox SDK provides a clear `extendTimeout(ms)` method, but it is an **external** SDK method — it must be called from the orchestrating process that created the sandbox, not from inside the sandbox itself. This is the critical architectural distinction for the keep-alive loop: the keep-alive setInterval must run in the orchestrating Node.js process that holds the `Sandbox` object, or alternatively use Vercel's `VERCEL_SANDBOX_ID` env var from inside the sandbox to reconnect and extend via `Sandbox.get()`. The simpler design — an internal self-ping — keeps the sandbox alive indirectly by ensuring active CPU usage rather than calling `extendTimeout` directly. Whichever approach is chosen, this must be coded explicitly; there is no automatic keep-alive.

The OpenClaw device pre-pairing workaround is community-validated: write a `paired.json` entry with `deviceId`, `publicKey`, `role: "operator"`, and required scopes, then clear `pending.json`, before calling `openclaw start`. Add the VM's loopback/private IP ranges to `gateway.trustedProxies` to prevent `isLocalDirectRequest()` from failing. The exact schema has MEDIUM confidence — it is sourced from community gists and GitHub issues, not official docs. The planner should include a task to verify the schema against the current OpenClaw release before writing the startup script.

**Primary recommendation:** Write a single `bin/sandbox-start.sh` startup script that (in order) generates the device keypair, writes `paired.json`, clears `pending.json`, starts the OpenClaw gateway, waits for it to become healthy, starts Express, calls the Telnyx API to update the webhook URL, sends a self-test request, then loops on `extendTimeout` or self-ping every 5 minutes.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@vercel/sandbox` | latest | Sandbox lifecycle management (`extendTimeout`, `Sandbox.get`) | Official Vercel SDK; only way to call `extendTimeout` from a Node process |
| `telnyx` (npm) | 6.13.0 | Telnyx Call Control v2 REST client; webhook signature verification | Official SDK with TypeScript declarations; `telnyx.webhooks.constructEvent()` for sig verification |
| `express` | 5.2.1 | Webhook HTTP server; self-test endpoint | Persistent process inside sandbox; async error propagation fixed in v5 |
| `typescript` | 5.9.3 | Type safety | Project-wide requirement |
| `tsx` | 4.21.0 | Run TS directly for startup scripts and development | No compile step needed |
| `dotenv` | 16.x | Environment variable loading | Standard; loads `TELNYX_API_KEY`, `TELNYX_CONNECTION_ID`, `VERCEL_SANDBOX_URL` |
| `zod` | 4.3.6 | Validate Telnyx webhook payloads | Prevents mishandled call state from malformed events |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:child_process` | built-in | Spawn OpenClaw gateway as child process | Single-process model: Express spawns gateway, monitors it |
| `node:crypto` | built-in | Generate Ed25519 keypair for device identity | Pre-pairing: generate `deviceId` from SHA-256 of public key |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual `VERCEL_URL` env var | `sandbox.domain(18789)` from orchestrator | `domain()` requires sandbox object; env var approach works from inside sandbox at runtime |
| `setInterval` self-ping | External cron/keepalive service | Self-ping has no external dependency, which is the locked decision |
| Process-level supervisor library (`pm2`) | Simple respawn loop in TS | PM2 adds binary weight; a tight `child_process` + backoff loop is sufficient and aligns with locked decision |

**Installation:**
```bash
npm install telnyx @vercel/sandbox express zod dotenv
npm install -D typescript tsx @types/node @types/express
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 1 scope)
```
bin/
├── sandbox-start.sh          # Master startup script (gateway + express + url-update)
src/
├── api/
│   └── webhooks.ts           # Express webhook handler (Phase 1 stub: answer + hangup)
├── lib/
│   └── voice/
│       ├── telnyx-client.ts  # Telnyx SDK init + reusable client singleton
│       └── webhook-verify.ts # constructEvent wrapper, sig verification middleware
├── startup/
│   ├── gateway-manager.ts    # Spawn gateway, health-check, auto-restart with backoff
│   ├── pair-device.ts        # Generate Ed25519 keypair, write paired.json, clear pending.json
│   ├── webhook-url-updater.ts # Call Telnyx API to update webhook URL, self-test
│   └── keepalive.ts          # setInterval loop: ping gateway health check + optional extendTimeout
└── types/
    └── telnyx.ts             # Webhook payload types (Zod schemas)
.env.example                  # TELNYX_API_KEY, TELNYX_PUBLIC_KEY, TELNYX_CONNECTION_ID, TELNYX_PHONE_NUMBER
```

### Pattern 1: OpenClaw Gateway Pre-Pairing
**What:** Write device credentials into `paired.json` before `openclaw start` so the gateway treats the device as already approved. Clear `pending.json` to prevent stale request cache bug.
**When to use:** Mandatory — without this, gateway crashes with `1008: pairing required` in Vercel Sandbox.
**Example:**
```typescript
// Source: community gists (github.com/openclaw/openclaw issues + gist/johnlindquist)
// MEDIUM confidence — verify exact schema against current OpenClaw release

import { generateKeyPairSync, createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const OPENCLAW_STATE_DIR = process.env.OPENCLAW_STATE_DIR ?? `${process.env.HOME}/.openclaw`;
const DEVICES_DIR = path.join(OPENCLAW_STATE_DIR, 'devices');

export function prePairDevice() {
  mkdirSync(DEVICES_DIR, { recursive: true });

  // Generate Ed25519 keypair for device identity
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const publicKeyB64 = publicKey.toString('base64');
  const deviceId = createHash('sha256').update(publicKey).digest('hex');

  // Write pre-approved device entry to paired.json
  // VERIFY: Confirm exact schema fields against current OpenClaw release
  const pairedEntry = {
    deviceId,
    publicKey: publicKeyB64,
    displayName: 'openclaw-sandbox-device',
    role: 'operator',
    scopes: ['operator.admin', 'operator.approvals', 'operator.pairing'],
    approvedAtMs: Date.now(),
  };

  const pairedPath = path.join(DEVICES_DIR, 'paired.json');
  const existing = existsSync(pairedPath)
    ? JSON.parse(readFileSync(pairedPath, 'utf8'))
    : [];
  const entries = Array.isArray(existing) ? existing : [existing];
  writeFileSync(pairedPath, JSON.stringify([...entries, pairedEntry], null, 2));

  // Clear pending.json to prevent stale-request cache bug
  writeFileSync(path.join(DEVICES_DIR, 'pending.json'), '[]');

  // Write private key for device auth at runtime
  writeFileSync(
    path.join(OPENCLAW_STATE_DIR, 'device-key.pem'),
    typeof privateKey === 'string' ? privateKey : privateKey.toString()
  );
}
```

### Pattern 2: Gateway Config — trustedProxies for Vercel Sandbox
**What:** Add VM internal IP ranges to `gateway.trustedProxies` in `openclaw.yaml` so `isLocalDirectRequest()` correctly identifies the Express server as local.
**When to use:** Required in Vercel Sandbox — MicroVM proxy headers cause loopback detection to fail.
**Example (openclaw.yaml):**
```yaml
# Source: github.com/openclaw/openclaw/issues/20073 + docs.openclaw.ai/gateway/security
# MEDIUM confidence — community-sourced; validate against current OpenClaw docs

gateway:
  port: 18789
  bind: loopback           # Bind to 127.0.0.1 only — most secure
  trustedProxies:
    - "127.0.0.0/8"
    - "10.0.0.0/8"
    - "172.16.0.0/12"
    - "192.168.0.0/16"
    - "::1"
  allowRealIpFallback: false
```

### Pattern 3: Sandbox Keep-Alive via setInterval Self-Ping
**What:** Internal HTTP health-check ping to the gateway every 5 minutes. Prevents sandbox timeout from killing an idle-but-ready gateway.
**When to use:** Required — default sandbox timeout is 5 minutes; calls can run 10-30 minutes.
**Example:**
```typescript
// Source: verified Vercel Sandbox docs + community patterns

const PING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const GATEWAY_HEALTH_URL = 'http://127.0.0.1:18789/health';

export function startKeepAlive(): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      const res = await fetch(GATEWAY_HEALTH_URL, { signal: AbortSignal.timeout(5_000) });
      if (!res.ok) {
        console.error(`[keepalive] Gateway unhealthy: ${res.status} — triggering restart`);
        await restartGateway();
      }
    } catch (err) {
      console.error('[keepalive] Gateway unreachable — triggering restart', err);
      await restartGateway();
    }
  }, PING_INTERVAL_MS);
}
```

**Keep-alive architecture note (HIGH confidence):**
The `@vercel/sandbox` SDK's `sandbox.extendTimeout(ms)` is a method on the `Sandbox` object, which only exists in the external orchestrating process that called `Sandbox.create()` or `Sandbox.get()`. From inside the sandbox itself, there is no direct `extendTimeout` call. The self-ping approach satisfies the keep-alive requirement without needing access to the external `Sandbox` object, and matches the locked decision (internal self-ping, no external dependency).

### Pattern 4: Telnyx Webhook URL Auto-Update on Startup
**What:** On every sandbox restart, call the Telnyx Call Control Applications API to update the `webhook_event_url` to the current sandbox public HTTPS URL, then fire a self-test GET to confirm the URL is reachable.
**When to use:** Required — sandbox URL changes on restart; stale webhook URL causes all inbound calls to fail silently.
**Example:**
```typescript
// Source: developers.telnyx.com/docs/voice/programmable-voice/voice-api-webhooks (HIGH confidence)
// Webhook URL lives on the Call Control Application (connection), not on the phone number

import Telnyx from 'telnyx';

const telnyx = new Telnyx(process.env.TELNYX_API_KEY!);

export async function updateWebhookUrl(sandboxUrl: string) {
  const webhookUrl = `${sandboxUrl}/webhooks/telnyx`;

  // Update the Call Control Application (connection) webhook URL
  await telnyx.callControlApplications.update(
    process.env.TELNYX_CONNECTION_ID!,
    { webhook_event_url: webhookUrl }
  );

  // Self-test: confirm URL is publicly reachable
  const testRes = await fetch(`${sandboxUrl}/health`);
  if (!testRes.ok) {
    throw new Error(`Webhook URL self-test failed: ${testRes.status}`);
  }

  console.log(`[startup] Webhook URL updated and verified: ${webhookUrl}`);
}
```

### Pattern 5: Telnyx Webhook Signature Verification
**What:** Verify every inbound Telnyx webhook using Ed25519 signature from `telnyx-signature-ed25519` and `telnyx-timestamp` headers.
**When to use:** Required — must be in place from day one (locked decision).
**Example:**
```typescript
// Source: developers.telnyx.com/docs/messaging/messages/receiving-webhooks (HIGH confidence)

import { Request, Response, NextFunction } from 'express';
import Telnyx from 'telnyx';

const telnyx = new Telnyx(process.env.TELNYX_API_KEY!);

export function telnyxWebhookVerifier(req: Request, res: Response, next: NextFunction) {
  const signature = req.headers['telnyx-signature-ed25519'] as string;
  const timestamp = req.headers['telnyx-timestamp'] as string;

  // CRITICAL: pass raw body string, not re-serialized JSON
  const payload = JSON.stringify(req.body);

  try {
    telnyx.webhooks.constructEvent(
      payload,
      signature,
      timestamp,
      process.env.TELNYX_PUBLIC_KEY!
    );
    next();
  } catch {
    res.status(403).json({ error: 'Invalid webhook signature' });
  }
}
```

**Important:** Public key is retrieved from Mission Control Portal → Keys & Credentials → Public Key. Webhooks must respond within **2 seconds** (200 OK); verify first, then acknowledge, then process async.

### Anti-Patterns to Avoid
- **Calling `extendTimeout` from inside the sandbox process:** `@vercel/sandbox` SDK is for external orchestrators. From inside the sandbox, use a self-ping or CPU-activity approach instead.
- **Binding gateway to `0.0.0.0`:** Always use `bind: loopback` for the OpenClaw gateway in production. The Vercel Sandbox public HTTPS URL terminates at the MicroVM edge; the gateway only needs to be reachable from within the sandbox.
- **Skipping `pending.json` clear:** The stale pending-request bug is separate from the `paired.json` fix. Both steps are required.
- **Starting gateway before writing `paired.json`:** Order matters — pre-pairing files must be in place before `openclaw start` runs.
- **Re-serializing webhook body before signature verification:** `telnyx.webhooks.constructEvent()` requires the raw body string. Always use `express.raw()` or a body-parser that preserves the original buffer before verification.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook signature verification | Custom HMAC/Ed25519 verification | `telnyx.webhooks.constructEvent()` | SDK handles nonce, replay-attack timestamp check, correct canonical payload format |
| Phone number search + purchase | Scraping or manual portal flow | `telnyx.availablePhoneNumbers.list()` + `telnyx.numberOrders.create()` | Official SDK with typed responses; handles provisioning state machine |
| Webhook URL update | curl scripts or hardcoded URLs | `telnyx.callControlApplications.update()` | API handles propagation delay; typed input prevents silent typos in URL format |
| 10DLC registration submission | Manual TCR portal-only workflow | Telnyx 10DLC API (`POST /v2/10dlc/brand`, `/v2/10dlc/campaignBuilder`) | Can be scripted in startup verification checklist; programmatic status polling |

**Key insight:** Every Telnyx management action (number provisioning, webhook config, 10DLC registration) has a REST API equivalent. Scripting these reduces manual re-work on every sandbox restart.

---

## Common Pitfalls

### Pitfall 1: OpenClaw Device Pairing Fails Silently in Vercel Sandbox
**What goes wrong:** Gateway crashes with `gateway closed (1008): pairing required` while HTTP chat works — creating false impression of partial success.
**Why it happens:** MicroVM networking breaks `isLocalDirectRequest()` loopback detection; stale `pending.json` entries compound the issue.
**How to avoid:** Write `paired.json` entry + clear `pending.json` + set `trustedProxies` — all three steps before `openclaw start`.
**Warning signs:** Cron jobs fail while web UI works; any WebSocket-based feature (voice-call plugin) crashes immediately.

### Pitfall 2: Vercel Sandbox Timeout Kills Active Calls
**What goes wrong:** Default 5-minute timeout terminates the gateway mid-call with no graceful cleanup. User hears silence or dead air.
**Why it happens:** Vercel Sandbox default timeout is 5 minutes. No keep-alive = sandbox stops after first idle period.
**How to avoid:** setInterval ping every 5 minutes to gateway health endpoint. Note plan limits: 45 min (Hobby), 5 hours (Pro). Verify which plan is active before committing to call length expectations.
**Warning signs:** Gateway process disappears after 5 minutes of inactivity even when calls should be active.

### Pitfall 3: Stale Webhook URL After Sandbox Restart
**What goes wrong:** New sandbox gets a new URL; Telnyx still sends webhooks to the old URL; all inbound calls fail without error.
**Why it happens:** Vercel Sandbox URL is instance-specific (`sb-{id}-18789.vercel.run`). New sandbox = new ID = new URL.
**How to avoid:** Auto-update `TELNYX_CONNECTION_ID`'s webhook URL on every sandbox startup before the server becomes active.
**Warning signs:** Webhooks not arriving after sandbox restart; Telnyx logs show delivery to old URL with connection failures.

### Pitfall 4: `bind=loopback` + `auth.mode=trusted-proxy` Conflict (Historical)
**What goes wrong:** OpenClaw versions before the fix refused to start with this combination — error: `"gateway auth mode=trusted-proxy makes no sense with bind=loopback"`.
**Why it happens:** An overly strict validation check (now removed via PR #20097) blocked a valid security pattern.
**How to avoid:** Use OpenClaw version 2026.2.17+. If still on older version, use `bind=lan` + firewall rules as workaround. Verify current version on startup.
**Warning signs:** Gateway refuses to start; check OpenClaw CHANGELOG for this fix.

### Pitfall 5: 10DLC Registration Delay Blocks SMS in Phase 6
**What goes wrong:** SMS messages are silently filtered by U.S. carriers — no error returned. Registration approved too late blocks the Phase 5 milestone.
**Why it happens:** 10DLC brand + campaign approval takes 1–7 business days combined. TCR backlog can extend this.
**How to avoid:** Submit brand registration on day one of Phase 1. Do not block Phase 1 completion on 10DLC approval — it runs in parallel.
**Warning signs:** SMS sent from Telnyx with no delivery errors but message never arrives; check 10DLC campaign status in Mission Control.

### Pitfall 6: CNAM Propagation Delay on Outbound Calls
**What goes wrong:** Outbound calls to providers show the number without a business name for 3–5 business days after CNAM registration.
**Why it happens:** CNAM database propagation across carriers takes 3–5 working days.
**How to avoid:** Enable CNAM listing in Telnyx Mission Control on day one. Accept delay as normal — production volume before CNAM is active just means no name displays, not a functional failure.
**Warning signs:** Outbound calls show raw number instead of "Cardinal Conseils" — this is expected and resolves within the propagation window.

### Pitfall 7: Raw Body Not Preserved for Webhook Signature Verification
**What goes wrong:** Signature verification always fails; all webhooks rejected with 403.
**Why it happens:** Express JSON body parser re-serializes the body; field order and whitespace may differ from what Telnyx signed.
**How to avoid:** Use `express.raw({ type: 'application/json' })` for the webhook route, then `JSON.parse(req.body)` after verification. Never apply `express.json()` middleware globally before the webhook route.
**Warning signs:** `telnyx.webhooks.constructEvent` throws consistently even with correct public key.

---

## Code Examples

### Startup Sequence (bin/sandbox-start.sh)
```bash
#!/usr/bin/env bash
# Source: project decisions (CONTEXT.md) + community OpenClaw Vercel patterns
set -e

echo "[startup] Pre-pairing OpenClaw device..."
tsx src/startup/pair-device.ts

echo "[startup] Starting OpenClaw gateway..."
nohup openclaw start > /tmp/gateway.log 2>&1 &
GATEWAY_PID=$!

echo "[startup] Waiting for gateway to become healthy..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:18789/health > /dev/null 2>&1; then
    echo "[startup] Gateway healthy after ${i} seconds"
    break
  fi
  sleep 1
done

echo "[startup] Starting Express webhook server..."
tsx src/server.ts &

echo "[startup] Updating Telnyx webhook URL..."
tsx src/startup/webhook-url-updater.ts

echo "[startup] Infrastructure ready"
wait $GATEWAY_PID
```

### Telnyx 10DLC Brand Registration (API call sequence)
```typescript
// Source: developers.telnyx.com/docs/messaging/10dlc/quickstart (HIGH confidence)
// Run once during Phase 1 provisioning — not on every startup

// Step 1: Create brand
const brand = await telnyx.post('/v2/10dlc/brand', {
  entityType: 'PRIVATE_PROFIT',
  displayName: 'Cardinal Conseils',
  companyName: 'Cardinal Conseils',
  ein: process.env.BUSINESS_EIN,        // Tax ID or equivalent
  phone: process.env.BUSINESS_PHONE,
  street: process.env.BUSINESS_STREET,
  city: process.env.BUSINESS_CITY,
  state: process.env.BUSINESS_STATE,
  postalCode: process.env.BUSINESS_ZIP,
  country: 'CA',                         // Canada
  email: process.env.BUSINESS_EMAIL,
  website: process.env.BUSINESS_WEBSITE,
  vertical: 'PROFESSIONAL_SERVICES',
});
console.log('Brand ID:', brand.data.brandId);

// Step 2: Create campaign
const campaign = await telnyx.post('/v2/10dlc/campaignBuilder', {
  brandId: brand.data.brandId,
  usecase: 'CUSTOMER_CARE',              // Transactional post-call recaps
  subUsecases: ['ACCOUNT_NOTIFICATION'],
  description: 'Post-call SMS recaps to users who called the OpenClaw service matchmaker.',
  sample1: 'We found a plumber for you. Connected to ABC Plumbing (555-1234). If this helped, buy us a coffee: https://buymeacoffee.com/openclaw',
  messageFlow: 'User calls our phone number to find a local service provider. After the call, a single transactional SMS recap is sent with outcome details and a tip link.',
  embeddedLink: true,
  embeddedPhone: false,
  subscriberOptin: false,
  subscriberOptout: true,
  subscriberHelp: true,
  termsAndConditions: true,
  privacyPolicy: true,
});
console.log('Campaign ID:', campaign.data.campaignId);

// Step 3: Assign phone number to campaign
await telnyx.post('/v2/10dlc/phoneNumberCampaign', {
  phoneNumber: process.env.TELNYX_PHONE_NUMBER,
  campaignId: campaign.data.campaignId,
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual OpenClaw device pairing approval in UI | Pre-pairing via `paired.json` injection before gateway start | Community workaround discovered ~2026 | Required for Vercel Sandbox; eliminates `1008: pairing required` errors |
| Sandbox timeout accepts default (5 min) | `extendTimeout()` or self-ping keep-alive | Vercel Sandbox SDK, 2025-Q4 | Enables calls longer than 5 minutes |
| Webhook URL hardcoded in Telnyx portal | Auto-update via `callControlApplications.update()` on startup | Telnyx Call Control Applications API (stable) | Survives sandbox restarts without manual portal update |
| 10DLC registration manual portal flow | Telnyx 10DLC API + portal both supported | 2026 | Scriptable; status can be polled programmatically |

**Deprecated/outdated:**
- `bind=loopback` + `auth.mode=trusted-proxy` conflict: Fixed in PR #20097. Use current OpenClaw (2026.2.17+); no workaround needed on latest.
- Telnyx CNAM API v1 endpoint: Deprecated (see Telnyx support article `6535207`). Use Mission Control Portal for CNAM registration, not the old API endpoint.

---

## Open Questions

1. **Exact `paired.json` JSON schema (MEDIUM confidence)**
   - What we know: Fields include `deviceId` (SHA-256 of public key), `publicKey` (Ed25519 base64), `role: "operator"`, `scopes: [...]`, `approvedAtMs`
   - What's unclear: Whether `tokens` array is required; whether `displayName` is required; exact scope strings for voice-call plugin (the `operator.admin` scope bundle may differ from per-feature scopes)
   - Recommendation: First task in Wave 0 — verify schema against current OpenClaw source (`src/gateway/protocol/` or `openclaw/openclaw` GitHub) before writing `pair-device.ts`

2. **Vercel Sandbox plan tier (Hobby vs Pro) constraint**
   - What we know: Hobby plan caps at 45 min sandbox lifetime; Pro caps at 5 hours
   - What's unclear: Which plan is active for this project; whether 45 min is sufficient for expected call durations
   - Recommendation: Confirm plan tier before committing to sandbox-only architecture. A complex call (user + 4 provider attempts + bridge + SMS) can run 10-20 minutes easily — well within 45 min, but worth confirming.

3. **Vercel Sandbox URL pattern for `VERCEL_URL` env var**
   - What we know: Public URL pattern is `https://sb-{id}-18789.vercel.run`; official guide confirms this
   - What's unclear: Whether `VERCEL_URL` or a custom env var is set automatically inside the sandbox process (vs. needing to be injected at `Sandbox.create({ env: {...} })`)
   - Recommendation: In the startup script, fall back to `process.env.VERCEL_URL ?? process.env.SANDBOX_URL` and document the required env var injection pattern.

4. **OpenClaw gateway health endpoint**
   - What we know: Gateway runs on port 18789; official guide shows `http://127.0.0.1:18789` as the root
   - What's unclear: Whether a dedicated `/health` route exists or whether the root URL is the health signal
   - Recommendation: Start with `GET http://127.0.0.1:18789/` — if it returns any 2xx, the gateway is alive. Add explicit `/health` check once gateway is running.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (none currently installed — Wave 0 gap) |
| Config file | `vitest.config.ts` — Wave 0 gap |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | OpenClaw gateway process starts and becomes healthy on port 18789 | smoke | `npx vitest run tests/startup/gateway.test.ts -t "gateway health"` | Wave 0 gap |
| INFRA-02 | Express webhook handler returns 200 on valid signed POST; returns 403 on invalid sig | unit | `npx vitest run tests/api/webhooks.test.ts` | Wave 0 gap |
| INFRA-03 | `pair-device.ts` writes `paired.json` and clears `pending.json` correctly | unit | `npx vitest run tests/startup/pair-device.test.ts` | Wave 0 gap |
| INFRA-04 | Keep-alive setInterval fires within tolerance of 5-minute target | unit | `npx vitest run tests/startup/keepalive.test.ts -t "keepalive interval"` | Wave 0 gap |
| INFRA-05 | 10DLC registration script produces brand + campaign IDs without error (mocked Telnyx) | integration | `npx vitest run tests/startup/10dlc-registration.test.ts` | Wave 0 gap |

**Manual-only verification items:**
- Vercel Sandbox actually receives Telnyx webhooks after URL update (requires live Telnyx account + sandbox)
- 10DLC campaign approval status (requires 1–7 business days; check Telnyx Mission Control)
- CNAM "Cardinal Conseils" displays on outbound calls (3–5 day propagation; manual test call)
- Free Caller Registry registration confirmation (manual portal submission)

### Sampling Rate
- **Per task commit:** `npx vitest run tests/startup/ --reporter=dot`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + manual webhook reachability test before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/startup/pair-device.test.ts` — covers INFRA-03
- [ ] `tests/startup/gateway.test.ts` — covers INFRA-01 (process health smoke test)
- [ ] `tests/api/webhooks.test.ts` — covers INFRA-02 (sig verify + 200/403 response)
- [ ] `tests/startup/keepalive.test.ts` — covers INFRA-04
- [ ] `tests/startup/10dlc-registration.test.ts` — covers INFRA-05 (mocked Telnyx API calls)
- [ ] `vitest.config.ts` — test runner config
- [ ] Framework install: `npm install -D vitest @vitest/coverage-v8`

---

## Sources

### Primary (HIGH confidence)
- [Vercel Sandbox SDK Reference](https://vercel.com/docs/vercel-sandbox/sdk-reference) — `extendTimeout(ms)`, `Sandbox.get()`, `sandbox.domain()`, plan limits (45 min Hobby / 5 hr Pro), `timeout` accessor
- [Vercel Working with Sandbox](https://vercel.com/docs/vercel-sandbox/working-with-sandbox) — `nohup openclaw gateway run` pattern, `extendTimeout` usage
- [Telnyx Webhook Signature Verification](https://developers.telnyx.com/docs/messaging/messages/receiving-webhooks) — `telnyx-signature-ed25519`, `telnyx-timestamp` headers, `constructEvent()` method, 2-second response requirement
- [Telnyx 10DLC Quickstart](https://developers.telnyx.com/docs/messaging/10dlc/quickstart) — `POST /v2/10dlc/brand`, `POST /v2/10dlc/campaignBuilder`, `POST /v2/10dlc/phoneNumberCampaign` API endpoints
- [Telnyx Voice API Webhooks](https://developers.telnyx.com/docs/voice/programmable-voice/voice-api-webhooks) — webhook URL lives on Call Control Application (connection), not phone number; `webhook_event_url` field
- [Telnyx CNAM Guide](https://telnyx.com/resources/caller-id-name-cnam) — outbound CNAM, 15-char limit, 3–5 day propagation

### Secondary (MEDIUM confidence)
- [OpenClaw Cron in Vercel Sandbox: The Pairing Wall](https://gist.github.com/johnlindquist/da649125c487260a8f408be778d0b900) — `paired.json` pre-pairing workaround, `pending.json` clear step, `deviceId` from SHA-256 of public key, scopes list
- [OpenClaw GitHub Issue #20073 — bind=loopback + trusted-proxy conflict](https://github.com/openclaw/openclaw/issues/20073) — confirms bug fixed in PR #20097; `trustedProxies` configuration for VM environments
- [OpenClaw Security Docs](https://docs.openclaw.ai/gateway/security) — `gateway.trustedProxies` YAML key, `allowRealIpFallback` option, correct vs incorrect nginx proxy header pattern
- [OpenClaw GitHub Issue #21906 — empty scopes bug](https://github.com/openclaw/openclaw/issues/21906) — `PairedDevice` type field list: `deviceId`, `displayName`, `roles`, `scopes`, `remoteIp`, `tokens`, `createdAtMs`, `approvedAtMs`
- [OpenClaw GitHub Issue #23006 — operator.write/read scopes](https://github.com/openclaw/openclaw/issues/23006) — `operator.write` and `operator.read` are required scopes for tool connections; missing in 2026.2.19 upgrade
- [Vercel Sandbox extendTimeout changelog](https://vercel.com/changelog/dynamically-extend-timeout-of-an-active-sandbox) — `sandbox.extendTimeout()` method, `Promise<void>` return type
- [Telnyx Spam/Scam Likely Handling](https://support.telnyx.com/en/articles/4088988-telnyx-how-to-handle-spam-scam-likely) — Free Caller Registry, CNAM, STIR/SHAKEN A-attestation
- [10DLC Registration Timeline (Telnyx)](https://support.telnyx.com/en/articles/5896911-how-to-create-a-10dlc-brand) — 1-7 business day combined approval timeline

### Tertiary (LOW confidence — monitor for changes)
- [OpenClaw paired.json schema from community gists](https://gist.github.com/digitalknk/4169b59d01658e20002a093d544eb391) — sanitized config example; does not contain full paired.json schema; verify against source
- [Free Caller Registry registration flow (LiveVox)](https://help.livevox.com/en_US/voice/registering-with-the-free-caller-registry-solution) — process overview; not Telnyx-specific

---

## Metadata

**Confidence breakdown:**
- Sandbox keep-alive / extendTimeout: HIGH — verified against official Vercel Sandbox SDK docs
- Webhook signature verification: HIGH — verified against official Telnyx docs; code pattern confirmed
- Webhook URL auto-update: HIGH — verified Call Control Applications API is the correct level
- paired.json pre-pairing schema: MEDIUM — community-sourced from GitHub issues and gists; not in official OpenClaw docs; must be verified against current release
- trustedProxies configuration: MEDIUM — community-sourced and security docs; one historical breaking bug exists (now fixed)
- 10DLC registration: HIGH — official Telnyx 10DLC API and quickstart docs confirmed; approval timeline is estimate based on official guidance
- CNAM / Free Caller Registry: HIGH — official Telnyx support articles confirmed; propagation delay is carrier-dependent

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 for Vercel Sandbox SDK and Telnyx docs (stable); 2026-03-28 for OpenClaw-specific patterns (fast-moving project, new issues weekly)

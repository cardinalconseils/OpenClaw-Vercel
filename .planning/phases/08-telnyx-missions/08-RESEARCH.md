# Phase 8: Telnyx Missions - Research

**Researched:** 2026-03-15
**Domain:** Batch telephony operations, job scheduling, mission orchestration
**Confidence:** MEDIUM

## Summary

Phase 8 adds "Missions" -- multi-step batch operations (call campaigns, SMS surveys, provider research) that users create via natural language through any connected channel (voice, SMS, ClawdTalk chat). The agent plans the mission, creates a dedicated AI assistant context, schedules events with rate limiting, executes them automatically, and reports results in real-time through the ClawdTalk portal.

This phase builds on top of all prior phases: it reuses outbound calling (Phase 4), SMS sending (Phase 6), provider search (Phase 3), and the AI orchestrator (Phase 1.1). The core new work is: (1) a mission data model and lifecycle state machine, (2) a job scheduler that respects Telnyx rate limits, (3) mission-aware LLM planning that decomposes natural language into executable steps, and (4) real-time progress reporting via the existing ClawdTalk plugin.

**Primary recommendation:** Build an in-process mission engine with a simple queue (no Redis/BullMQ) since the Vercel Sandbox is a single-process environment. Use Supabase for mission persistence and the existing Telnyx client for execution. Rate limiting is the critical constraint -- Telnyx enforces 1 SMS/second account-wide and 10 messages/minute/number for long codes, plus outbound call concurrency should be capped at 1-2 simultaneous legs.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MISSION-01 | User can create missions via voice, SMS, or any connected chat channel by describing what they need | Mission intake parser reuses existing intent extraction (Phase 2) + new `create_mission` tool registered in tool registry |
| MISSION-02 | Agent plans the mission with clear steps and creates a dedicated AI assistant for execution | Mission planner uses Anthropic tier (complex task) to decompose natural language into MissionStep[] with dedicated system prompt |
| MISSION-03 | Agent schedules and executes mission events automatically (batch calls, SMS campaigns) | In-process scheduler with configurable delays, uses existing `call_provider` and `send_sms` tool handlers |
| MISSION-04 | Mission progress is trackable in real-time via the ClawdTalk portal | ClawdTalk plugin already enabled in openclaw.json; emit progress events via OpenClaw gateway sessions_send |
| MISSION-05 | Agent captures results and conversation insights from each mission event automatically | Each event stores structured results (call outcome, SMS delivery status, conversation summary) in Supabase |
| MISSION-06 | Agent handles batch operations with automatic scheduling and throttling (rate limiting) | Token bucket rate limiter: 1 SMS/sec account-wide, 1 concurrent outbound call, configurable per-mission throttle |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| telnyx | ^6.13.0 | Outbound calls + SMS | Already installed; `client.calls.dial()` for calls, `client.messages.create()` for SMS |
| @supabase/supabase-js | ^2.x | Mission persistence | Already in .env.example (SUPABASE_URL, keys); Supabase is the project's database layer |
| zod | ^4.3.6 | Mission schema validation | Already installed; validate mission input, step definitions, event results |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @anthropic-ai/sdk | ^0.78.0 | Mission planning LLM | Already installed; complex task tier for decomposing natural language into mission plans |
| openai | ^6.29.0 | Routine mission updates | Already installed; OpenRouter tier for status messages and filler |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-process queue | BullMQ + Redis | BullMQ is production-grade but requires Redis; Vercel Sandbox is single-process with no Redis available; unnecessary complexity |
| In-process queue | node-cron | node-cron is for recurring schedules, not one-shot delayed jobs; missions are one-shot with variable delays |
| Supabase | In-memory Map | Would lose mission state on sandbox restart; Supabase provides persistence and the dashboard (Phase 7) already reads from it |

**Installation:**
```bash
npm install @supabase/supabase-js
```
(All other dependencies already installed.)

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── missions/
│   │   ├── types.ts              # Mission, MissionStep, MissionEvent types
│   │   ├── mission-planner.ts    # LLM-powered mission decomposition
│   │   ├── mission-engine.ts     # Lifecycle: create → plan → schedule → execute → complete
│   │   ├── mission-scheduler.ts  # In-process queue with rate limiting
│   │   ├── rate-limiter.ts       # Token bucket for Telnyx rate limits
│   │   └── mission-reporter.ts   # Progress events to ClawdTalk + result summaries
│   ├── tools/
│   │   └── handlers/
│   │       └── missions.ts       # create_mission, get_mission_status tool handlers
│   └── db/
│       ├── supabase-client.ts    # Singleton Supabase client (lazy, like telnyx-client.ts)
│       └── missions-repo.ts      # CRUD for missions table
├── types/
│   └── mission.ts                # Shared mission type exports
```

### Pattern 1: Mission State Machine
**What:** Missions follow a strict lifecycle: CREATED -> PLANNING -> PLANNED -> SCHEDULING -> EXECUTING -> COMPLETED/FAILED
**When to use:** Every mission goes through this lifecycle
**Example:**
```typescript
// State transitions
type MissionStatus =
  | 'created'      // User request received
  | 'planning'     // LLM decomposing into steps
  | 'planned'      // Steps defined, awaiting schedule
  | 'executing'    // Events being processed
  | 'paused'       // User-requested pause
  | 'completed'    // All events done
  | 'failed';      // Unrecoverable error

interface Mission {
  id: string;
  userId: string;          // Caller phone number or ClawdTalk user ID
  channel: 'voice' | 'sms' | 'chat';
  description: string;     // Original natural language request
  status: MissionStatus;
  steps: MissionStep[];
  results: MissionEventResult[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface MissionStep {
  id: string;
  missionId: string;
  order: number;
  type: 'call' | 'sms' | 'search';
  target: string;          // Phone number or search query
  context: string;         // What to say/ask
  scheduledAt?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';
}
```

### Pattern 2: In-Process Job Queue with Rate Limiting
**What:** A simple queue that processes mission steps sequentially with configurable delays between operations
**When to use:** All mission execution -- no external queue needed for single-process Vercel Sandbox
**Example:**
```typescript
interface QueueOptions {
  maxConcurrentCalls: number;   // Default: 1
  smsPerSecond: number;         // Default: 1 (Telnyx account limit)
  delayBetweenCallsMs: number;  // Default: 5000 (5 sec between calls)
  maxRetriesPerStep: number;    // Default: 2
}

class MissionScheduler {
  private queue: MissionStep[] = [];
  private processing = false;
  private rateLimiter: RateLimiter;

  async enqueue(steps: MissionStep[]): Promise<void> {
    this.queue.push(...steps);
    if (!this.processing) this.processNext();
  }

  private async processNext(): Promise<void> {
    this.processing = true;
    while (this.queue.length > 0) {
      const step = this.queue.shift()!;
      await this.rateLimiter.acquire(step.type);
      await this.executeStep(step);
    }
    this.processing = false;
  }
}
```

### Pattern 3: Mission Planning via LLM
**What:** Use Anthropic (complex tier) to decompose natural language into structured MissionStep arrays
**When to use:** When user creates a mission -- converts "Call the top 5 plumbers in Austin and get quotes" into executable steps
**Example:**
```typescript
const MISSION_PLANNER_PROMPT = `You are a mission planner for OpenClaw.
Given a user's request, decompose it into concrete steps.

Each step must be one of:
- search: Find providers matching criteria
- call: Call a specific phone number with a script
- sms: Send an SMS to a specific number

Output JSON array of steps with: type, target, context, order.

RULES:
- Search steps always come before call/sms steps
- Call steps include what to say and what info to capture
- SMS steps include the message body
- Maximum 10 steps per mission
- Include error handling guidance for each step`;

async function planMission(description: string): Promise<MissionStep[]> {
  const response = await chat(
    [
      { role: 'system', content: MISSION_PLANNER_PROMPT },
      { role: 'user', content: description },
    ],
    'transfer-logic' // Routes to Anthropic tier
  );
  return parseMissionSteps(response);
}
```

### Pattern 4: Real-Time Progress via ClawdTalk
**What:** Emit structured progress events through the OpenClaw gateway so the ClawdTalk portal shows live mission status
**When to use:** After each mission event completes or status changes
**Example:**
```typescript
// Progress event emitted via OpenClaw gateway sessions_send
interface MissionProgressEvent {
  type: 'mission.progress';
  missionId: string;
  step: number;
  totalSteps: number;
  status: string;
  detail: string;          // "Called Acme Plumbing - available, quote: $150"
  timestamp: string;
}
```

### Anti-Patterns to Avoid
- **Unbounded parallelism:** Never fire all calls/SMS simultaneously -- Telnyx will rate-limit and fail. Always use the scheduler with rate limiting.
- **Blocking the event loop:** Mission execution must be async and non-blocking. The Express server still needs to handle webhooks during mission execution.
- **Storing mission state only in memory:** Sandbox can restart. Persist to Supabase after every state transition.
- **Hardcoded rate limits:** Telnyx limits vary by 10DLC trust score and carrier. Make limits configurable via env vars.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting | Custom timing logic with setTimeout | Token bucket algorithm (simple implementation, ~30 lines) | Edge cases around burst, refill, concurrent access |
| Outbound calls | Raw HTTP to Telnyx API | `getTelnyxClient().calls.dial()` | SDK handles auth, retries, response parsing |
| SMS sending | Raw HTTP to Telnyx API | `getTelnyxClient().messages.create()` | SDK handles auth, encoding, delivery status |
| Mission persistence | File-based storage | Supabase (already configured) | Transactions, queries, dashboard reads from same DB |
| Schema validation | Manual if/else checks | Zod schemas (already installed) | Type inference, error messages, composable |

**Key insight:** The entire execution layer (calls, SMS, search) already exists as tool handlers from prior phases. Missions orchestrate existing tools -- the new work is planning, scheduling, and progress reporting.

## Common Pitfalls

### Pitfall 1: Telnyx SMS Rate Limit (1 msg/sec account-wide)
**What goes wrong:** Batch SMS missions fire too fast, Telnyx returns 429 errors, messages silently fail
**Why it happens:** Account-level limit of 1 SMS/second is surprisingly low; 10DLC per-number limit is 10 msgs/min
**How to avoid:** Token bucket rate limiter with 1 token/second for SMS. Queue all SMS through the rate limiter regardless of mission.
**Warning signs:** Telnyx error code 40300 (rate limit exceeded), messages stuck in "queued" status

### Pitfall 2: Outbound Call Concurrency
**What goes wrong:** Multiple mission steps try to dial simultaneously, exceeding connection limits or creating confusing webhook interleaving
**Why it happens:** Telnyx Call Control is async -- dial returns immediately, results come via webhooks. Easy to fire multiple dials.
**How to avoid:** Cap concurrent outbound calls at 1 (or 2 max). Wait for call completion webhook before dialing next.
**Warning signs:** Overlapping call.initiated webhooks, mixed-up call_leg_ids

### Pitfall 3: Mission Planner LLM Hallucination
**What goes wrong:** LLM generates phone numbers, makes up provider names, or creates impossible steps
**Why it happens:** Mission planning prompt gives LLM too much freedom; no grounding in real data
**How to avoid:** Two-phase planning: (1) LLM generates abstract steps (search for X, call results, SMS summary), (2) execution fills in real data from search results. Never let LLM fabricate contact info.
**Warning signs:** Steps containing phone numbers that weren't from a search result

### Pitfall 4: Sandbox Restart During Mission
**What goes wrong:** Vercel Sandbox restarts mid-mission, in-memory queue is lost, mission hangs
**Why it happens:** Sandbox has timeout/restart behavior; keep-alive helps but doesn't guarantee uptime
**How to avoid:** Persist mission state to Supabase after every step. On startup, check for incomplete missions and resume from last completed step.
**Warning signs:** Missions stuck in "executing" status with no recent events

### Pitfall 5: Missing Webhook Correlation for Mission Calls
**What goes wrong:** Outbound call webhooks can't be matched back to the mission step that triggered them
**Why it happens:** Telnyx webhooks contain call_control_id/call_leg_id but no custom metadata for correlation
**How to avoid:** Store a mapping of call_leg_id -> mission_step_id when dialing. Use client_state (base64-encoded) parameter in the dial command to pass mission context.
**Warning signs:** Orphaned webhook events, mission steps never marked complete

### Pitfall 6: 10DLC Compliance for Batch SMS
**What goes wrong:** Batch SMS campaigns get flagged as spam, messages blocked by carriers
**Why it happens:** 10DLC campaign registration may not cover "batch/campaign" use case if originally registered for "transactional" only
**How to avoid:** Verify 10DLC campaign type covers promotional/mixed messaging. Include opt-out language in batch SMS. Keep per-number rate under 10 msgs/min.
**Warning signs:** High SMS failure rates to specific carriers (especially T-Mobile)

## Code Examples

### Telnyx Outbound Call (from SDK docs)
```typescript
// Source: https://developers.telnyx.com/api/call-control/dial-call
const client = getTelnyxClient();
const response = await client.calls.dial({
  connection_id: process.env.TELNYX_CONNECTION_ID!,
  from: process.env.TELNYX_PHONE_NUMBER!,
  to: targetPhoneNumber,
  answering_machine_detection: 'detect',  // AMD for batch efficiency
  client_state: Buffer.from(JSON.stringify({
    missionId,
    stepId,
  })).toString('base64'),
  webhook_url: `${process.env.PRODUCTION_URL}/webhooks/telnyx`,
});
const callLegId = response.data.call_leg_id;
```

### Telnyx SMS Send (from SDK docs)
```typescript
// Source: https://developers.telnyx.com/api/messaging/send-message
const client = getTelnyxClient();
const response = await client.messages.create({
  from: process.env.TELNYX_PHONE_NUMBER!,
  to: targetPhoneNumber,
  text: messageBody,
});
```

### Token Bucket Rate Limiter
```typescript
class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number,
    private refillRatePerMs: number,
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    // Wait for next token
    const waitMs = (1 - this.tokens) / this.refillRatePerMs;
    await new Promise(resolve => setTimeout(resolve, waitMs));
    this.refill();
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRatePerMs);
    this.lastRefill = now;
  }
}

// 1 SMS per second
const smsLimiter = new TokenBucketRateLimiter(1, 1 / 1000);
// 1 concurrent call (limiter with 1 token, slow refill = 1 per 5 seconds)
const callLimiter = new TokenBucketRateLimiter(1, 1 / 5000);
```

### Supabase Client (follows telnyx-client.ts lazy pattern)
```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('[supabase] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    _client = createClient(url, key);
  }
  return _client;
}
```

### Mission New Tool Registration
```typescript
// Add to TOOLS array in registry.ts
{
  name: 'create_mission',
  description: 'Create a new batch mission from a natural language description. The agent will plan, schedule, and execute the mission automatically.',
  input_schema: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'Natural language description of the mission (e.g., "Call the top 5 plumbers in Austin and get quotes")',
      },
      channel: {
        type: 'string',
        description: 'Channel the mission was created from: "voice", "sms", or "chat"',
      },
    },
    required: ['description'],
  },
},
{
  name: 'get_mission_status',
  description: 'Get the current status and progress of a mission by ID.',
  input_schema: {
    type: 'object',
    properties: {
      mission_id: {
        type: 'string',
        description: 'The mission ID to check status for',
      },
    },
    required: ['mission_id'],
  },
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BullMQ + Redis for job queues | In-process queues for single-service deployments | N/A (architecture choice) | No Redis dependency in Vercel Sandbox |
| Raw Telnyx REST calls | Telnyx SDK v6 with typed responses | Telnyx SDK v6 (current) | Type safety, automatic retry |
| Blind batch SMS | 10DLC-compliant throttled sending | 2023 (carrier enforcement) | Must respect per-number and account-level limits |
| Manual call result tracking | AMD + client_state webhook correlation | Telnyx AMD launch | 97% accuracy detecting voicemail vs human |

**Deprecated/outdated:**
- Bull (predecessor to BullMQ): in maintenance mode, use BullMQ if Redis is available
- Telnyx Auth V1: deprecated, use V2 API keys

## Supabase Schema Design

### missions table
```sql
CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,          -- Phone number or ClawdTalk user ID
  channel TEXT NOT NULL,          -- 'voice' | 'sms' | 'chat'
  description TEXT NOT NULL,      -- Original natural language request
  status TEXT NOT NULL DEFAULT 'created',
  plan JSONB,                     -- Structured plan from LLM
  summary TEXT,                   -- Final results summary
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_missions_user ON missions(user_id);
CREATE INDEX idx_missions_status ON missions(status);
```

### mission_events table
```sql
CREATE TABLE mission_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES missions(id),
  step_order INTEGER NOT NULL,
  type TEXT NOT NULL,              -- 'call' | 'sms' | 'search'
  target TEXT NOT NULL,            -- Phone number or search query
  context TEXT,                    -- Script/message content
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB,                   -- Structured outcome
  call_leg_id TEXT,               -- Telnyx correlation for calls
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_events_mission ON mission_events(mission_id);
CREATE INDEX idx_events_call_leg ON mission_events(call_leg_id);
```

## Open Questions

1. **ClawdTalk progress event format**
   - What we know: ClawdTalk plugin is enabled in openclaw.json; gateway supports sessions_send
   - What's unclear: Exact event schema the ClawdTalk portal expects for real-time progress display
   - Recommendation: Start with a generic structured event format; adjust when ClawdTalk portal integration is tested

2. **Supabase schema migration strategy**
   - What we know: Supabase is configured in .env.example but no tables exist yet (no Supabase code in src/)
   - What's unclear: Whether to use Supabase migrations CLI or manual SQL; whether Phase 6 (POST-04 call data persistence) will have created tables already
   - Recommendation: Phase 8 should assume Phase 6 created a `calls` table; missions tables are net-new. Use raw SQL via Supabase dashboard or a migration script in bin/.

3. **Mission scope limits**
   - What we know: Success criteria says "top 5 plumbers" and "text all my leads" -- missions can be 5-50+ events
   - What's unclear: Maximum mission size, timeout behavior for long-running missions (30+ minutes)
   - Recommendation: Cap at 25 events per mission. For "text all my leads," require the user to confirm the list size before executing.

4. **AMD behavior in mission context**
   - What we know: Telnyx AMD has 97% accuracy, sends webhooks for human/machine detection
   - What's unclear: Whether the existing Phase 4 outbound calling handler already integrates AMD or if missions need separate handling
   - Recommendation: Mission calls should always enable AMD (`answering_machine_detection: 'detect'`); skip voicemails and mark step as "no answer - machine"

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | vitest defaults (package.json scripts) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MISSION-01 | Mission creation from natural language | unit | `npx vitest run src/lib/missions/mission-engine.test.ts -t "create"` | No - Wave 0 |
| MISSION-02 | LLM mission planning decomposition | unit | `npx vitest run src/lib/missions/mission-planner.test.ts -t "plan"` | No - Wave 0 |
| MISSION-03 | Automatic scheduling and execution | unit | `npx vitest run src/lib/missions/mission-scheduler.test.ts -t "schedule"` | No - Wave 0 |
| MISSION-04 | Real-time progress reporting | unit | `npx vitest run src/lib/missions/mission-reporter.test.ts -t "progress"` | No - Wave 0 |
| MISSION-05 | Result and insight capture | unit | `npx vitest run src/lib/missions/mission-engine.test.ts -t "results"` | No - Wave 0 |
| MISSION-06 | Rate limiting and throttling | unit | `npx vitest run src/lib/missions/rate-limiter.test.ts` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/missions/mission-engine.test.ts` -- covers MISSION-01, MISSION-05
- [ ] `src/lib/missions/mission-planner.test.ts` -- covers MISSION-02
- [ ] `src/lib/missions/mission-scheduler.test.ts` -- covers MISSION-03
- [ ] `src/lib/missions/mission-reporter.test.ts` -- covers MISSION-04
- [ ] `src/lib/missions/rate-limiter.test.ts` -- covers MISSION-06
- [ ] `src/lib/db/missions-repo.test.ts` -- covers persistence layer
- [ ] Framework install: `npm install @supabase/supabase-js` -- Supabase client not yet installed

## Sources

### Primary (HIGH confidence)
- Telnyx Dial API docs: https://developers.telnyx.com/api/call-control/dial-call -- outbound call parameters, client_state, AMD
- Telnyx Send Message API: https://developers.telnyx.com/api/messaging/send-message -- SMS sending parameters
- Telnyx Rate Limits: https://developers.telnyx.com/docs/messaging/10dlc/10dlc-rate-limits -- 10DLC throughput limits
- Telnyx AMD docs: https://developers.telnyx.com/docs/voice/programmable-voice/answering-machine-detection -- AMD configuration
- Existing codebase: src/lib/tools/registry.ts, src/lib/ai/orchestrator.ts, src/startup/openclaw-config.ts -- integration surface

### Secondary (MEDIUM confidence)
- Telnyx SMS throughput: https://support.telnyx.com/en/articles/96934-throughput-limit-for-outbound-long-code-sms -- 1 msg/sec account limit, 10/min/number
- BullMQ docs: https://docs.bullmq.io/ -- evaluated and rejected for this architecture (no Redis)

### Tertiary (LOW confidence)
- ClawdTalk portal progress event format: inferred from project context, not verified against ClawdTalk docs
- Supabase schema: designed for this project, not based on existing tables (none exist yet)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed or well-documented (only adding @supabase/supabase-js)
- Architecture: MEDIUM - mission state machine and scheduler patterns are sound but ClawdTalk progress integration is unverified
- Pitfalls: HIGH - Telnyx rate limits are well-documented; sandbox restart risk is real and mitigated by Supabase persistence

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable domain, Telnyx SDK unlikely to change)

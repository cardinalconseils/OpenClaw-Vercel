---
name: discussion-builder
description: Design and build phone conversation flows, dialogue scripts, and voice interaction patterns for OpenClaw dispatch calls
---

# Discussion Builder

Build natural, efficient phone conversations for the OpenClaw dispatch pipeline.

## When to Use

- Designing caller intake dialogue (greeting → intent → details)
- Writing provider outreach scripts (intro → availability check → qualification)
- Creating hold/waiting experiences with status updates
- Building warm transfer handoff scripts
- Structuring post-call SMS recap content

## Conversation Architecture

### Caller-Side Dialogue

```
STAGE 1: GREETING & INTENT
├── Greeting (warm, brief — under 5 seconds)
├── Open-ended prompt ("What can I help you find today?")
├── Intent classification (service type, urgency)
└── Confirmation ("So you need a [service] — got it.")

STAGE 2: DETAILS & QUALIFICATION
├── Location (infer from caller ID or ask)
├── Timing ("When do you need this done?")
├── Specifics (job size, special requirements)
└── Summary confirmation before searching

STAGE 3: SEARCH & HOLD
├── Transition ("Let me find the best options near you.")
├── Status updates every 15-20 seconds
├── Result announcement ("I found 3 providers...")
└── Provider intro before transfer

STAGE 4: TRANSFER
├── Warm intro to provider
├── Brief both parties
└── Graceful exit or stay on line
```

### Provider-Side Dialogue

```
STAGE 1: INTRO (under 10 seconds)
├── "Hi, this is OpenClaw — we have a customer nearby looking for [service]."

STAGE 2: AVAILABILITY CHECK
├── "Are you available [timeframe]?"
├── If no → "Thanks, have a great day." (move to next)

STAGE 3: JOB DETAILS
├── Brief description of the job
├── Confirm they can handle it

STAGE 4: HANDOFF
├── "Great — I'll connect you now."
├── Warm transfer with customer context
```

## Script Template Format

```typescript
interface ConversationScript {
  stage: string;
  prompt: string;           // What the AI says
  expectedIntent: string;   // What we expect to hear
  fallback: string;         // If we don't understand
  maxAttempts: number;      // Before escalating
  nextStage: string;        // On success
  errorStage: string;       // On failure
  timeoutMs: number;        // Silence timeout
}
```

## Design Rules

1. **3-second rule** — If the caller hasn't heard anything in 3 seconds, something is wrong
2. **2-turn clarification max** — If you can't understand after 2 tries, escalate or offer alternatives
3. **No dead air** — Always fill silence with status or filler ("One moment...")
4. **Mirror language** — Use the caller's words back to them, not jargon
5. **Progressive disclosure** — Don't dump all info at once; reveal as needed
6. **Graceful exits** — Every path must have a way out ("Would you like me to text you these options instead?")

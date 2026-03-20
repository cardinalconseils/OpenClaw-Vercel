---
name: dispatch-process
description: Design and implement provider dispatching logic — ranking, routing, parallel dialing, and fallback strategies
---

# Dispatch Process

Build the dispatching engine that selects, contacts, and connects callers with the best available service provider.

## When to Use

- Designing provider selection and ranking algorithms
- Building parallel/sequential dialing strategies
- Implementing fallback and escalation paths
- Optimizing dispatch speed and success rate
- Structuring the dispatch state machine

## Dispatch Pipeline

```
INTAKE → SEARCH → RANK → DIAL → CONNECT → FOLLOW-UP
```

### 1. Intake — Extract Dispatch Parameters

| Parameter | Source | Required |
|-----------|--------|----------|
| Service type | Caller speech (NLU) | Yes |
| Location | Caller ID / spoken address | Yes |
| Urgency | Caller speech | No (default: normal) |
| Timing | Caller speech | No (default: ASAP) |
| Budget | Caller speech | No |
| Preferences | Caller history / speech | No |

### 2. Search — Find Candidate Providers

```
Google Maps/Places API
├── Query: "{service_type} near {location}"
├── Radius: start 5km → expand to 25km if < 3 results
├── Filters: open_now, minimum_rating >= 3.5
└── Max candidates: 10
```

### 3. Rank — Score and Sort Providers

```typescript
interface ProviderScore {
  proximity: number;     // 0-30 pts (closer = higher)
  rating: number;        // 0-25 pts (stars × 5)
  reviewCount: number;   // 0-15 pts (log scale)
  availability: number;  // 0-20 pts (from history or hours)
  priceMatch: number;    // 0-10 pts (if budget provided)
}
```

**Ranking priority by urgency:**
- **Emergency**: proximity (40%) → availability (30%) → rating (20%) → reviews (10%)
- **Normal**: rating (30%) → proximity (25%) → reviews (20%) → availability (15%) → price (10%)
- **Flexible**: rating (25%) → price (25%) → reviews (25%) → proximity (15%) → availability (10%)

### 4. Dial — Contact Providers

**Strategy: Waterfall with parallel backup**

```
Round 1: Dial top-ranked provider
├── Answer → qualify → if available → CONNECT
├── No answer (20s) → move to Round 2
└── Declined → move to Round 2

Round 2: Dial #2 and #3 in parallel
├── First to answer and accept → CONNECT
├── Both decline → Round 3
└── Timeout (30s) → Round 3

Round 3: Dial #4 and #5 in parallel
├── Same as Round 2
└── All fail → FALLBACK
```

**Caller updates during dialing:**
- After Round 1: "The first provider wasn't available — trying two more now."
- After Round 2: "Still searching — I have a couple more options."
- After Round 3: "I wasn't able to reach anyone right now."

### 5. Connect — Transfer Caller to Provider

```
Warm Transfer Protocol:
1. Brief provider: "I have [name] on the line — they need [service] at [location]."
2. Brief caller: "I'm connecting you with [provider name] — [rating] stars, [distance] away."
3. Bridge the call (Telnyx conference)
4. AI agent drops off after confirming both parties are talking
```

### 6. Follow-up — Post-Connection

```
After call ends:
1. SMS to caller: "Thanks for using OpenClaw! You were connected with [provider]."
2. SMS includes: provider name, phone, address, tip link
3. Log: dispatch time, rounds needed, outcome, caller satisfaction signal
```

## Dispatch State Machine

```
IDLE → INTAKE → SEARCHING → RANKING → DIALING → TRANSFERRING → CONNECTED → COMPLETE
                                         ↓                          ↓
                                      FALLBACK ←──────────── TRANSFER_FAILED
                                         ↓
                                    SMS_ALTERNATIVES → COMPLETE
```

**Fallback path when no provider connects:**
1. Offer to SMS the top 3 providers' contact info
2. Offer to try again at a different time
3. Suggest the caller try the top-rated result directly

## Metrics to Track

| Metric | Target | What It Measures |
|--------|--------|-----------------|
| Dispatch success rate | > 70% | Calls that result in a connection |
| Time to connect | < 90 seconds | From intake complete to transfer |
| Rounds needed | Avg < 2 | How many dial rounds before connect |
| Provider answer rate | > 50% | Providers who pick up |
| Caller drop-off rate | < 15% | Callers who hang up during dispatch |
| Post-call SMS open rate | > 60% | Engagement with follow-up |

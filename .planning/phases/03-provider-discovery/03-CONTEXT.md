# Phase 3: Provider Discovery - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Given extracted service type and location (from Phase 2 intent extractor), search Google Places and web fallback for local service providers, rank them by ratings/proximity/urgency, narrate a transparent verbal summary to the caller, and produce a ranked provider list with phone numbers that feeds into Phase 4 outbound calling.

</domain>

<decisions>
## Implementation Decisions

### Search Sources & Fallback
- **Google Places API** as primary source — `GOOGLE_MAPS_API_KEY` via environment variable (already in .env.example)
- **Fetch top 10** results from API for ranking flexibility
- **Show top 3** to caller — narrate only the best matches
- **Web search via OpenRouter** as fallback when Google Places returns fewer than 3 results — no extra API key needed, OpenRouter already configured
- **Custom provider directory deferred** — Google Places + web fallback is enough for v1

### Ranking & Scoring Logic
- **Normal requests:** Rating first, then proximity — highest-rated providers surface first; among similar ratings (within 0.3 stars), prefer closer ones
- **Urgent/emergency requests:** Proximity first, open now — closest providers currently open get priority; rating becomes secondary
- **Show all providers, note hours** — include closed providers but Murphy mentions "they open at 8am tomorrow." Caller decides whether to wait
- Urgency detection already built in Phase 2 intent extractor (`urgency` field)

### Result Narration
- **Summary + top pick pattern:** "I found 6 plumbers near downtown Austin. The top-rated is Acme Plumbing with 4.8 stars — want me to call them?"
- **Match caller language** — narrate in detected language (EN/FR). Provider names stay in English (business names)
- **If caller declines top pick:** Offer next in ranked list — "No problem. Next up is Bob's Plumbing — 4.6 stars, 1.5 miles away."
- **No results found:** Broaden search radius + suggest alternatives. If still nothing: "I'd suggest trying [service] + [city] on Google. Sorry I couldn't help more!"

### Provider Data
- **Core fields per provider:** name, phone, rating, review count, address, distance, opening hours, place_id
- **Ranked list stored in CallState** — Phase 4 reads from in-memory call state to start dialing (call-state.ts from Phase 2)

### Claude's Discretion
- Google Places API query construction (search terms, radius, type filters)
- Web search query formatting for fallback
- Exact narration phrasing in French
- Search radius (initial and broadened)
- How to compute distance from caller location
- Rating similarity threshold for proximity tiebreaker

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Search implementation
- `src/lib/tools/handlers/search.ts` — Existing stub with `Provider` interface and `searchProviders` function to replace
- `src/lib/tools/registry.ts` — Tool registry with `search_providers` tool definition
- `.claude/skills/dispatch-process/SKILL.md` — Dispatch pipeline (SEARCH → RANK stages)

### Voice integration
- `src/lib/voice/call-state.ts` — CallState interface needs `providers` field for ranked list
- `src/lib/voice/filler.ts` — Filler phrases play during search
- `src/api/webhooks.ts` — Webhook handler triggers search after intent capture

### Intent input
- `src/lib/ai/intent-extractor.ts` — `IntentResult` with service_type, location, urgency feeds into search

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/tools/handlers/search.ts`: Stub `searchProviders(params)` with `SearchProvidersParams` (service_type, location, urgency) and `Provider` interface (name, phone, rating, distance) — needs real implementation
- `src/lib/tools/registry.ts`: `search_providers` tool already registered with JSON schema
- `src/lib/voice/call-state.ts`: `CallState` interface — needs `providers: Provider[]` field added
- `src/lib/ai/intent-extractor.ts`: `extractIntent` returns `IntentResult` with service_type, location, urgency — direct input to search

### Established Patterns
- Tool handlers in `src/lib/tools/handlers/` — follow same pattern as existing stubs
- Structured logging with `[tools:search]` prefix
- TypeScript interfaces for all data contracts
- Vitest for testing with mocked external APIs

### Integration Points
- `src/api/webhooks.ts` → after intent capture, triggers `search_providers` tool
- `src/lib/voice/filler.ts` → plays filler during search API calls
- CallState → stores ranked provider list for Phase 4 consumption

</code_context>

<specifics>
## Specific Ideas

- The narration pattern from ROADMAP.md: "I found 6 plumbers near downtown Austin. The top-rated one is Acme Plumbing with 4.8 stars — calling them now"
- Murphy should sound confident and decisive, not listing options like a menu
- Filler phrase fires concurrently with Google Places API call — caller hears "Searching for plumbers near you now" while results load

</specifics>

<deferred>
## Deferred Ideas

- Custom provider directory (local DB of preferred/vetted providers) — future feature
- Provider reviews/sentiment analysis — beyond v1 scope
- Map/directions integration — visual features for dashboard phase

</deferred>

---

*Phase: 03-provider-discovery*
*Context gathered: 2026-03-16*

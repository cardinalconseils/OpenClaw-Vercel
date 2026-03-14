# Requirements: OpenClaw — Service Matchmaker

**Defined:** 2026-03-14
**Core Value:** Eliminate the tedious multi-call search for local service providers — one phone call to the agent replaces five calls to providers.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Infrastructure

- [ ] **INFRA-01**: OpenClaw gateway runs on Vercel Sandbox with Telnyx phone number configured
- [ ] **INFRA-02**: Telnyx webhook receives inbound calls and routes to OpenClaw voice-call plugin
- [ ] **INFRA-03**: Device pre-pairing is automated (sandbox pairing bug workaround)
- [ ] **INFRA-04**: Sandbox timeout is extended and kept alive during active calls
- [ ] **INFRA-05**: 10DLC SMS registration is initiated for outbound SMS compliance

### Voice Conversation

- [ ] **VOICE-01**: User calls Telnyx number and agent answers with a greeting
- [ ] **VOICE-02**: Agent captures user intent from natural speech (service type, location, urgency)
- [ ] **VOICE-03**: Agent asks smart clarifying questions when intent is ambiguous
- [ ] **VOICE-04**: Agent responds with sub-second perceived latency (streaming TTS)
- [ ] **VOICE-05**: Agent uses filler speech during tool calls to avoid dead air

### Provider Search

- [ ] **SRCH-01**: Agent searches Google Places API for providers matching service type and location
- [ ] **SRCH-02**: Agent performs web search as fallback when Google Places has gaps
- [ ] **SRCH-03**: Agent queries custom provider directory for curated/vetted providers
- [ ] **SRCH-04**: Agent ranks providers by ratings, reviews, proximity, and hours of operation
- [ ] **SRCH-05**: Agent detects urgency keywords and re-ranks for same-day/emergency availability
- [ ] **SRCH-06**: Agent narrates search results to user with ranking transparency

### Outbound Calling

- [ ] **CALL-01**: Agent calls providers starting from the best-ranked match
- [ ] **CALL-02**: Agent identifies itself as AI on outbound calls (legal compliance)
- [ ] **CALL-03**: Agent gives live verbal updates to user while calling providers
- [ ] **CALL-04**: Agent sends SMS pre-notification to provider before/during call to signal legitimate customer interest
- [ ] **CALL-05**: Agent handles answering machines and busy signals, moves to next provider
- [ ] **CALL-06**: Agent confirms provider availability before attempting transfer
- [ ] **CALL-07**: Agent cascades through ranked providers if first match is unavailable

### Call Transfer

- [ ] **XFER-01**: Agent performs live warm transfer — patches user through to available provider
- [ ] **XFER-02**: Agent briefs provider before merging: service needed, user name, location
- [ ] **XFER-03**: Agent exits call cleanly after successful transfer
- [ ] **XFER-04**: Agent handles transfer failure gracefully (provider drops, no answer) and retries next provider

### Post-Call

- [ ] **POST-01**: Agent sends SMS recap to user after call ends (providers contacted, outcomes, connected provider info)
- [ ] **POST-02**: Agent includes BuyMeACoffee tip link in SMS recap
- [ ] **POST-03**: Agent sends graceful failure SMS with provider contact list if no live transfer was achieved
- [ ] **POST-04**: Call data is persisted for history (caller, providers, outcomes, timestamps)

### Web Dashboard

- [ ] **DASH-01**: User can view call history by entering their phone number
- [ ] **DASH-02**: Dashboard shows past searches, providers contacted, and outcomes
- [ ] **DASH-03**: Dashboard is a simple web page served from the Vercel Sandbox

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Proactive Monitoring

- **PROACT-01**: Agent monitors for seasonal/recurring needs and suggests providers via SMS
- **PROACT-02**: Agent sends reminders for annual services (HVAC maintenance, gutter cleaning)

### Enhanced Provider Directory

- **DIR-01**: Provider self-registration portal
- **DIR-02**: Provider ratings from OpenClaw users (in addition to Google)
- **DIR-03**: Provider availability calendar integration

### Multi-Language

- **LANG-01**: Spanish language support for voice and SMS
- **LANG-02**: French language support for voice and SMS

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Scheduling/booking on behalf of user | Liability risk; incompatible provider systems; user handles after transfer |
| Payment processing or job quotes | PCI compliance, provider agreements; 48% of businesses refuse AI pricing requests |
| Provider-side portal | Creates two-sided marketplace; doubles acquisition problem |
| Mobile app | Phone call + SMS + web dashboard covers 100% of interaction surface |
| Multi-language (v1) | STT/TTS quality degrades in non-English; unvalidated market |
| IVR-style menus | Rigid; contradicts natural AI conversation UX |
| AI identity deception | Illegal under CA SB-1001 and FCC rules |
| Storing provider data long-term | Google Maps ToS restricts Places API result storage |
| Caller authentication gate | Removes zero-friction onboarding advantage |
| AI-negotiated pricing | Providers refuse; legal exposure; false expectations |
| Sentiment-based human escalation | Adds staffing cost; contradicts human-free architecture |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | — | Pending |
| INFRA-02 | — | Pending |
| INFRA-03 | — | Pending |
| INFRA-04 | — | Pending |
| INFRA-05 | — | Pending |
| VOICE-01 | — | Pending |
| VOICE-02 | — | Pending |
| VOICE-03 | — | Pending |
| VOICE-04 | — | Pending |
| VOICE-05 | — | Pending |
| SRCH-01 | — | Pending |
| SRCH-02 | — | Pending |
| SRCH-03 | — | Pending |
| SRCH-04 | — | Pending |
| SRCH-05 | — | Pending |
| SRCH-06 | — | Pending |
| CALL-01 | — | Pending |
| CALL-02 | — | Pending |
| CALL-03 | — | Pending |
| CALL-04 | — | Pending |
| CALL-05 | — | Pending |
| CALL-06 | — | Pending |
| CALL-07 | — | Pending |
| XFER-01 | — | Pending |
| XFER-02 | — | Pending |
| XFER-03 | — | Pending |
| XFER-04 | — | Pending |
| POST-01 | — | Pending |
| POST-02 | — | Pending |
| POST-03 | — | Pending |
| POST-04 | — | Pending |
| DASH-01 | — | Pending |
| DASH-02 | — | Pending |
| DASH-03 | — | Pending |

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 0
- Unmapped: 34 ⚠️

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-14 after initial definition*

# Requirements: OpenClaw — Service Matchmaker

**Defined:** 2026-03-14
**Core Value:** Eliminate the tedious multi-call search for local service providers — one phone call to the agent replaces five calls to providers.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Infrastructure

- [x] **INFRA-01**: OpenClaw gateway runs on Vercel Sandbox with Telnyx phone number configured
- [x] **INFRA-02**: Telnyx webhook receives inbound calls and routes to OpenClaw voice-call plugin
- [x] **INFRA-03**: Device pre-pairing is automated (sandbox pairing bug workaround)
- [x] **INFRA-04**: Sandbox timeout is extended and kept alive during active calls
- [x] **INFRA-05**: 10DLC SMS registration is initiated for outbound SMS compliance

### Voice Conversation

- [x] **VOICE-01**: User calls Telnyx number and agent answers with a greeting
- [x] **VOICE-02**: Agent captures user intent from natural speech (service type, location, urgency)
- [x] **VOICE-03**: Agent asks smart clarifying questions when intent is ambiguous
- [x] **VOICE-04**: Agent responds with sub-second perceived latency (streaming TTS)
- [x] **VOICE-05**: Agent uses filler speech during tool calls to avoid dead air

### Provider Search

- [x] **SRCH-01**: Agent searches Google Places API for providers matching service type and location
- [x] **SRCH-02**: Agent performs web search as fallback when Google Places has gaps
- [x] **SRCH-03**: Agent queries custom provider directory for curated/vetted providers
- [x] **SRCH-04**: Agent ranks providers by ratings, reviews, proximity, and hours of operation
- [x] **SRCH-05**: Agent detects urgency keywords and re-ranks for same-day/emergency availability
- [x] **SRCH-06**: Agent narrates search results to user with ranking transparency

### Outbound Calling

- [x] **CALL-01**: Agent calls providers starting from the best-ranked match
- [x] **CALL-02**: Agent identifies itself as AI on outbound calls (legal compliance)
- [x] **CALL-03**: Agent gives live verbal updates to user while calling providers
- [x] **CALL-04**: Agent sends SMS pre-notification to provider before/during call to signal legitimate customer interest
- [x] **CALL-05**: Agent handles answering machines and busy signals, moves to next provider
- [x] **CALL-06**: Agent confirms provider availability before attempting transfer
- [x] **CALL-07**: Agent cascades through ranked providers if first match is unavailable

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

### Telnyx Missions

- [x] **MISSION-01**: User can create missions via voice, SMS, or any connected chat channel by describing what they need
- [x] **MISSION-02**: Agent plans the mission with clear steps and creates a dedicated AI assistant for execution
- [x] **MISSION-03**: Agent schedules and executes mission events automatically (batch calls, SMS campaigns)
- [x] **MISSION-04**: Mission progress is trackable in real-time via the ClawdTalk portal
- [x] **MISSION-05**: Agent captures results and conversation insights from each mission event automatically
- [x] **MISSION-06**: Agent handles batch operations with automatic scheduling and throttling (rate limiting)

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
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| INFRA-05 | Phase 1 | Complete |
| VOICE-01 | Phase 2 | Complete |
| VOICE-02 | Phase 2 | Complete |
| VOICE-03 | Phase 2 | Complete |
| VOICE-04 | Phase 2 | Complete |
| VOICE-05 | Phase 2 | Complete |
| SRCH-01 | Phase 3 | Complete |
| SRCH-02 | Phase 3 | Complete |
| SRCH-03 | Phase 3 | Complete |
| SRCH-04 | Phase 3 | Complete |
| SRCH-05 | Phase 3 | Complete |
| SRCH-06 | Phase 3 | Complete |
| CALL-01 | Phase 4 | Complete |
| CALL-02 | Phase 4 | Complete |
| CALL-03 | Phase 4 | Complete |
| CALL-04 | Phase 4 | Complete |
| CALL-05 | Phase 4 | Complete |
| CALL-06 | Phase 4 | Complete |
| CALL-07 | Phase 4 | Complete |
| XFER-01 | Phase 5 | Pending |
| XFER-02 | Phase 5 | Pending |
| XFER-03 | Phase 5 | Pending |
| XFER-04 | Phase 5 | Pending |
| POST-01 | Phase 6 | Pending |
| POST-02 | Phase 6 | Pending |
| POST-03 | Phase 6 | Pending |
| POST-04 | Phase 6 | Pending |
| DASH-01 | Phase 7 | Pending |
| DASH-02 | Phase 7 | Pending |
| DASH-03 | Phase 7 | Pending |
| MISSION-01 | Phase 8 | Complete |
| MISSION-02 | Phase 8 | Complete |
| MISSION-03 | Phase 8 | Complete |
| MISSION-04 | Phase 8 | Complete |
| MISSION-05 | Phase 8 | Complete |
| MISSION-06 | Phase 8 | Complete |

**Coverage:**
- v1 requirements: 40 total
- Mapped to phases: 40
- Unmapped: 0

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-14 after roadmap creation*

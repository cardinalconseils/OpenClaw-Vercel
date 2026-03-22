# Milestones

## v1.0 MVP (Shipped: 2026-03-22)

**Phases:** 13 | **Plans:** 32 | **Commits:** 69 | **LOC:** 11,439 TypeScript
**Timeline:** 2026-03-14 → 2026-03-22 (9 days)
**Requirements:** 54/61 satisfied

**Key accomplishments:**

1. End-to-end AI phone concierge — inbound call → greeting → intent extraction → provider search → outbound cascade → warm bridge transfer
2. Google Places API integration with geocoding, distance ranking, urgency re-ranking, and web search fallback
3. Telnyx Call Control v2 — AMD voicemail detection, live narration, SMS pre-notification, conference bridge transfer
4. Telnyx Missions — batch multi-call campaigns, SMS surveys, rate-limited scheduling via natural language
5. Next.js SaaS frontend at murphy.help — dark landing page, Supabase Auth, legal pages (CCPA/PIPEDA/TCPA)
6. Custom server with /admin proxy to OpenClaw Control UI, admin RBAC via `app_metadata`
7. Zod-validated client state at serialization boundary, typed dispatch interfaces

### Known Gaps (deferred to v1.1)

- **POST-01/02/03**: SMS recap to caller after call (sendSms is a stub — infrastructure exists via Telnyx messages.send)
- **DASH-01/02/03**: Public /history page for call history lookup (data persists via insertCallHistory, page not built)
- **FIX-02**: sessions_send not in openclaw-config.ts (gitignored file, change not committed)

**Archive:** `.planning/milestones/v1.0-ROADMAP.md`, `v1.0-REQUIREMENTS.md`

---

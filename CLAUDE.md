# OpenClaw — Service Matchmaker - Development Guide

**Agent Orchestrator**: [.claude/agents/agent-orchestrator.md](.claude/agents/agent-orchestrator.md)

---

## Project Overview

AI-powered phone concierge that finds and connects callers with local service providers. Users call a Telnyx phone number, describe what they need, and the agent searches for providers, calls them to check availability, then live-transfers the user to the best match. After the call, it sends an SMS recap with a BuyMeACoffee tip link.

### Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Runtime** | Node.js 20+ | Server runtime |
| **Language** | TypeScript | Type safety |
| **Voice/SMS** | Telnyx Call Control v2 | Telephony, STT, TTS |
| **AI Framework** | OpenClaw | Agent orchestration |
| **Search** | Google Maps/Places API | Provider discovery |
| **Database** | Supabase (PostgreSQL) | Data persistence |
| **Deployment** | Vercel Sandbox | Isolated MicroVM, port 18789 |
| **Monetization** | BuyMeACoffee | Tip link via SMS |
| **Observability** | LangSmith | LLM tracing |

---

## Development Workflow

### Starting a New Project

```bash
/gsd:new-project       # Initialize project with deep context gathering
```

This creates `.planning/PROJECT.md` with your project's roadmap, milestones, and phases.

### Feature Development (GSD Flow)

The recommended workflow for all feature development:

```
/gsd:plan-phase → /gsd:execute-phase → /gsd:verify-work
```

| Step | Command | What It Does |
|------|---------|--------------|
| 1. Plan | `/gsd:plan-phase <N>` | Research + create detailed PLAN.md with tasks |
| 2. Execute | `/gsd:execute-phase <N>` | Build with atomic commits and state tracking |
| 3. Verify | `/gsd:verify-work` | Conversational UAT to confirm it works |
| 4. Review | `/review` | Full code quality + security scan |

### Quick Tasks (Skip Planning)

For small changes that don't need a full phase:
```bash
/gsd:quick "fix the login button alignment"
```

### Session Management

| Command | When to Use |
|---------|-------------|
| `/status` | Start of session — see project state |
| `/gsd:progress` | Check milestone progress and next action |
| `/gsd:resume-work` | Resume after a break with full context |
| `/gsd:pause-work` | Save context before stopping |
| `/handoff` | Generate handoff summary for another session |
| `/summarize` | End of session summary |

### GSD Project Commands

| Command | Description |
|---------|-------------|
| `/gsd:new-project` | Initialize project with roadmap |
| `/gsd:new-milestone` | Start a new milestone cycle |
| `/gsd:plan-phase <N>` | Plan a phase (research + tasks) |
| `/gsd:execute-phase <N>` | Execute a planned phase |
| `/gsd:verify-work` | Validate features through UAT |
| `/gsd:add-phase` | Add a phase to current milestone |
| `/gsd:insert-phase` | Insert urgent work between phases |
| `/gsd:remove-phase` | Remove a future phase |
| `/gsd:add-todo` | Capture idea as todo |
| `/gsd:check-todos` | List and work on pending todos |
| `/gsd:map-codebase` | Analyze codebase structure |
| `/gsd:debug` | Systematic debugging with state |
| `/gsd:audit-milestone` | Audit milestone before archiving |
| `/gsd:complete-milestone` | Archive and prepare for next |

### Code Quality Commands

| Command | Description |
|---------|-------------|
| `/review` | Full codebase review (security + quality) |
| `/review-code` | Quick review of recent changes |
| `/review-security` | Security-focused scan |
| `/review-complexity` | Find complex code |
| `/review-file` | Deep analysis of a single file |
| `/review-dir` | Full review of a directory |
| `/review-recent` | Review recently modified files |

### Other Commands

| Command | Description |
|---------|-------------|
| `/decide` | Stop presenting options — diagnose and act |
| `/prd` | Generate PRD with task list |
| `/danger` | Skip permissions (use carefully) |

---

## Agent System

Specialized agents in `.claude/agents/`:

| Agent | Purpose |
|-------|---------|
| `agent-orchestrator` | Coordinates tasks, delegates to agents |
| `code-reviewer` | Security and quality review |
| `frontend-designer` | UI design (Dieter Rams principles) |
| `e2e-test-specialist` | End-to-end test coverage |
| `uat-specialist` | User acceptance test scenarios |
| `documentation-specialist` | Documentation maintenance |

---

## Skills

Domain expertise in `.claude/skills/`:

| Skill | Purpose |
|-------|---------|
| `expert-decide` | Autonomous decision framework |
| `code-quality` | Review workflows (full, security, recent) |
| `ideas` | Capture and prioritize project ideas |
| `team-orchestration` | Multi-agent coordination |
| `learning` | Codebase deep dives and concept learning |

---

## Directory Structure

```
.
├── CLAUDE.md                    # This file
├── .env.example                 # Environment template
├── .gitignore                   # Git ignore rules
├── bin/setup.sh                 # Project setup script
│
├── .claude/                     # Claude Code configuration
│   ├── settings.local.json      # Permission rules
│   ├── agents/                  # Specialized AI agents
│   ├── commands/                # Slash commands
│   ├── skills/                  # Domain knowledge
│   ├── hooks/                   # Automation hooks
│   └── temp/                    # Session handoffs (gitignored)
│
├── .planning/                   # GSD project planning (auto-created)
│   ├── PROJECT.md               # Project definition
│   ├── ROADMAP.md               # Milestone roadmap
│   ├── codebase/                # Codebase analysis
│   └── phases/                  # Phase plans and state
│
├── src/                         # Source code
│   ├── api/                     # API routes
│   ├── lib/                     # Core libraries
│   │   ├── voice/               # Voice pipeline (Telnyx)
│   │   ├── state/               # Call state machine
│   │   ├── ai/                  # LLM orchestrator
│   │   └── tools/               # Tool registry
│   └── types/                   # Type definitions
│
├── tests/                       # Test suites
└── docs/                        # Documentation
```

---

## Code Conventions

### Naming

- **Files**: `kebab-case.ts`
- **Components**: `PascalCase`
- **Functions**: `camelCase`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Types**: `PascalCase`

### Rules

- Keep files under 300 lines
- Co-locate tests (`*.test.ts` alongside `*.ts`)
- Use typed errors and Result types for recoverable errors
- Use structured logging
- Never hardcode secrets

---

## Security Guidelines

1. **Never hardcode secrets** — use environment variables
2. **Validate all inputs** — especially external data
3. **Sanitize database queries** — use parameterized queries
4. **Rate limit API endpoints** — prevent abuse
5. **Log security events** — track auth and access
6. **Validate Telnyx webhooks** — check signatures on all inbound requests

---

## Adspirer — Brand & Ads Context

### Brand Overview

- **Product:** OpenClaw Service Matchmaker — AI phone concierge for local service provider discovery
- **Value Prop:** One phone call replaces five — AI finds, vets, and connects callers to the best local provider
- **Monetization:** BuyMeACoffee tip links sent via SMS after successful connections
- **Vertical:** Services / Technology (AI SaaS)
- **Target Audience:** Consumers needing local service providers (plumbers, electricians, etc.)

### Connected Ad Platforms

| Platform | Account | Status |
|----------|---------|--------|
| **Meta Ads** (Facebook/Instagram) | Pierre-Marc Cardinal (`2985765295038102`) | Connected — initial sync in progress |
| Google Ads | — | Not connected |
| LinkedIn Ads | — | Not connected |
| TikTok Ads | — | Not connected |

Connect additional platforms at: https://adspirer.ai/connections

### Performance Snapshot (as of 2026-03-14)

- **Meta Ads:** Account recently connected — initial data sync in progress. Metrics will be available within a few hours.
- **Google/LinkedIn/TikTok:** Not connected — no data available.

### KPI Targets (Services/Technology Vertical)

| Metric | Typical | Good | Excellent |
|--------|---------|------|-----------|
| ROAS | 3.0x | 5.0x | 7.0x |
| CTR (Search) | 3-5% | 5%+ | 7%+ |
| Conversion Rate | 2-5% | 5%+ | 8%+ |

### Adspirer Commands

| Command | Description |
|---------|-------------|
| `/adspirer:performance-review` | Cross-platform performance review |
| `/adspirer:wasted-spend` | Find and fix wasted ad spend |
| `/adspirer:write-ad-copy` | Brand-voice ad copy for any platform |
| `/adspirer:refresh-brand-context` | Re-scan and update this section |

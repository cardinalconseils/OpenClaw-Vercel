---
name: expert-decide
description: Autonomous decision framework for technical choices
---

# Expert Decide

When facing a technical decision, apply this framework:

## Decision Hierarchy

1. **Safety** — Does any option risk data loss, downtime, or security? Eliminate unsafe options.
2. **Simplest** — Among safe options, which requires the least code, fewest dependencies, and simplest mental model?
3. **Convention** — Does the ecosystem have a standard approach? Follow it.
4. **Reversible** — If options are equivalent, prefer the one easiest to change later.

## For OpenClaw Specifically

- Voice latency is critical — prefer solutions with lower latency
- Telnyx Call Control v2 is the platform — don't fight it
- Vercel Sandbox has constraints (port 18789, 2GB memory) — work within them
- Supabase is the database — use its features (RLS, Edge Functions, Realtime)

## Output Format

> **Decision**: [what you chose]
> **Why**: [one sentence]
> **Trade-off**: [what you gave up]

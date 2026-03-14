---
description: Generate session handoff summary
allowed-tools: Read, Glob, Grep, Bash, Write
---

Generate a handoff summary for the next session:

1. **What was done** — List changes made in this session
2. **Current state** — What's working, what's not
3. **Next steps** — What should be done next (prioritized)
4. **Blockers** — Any issues that need attention
5. **Context** — Important decisions made and why

Write the handoff to `.claude/temp/handoff-$(date +%Y%m%d-%H%M).md`.

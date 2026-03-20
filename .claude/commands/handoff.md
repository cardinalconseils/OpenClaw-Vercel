---
description: Generate session handoff summary with full context
allowed-tools: Read, Glob, Grep, Bash, Write
---

# Session Handoff

Generate a handoff summary for the next session:

## 1. Changes Made
- Run `git diff --name-only` and `git log --oneline -10` to list what was done
- Summarize changes by area (components, tests, config, etc.)

## 2. Current State
- What's working, what's not
- Any failing tests or lint errors
- Current branch and commit status

## 3. Automation State
- List all configured automations:
  - Hooks in `.claude/settings.json`
  - Agents in `.claude/agents/`
  - Skills in `.claude/skills/`
  - Commands in `.claude/commands/`
  - MCP servers (check `claude mcp list` output)
- Note any that were added or modified this session

## 4. Next Steps
- Prioritized list of what should be done next
- Any blockers or decisions needed

## 5. Context
- Important decisions made and why
- Anything non-obvious about the current state

Write the handoff to `.claude/temp/handoff-$(date +%Y%m%d-%H%M).md`.

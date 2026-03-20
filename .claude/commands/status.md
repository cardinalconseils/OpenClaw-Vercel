---
description: Frontend project health overview
allowed-tools: Read, Glob, Grep, Bash
---

# Frontend Status Dashboard

Provide a concise project health overview:

## 1. Git State
- Current branch, uncommitted changes, recent commits
- Count of modified/untracked files

## 2. Code Stats
- Count components in `src/components/ui/`, `src/components/dashboard/`, `src/components/landing/`
- Count test files and total test count
- Count pages/routes in `src/app/`

## 3. Quick Health Checks

Run in parallel:
```bash
npx tsc --noEmit 2>&1 | tail -5       # TypeScript errors
npx next lint 2>&1 | tail -5           # Lint issues
npm test 2>&1 | tail -10               # Test results
```

## 4. TODO/FIXME Scan
- Search for TODO, FIXME, HACK comments in `src/`
- Report count and locations

## 5. Automation Status
- List configured hooks in `.claude/settings.json`
- List available agents in `.claude/agents/`
- List available skills in `.claude/skills/`
- List available commands in `.claude/commands/`

Present as a concise dashboard with pass/fail indicators.

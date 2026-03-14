---
description: Project health overview
allowed-tools: Read, Glob, Grep, Bash
---

Provide a project health overview:

1. **Git status** — Current branch, uncommitted changes, recent commits
2. **Project state** — Read `.planning/PROJECT.md` for current milestone and phase
3. **Code stats** — Count files, lines of code by directory
4. **Dependencies** — Check for outdated packages (if package.json exists)
5. **Tests** — Run tests if configured, report pass/fail
6. **Open issues** — Check for TODO/FIXME/HACK comments in code

Present as a concise dashboard.

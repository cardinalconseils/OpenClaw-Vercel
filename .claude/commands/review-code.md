---
description: Quick review of recent changes
allowed-tools: Read, Glob, Grep, Bash
---

Review recently changed files for code quality issues:

1. Run `git diff --name-only HEAD~3` to find recently modified files
2. Read each changed file
3. Check for:
   - Code style violations
   - Missing error handling
   - TypeScript strict mode issues
   - Untested code paths
4. Provide actionable feedback

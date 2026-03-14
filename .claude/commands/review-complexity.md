---
description: Find overly complex code
allowed-tools: Read, Glob, Grep, Bash
---

Scan the codebase for complexity issues:

1. Files over 300 lines
2. Functions over 50 lines
3. Deeply nested code (>3 levels)
4. High cyclomatic complexity
5. Long parameter lists (>4 params)
6. God objects or modules with too many responsibilities

For each finding, suggest how to simplify (extract function, split file, use patterns, etc.).

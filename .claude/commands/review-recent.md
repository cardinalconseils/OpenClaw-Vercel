---
description: Review recently modified files
allowed-tools: Read, Glob, Grep, Bash
---

Review files modified in the last 24 hours:

1. Find recently modified files: `find src/ -name '*.ts' -mtime -1`
2. Read each file
3. Check for common issues introduced in recent changes
4. Focus on: correctness, error handling, type safety
5. Provide quick feedback

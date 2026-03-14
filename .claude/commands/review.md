---
description: Full codebase review (security + quality)
allowed-tools: Read, Glob, Grep, Bash, Agent
---

Perform a comprehensive code review of the OpenClaw project. Cover:

1. **Security scan** — Check for hardcoded secrets, unvalidated inputs, SQL injection, XSS, missing Telnyx webhook validation
2. **Code quality** — Files over 300 lines, complex functions, `any` types, missing error handling
3. **Voice pipeline** — WebSocket cleanup, audio buffer management, call state consistency
4. **Telnyx integration** — Proper Call Control v2 usage, webhook signature validation
5. **Dependencies** — Known vulnerabilities, outdated packages

Report findings by severity: CRITICAL, HIGH, MEDIUM, LOW.
For each finding, include file path, line number, and suggested fix.

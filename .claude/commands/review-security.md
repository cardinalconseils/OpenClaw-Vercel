---
description: Security-focused code scan
allowed-tools: Read, Glob, Grep, Bash
---

Perform a security-focused scan of the OpenClaw codebase:

1. **Secrets** — Search for hardcoded API keys, tokens, passwords
2. **Telnyx webhooks** — Verify all webhook endpoints validate signatures
3. **Input validation** — Check all external data inputs are sanitized
4. **SQL injection** — Verify parameterized queries used everywhere
5. **Rate limiting** — Check API endpoints have rate limits
6. **PII handling** — Ensure phone numbers and caller data are handled securely
7. **WebSocket security** — Check origin validation, auth on WS connections
8. **Environment** — Verify no .env files committed, .gitignore correct

Report as: CRITICAL (fix now), HIGH (fix before deploy), MEDIUM (fix soon), LOW (nice to have).

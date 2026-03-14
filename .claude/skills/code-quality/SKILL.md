---
name: code-quality
description: Code review workflows — full, security, recent changes, doc sync
---

# Code Quality

## Review Types

### Full Review (`/review`)
Run all checks: security + quality + conventions + voice pipeline.

### Security Review (`/review-security`)
Focus on: secrets, webhook validation, input sanitization, SQL injection, PII handling.

### Recent Changes (`/review-recent`)
Quick scan of files modified in last 24h.

### Complexity Review (`/review-complexity`)
Find files >300 lines, functions >50 lines, deep nesting.

## Quality Standards for OpenClaw

### Must Have
- TypeScript strict mode
- Typed errors (no `throw new Error("string")`)
- Structured logging with context (callSid, requestId)
- Telnyx webhook signature validation on all endpoints
- Input validation with Zod schemas

### Should Have
- Tests co-located with source
- Functions under 30 lines
- Single responsibility per module
- Consistent error handling pattern (Result type)

### Nice to Have
- JSDoc on exported functions
- Performance benchmarks for voice pipeline
- Load test scenarios

---
description: Generate PRD with task list
allowed-tools: Read, Glob, Grep, Write
---

Generate a Product Requirements Document based on the current project state:

1. Read `.planning/PROJECT.md` and `docs/prd.md` for context
2. Analyze existing code to understand current implementation
3. Generate a PRD covering:
   - Problem statement
   - User personas
   - User stories (with acceptance criteria)
   - Technical requirements
   - Non-functional requirements (latency, reliability, security)
   - Task breakdown with priorities
   - Dependencies and risks

Write the PRD to `docs/prd-generated.md`.

Use $ARGUMENTS for any specific focus area.

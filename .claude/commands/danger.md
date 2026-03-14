---
description: Skip confirmations for this task (use carefully)
allowed-tools: Read, Glob, Grep, Bash, Write, Edit
---

The user has explicitly requested to skip confirmation prompts for this task. Proceed with autonomous execution but still:

1. Do NOT delete files without stating what you're deleting
2. Do NOT push to remote without stating the branch
3. Do NOT modify .env files
4. Log every significant action

Task: $ARGUMENTS

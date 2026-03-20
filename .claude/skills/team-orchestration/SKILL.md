---
name: team-orchestration
description: Multi-agent team creation and coordination
---

# Team Orchestration

## When to Use Multiple Agents

- **Large features** spanning multiple concerns (API + UI + tests)
- **Review + fix** cycles (reviewer finds issues, coder fixes them)
- **Parallel work** on independent modules

## Coordination Patterns

### Sequential Pipeline
```
code-reviewer → findings → fix → code-reviewer (verify)
```

### Parallel Specialists
```
e2e-test-specialist ──┐
                      ├── merge results
uat-specialist ───────┘
```

### Orchestrated
```
agent-orchestrator
  ├── delegates to frontend-designer (UI work)
  ├── delegates to e2e-test-specialist (test work)
  └── delegates to documentation-specialist (doc work)
```

## Rules

1. Never have two agents editing the same file
2. Always review agent output before committing
3. Use the orchestrator for tasks spanning 3+ agents

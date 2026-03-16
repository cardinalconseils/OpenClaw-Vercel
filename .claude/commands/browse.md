---
description: Browser automation — open websites, fill forms, click buttons, take screenshots, extract data, configure external portals
allowed-tools: Read, Glob, Grep, Bash, Write, Edit, Agent
---

# Browser Automation

You are executing a browser automation task using `agent-browser`. Load the skill for full reference:

- **Skill**: `.claude/skills/agent-browser/SKILL.md`

## Prerequisites Check

Before starting, verify agent-browser is installed:

```bash
agent-browser --version || echo "NOT INSTALLED — run: npm install -g agent-browser && agent-browser install"
```

## Execution Protocol

### Step 1: Determine Intent

Parse the user's request to identify:
- **Target URL** — where to navigate
- **Goal** — what to accomplish (configure, extract, verify, test)
- **Authentication** — whether login is needed

### Step 2: Session Setup

Choose the right session strategy:

```bash
# For portals that need auth persistence (Telnyx, Vercel, Supabase)
agent-browser --session-name <portal-name> open <url>

# For one-off tasks
agent-browser open <url>

# To connect to user's already-authenticated browser
agent-browser --auto-connect open <url>
```

### Step 3: Navigate & Interact

Follow the core workflow:

1. `agent-browser open <url>` — Navigate
2. `agent-browser wait --load networkidle` — Wait for page load
3. `agent-browser snapshot -i` — Get interactive elements with refs
4. Interact using refs (`@e1`, `@e2`, etc.)
5. Re-snapshot after every navigation or DOM change

### Step 4: Verify & Report

After completing the task:
- Take a screenshot for visual confirmation: `agent-browser screenshot`
- Extract relevant data: `agent-browser get text @eN`
- Report results back to the user

### Step 5: Cleanup

Always close the session:

```bash
agent-browser close
```

## Common Automation Targets

### Telnyx Portal (portal.telnyx.com)

- Create Call Control Applications
- Configure webhook URLs
- Buy/assign phone numbers
- Copy Connection IDs and API keys

### Vercel Dashboard (vercel.com)

- Check deployment status
- Manage environment variables
- View runtime logs
- Monitor build output

### Supabase Dashboard

- Check database tables
- View API settings
- Monitor usage

## Safety Rules

1. **Never type real passwords in plain text** — use environment variables: `agent-browser fill @e1 "$PASSWORD"`
2. **Never screenshot pages with visible secrets** — scroll past sensitive areas first
3. **Always close sessions** — avoid leaked browser processes
4. **Re-snapshot after every page change** — refs become stale

## Arguments

Target: $ARGUMENTS

If no arguments provided, ask the user what they'd like to automate.

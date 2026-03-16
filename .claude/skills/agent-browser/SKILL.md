---
name: agent-browser
description: Browser automation CLI for AI agents. Use when the user needs to interact with websites, including navigating pages, filling forms, clicking buttons, taking screenshots, extracting data, testing web apps, or automating any browser task. Triggers include requests to "open a website", "fill out a form", "click a button", "take a screenshot", "scrape data from a page", "test this web app", "login to a site", "automate browser actions", "configure Telnyx portal", "check Vercel dashboard", or any task requiring programmatic web interaction.
allowed-tools: Bash(agent-browser:*), Bash(npx agent-browser:*)
---

# Browser Automation with agent-browser

Headless browser automation CLI for AI agents. Uses Chrome/Chromium via CDP directly.

## Prerequisites

```bash
npm install -g agent-browser   # Install globally
agent-browser install           # Download Chrome (first time only)
```

## Core Workflow

Every browser automation follows this pattern:

1. **Navigate**: `agent-browser open <url>`
2. **Snapshot**: `agent-browser snapshot -i` (get element refs like `@e1`, `@e2`)
3. **Interact**: Use refs to click, fill, select
4. **Re-snapshot**: After navigation or DOM changes, get fresh refs

```bash
agent-browser open https://example.com/form
agent-browser snapshot -i
# Output: @e1 [input type="email"], @e2 [input type="password"], @e3 [button] "Submit"

agent-browser fill @e1 "user@example.com"
agent-browser fill @e2 "password123"
agent-browser click @e3
agent-browser wait --load networkidle
agent-browser snapshot -i  # Check result
```

## Ref Lifecycle (Critical)

Refs (`@e1`, `@e2`, etc.) are invalidated when the page changes. Always re-snapshot after:

- Clicking links or buttons that navigate
- Form submissions
- Dynamic content loading (dropdowns, modals)

```bash
agent-browser click @e5              # Navigates to new page
agent-browser snapshot -i            # MUST re-snapshot
agent-browser click @e1              # Use new refs
```

## Command Chaining

Chain commands with `&&` when you don't need intermediate output:

```bash
agent-browser open https://example.com && agent-browser wait --load networkidle && agent-browser snapshot -i
```

Run separately when you need to parse output (e.g., snapshot to discover refs, then interact).

## Essential Commands

### Navigation & Lifecycle

```bash
agent-browser open <url>              # Navigate (aliases: goto, navigate)
agent-browser close                   # Close browser
```

### Snapshot & Screenshots

```bash
agent-browser snapshot -i             # Interactive elements with refs (recommended)
agent-browser snapshot -i -C          # Include cursor-interactive elements
agent-browser snapshot -s "#selector" # Scope to CSS selector
agent-browser screenshot              # Screenshot to temp dir
agent-browser screenshot --full       # Full page screenshot
agent-browser screenshot --annotate   # Annotated with numbered element labels
agent-browser screenshot page.png     # Save to specific path
agent-browser pdf output.pdf          # Save as PDF
```

### Interaction (use @refs from snapshot)

```bash
agent-browser click @e1               # Click element
agent-browser click @e1 --new-tab     # Click and open in new tab
agent-browser fill @e2 "text"         # Clear and type text
agent-browser type @e2 "text"         # Type without clearing
agent-browser select @e1 "option"     # Select dropdown option
agent-browser check @e1               # Check checkbox
agent-browser uncheck @e1             # Uncheck checkbox
agent-browser press Enter             # Press key
agent-browser keyboard type "text"    # Type at current focus
agent-browser scroll down 500         # Scroll page
agent-browser scroll down 500 --selector "div.content"  # Scroll in container
agent-browser drag <src> <tgt>        # Drag and drop
agent-browser upload <sel> <files>    # Upload files
```

### Get Information

```bash
agent-browser get text @e1            # Get element text
agent-browser get url                 # Get current URL
agent-browser get title               # Get page title
agent-browser get html @e1            # Get innerHTML
agent-browser get value @e1           # Get input value
agent-browser get attr @e1 <attr>     # Get attribute
agent-browser get count <sel>         # Count matching elements
```

### Wait

```bash
agent-browser wait @e1                # Wait for element
agent-browser wait --load networkidle # Wait for network idle
agent-browser wait --url "**/page"    # Wait for URL pattern
agent-browser wait --text "Welcome"   # Wait for text to appear
agent-browser wait 2000               # Wait milliseconds
agent-browser wait --fn "!document.body.innerText.includes('Loading...')"  # JS condition
agent-browser wait "#spinner" --state hidden  # Wait for element to disappear
```

### Semantic Locators (Alternative to Refs)

```bash
agent-browser find text "Sign In" click
agent-browser find label "Email" fill "user@test.com"
agent-browser find role button click --name "Submit"
agent-browser find placeholder "Search" type "query"
agent-browser find testid "submit-btn" click
```

### Diff (Verify Changes)

```bash
agent-browser snapshot -i              # Take baseline
agent-browser click @e2                # Perform action
agent-browser diff snapshot            # See what changed
agent-browser diff screenshot --baseline before.png  # Visual diff
```

## Authentication Patterns

### Session Persistence (Recommended)

```bash
# Login once — state auto-saved
agent-browser --session-name myapp open https://app.example.com/login
# ... fill credentials, submit ...
agent-browser close

# Next time — state auto-restored
agent-browser --session-name myapp open https://app.example.com/dashboard
```

### Connect to User's Browser

```bash
# Connect to already-authenticated Chrome
agent-browser --auto-connect open https://portal.telnyx.com
agent-browser --auto-connect snapshot -i
```

### State File

```bash
# Save state after login
agent-browser state save ./auth.json

# Reuse later
agent-browser state load ./auth.json
agent-browser open https://app.example.com/dashboard
```

## OpenClaw-Specific Patterns

### Telnyx Portal Configuration

```bash
agent-browser --session-name telnyx open https://portal.telnyx.com
agent-browser wait --load networkidle && agent-browser snapshot -i
# Navigate to Voice > Call Control Applications
# Create app, copy Connection ID
# Assign phone number to app
agent-browser close
```

### Vercel Dashboard Monitoring

```bash
agent-browser --session-name vercel open https://vercel.com/dashboard
agent-browser wait --load networkidle && agent-browser snapshot -i
# Check deployment status, environment variables, logs
agent-browser close
```

### Post-Deploy Verification

```bash
# Screenshot the deployed app for visual verification
agent-browser open $PRODUCTION_URL
agent-browser wait --load networkidle
agent-browser screenshot deploy-check.png
agent-browser get title
agent-browser close
```

## Viewport & Device Emulation

```bash
agent-browser set viewport 1920 1080           # Desktop
agent-browser set viewport 375 812             # Mobile
agent-browser set viewport 1920 1080 2         # Retina (2x DPI)
agent-browser set device "iPhone 14"           # Device emulation
```

## Security

```bash
# Content boundaries (recommended for AI agents)
export AGENT_BROWSER_CONTENT_BOUNDARIES=1

# Domain allowlist
export AGENT_BROWSER_ALLOWED_DOMAINS="portal.telnyx.com,vercel.com"

# Output limits (prevent context flooding)
export AGENT_BROWSER_MAX_OUTPUT=50000
```

## Session Cleanup

Always close sessions when done:

```bash
agent-browser close                         # Close default session
agent-browser --session-name myapp close    # Close named session
agent-browser session list                  # Check active sessions
```

## Visual Debugging

```bash
agent-browser --headed open https://example.com  # Visible browser
agent-browser highlight @e1                        # Highlight element
agent-browser inspect                              # Open DevTools
```

## JavaScript Evaluation

```bash
# Simple expressions
agent-browser eval 'document.title'

# Complex JS — use --stdin to avoid shell quoting issues
agent-browser eval --stdin <<'EVALEOF'
JSON.stringify(Array.from(document.querySelectorAll("a")).map(a => a.href))
EVALEOF
```

## Error Recovery

| Issue | Resolution |
|-------|------------|
| Stale refs after navigation | Re-snapshot: `agent-browser snapshot -i` |
| Page not loaded | Wait: `agent-browser wait --load networkidle` |
| Element not found | Try semantic locator: `agent-browser find text "..." click` |
| Leaked daemon process | Clean up: `agent-browser close` |
| Auth expired | Re-login or load saved state |
| Timeout on slow page | Set `AGENT_BROWSER_DEFAULT_TIMEOUT=60000` |

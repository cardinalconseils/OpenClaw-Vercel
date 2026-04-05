#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# OpenClaw + ClawdTalk Startup Script
# Runs on: Railway, Vercel Sandbox, VPS, or local machine
#
# Required env vars:
#   CLAWDTALK_API_KEY   - ClawdTalk API key (cc_live_...)
#   CLAWDTALK_BOT_ID    - ClawdTalk bot ID (bot_...)
#
# Optional env vars:
#   OPENCLAW_GATEWAY_PORT  - Gateway port (default: 18789)
#   OPENROUTER_API_KEY     - OpenRouter LLM key
#   ANTHROPIC_API_KEY      - Anthropic LLM key
#   TELNYX_API_KEY         - Telnyx voice/SMS key
#   TELNYX_CONNECTION_ID   - Telnyx connection ID
#   TELNYX_PHONE_NUMBER    - Telnyx phone number
#   OWNER_NAME             - Bot owner name (default: Murphy)
#   AGENT_NAME             - Bot agent name (default: Murphy)
# ============================================================================

GATEWAY_PORT="${OPENCLAW_GATEWAY_PORT:-18789}"
OWNER="${OWNER_NAME:-Murphy}"
AGENT="${AGENT_NAME:-Murphy}"
SKILLS_DIR="${HOME}/clawd/skills"
CLAWDTALK_DIR="${SKILLS_DIR}/clawdtalk-client"
OPENCLAW_DIR="${HOME}/.openclaw"
MAX_WAIT=30

log() { echo "[startup] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"; }
die() { log "FATAL: $*"; exit 1; }

# ---------------------------------------------------------------------------
# 1. Validate required env vars
# ---------------------------------------------------------------------------
log "Checking required environment variables..."
[[ -z "${CLAWDTALK_API_KEY:-}" ]] && die "CLAWDTALK_API_KEY is not set"
[[ -z "${CLAWDTALK_BOT_ID:-}" ]] && die "CLAWDTALK_BOT_ID is not set"
log "Environment OK"

# ---------------------------------------------------------------------------
# 2. Install openclaw CLI if missing
# ---------------------------------------------------------------------------
if ! command -v openclaw &>/dev/null; then
  log "Installing openclaw CLI via npx (first run)..."
  npx openclaw --version || die "Failed to install openclaw"
fi

# ---------------------------------------------------------------------------
# 3. Write openclaw.json config
# ---------------------------------------------------------------------------
log "Writing openclaw.json..."
mkdir -p "${OPENCLAW_DIR}"
cat > "${OPENCLAW_DIR}/openclaw.json" <<CONF
{
  "gateway": {
    "bind": "loopback",
    "port": ${GATEWAY_PORT},
    "mode": "local",
    "tools": {
      "allow": ["sessions_send"]
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "openrouter/google/gemini-2.5-flash-lite",
        "fallbacks": ["anthropic/claude-sonnet-4-5"]
      }
    }
  }
}
CONF
log "Config written to ${OPENCLAW_DIR}/openclaw.json"

# ---------------------------------------------------------------------------
# 4. Pre-pair device (workaround for sandbox/container pairing bug)
# ---------------------------------------------------------------------------
log "Pre-pairing device..."
if [[ -f "src/startup/pair-device.ts" ]]; then
  npx tsx src/startup/pair-device.ts 2>&1 || log "WARN: pair-device failed (non-fatal)"
else
  log "WARN: pair-device.ts not found, skipping"
fi

# ---------------------------------------------------------------------------
# 5. Write Murphy workspace files
# ---------------------------------------------------------------------------
log "Writing workspace files..."
if [[ -f "src/startup/openclaw-config.ts" ]]; then
  npx tsx -e "
    const { writeWorkspaceFiles } = require('./src/startup/openclaw-config.ts');
    writeWorkspaceFiles();
  " 2>&1 || log "WARN: writeWorkspaceFiles failed (non-fatal)"
fi

# ---------------------------------------------------------------------------
# 6. Start OpenClaw Gateway
# ---------------------------------------------------------------------------
log "Starting OpenClaw Gateway on port ${GATEWAY_PORT}..."

# Kill any existing gateway
pkill -f "openclaw-gateway" 2>/dev/null || true
sleep 1

npx openclaw gateway --port "${GATEWAY_PORT}" --auth none &
GATEWAY_PID=$!
log "Gateway process started (PID: ${GATEWAY_PID})"

# Wait for gateway to become healthy
log "Waiting for gateway health..."
for attempt in $(seq 1 ${MAX_WAIT}); do
  if curl -s -o /dev/null -w '' "http://127.0.0.1:${GATEWAY_PORT}/" 2>/dev/null; then
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${GATEWAY_PORT}/")
    if [[ "$http_code" == "200" ]]; then
      log "Gateway healthy after ${attempt}s"
      break
    fi
  fi
  if [[ $attempt -eq $MAX_WAIT ]]; then
    die "Gateway failed to become healthy after ${MAX_WAIT}s"
  fi
  sleep 1
done

# ---------------------------------------------------------------------------
# 7. Install ClawdTalk client skill
# ---------------------------------------------------------------------------
log "Setting up ClawdTalk client..."
mkdir -p "${SKILLS_DIR}"

if [[ ! -d "${CLAWDTALK_DIR}" ]]; then
  log "Cloning clawdtalk-client..."
  git clone https://github.com/team-telnyx/clawdtalk-client.git "${CLAWDTALK_DIR}" 2>&1 \
    || die "Failed to clone clawdtalk-client"
else
  log "ClawdTalk client already installed, pulling latest..."
  (cd "${CLAWDTALK_DIR}" && git pull --ff-only 2>&1) || log "WARN: git pull failed"
fi

# Install dependencies
log "Installing ClawdTalk dependencies..."
(cd "${CLAWDTALK_DIR}" && npm install --production 2>&1) || die "npm install failed"

# ---------------------------------------------------------------------------
# 8. Write ClawdTalk skill-config.json
# ---------------------------------------------------------------------------
log "Writing ClawdTalk config..."
cat > "${CLAWDTALK_DIR}/skill-config.json" <<CTCONF
{
  "api_key": "${CLAWDTALK_API_KEY}",
  "server": "https://clawdtalk.com",
  "owner_name": "${OWNER}",
  "agent_name": "${AGENT}",
  "greeting": "Hey, this is ${AGENT}! How can I help you find a service provider today?",
  "max_conversation_turns": 20,
  "gateway_url": "http://127.0.0.1:${GATEWAY_PORT}",
  "gateway_token": "",
  "agent_id": "main"
}
CTCONF
log "ClawdTalk config written"

# ---------------------------------------------------------------------------
# 9. Start ClawdTalk WebSocket client
# ---------------------------------------------------------------------------
log "Starting ClawdTalk WebSocket client..."
(cd "${CLAWDTALK_DIR}" && bash scripts/connect.sh start 2>&1) \
  || die "Failed to start ClawdTalk client"

# Give it a moment to connect
sleep 5

# Check status
log "Checking ClawdTalk status..."
(cd "${CLAWDTALK_DIR}" && bash scripts/connect.sh status 2>&1)

# ---------------------------------------------------------------------------
# 10. Start Next.js frontend (if in sandbox/dev mode)
# ---------------------------------------------------------------------------
if [[ "${START_NEXTJS:-false}" == "true" ]]; then
  log "Starting Next.js dev server on port 3000..."
  npx next dev --port 3000 &
  NEXT_PID=$!
  log "Next.js started (PID: ${NEXT_PID})"
fi

# ---------------------------------------------------------------------------
# 11. Health summary
# ---------------------------------------------------------------------------
echo ""
echo "============================================"
echo "  OpenClaw + ClawdTalk Startup Complete"
echo "============================================"
echo ""
echo "  Gateway:    http://127.0.0.1:${GATEWAY_PORT} (PID: ${GATEWAY_PID})"
echo "  ClawdTalk:  Connected to wss://clawdtalk.com"
echo "  Bot ID:     ${CLAWDTALK_BOT_ID}"
echo "  Agent:      ${AGENT}"
echo ""
echo "  Logs:"
echo "    Gateway:   /tmp/openclaw/openclaw-$(date -u +%Y-%m-%d).log"
echo "    ClawdTalk: ${CLAWDTALK_DIR}/.connect.log"
echo ""
echo "  Commands:"
echo "    Status:    cd ${CLAWDTALK_DIR} && bash scripts/connect.sh status"
echo "    Restart:   cd ${CLAWDTALK_DIR} && bash scripts/connect.sh restart"
echo "    Stop:      cd ${CLAWDTALK_DIR} && bash scripts/connect.sh stop"
echo "============================================"

# ---------------------------------------------------------------------------
# 12. Keep alive — wait for gateway process
# ---------------------------------------------------------------------------
log "Startup complete. Waiting for gateway process..."
wait ${GATEWAY_PID}
